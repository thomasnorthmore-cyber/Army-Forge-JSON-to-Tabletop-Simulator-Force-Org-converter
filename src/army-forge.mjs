/* Stage 3: strict local Army Forge resolver. No live code generation. */
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
 const grantRules=new Map([['Rending in Melee',[false,'Rending']],['Shred in Melee',[false,'Shred']],['Unstoppable in Melee',[false,'Unstoppable']],['Shred when Shooting',[true,'Shred']],['Anti-Cover when Shooting',[true,'Anti-Cover']],['Unstoppable when Shooting',[true,'Unstoppable']]]);
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
  const options=[], sectionUses=new Map(), instanceIds=new Set();
  let upgradeCost=0;
  for(const up of arr(selection.selectedUpgrades)){
   if(!up.instanceId||instanceIds.has(up.instanceId))fail('Duplicate or missing upgrade instance ID');
   instanceIds.add(up.instanceId);
   const matches=arr(book.upgradePackages).filter(p=>arr(u.upgrades).includes(p.uid)).flatMap(p=>arr(p.sections)).filter(s=>s.id===up.upgradeId||s.uid===up.upgradeId);
   if(matches.length!==1)fail('Unresolved or ambiguous section '+up.upgradeId);
   const s=matches[0],o=arr(s.options).find(o=>o.id===up.optionId||o.uid===up.optionId);
   if(!o)fail('Unknown upgrade '+up.optionId);
   const cost=arr(o.costs).find(c=>c.unitId===u.id)?.cost;
   if(!Number.isFinite(cost))fail('Missing upgrade cost: '+o.label);
   if(s.variant!=='upgrade'&&s.variant!=='replace')fail('Unsupported upgrade variant '+s.variant);
   const scope=s.affects?.type||'single';
   if(!['all','any','exactly','single'].includes(scope))fail('Unsupported upgrade scope '+scope);
   if(scope==='single'&&u.size>1)fail('Unspecified multi-model upgrade scope: '+u.name);
   const state=sectionUses.get(s.uid)||{count:0,options:new Set(),models:new Set()};
   const maxChoices=s.select?.value;
   if(s.select&&!['exactly','up to','any'].includes(s.select.type))fail('Unsupported option selection limit');
   if(maxChoices!=null&&state.count>=maxChoices)fail('Too many selections: '+s.label);
   if(scope!=='any'&&state.options.has(o.uid))fail('Repeated non-repeatable option: '+o.label);
   if(!s.select&&scope!=='any'&&state.count>0)fail('Repeated upgrade section: '+s.label);
   const eligible=models.map((m,i)=>({m,i})).filter(({m,i})=>
    (scope!=='any'||!state.models.has(i)) &&
    (s.variant!=='replace'||arr(s.targets).every(t=>['weapons','items'].some(f=>m[f].some(e=>eq(e.name,t))))));
   const quantity=scope==='all'?models.length:scope==='exactly'?s.affects.value:1;
   if(!Number.isInteger(quantity)||quantity<1||eligible.length<quantity)fail('Not enough eligible models: '+s.label);
   const chosen=eligible.slice(0,quantity);
   if(scope==='all'&&chosen.length!==models.length)fail('All-model upgrade cannot be applied');
   state.count++;state.options.add(o.uid);chosen.forEach(({i})=>state.models.add(i));sectionUses.set(s.uid,state);
   // Costs in the book are per selected option, not per affected model.
   upgradeCost+=cost;
   options.push({label:o.label,costEntry:cost,scope,id:o.uid,modelIndices:chosen.map(({i})=>i+1)});
   for(const {m} of chosen){
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
   
   for(const w of m.weapons){
    const base=arr(w.specialRules).map(label), ranged=w.range>0||base.includes('Crossing Strike');
    w.effectiveRules=[...new Set([...base,...ruleNames.filter(n=>grantRules.has(n)&&grantRules.get(n)[0]===ranged).map(n=>grantRules.get(n)[1])])];
   }
   m.abilities=[...new Set(ruleNames)];
   m.tough=Math.max(0,...m.rules.filter(r=>r.name==='Tough').map(r=>Number(r.rating)||0));
   m.caster=Math.max(0,...m.rules.filter(r=>r.name==='Caster').map(r=>Number(r.rating)||0));
  }
  units.push({name:u.name,selectionId:selection.selectionId,joinToUnit:selection.joinToUnit||null,quality:u.quality,defense:u.defense,baseCost:u.cost,upgradeCost,points:u.cost+upgradeCost,options,models});
 }
 for(const u of units)if(u.joinToUnit&&(!ids.has(u.joinToUnit)||u.joinToUnit===u.selectionId))fail('Invalid attachment '+u.selectionId);
 const computedPoints=units.reduce((n,u)=>n+u.points,0);
 if(Number.isFinite(roster.listPoints)&&computedPoints!==roster.listPoints)warnings.push('Points mismatch: declared '+roster.listPoints+', computed '+computedPoints+'.');
 const count=units.reduce((n,u)=>n+u.models.length,0);
 if(count>500)fail('Too many models');
 if(roster.list.modelCount!=null&&roster.list.modelCount!==count)fail('Model count mismatch');
 return {listName:roster.list.name,gameSystem:'gf',bookVersion:book.versionString,rosterVersion:version,declaredPoints:roster.listPoints,computedPoints,modelCount:count,units,warnings,previewOnly:true};
}
