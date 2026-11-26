import assert from 'node:assert/strict';
import {resolveArmy} from '../src/army-forge.mjs';
import {formatForceOrgPreview} from '../src/force-org.mjs';
const weapon=(name,range=0,count=1)=>({type:'ArmyBookWeapon',name,range,count,attacks:1,specialRules:[]});
const option=(uid,gains,cost=5)=>({uid,gains,costs:[{unitId:'u',cost}]});
const section=(uid,variant,affects,options,targets)=>({uid,variant,affects,options,targets,label:uid});
const book={uid:'b',gameSystemSlug:'grimdark-future',versionString:'3.6.1',units:[{id:'u',name:'Squad',size:3,quality:3,defense:4,cost:100,upgrades:['p'],weapons:[weapon('Blade',0,3),weapon('Rifle',18,3)],rules:[{name:'Tough',rating:3}]}],upgradePackages:[{uid:'p',sections:[
section('any','replace',{type:'any'},[option('sword',[weapon('Sword')])],['Blade']),
section('one','replace',{type:'exactly',value:1},[option('axe',[weapon('Axe')],10)],['Blade']),
section('item','upgrade',{type:'exactly',value:1},[option('boost',[{type:'ArmyBookItem',name:'Boost',content:[{type:'ArmyBookRule',name:'Rending in Melee'}]}])]),
section('aura','upgrade',{type:'exactly',value:1},[option('auraOption',[{type:'ArmyBookRule',name:'Unstoppable when Shooting Aura'}])])
]}]};
const roster=ups=>({gameSystem:'gf',armyVersions:[{armyId:'b',version:'3.6.1'}],list:{name:'Synthetic',modelCount:3,units:[{id:'u',armyId:'b',selectionId:'s',selectedUpgrades:ups.map(([upgradeId,optionId],i)=>({upgradeId,optionId,instanceId:'i'+i}))}]}});
const r=resolveArmy(roster([['any','sword'],['any','sword'],['one','axe'],['item','boost'],['aura','auraOption']]),book);
const ms=r.units[0].models;
assert.equal(r.computedPoints,130);
assert.deepEqual(ms.map(m=>m.weapons.find(w=>w.range===0).name),['Sword','Sword','Axe']);
assert.equal(ms.filter(m=>m.abilities.includes('Rending in Melee')).length,1);
assert.equal(ms.filter(m=>m.weapons.find(w=>w.range===0).effectiveRules.includes('Rending')).length,1);
const out=formatForceOrgPreview(r).listJson.units[0].modelDefinitions;
assert.equal(out.filter(m=>m.ttsDescriptionOutput.includes('Unstoppable when Shooting Aura')).length,1);
assert.equal(out.filter(m=>m.ttsDescriptionOutput.includes('18"  A1  Unstoppable')).length,3);
assert.throws(()=>resolveArmy(roster(Array(4).fill(['any','sword'])),book),/Not enough eligible models/);
assert.throws(()=>resolveArmy(roster([['one','axe'],['one','axe']]),book),/Repeated/);
assert.throws(()=>resolveArmy({...roster([]),armyVersions:[{armyId:'b',version:'3.6.0'}]},book),/version mismatch/);
assert.match(resolveArmy({...roster([]),listPoints:200},book).warnings[0],/Points mismatch/);
console.log('10 allocation and aura assertions passed');
