const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const R=require('../site/engine.js');
const app=fs.readFileSync(require.resolve('../site/app.js'),'utf8');
const start=app.indexOf('async function exportAll()'),end=app.indexOf('\nfunction slots()',start);
if(start<0||end<0)throw Error('Backup source not found');
function setup(characters){let file,listener;const messages=[];const ctx={R,S:{characters,active:''},window:{},Store:{snapshot:()=>true},sendFile:async(name,text)=>{file={name,text};},save:()=>{},close:()=>{},render:()=>{},toast:m=>messages.push(m),tab:'sheet',$:()=>({addEventListener:(_type,cb)=>{listener=cb;}})};vm.createContext(ctx);vm.runInContext(app.slice(start,end),ctx);return{ctx,messages,getFile:()=>file,getListener:()=>listener};}
function largeLibrary(){return Array.from({length:30},(_,i)=>{const c=R.create();c.name='Герой '+i;c.notes='т'.repeat(150000);return c;});}
test('A large exported library can be imported by the browser file picker',async()=>{const original=largeLibrary(),h=setup(original);await h.ctx.exportAll();const file=h.getFile();assert.ok(Buffer.byteLength(file.text,'utf8')>4000000);h.ctx.S={characters:[],active:''};const target={files:[{size:Buffer.byteLength(file.text,'utf8'),text:async()=>file.text}],value:'backup.json'};await h.getListener()({target});assert.equal(h.ctx.S.characters.length,30);assert.equal(h.ctx.S.characters[0].notes.length,150000);assert.equal(target.value,'');assert.match(h.messages.at(-1),/Добавлено персонажей: 30/);});
test('A large backup can be imported by a native file bridge',async()=>{const h=setup(largeLibrary());await h.ctx.exportAll();const file=h.getFile();h.ctx.S={characters:[],active:''};h.ctx.window.receiveNativeFile(file.text);assert.equal(h.ctx.S.characters.length,30);assert.equal(h.ctx.S.characters[29].name,'Герой 29');});
test('A read error is reported and clears the file selection',async()=>{const h=setup([]),target={files:[{text:async()=>{throw Error('read failed');}}],value:'backup.json'};await h.getListener()({target});assert.equal(target.value,'');assert.equal(h.messages.at(-1),'Не удалось прочитать файл.');});
