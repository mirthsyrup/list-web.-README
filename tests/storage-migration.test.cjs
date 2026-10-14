const {test}=require('node:test'),assert=require('node:assert/strict');
const R=require('../site/rules-v2.js'),{createStore}=require('../site/storage.js'),{migrate}=require('../site/storage-migration.js');
function memory(){const map=new Map();return{getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k),map};}
function state(name='Герой'){const c={...R.create(),name};return{characters:[c],active:c.id,revision:0,dirty:false};}
const load=m=>createStore(m,R.validateCharacter).load({characters:[]}).state;

test('Joins both libraries and settings while preserving modern preferences and separate themes',()=>{
 const m=memory(),a=state('Простой'),b=state('Средневековый');
 m.setItem('list-state',JSON.stringify(a));m.setItem('fantasy-list-state',JSON.stringify(b));
 m.setItem('list-feedback-v1','{"sound":false}');m.setItem('fantasy-list-feedback-v1','{"sound":true}');
 m.setItem('fantasy-list-sync','{"url":"https://example.test","auto":false}');
 m.setItem('list-theme','light');m.setItem('fantasy-list-theme','dark');
 assert.equal(migrate(m,R.validateCharacter).added,1);
 assert.deepEqual(load(m).characters.map(c=>c.name),['Простой','Средневековый']);
 assert.equal(load(m).active,a.active);assert.equal(load(m).dirty,true);
 assert.equal(m.getItem('list-feedback-v1'),'{"sound":false}');
 assert.equal(m.getItem('list-sync'),m.getItem('fantasy-list-sync'));
 assert.equal(m.getItem('list-theme'),'light');assert.equal(m.getItem('fantasy-list-theme'),'dark');
 assert.equal(m.getItem('fantasy-list-state'),JSON.stringify(b));
 const store=createStore(m,R.validateCharacter);assert(store.history().some(c=>c.label==='Средневековая версия до объединения'));
 assert.equal(migrate(m,R.validateCharacter).migrated,false);assert.equal(load(m).characters.length,2);
});

test('Recovers a fantasy mirror and avoids creating a demo on an empty first visit',()=>{
 const m=memory(),legacy={getItem:k=>m.getItem('fantasy-'+k),setItem:(k,v)=>m.setItem('fantasy-'+k,v),removeItem:k=>m.removeItem('fantasy-'+k)};
 const b=state();createStore(legacy,R.validateCharacter).save(b);m.setItem('fantasy-list-state','{broken');
 migrate(m,R.validateCharacter);assert.equal(load(m).characters[0].id,b.active);
 const empty=memory();migrate(empty,R.validateCharacter);assert.equal(load(empty).characters.length,0);
});

test('Preserves conflicting copies and retries without duplicates if writing the marker fails',()=>{
 const m=memory(),a=state(),b=structuredClone(a);b.characters[0].hp=3;
 m.setItem('list-state',JSON.stringify(a));m.setItem('fantasy-list-state',JSON.stringify(b));
 const set=m.setItem;m.setItem=(k,v)=>{if(k==='list-fantasy-migration-v1')throw Error('quota');set(k,v);};
 assert.throws(()=>migrate(m,R.validateCharacter));assert.equal(load(m).characters.length,2);
 m.setItem=set;migrate(m,R.validateCharacter);
 const chars=load(m).characters;assert.equal(chars.length,2);assert.notEqual(chars[0].id,chars[1].id);assert.equal(chars[1].hp,3);
});

test('Does not duplicate identical sheets or silently transfer rejected or over-limit libraries',()=>{
 const m=memory(),a=state();m.setItem('list-state',JSON.stringify(a));m.setItem('fantasy-list-state',JSON.stringify(a));
 assert.equal(migrate(m,R.validateCharacter).added,0);assert.equal(load(m).characters.length,1);
 const bad=memory(),b=state();b.characters[0].level=99;bad.setItem('fantasy-list-state',JSON.stringify(b));
 assert.throws(()=>migrate(bad,R.validateCharacter));assert.equal(bad.getItem('list-fantasy-migration-v1'),null);assert.equal(bad.getItem('fantasy-list-state'),JSON.stringify(b));
 const full=memory(),many={characters:Array.from({length:100},()=>state().characters[0]),active:'',revision:0,dirty:false};
 full.setItem('list-state',JSON.stringify(many));full.setItem('fantasy-list-state',JSON.stringify(state()));
 assert.throws(()=>migrate(full,R.validateCharacter));assert.equal(load(full).characters.length,100);
});

test('An interrupted shared-store write leaves the original fantasy library recoverable',()=>{
 const m=memory(),b=state();m.setItem('fantasy-list-state',JSON.stringify(b));const set=m.setItem;
 m.setItem=(k,v)=>{if(k==='list-state')throw Error('quota');set(k,v);};
 assert.throws(()=>migrate(m,R.validateCharacter));assert.equal(m.getItem('fantasy-list-state'),JSON.stringify(b));assert.equal(m.getItem('list-fantasy-migration-v1'),null);
 m.setItem=set;migrate(m,R.validateCharacter);assert.equal(load(m).characters.length,1);
});
