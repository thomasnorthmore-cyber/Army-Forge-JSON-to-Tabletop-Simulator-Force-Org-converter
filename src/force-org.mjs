// Force Org's existing modelDefinitions contract. A preview is NOT an import code.
const arr=x=>Array.isArray(x)?x:[];
const clean=x=>String(x??'').replace(/[\[\]\r\n]/g,' ').trim();
const unique=x=>[...new Set(x)];
const color=(hex,s,bold=false)=>'['+hex+']'+(bold?'[b]':'')+s+(bold?'[/b]':'')+'[-]';
const grants=new Map([['Rending in Melee',[false,'Rending']],['Shred in Melee',[false,'Shred']],['Unstoppable in Melee',[false,'Unstoppable']],['Shred when Shooting',[true,'Shred']],['Anti-Cover when Shooting',[true,'Anti-Cover']],['Unstoppable when Shooting',[true,'Unstoppable']]]);
function modelDefinition(model,unit){
 const name=clean(model.name||unit.name||'Model');
 if(!name||!Number.isInteger(unit.quality)||!Number.isInteger(unit.defense))throw Error('Invalid model statistics');
 const abilities=unique(arr(model.abilities).map(clean).filter(Boolean));
 const weapons=arr(model.weapons).map(w=>{
  if(!Number.isFinite(w.range)||w.range<0||!Number.isInteger(w.attacks)||w.attacks<1||!clean(w.name))throw Error('Invalid weapon profile on '+name);
  const base=unique(arr(w.specialRules).map(r=>clean(r.label||r.name+(r.rating!=null?'('+r.rating+')':''))));
  const crossing=base.includes('Crossing Strike'), ranged=w.range>0||crossing;
  const rules=unique([...base,...abilities.filter(a=>grants.has(a)&&grants.get(a)[0]===ranged).map(a=>grants.get(a)[1])]);
  return {name:clean(w.name),range:w.range,attacks:w.attacks,crossing,ranged,rules};
 });
 const lines=[color('A4FF61','Quality '+unit.quality+'+   Defense '+unit.defense+'+')];
 for(const [heading,group] of [
 ['Ranged weapons',weapons.filter(w=>w.ranged&&!w.crossing)],
 ['Melee weapons',weapons.filter(w=>!w.ranged)],
 ['Crossing Strike weapons',weapons.filter(w=>w.crossing)]]){
  if(!group.length)continue;
  lines.push('',color('FF6565',heading,true));
  for(const w of group){
   lines.push(color('FFE477',w.name,true),color('E8EDF2',[w.range>0?w.range+'"':'','A'+w.attacks,w.rules.join(', ')].filter(Boolean).join('  ')));
  }
 }
 const weaponRules=new Set(weapons.flatMap(w=>w.rules));
 const remaining=abilities.filter(a=>!/^Tough\(\d+\)$/i.test(a)&&!weaponRules.has(a)&&!(grants.has(a)&&weapons.some(w=>w.ranged===grants.get(a)[0]&&w.rules.includes(grants.get(a)[1]))));
 if(remaining.length)lines.push('',color('F48BDD','Abilities',true),...remaining.map(a=>color('E8EDF2',a)));
 const tough=model.tough??0,caster=model.caster??0;
 if(!Number.isInteger(tough)||tough<0||!Number.isInteger(caster)||caster<0)throw Error('Invalid Tough or Caster value');
 return {name,loadoutCSV:weapons.map(w=>w.name).join(', '),ttsNameOutput:name,ttsDescriptionOutput:lines.join('\r\n'),originalToughValue:tough,originalCasterValue:caster};
}
export function formatForceOrgPreview(resolved){
 if(resolved.gameSystem!=='gf'||!Array.isArray(resolved.units)||!resolved.units.length)throw Error('Invalid resolved army');
 const byId=new Map(resolved.units.map(u=>[u.selectionId,u]));
 if(byId.size!==resolved.units.length)throw Error('Duplicate selection IDs');
 for(const u of resolved.units){
  if(u.joinToUnit){
   const target=byId.get(u.joinToUnit);
   if(!target||target===u||target.joinToUnit)throw Error('Invalid or nested hero attachment');
  }
 }
 const units=resolved.units.filter(u=>!u.joinToUnit).map((u,i)=>{
  const members=[u,...resolved.units.filter(h=>h.joinToUnit===u.selectionId)];
  return {name:clean(u.name),selectionId:String(u.selectionId),unitId:'af_'+(i+1)+'_'+String(u.selectionId),modelDefinitions:members.flatMap(m=>m.models.map(model=>modelDefinition(model,m)))};
 });
 const modelCount=units.reduce((n,u)=>n+u.modelDefinitions.length,0);
 if(modelCount!==resolved.modelCount||modelCount>500||modelCount<1)throw Error('Model count mismatch');
 // Match the old code service listJson structure, but keep preview metadata OUTSIDE listJson.
 return {previewOnly:true,warnings:arr(resolved.warnings),bookVersion:resolved.bookVersion,rosterVersion:resolved.rosterVersion,listJson:{gameSystem:'gf',rulesVersion:String(resolved.bookVersion).split('.').slice(0,2).join('.'),listName:clean(resolved.listName||'Army Forge list'),units}};
}
