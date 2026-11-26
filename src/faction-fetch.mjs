// Public Army Forge read-only endpoint, as used by community importers.
const ORIGIN='https://army-forge.onepagerules.com';
const MAX_BYTES=5_000_000;
export function factionRequest(roster){
 if(roster?.gameSystem!=='gf'||!Array.isArray(roster.list?.units)||!roster.list.units.length)throw Error('Expected a Grimdark Future roster');
 const ids=[...new Set(roster.list.units.map(u=>u.armyId))];
 if(ids.length!==1)throw Error('Automatic retrieval currently supports one faction per roster');
 const id=ids[0];
 if(typeof id!=='string'||!/^[A-Za-z0-9_-]{1,80}$/.test(id))throw Error('Invalid faction ID');
 const version=roster.armyVersions?.find(v=>v.armyId===id)?.version;
 if(typeof version!=='string'||!/^\d+\.\d+\.\d+$/.test(version))throw Error('Missing or invalid faction version');
 return {id,version,url:ORIGIN+'/api/afs/book/'+encodeURIComponent(id)+'?gameSystem=grimdark-future'};
}
export async function fetchFactionBook(roster,{fetchImpl=globalThis.fetch,allowVersionMismatch=false,timeoutMs=12000}={}){
 const {id,version,url}=factionRequest(roster);
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{
  let response;
  try{response=await fetchImpl(url,{method:'GET',credentials:'omit',redirect:'error',headers:{Accept:'application/json'},signal:controller.signal})}
  catch(e){throw Error('Army Forge request unavailable (network, CORS or timeout). Upload the faction response manually.')}
  if(!response.ok)throw Error('Army Forge returned HTTP '+response.status+'. Upload the faction response manually.');
  if(!/application\/(?:[\w.+-]*\+)?json\b/i.test(response.headers.get('content-type')||''))throw Error('Army Forge did not return JSON. Upload the faction response manually.');
  if(Number(response.headers.get('content-length')||0)>MAX_BYTES)throw Error('Faction response too large');
  let raw;
  if(response.body?.getReader){
   const reader=response.body.getReader(),decoder=new TextDecoder();let size=0;raw='';
   try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_BYTES){await reader.cancel();throw Error('Faction response too large')}raw+=decoder.decode(value,{stream:true})}raw+=decoder.decode()}
   finally{reader.releaseLock()}
  }else{raw=await response.text();if(new TextEncoder().encode(raw).length>MAX_BYTES)throw Error('Faction response too large')}
  let book;try{book=JSON.parse(raw)}catch{throw Error('Invalid Army Forge JSON response')}
  if(book.uid!==id||book.gameSystemSlug!=='grimdark-future'||!Array.isArray(book.units)||!book.units.length||!Array.isArray(book.upgradePackages))throw Error('Army Forge returned a different or unsupported faction');
  if(typeof book.versionString!=='string'||!/^\d+\.\d+\.\d+$/.test(book.versionString))throw Error('Faction response has no valid version');
  if(book.versionString!==version&&!allowVersionMismatch)throw Error('Requested '+version+' but Army Forge returned '+book.versionString+'. Re-export your army in Army Forge or supply a matching saved faction response.');
  return book;
 }finally{clearTimeout(timer)}
}
