import assert from 'node:assert/strict';
import {formatForceOrgPreview} from '../src/force-org.mjs';
const model=(name,weapon,abilities=[],tough=0,caster=0)=>({name,weapons:[weapon],abilities,tough,caster});
const blade={name:'Blade',range:0,attacks:2,specialRules:[{name:'AP',rating:1}]};
const rifle={name:'Rifle',range:18,attacks:1,specialRules:[]};
const cross={name:'Strike pass',range:0,attacks:2,specialRules:[{name:'Crossing Strike'}]};
const unit=(selectionId,name,models,joinToUnit=null)=>({selectionId,name,models,joinToUnit,quality:3,defense:4});
const fixture={gameSystem:'gf',bookVersion:'3.6.1',rosterVersion:'3.6.0',warnings:['Version mismatch'],listName:'Test',modelCount:4,units:[
unit('a','Squad',[model('Trooper',blade,['Rending in Melee','Tough(3)'],3),model('Trooper',rifle)]),
unit('b','Hero',[model('Hero',cross,['Shred when Shooting','Caster(2)'],3,2)],'a'),
unit('c','Squad',[model('Trooper',rifle)])]};
const r=formatForceOrgPreview(fixture),[a,c]=r.listJson.units;
assert.equal(r.previewOnly,true);
assert.equal(r.warnings.length,1);
assert.equal(a.modelDefinitions.length,3);
assert.equal(c.modelDefinitions.length,1);
assert.notEqual(a.unitId,c.unitId);
assert.equal(a.modelDefinitions[0].originalToughValue,3);
assert.equal(a.modelDefinitions[1].originalToughValue,0);
assert.equal(a.modelDefinitions[2].originalCasterValue,2);
assert.match(a.modelDefinitions[0].ttsDescriptionOutput,/AP\(1\), Rending/);
assert.doesNotMatch(a.modelDefinitions[0].ttsDescriptionOutput,/Rending in Melee|Tough\(3\)/);
assert.doesNotMatch(a.modelDefinitions[1].ttsDescriptionOutput,/Rending/);
assert.match(a.modelDefinitions[2].ttsDescriptionOutput,/Crossing Strike weapons/);
assert.match(a.modelDefinitions[2].ttsDescriptionOutput,/Crossing Strike, Shred/);
assert.throws(()=>formatForceOrgPreview({...fixture,modelCount:5}),/Model count mismatch/);
assert.throws(()=>formatForceOrgPreview({...fixture,units:[...fixture.units,fixture.units[0]]}),/Duplicate selection IDs/);
assert.throws(()=>formatForceOrgPreview({...fixture,units:[fixture.units[0],{...fixture.units[1],joinToUnit:'missing'},fixture.units[2]]}),/Invalid or nested hero attachment/);
console.log('16 Force Org formatter assertions passed');
