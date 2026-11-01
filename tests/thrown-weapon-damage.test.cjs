const {test}=require('node:test'),assert=require('node:assert/strict');
const R=require('../site/engine.js');require('../site/rules-v2.js');
function strike(tags,str,enfeebled=0,effects=[]){const c=R.create();c.attributes.str=str;c.conditions.enfeebled=enfeebled;c.effects=effects;const db={weapon:{id:'weapon',type:'weapon',tags,mechanics:{range:20,category:'simple',damage:{dice:1,die:'d6'}}}};return R.strike(c,{id:'weapon'},db);}
test('Thrown weapons add full Strength to damage',()=>{assert.equal(strike(['thrown-20'],4).damage,'1к6+4');assert.equal(strike(['thrown-20'],-2).damageBonus,-2);});
test('Propulsive weapons apply enfeebled and full negative Strength',()=>{assert.equal(strike(['propulsive'],4,1).damageBonus,1);assert.equal(strike(['propulsive'],-3,1).damageBonus,-4);});
test('Ordinary ranged weapons do not add Strength or enfeebled damage penalty',()=>{assert.equal(strike([],4,2).damageBonus,0);});
test('Status penalties on Strength damage do not stack',()=>{const effects=[{active:true,rounds:null,modifiers:[{target:'damage',type:'status',value:-2}]}];assert.equal(strike(['thrown-20'],4,1,effects).damageBonus,2);assert.equal(strike(['propulsive'],4,1,effects).damageBonus,0);});
