/* Stage 1: strict local Army Forge resolver. No live code generation. */
export function resolveArmy(roster,book,{allowVersionMismatch=false}={}){
 const fail=m=>{throw Error(m)};
 const arr=x=>Array.isArray(x)?x:[];
 const clone=x=>JSON.parse(JSON.stringify(x));
 const label=r=>r.label||r.name+(r.rating!=null?'('+r.rating+')':'');
 const eq=(a,b)=>String(a).toLowerCase().replace(/s$/,'')===String(b).toLowerCase().replace(/s$/,'');
 if(roster.gameSystem!=='gf'||book.gameSystemSlug!=='grimdark-future')fail('Only Grimdark Future is supported by this prototype');
 if(!Array.isArray(roster.list?.units)||!Array.isArray(book.units))fail('Invalid roster or army book');
 if(roster.list.units.length>500)fail('Too many selections');
 const warnings=[];
 const version=roster.armyVersions?.find(v=>v.armyId===book.uid)?.version;
 if(!version||version!==book.versionString){
  if(!allowVersionMismatch)fail('Army book version mismatch: roster '+(version||'unknown')+', book '+book.versionString);
  warnings.push('Version mismatch: preview only; points and rules may differ.');
 }
 const units=[], ids=new Set();
 for(const selection of roster.list.units){
  if(selection.armyId!==book.uid)fail('Missing army book for '+selection.armyId);
  if(!selection.selectionId||ids.has(selection.selectionId))fail('Duplicate or missing selection ID');
  ids.add(selection.selectionId);
  const u=book.units.find(x=>x.id===selection.id);
  if(!u)fail('Unknown unit '+selection.id);
  if(selection.combined)fail('Combined units are not implemented');
  if(!Number.isInteger(u.size)||u.size<1||u.size>100)fail('Invalid size');
  const models=Array.from({length:u.size},()=>({name:u.name,rules:clone(arr(u.rules)),weapons:[],items:[]}));
  for(const [field,entries] of [['weapons',arr(u.weapons)],['items',arr(u.items)]]){
   for(const e of entries){
    const count=e.count??1;
    if(!Number.isInteger(count)||count<1||count%u.size!==0)fail('Uneven default equipment needs allocation: '+u.name+' '+e.name);
    for(const m of models)for(let n=0;n<count/u.size;n++)m[field].push(clone({...e,count:1}));
   }
  }
  const options=[];
  for(const up of arr(selection.selectedUpgrades)){
   const matches=arr(book.upgradePackages).filter(p=>arr(u.upgrades).includes(p.uid)).flatMap(p=>arr(p.sections)).filter(s=>s.id===up.upgradeId||s.uid===up.upgradeId);
   if(matches.length!==1)fail('Unresolved or ambiguous section '+up.upgradeId);
   const s=matches[0],o=arr(s.options).find(o=>o.id===up.optionId||o.uid===up.optionId);
   if(!o)fail('Unknown upgrade '+up.optionId);
   const cost=arr(o.costs).find(c=>c.unitId===u.id)?.cost;
   options.push({label:o.label,costEntry:cost??null,scope:s.affects?.type||'single',id:o.uid});
   if(s.variant!=='upgrade'&&s.variant!=='replace')fail('Unsupported upgrade variant '+s.variant);
   if(s.affects&&s.affects.type!=='all')fail('Unsupported upgrade scope '+s.affects.type);
   if(u.size>1&&s.affects?.type!=='all')fail('Individual upgrade allocation not implemented: '+u.name);
   for(const m of models){
    if(s.variant==='replace')for(const target of arr(s.targets)){
     const found=['weapons','items'].find(f=>m[f].some(e=>eq(e.name,target)));
     if(!found)fail('Replacement target missing: '+target);
     m[found].splice(m[found].findIndex(e=>eq(e.name,target)),1);
    }
    for(const g of arr(o.gains)){
     const field={ArmyBookWeapon:'weapons',ArmyBookItem:'items',ArmyBookRule:'rules'}[g.type];
     if(!field)fail('Unsupported gain type '+g.type);
     const count=g.count??1;
     if(!Number.isInteger(count)||count<1||count>100)fail('Invalid upgrade count');
     for(let n=0;n<count;n++)m[field].push(clone({...g,count:1}));
    }
   }
  }
  for(const m of models){
   for(const item of m.items)for(const g of arr(item.content)){
    if(g.type==='ArmyBookRule')m.rules.push(clone(g));
    else if(g.type==='ArmyBookWeapon')m.weapons.push(clone(g));
    else fail('Unsupported nested equipment '+g.type);
   }
   const ruleNames=m.rules.map(label);
   const grantMap={'Rending in Melee':['Rending',false],'Shred in Melee':['Shred',false],'Unstoppable in Melee':['Unstoppable',false],'Shred when Shooting':['Shred',true]};
   for(const w of m.weapons){
    w.effectiveRules=[...new Set([...arr(w.specialRules).map(label),...ruleNames.filter(n=>grantMap[n]&&grantMap[n][1]===(w.range>0)).map(n=>grantMap[n][0])])];
   }
   m.abilities=[...new Set(ruleNames)];
   m.tough=Math.max(0,...m.rules.filter(r=>r.name==='Tough').map(r=>Number(r.rating)||0));
   m.caster=Math.max(0,...m.rules.filter(r=>r.name==='Caster').map(r=>Number(r.rating)||0));
  }
  units.push({name:u.name,selectionId:selection.selectionId,joinToUnit:selection.joinToUnit||null,quality:u.quality,defense:u.defense,baseCost:u.cost,options,models});
 }
 for(const u of units)if(u.joinToUnit&&(!ids.has(u.joinToUnit)||u.joinToUnit===u.selectionId))fail('Invalid attachment '+u.selectionId);
 const count=units.reduce((n,u)=>n+u.models.length,0);
 if(count>500)fail('Too many models');
 if(roster.list.modelCount!=null&&roster.list.modelCount!==count)fail('Model count mismatch');
 return {listName:roster.list.name,gameSystem:'gf',bookVersion:book.versionString,rosterVersion:version,declaredPoints:roster.listPoints,modelCount:count,units,warnings,previewOnly:true};
}
