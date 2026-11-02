const test=require('node:test');
const assert=require('node:assert/strict');
const R=require('../site/engine.js');
require('../site/rules-v2.js');
test('Additional conditions persist through character validation and disclose manual effects',()=>{
  const c=R.create();
  c.conditions={blinded:1,fatigued:1,quickened:1};
  const restored=R.validateCharacter(JSON.parse(JSON.stringify(c)));
  assert.deepEqual(restored.conditions,c.conditions);
  for(const id of Object.keys(c.conditions)){
    assert.equal(R.CONDITIONS[id][2],false);
    assert.match(R.CONDITIONS[id][1],/вручную/);
  }
});
