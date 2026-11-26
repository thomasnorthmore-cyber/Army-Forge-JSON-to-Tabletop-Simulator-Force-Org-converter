import {resolveArmy} from './army-forge.mjs';
const arr=x=>Array.isArray(x)?x:[];
const count=e=>e.count??1;
const ruleKey=r=>JSON.stringify([r.name,r.rating??null]);
const gearKey=e=>JSON.stringify([e.type,e.name,e.type==='ArmyBookWeapon'?e.range:null,e.type==='ArmyBookWeapon'?e.attacks:null,arr(e.specialRules).map(ruleKey).sort(),arr(e.content).map(g=>g.type==='ArmyBookRule'?ruleKey(g):gearKey(g)).sort()]);
function inventory(entries){
 const out=new Map();
 for(const e of entries){
  if(!Number.isInteger(count(e))||count(e)<0)throw Error('Invalid loadout quantity');
  if(!count(e))continue;
  const k=gearKey(e);out.set(k,(out.get(k)||0)+count(e));
 }
 return JSON.stringify([...out].sort(([a],[b])=>a.localeCompare(b)));
}
export function resolveSharedList(data){
 if(data?.gameSystem!=='gf'||!Array.isArray(data.units)||!data.units.length||data.units.length>500)throw Error('Expected a Grimdark Future shared-list response');
 if(!Number.isInteger(data.listPoints)||data.listPoints<0||!Number.isInteger(data.modelCount)||data.modelCount<1)throw Error('Missing valid list points or model count');
 if(data.campaignMode||data.narrativeMode)throw Error('Campaign and narrative lists are not supported yet');
 const uid='shared-list',version='3.6',book={uid,gameSystemSlug:'grimdark-future',versionString:version,units:[],upgradePackages:[]};
 const roster={gameSystem:'gf',armyVersions:[{armyId:uid,version}],listPoints:data.listPoints,list:{name:data.name,modelCount:data.modelCount,units:[]}};
 for(const [i,u] of data.units.entries()){
  if(u.valid===false||u.combined||u.hasBalanceInvalid||arr(u.traits).length)throw Error('Unsupported or invalid selection: '+u.name);
  if(!Array.isArray(u.loadout)||!Array.isArray(u.rules)||!Array.isArray(u.selectedUpgrades)||!Number.isFinite(u.cost))throw Error('Missing shared-list equipment: '+u.name);
  const id='unit-'+i,p='package-'+i,sections=new Map();
  const base=e=>({...e,count:e.originalCount??e.count??1});
  book.units.push({id,name:u.name,size:u.size,quality:u.quality,defense:u.defense,cost:u.cost,rules:u.rules,weapons:arr(u.weapons).map(base),items:arr(u.items).map(base),upgrades:[p]});
  const selectedUpgrades=[];
  for(const s of u.selectedUpgrades){
   const section=s.upgrade,option=s.option;
   if(!section||!option||!Array.isArray(option.gains)||!s.instanceId)throw Error('Missing selected upgrade details');
   const sid=section.uid||section.id,oid=option.uid||option.id;
   const c=arr(option.costs).find(x=>x.unitId===u.id)?.cost;
   if(!sid||!oid||!Number.isFinite(c))throw Error('Missing selected upgrade cost or ID');
   if(!sections.has(sid))sections.set(sid,{...section,id:sid,uid:sid,options:[]});
   const target=sections.get(sid);
   if(!target.options.some(x=>x.uid===oid))target.options.push({...option,id:oid,uid:oid,costs:[{unitId:id,cost:c}]});
   selectedUpgrades.push({instanceId:s.instanceId,upgradeId:sid,optionId:oid});
  }
  book.upgradePackages.push({uid:p,sections:[...sections.values()]});
  roster.list.units.push({id,armyId:uid,selectionId:u.selectionId,joinToUnit:u.joinToUnit,selectedUpgrades});
 }
 const resolved=resolveArmy(roster,book);
 if(resolved.computedPoints!==data.listPoints||resolved.warnings.length)throw Error('Shared list points do not match reconstructed equipment');
 for(const [i,u] of data.units.entries()){
  const m=resolved.units[i].models;
  // Nested weapon quantities need additional fixtures; never silently guess them.
  if(u.loadout.some(e=>e.type==='ArmyBookItem'&&arr(e.content).some(g=>g.type!=='ArmyBookRule')))throw Error('Unsupported nested equipment: '+u.name);
  if(u.loadout.some(e=>!['ArmyBookWeapon','ArmyBookItem','ArmyBookRule'].includes(e.type)))throw Error('Unsupported loadout type: '+u.name);
  const actual=m.flatMap(x=>[...x.weapons,...x.items]).map(e=>({...e,count:1}));
  const expected=u.loadout.filter(e=>e.type!=='ArmyBookRule');
  if(inventory(actual)!==inventory(expected))throw Error('Equipped loadout mismatch: '+u.name);
  for(const r of u.loadout.filter(e=>e.type==='ArmyBookRule')){
   if(m.filter(x=>x.rules.some(y=>ruleKey(y)===ruleKey(r))).length!==count(r))throw Error('Equipped rule mismatch: '+u.name);
  }
 }
 // TTS responses lack a patch-level version. 3.6 is our configured formatter rules family, not an independently verified book version.
 return {...resolved,source:'army-forge-tts',rosterVersion:null,bookVersion:'3.6',versionVerified:false};
}
export function sharedListRequest(value){
 let url;try{url=new URL(value)}catch{throw Error('Invalid Army Forge share URL')}
 if(url.origin!=='https://army-forge.onepagerules.com'||url.pathname!=='/share'||url.username||url.password)throw Error('Use the official Army Forge share URL');
 const ids=url.searchParams.getAll('id'),id=ids[0];
 if(ids.length!==1||!id||!/^[A-Za-z0-9_-]{1,80}$/.test(id))throw Error('Invalid shared list ID');
 return {id,url:'https://army-forge.onepagerules.com/api/tts?id='+encodeURIComponent(id)};
}
export async function fetchSharedList(value,{fetchImpl=(url,init)=>globalThis.fetch(url,init),timeoutMs=15000}={}){
 const {id,url}=sharedListRequest(value);
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{
  let res;
  try{res=await fetchImpl(url,{method:'GET',redirect:'manual',credentials:'omit',headers:{Accept:'application/json'},signal:controller.signal})}
  catch(e){
   const detail=controller.signal.aborted?'Timed out after '+timeoutMs+'ms':String(e?.message||e).replace(/[\r\n]/g,' ').slice(0,240);
   console.warn('Army Forge shared-list fetch failed:',e?.name||'Error',detail);
   throw Error('Army Forge shared-list connection failed: '+detail+'. Save the API JSON in your browser and upload it instead.');
  }
  if(res.status>=300&&res.status<400)throw Error('Army Forge redirected the API request (HTTP '+res.status+'). The Worker did not follow the redirect.');
  if(!res.ok)throw Error('Army Forge shared-list HTTP '+res.status);
  if(!/application\/(?:[\w.+-]*\+)?json\b/i.test(res.headers.get('content-type')||''))throw Error('Army Forge did not return JSON');
  if(Number(res.headers.get('content-length')||0)>5000000)throw Error('Shared response too large');
  const reader=res.body.getReader(),decoder=new TextDecoder();let raw='',bytes=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>5000000){await reader.cancel();throw Error('Shared response too large')}raw+=decoder.decode(value,{stream:true})}raw+=decoder.decode()}finally{reader.releaseLock()}
  let data;try{data=JSON.parse(raw)}catch{throw Error('Invalid shared-list JSON')}
  if(data?.id!==id)throw Error('Army Forge returned an empty or different shared list');
  return data;
 }finally{clearTimeout(timer)}
}
