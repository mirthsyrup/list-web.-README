const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const app=fs.readFileSync(require.resolve('../site/app.js'),'utf8');
const start=app.indexOf('function mergeSyncCharacters('),end=app.indexOf('\nfunction importText(',start);
if(start<0||end<0)throw Error('Sync source not found');
const source=app.slice(start,end);
function setup(local,remote,base={}){
 let release,startedResolve,version=1,first=true;
 const started=new Promise(resolve=>{startedResolve=resolve;}),gate=new Promise(resolve=>{release=resolve;});
 let server=structuredClone(remote),sent=[],saved=[],messages=[];
 const ctx={S:{characters:structuredClone(local),synced:base,revision:0,dirty:true},cfg:{url:'https://example.test',token:'test',auto:false},syncBusy:false,syncTimer:null,
  R:{clone:x=>structuredClone(x),validateCharacter:x=>structuredClone(x),uid:(()=>{let i=0;return()=>`copy-${++i}`;})()},
  timedFetch:async(_url,opts)=>{if(opts.method!=='PUT')return{ok:true,json:async()=>({characters:structuredClone(server),revision:version})};
   const body=JSON.parse(opts.body);sent.push(structuredClone(body.characters));if(first){first=false;startedResolve();await gate;}
   server=structuredClone(body.characters);return{ok:true,json:async()=>({revision:++version})};},
  save:()=>{saved.push(structuredClone(ctx.S));return true;},render:()=>{},toast:m=>messages.push(m),setTimeout:()=>0,clearTimeout:()=>{},console};
 vm.createContext(ctx);vm.runInContext(source,ctx);return{ctx,started,release,sent,saved,messages,getServer:()=>server};
}
const character=(id,name)=>({id,name});
test('editing while a sync is in flight preserves server-only characters on the next sync',async()=>{
 const a=character('a','Исходный'),b=character('b','На сервере'),h=setup([a],[a,b]);
 const first=h.ctx.sync();await h.started;h.ctx.S.characters[0].name='Изменён';h.release();await first;
 assert.deepEqual(Array.from(h.ctx.S.characters,c=>c.name),['Изменён','На сервере']);assert.equal(h.ctx.S.dirty,true);
 await h.ctx.sync();assert.deepEqual(h.getServer().map(c=>c.name),['Изменён','На сервере']);assert.equal(h.ctx.S.dirty,false);
});
test('deletion during a request remains a deletion, while remote additions survive',async()=>{
 const a=character('a','A'),b=character('b','B'),h=setup([a],[a,b]);
 const first=h.ctx.sync();await h.started;h.ctx.S.characters=[];h.release();await first;
 assert.deepEqual(Array.from(h.ctx.S.characters,c=>c.id),['b']);await h.ctx.sync();assert.deepEqual(h.getServer().map(c=>c.id),['b']);
});
test('concurrent edits to one character keep both versions',async()=>{
 const old=character('a','До'),changed=character('a','На сервере'),h=setup([old],[changed],{a:JSON.stringify(old)});
 const first=h.ctx.sync();await h.started;h.ctx.S.characters[0].name='На устройстве';h.release();await first;
 assert.deepEqual(Array.from(h.ctx.S.characters,c=>c.name),['На устройстве','На сервере · другая версия']);await h.ctx.sync();assert.deepEqual(h.getServer().map(c=>c.name),['На устройстве','На сервере · другая версия']);
});
test('a full library does not mark unseen server characters as deleted',async()=>{
 const local=Array.from({length:99},(_,i)=>character('a'+i,'A'+i)),b=character('b','B'),h=setup(local,[...local,b]);
 const first=h.ctx.sync();await h.started;h.ctx.S.characters.push(character('c','C'));h.release();await first;
 assert.equal(h.ctx.S.characters.length,100);assert.equal(h.ctx.S.synced.b,undefined);assert.equal(h.ctx.S.dirty,true);
 h.ctx.S.characters=h.ctx.S.characters.filter(c=>c.id!=='c');await h.ctx.sync();assert.ok(h.getServer().some(c=>c.id==='b'));
});
test('A failed local save after synchronization warns even during automatic sync',async()=>{const a=character('a','A'),h=setup([a],[a]);h.ctx.save=()=>false;const first=h.ctx.sync(false);await h.started;h.release();await first;assert.match(h.messages.at(-1),/не сохранены на устройстве/);assert.doesNotMatch(h.messages.at(-1),/Персонажи синхронизированы/);});
