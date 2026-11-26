import {resolveArmy} from './army-forge.mjs';
import {formatForceOrgPreview} from './force-org.mjs';
import {fetchFactionBook} from './faction-fetch.mjs';
import {fetchSharedList,resolveSharedList} from './shared-list.mjs';

const TTL=600, MAX_BYTES=6_000_000, MAX_STORED=1_000_000;
const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const codePattern=/^OPR-[A-HJ-NP-Z2-9]{9}$/;
const respond=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
export function newCode(random=globalThis.crypto){
 let s='';
 // The alphabet has 32 characters, so each byte maps uniformly.
 for(const b of random.getRandomValues(new Uint8Array(9)))s+=alphabet[b%alphabet.length];
 return 'OPR-'+s;
}
async function readJSON(request){
 if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type')||''))throw Error('Expected application/json');
 if(Number(request.headers.get('content-length')||0)>MAX_BYTES)throw Error('Request too large');
 if(!request.body)throw Error('Missing request body');
 const reader=request.body.getReader(),decoder=new TextDecoder();let size=0,raw='';
 try{
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_BYTES){await reader.cancel();throw Error('Request too large')}raw+=decoder.decode(value,{stream:true})}
  raw+=decoder.decode();
 }finally{reader.releaseLock()}
 try{return JSON.parse(raw)}catch{throw Error('Invalid JSON')}
}
export function buildImport(roster,book){
 if(!roster||!book||!Number.isInteger(roster.listPoints)||roster.listPoints<0||!Number.isInteger(roster.list?.modelCount)||roster.list.modelCount<1)throw Error('Roster must declare valid points and model count');
 const resolved=resolveArmy(roster,book,{allowVersionMismatch:false});
 if(resolved.warnings.length||resolved.computedPoints!==roster.listPoints||resolved.bookVersion!==resolved.rosterVersion)throw Error('Roster validation failed: '+resolved.warnings.join('; '));
 const output=formatForceOrgPreview(resolved).listJson;
 return output;
}
export function createWorker({now=()=>Date.now(),random=globalThis.crypto,fetchBook=fetchFactionBook,fetchShare=fetchSharedList}={}){
 return {async fetch(request,env){
  const url=new URL(request.url);
  if(!url.pathname.startsWith('/api/'))return env.ASSETS?env.ASSETS.fetch(request):respond({error:'Website assets not configured'},404);
  if(request.method==='POST'&&url.pathname==='/api/preview'){
   const origin=request.headers.get('origin');
   if(origin&&origin!==url.origin)return respond({error:'Cross-origin preview refused'},403);
   let input;
   try{input=await readJSON(request);if(!input?.roster&&!input?.shareUrl&&!input?.sharedList)throw Error('Missing Army Forge roster')}
   catch(e){return respond({error:String(e.message||e)},400)}
   if(input.shareUrl||input.sharedList){
    try{const resolved=resolveSharedList(input.sharedList??await fetchShare(input.shareUrl));formatForceOrgPreview(resolved);return respond({resolved})}
    catch(e){return respond({error:String(e.message||e)},400)}
   }
   const allowVersionMismatch=input.allowVersionMismatch===true;
   let book;
   try{book=await fetchBook(input.roster,{allowVersionMismatch})}
   catch(e){return respond({error:String(e.message||e)},502)}
   try{
    const resolved=resolveArmy(input.roster,book,{allowVersionMismatch});
    // Only return selected model data; no full faction response or KV storage.
    formatForceOrgPreview(resolved);
    return respond({resolved});
   }catch(e){return respond({error:String(e.message||e)},400)}
  }
  if(!env.ARMIES)return respond({error:'KV namespace ARMIES is not configured'},503);
  if(request.method==='POST'&&url.pathname==='/api/upload'){
   // Browser requests must originate from this website.
   const origin=request.headers.get('origin');
   if(origin&&origin!==url.origin)return respond({error:'Cross-origin upload refused'},403);
   let listJson;
   try{
    const input=await readJSON(request);
    if(!input||typeof input!=='object')throw Error('Missing Army Forge roster');
    if(input.shareUrl||input.sharedList){
     const resolved=resolveSharedList(input.sharedList??await fetchShare(input.shareUrl));
     listJson=formatForceOrgPreview(resolved).listJson;
    }else{
     if(!input.roster)throw Error('Missing Army Forge roster');
     const book=input.book??await fetchBook(input.roster,{allowVersionMismatch:false});
     listJson=buildImport(input.roster,book);
    }
    for(const u of listJson.units)u.unitId=random.randomUUID();
   }catch(e){const msg=String(e.message||e);return respond({error:msg},msg==='Request too large'?413:400)}
   if(new TextEncoder().encode(JSON.stringify(listJson)).length>MAX_STORED)return respond({error:'Converted army too large'},413);
   try{
    let code;
    for(let i=0;i<5;i++){const candidate=newCode(random);if(!(await env.ARMIES.get(candidate))){code=candidate;break}}
    if(!code)return respond({error:'Unable to allocate a code; retry'},503);
    const expiresAt=now()+TTL*1000;
    await env.ARMIES.put(code,JSON.stringify({listId:code,listJson,expiresAt}),{expirationTtl:TTL});
    return respond({code,expiresAt,expiresInSeconds:TTL,units:listJson.units.length,models:listJson.units.reduce((n,u)=>n+u.modelDefinitions.length,0)});
   }catch{return respond({error:'Army storage unavailable'},503)}
  }
  if(request.method==='GET'&&url.pathname==='/api/army'){
   const code=(url.searchParams.get('code')||'').trim().toUpperCase();
   if(!codePattern.test(code))return respond({error:'Invalid army code'},400);
   try{
    const raw=await env.ARMIES.get(code);
    if(!raw)return respond({error:'Code not found or expired'},404);
    const data=JSON.parse(raw);
    if(!Number.isFinite(data.expiresAt)||now()>=data.expiresAt)return respond({error:'Code expired'},404);
    return respond({listId:data.listId,listJson:data.listJson});
   }catch{return respond({error:'Army storage unavailable'},503)}
  }
  return respond({error:'Not found'},404);
 }};
}
export default createWorker();
