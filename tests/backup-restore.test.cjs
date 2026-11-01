const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const app=fs.readFileSync(require.resolve('../site/app.js'),'utf8');
const line=app.split('\n').find(x=>x.startsWith("case 'backup-apply':"));
if(!line)throw Error('Backup action not found');
function setup({snapshot=true,saved=true}={}){const messages=[],events=[];const ctx={S:{characters:[{id:'old'}]},d:{id:'copy'},Store:{restore:()=>({characters:[{id:'restored'}]}),snapshot:()=>snapshot},save:()=>saved,close:()=>events.push('close'),render:()=>events.push('render'),toast:m=>messages.push(m)};vm.createContext(ctx);vm.runInContext(`function run(){switch('backup-apply'){${line}}}`,ctx);return{ctx,messages,events};}
test('A failed pre-restore backup leaves current characters untouched',()=>{const h=setup({snapshot:false});h.ctx.run();assert.equal(h.ctx.S.characters[0].id,'old');assert.match(h.messages.at(-1),/Не удалось сохранить текущее состояние/);assert.equal(h.events.length,0);});
test('A failed restore write warns that the restored copy is only in memory',()=>{const h=setup({saved:false});h.ctx.run();assert.equal(h.ctx.S.characters[0].id,'restored');assert.match(h.messages.at(-1),/в памяти, но не сохранена/);assert.doesNotMatch(h.messages.at(-1),/Копия восстановлена/);});
test('A successful restore reports success',()=>{const h=setup();h.ctx.run();assert.equal(h.ctx.S.characters[0].id,'restored');assert.equal(h.messages.at(-1),'Копия восстановлена.');});
