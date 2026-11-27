import assert from 'node:assert/strict';
import {resolveSharedList,sharedListRequest} from '../src/shared-list.mjs';
import {formatForceOrgPreview} from '../src/force-org.mjs';
const w=(name,count=1,range=0)=>({name,count,range,attacks:1,type:'ArmyBookWeapon',specialRules:[]});
const r={id:'fixture',name:'Synthetic',gameSystem:'gf',listPoints:105,modelCount:3,units:[{id:'u',selectionId:'s',name:'Squad',size:3,quality:3,defense:4,cost:100,rules:[{name:'Tough',rating:3}],weapons:[{...w('Blade',2),originalCount:3},w('Rifle',3,18)],items:[],selectedUpgrades:[{instanceId:'i',upgrade:{uid:'up',variant:'replace',affects:{type:'exactly',value:1},targets:['Blade']},option:{uid:'op',costs:[{unitId:'u',cost:5}],gains:[w('Axe')]}}],loadout:[w('Blade',2),w('Axe'),w('Rifle',3,18)]}]};
const resolved=resolveSharedList(r);
assert.equal(resolved.computedPoints,105);
assert.equal(resolved.modelCount,3);
assert.equal(resolved.versionVerified,false);
assert.equal(resolved.units[0].models.filter(m=>m.weapons.some(w=>w.name==='Axe')).length,1);
assert.equal(formatForceOrgPreview(resolved).listJson.units[0].modelDefinitions.length,3);
assert.throws(()=>resolveSharedList({...r,listPoints:110}),/points/);
assert.throws(()=>resolveSharedList({...r,modelCount:4}),/Model count mismatch/);
assert.throws(()=>resolveSharedList({...r,units:[{...r.units[0],loadout:[w('Blade',3),w('Rifle',3,18)]}]}),/Equipped loadout mismatch/);
assert.throws(()=>resolveSharedList({...r,units:[{...r.units[0],combined:true}]}),/Unsupported/);
assert.equal(sharedListRequest('https://army-forge.onepagerules.com/share?id=abc_123&name=Example').url,'https://army-forge.onepagerules.com/api/tts?id=abc_123');
assert.throws(()=>sharedListRequest('https://example.com/share?id=abc'),/official/);
assert.throws(()=>sharedListRequest('https://army-forge.onepagerules.com/share?id=a&id=b'),/Invalid/);
// Accept unspecified scope only when exactly one quantity fits the inventory.
const missing=(scope,qty)=>{const data=JSON.parse(JSON.stringify(r));const u=data.units[0];u.name='Synthetic multi-model unit';u.selectedUpgrades[0].upgrade.affects=scope;u.weapons=[{...w('Blade',3-qty),originalCount:3},w('Rifle',3,18)];u.loadout=[w('Blade',3-qty),w('Axe',qty),w('Rifle',3,18)];return data};
for(const scope of [undefined,{type:'single'}])for(const qty of [1,2,3]){
 const data=missing(scope,qty), resolved=resolveSharedList(data);
 assert.equal(resolved.computedPoints,105);
 assert.equal(resolved.units[0].models.filter(m=>m.weapons.some(w=>w.name==='Axe')).length,qty);
 assert.equal(resolved.units[0].models.filter(m=>m.weapons.some(w=>w.name==='Blade')).length,3-qty);
 assert.equal(data.units[0].selectedUpgrades[0].upgrade.affects,scope);
}
const impossible=missing(undefined,2);impossible.units[0].loadout=[w('Blade',1),w('Axe',1),w('Rifle',3,18)];
assert.throws(()=>resolveSharedList(impossible),/Cannot verify unspecified upgrade scope/);
const ambiguous=missing(undefined,1);ambiguous.units[0].selectedUpgrades[0].upgrade.variant='upgrade';ambiguous.units[0].selectedUpgrades[0].option.gains=[{type:'ArmyBookRule',name:'Test Rule'}];ambiguous.units[0].loadout=[w('Blade',3),w('Rifle',3,18)];
assert.throws(()=>resolveSharedList(ambiguous),/Ambiguous unspecified upgrade scope/);
const explicit=missing({type:'exactly',value:1},2);
assert.throws(()=>resolveSharedList(explicit),/Equipped loadout mismatch/);
const rule=JSON.parse(JSON.stringify(ambiguous));rule.units[0].loadout.push({type:'ArmyBookRule',name:'Test Rule',count:2});
assert.equal(resolveSharedList(rule).units[0].models.filter(m=>m.abilities.includes('Test Rule')).length,2);
console.log('Shared-list assertions passed');
