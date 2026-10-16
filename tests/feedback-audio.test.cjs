const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
const script=fs.readFileSync(path.join(__dirname,'../site/feedback-audio.js'),'utf8');
function setup(options={}){
 const dom=new JSDOM('<body></body>',{url:'https://example.test',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,contexts=[],vibrations=[],visual=[],clears=[];
 Object.defineProperty(w.navigator,'userAgent',{value:options.ios?'iPhone':'Android'});Object.defineProperty(w.navigator,'userActivation',{value:{isActive:false}});
 w.atob=globalThis.atob;w.matchMedia=()=>({matches:!!options.reduced});w.ListFeedbackVisual={emit:(...args)=>{visual.push(args);return true;},clear(){clears.push(true);}};
 if(options.vibrate!==false)w.navigator.vibrate=x=>{vibrations.push(x);return true;};
 class Param{constructor(){this.value=0;}setValueAtTime(v){this.value=v;}linearRampToValueAtTime(v){this.value=v;}exponentialRampToValueAtTime(v){assert.ok(v>0);this.value=v;}setTargetAtTime(v){this.value=v;}}
 class Node{constructor(ctx,source=false){this.ctx=ctx;this.source=source;this.gain=new Param();this.frequency=new Param();this.Q=new Param();this.disconnected=false;ctx.nodes.push(this);}connect(){}disconnect(){this.disconnected=true;}start(t){this.started=t;assert.ok(t>=0);}stop(t){if(t===undefined)this.cancelled=true;else this.end=t;}}
 class Audio{constructor(){this.state=options.suspended?'suspended':'running';this.currentTime=0;this.sampleRate=48000;this.destination={};this.nodes=[];contexts.push(this);}createGain(){return new Node(this);}createOscillator(){return new Node(this,true);}createBufferSource(){return new Node(this,true);}createBiquadFilter(){return new Node(this);}createBuffer(ch,n){const data=new Float32Array(n);return{getChannelData:()=>data};}resume(){if(!options.slowResume)this.state='running';return options.slowResume?new Promise(resolve=>{this.completeResume=()=>{this.state='running';resolve();};}):Promise.resolve();}suspend(){this.state='suspended';return Promise.resolve();}}
 if(options.audio!==false)w.AudioContext=Audio;
 if(options.storageFail)Object.defineProperty(w,'localStorage',{value:{getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}}});else if(options.saved)w.localStorage.setItem('list-feedback-v1',options.saved);
 w.eval(fs.readFileSync(path.join(__dirname,'../site/feedback-samples.js'),'utf8'));w.eval(fs.readFileSync(path.join(__dirname,'../site/interaction-samples.js'),'utf8'));w.eval(script);return{w,api:w.ListFeedback,contexts,vibrations,visual,clears,dom,gesture(){w.ListFeedback.unlock({isTrusted:true});},active(){return contexts.flatMap(c=>c.nodes).filter(n=>n.source&&n.started!==undefined&&!n.cancelled&&!n.disconnected);}};
}
test('preferences are defensive, clamped, persistent and copied',()=>{const e=setup({saved:JSON.stringify({sound:false,haptics:'yes',volume:8,visual:false})});assert.equal(e.api.prefs().volume,1);assert.equal(e.api.prefs().haptics,true);const p=e.api.prefs();p.sound=true;assert.equal(e.api.prefs().sound,false);e.api.configure({sound:true,volume:-1,haptics:false});assert.equal(e.api.prefs().volume,0);assert.equal(JSON.parse(e.w.localStorage.getItem('list-feedback-v1')).sound,true);e.dom.window.close();});
test('missing audio, vibration and blocked storage preserve visual actions',()=>{const e=setup({audio:false,vibrate:false,storageFail:true});assert.equal(e.api.capabilities().sound,false);assert.equal(e.api.capabilities().haptics,false);assert.doesNotThrow(()=>e.api.configure({sound:false}));const result=e.api.emit('heal',{hpDelta:5});assert.equal(result.sound,false);assert.equal(result.visual,true);assert.equal(e.visual[0][1].hpDelta,5);e.dom.window.close();});
test('no audio context or vibration until a gesture; synthetic click cannot unlock',()=>{const e=setup();assert.equal(e.contexts.length,0);assert.equal(e.api.emit('damage').sound,false);e.w.document.dispatchEvent(new e.w.MouseEvent('click',{bubbles:true}));assert.equal(e.contexts.length,0);assert.equal(e.vibrations.length,0);e.gesture();assert.equal(e.contexts.length,1);assert.equal(e.api.emit('damage').sound,true);assert.equal(e.api.emit('invalid').haptics,true);e.dom.window.close();});
test('all six sounds are bounded to three voices, stop disconnects sources',()=>{const e=setup();e.gesture();for(const kind of ['damage','heal','roll','critical-success','critical-failure','invalid']){e.gesture();assert.equal(e.api.emit(kind).sound,true);}assert.ok(e.active().length<=13,'Only the three latest voices survive');const remaining=e.active();e.api.stop();assert.equal(e.active().length,0);assert.ok(remaining.every(n=>n.cancelled&&n.disconnected));e.dom.window.close();});
test('normal voice endings disconnect all nodes',()=>{const e=setup();e.gesture();e.api.emit('heal');const sources=e.active();for(const n of sources)n.onended();assert.equal(e.active().length,0);e.dom.window.close();});
test('disabling sound/visual and zero volume take effect immediately',()=>{const e=setup();e.gesture();e.api.emit('damage');e.api.configure({volume:0,visual:false});assert.equal(e.active().length,0);const result=e.api.emit('heal');assert.equal(result.sound,false);assert.equal(result.visual,false);assert.equal(e.visual.length,1);e.api.configure({sound:false,volume:1});assert.equal(e.api.demo('damage').sound,false);e.dom.window.close();});
test('iPhone never invokes browser vibrate; native haptic capability is honest',()=>{const e=setup({ios:true});assert.equal(e.api.capabilities().haptics,false);e.gesture();assert.equal(e.api.emit('damage').haptics,false);assert.equal(e.vibrations.length,0);let called;e.w.NativeBridge={haptic:kind=>called=kind};assert.equal(e.api.capabilities().haptics,true);assert.equal(e.api.emit('heal').haptics,true);assert.equal(called,'heal');e.dom.window.close();});
test('native haptic errors never interrupt the action',()=>{const e=setup({ios:true,audio:false});e.w.NativeBridge={haptic(){throw Error('bridge unavailable');}};e.gesture();assert.doesNotThrow(()=>e.api.emit('damage'));assert.equal(e.api.emit('damage').haptics,false);e.dom.window.close();});
test('hidden pages stop audio and do not replay a delayed resume',async()=>{const e=setup({suspended:true,slowResume:true});e.gesture();e.api.emit('damage');Object.defineProperty(e.w.document,'hidden',{value:true,configurable:true});e.w.document.dispatchEvent(new e.w.Event('visibilitychange'));e.contexts[0].completeResume();await Promise.resolve();assert.equal(e.active().length,0);assert.equal(e.api.emit('heal').visual,false);e.dom.window.close();});
test('slow resume drops its sound instead of queueing a late surprise',async()=>{const e=setup({suspended:true,slowResume:true});e.gesture();e.api.emit('damage');const original=e.w.Date.now;e.w.Date.now=()=>original()+250;e.contexts[0].completeResume();await Promise.resolve();assert.equal(e.active().length,0);e.dom.window.close();});
test('muting while audio is resuming prevents a deferred sound',async()=>{const e=setup({suspended:true,slowResume:true});e.gesture();e.api.emit('damage');e.api.configure({sound:false});e.contexts[0].completeResume();await Promise.resolve();assert.equal(e.active().length,0);e.dom.window.close();});
test('explicit stop cancels a pending resume sound',async()=>{const e=setup({suspended:true,slowResume:true});e.gesture();e.api.emit('heal');e.api.stop();e.contexts[0].completeResume();await Promise.resolve();assert.equal(e.active().length,0);e.dom.window.close();});
test('pagehide interrupts all sources',()=>{const e=setup();e.gesture();e.api.emit('critical-success');e.w.dispatchEvent(new e.w.Event('pagehide'));assert.equal(e.active().length,0);e.dom.window.close();});
test('reduced motion is reported and visual setting remains independent',()=>{const e=setup({reduced:true});assert.equal(e.api.capabilities().reducedMotion,true);assert.equal(e.api.prefs().visual,true);assert.match(e.api.settingsHTML(),/Упрощён/);assert.match(e.api.settingsHTML(),/id="feedback-volume"/);assert.doesNotMatch(e.api.settingsHTML(),/feedback-demo|feedback-previews/);assert.equal((e.api.settingsHTML().match(/role="switch"/g)||[]).length,3);e.dom.window.close();});
test('unsupported kinds produce no effects',()=>{const e=setup();e.gesture();const result=e.api.emit('music');assert.equal(result.sound,false);assert.equal(e.visual.length,0);e.dom.window.close();});
test('visual cleanup uses the actual clear API on preference change and stop',()=>{const e=setup();e.api.configure({visual:false});assert.equal(e.clears.length,1);e.api.stop();assert.equal(e.clears.length,2);e.dom.window.close();});
test('demo forwards mounted preview anchors and values without changing character data',()=>{const e=setup(),anchor=e.w.document.createElement('section');e.api.demo('damage',{anchor,hpDelta:-5,preview:false});assert.equal(e.visual[0][1].anchor,anchor);assert.equal(e.visual[0][1].hpDelta,-5);assert.equal(e.visual[0][1].preview,true);e.dom.window.close();});
test('health confirmation can sound immediately and defer the visual until modal closure',()=>{const e=setup();e.gesture();const result=e.api.emit('damage',{hpDelta:-5,deferVisual:true});assert.equal(result.sound,true);assert.equal(result.haptics,true);assert.equal(result.visual,false);assert.equal(e.visual.length,0);e.dom.window.close();});

test('approved samples switch exactly at20% of maxHP and healing uses actual capped gain',()=>{
 const e=setup();for(const [kind,detail,id] of [
 ['damage',{maxHp:50,damageAmount:9,hpDelta:-9},'D1'],['damage',{maxHp:50,damageAmount:10,hpDelta:-1},'D2'],
 ['damage',{maxHp:50,hpDelta:0,tempDelta:-10},'D2'],['heal',{maxHp:50,hpDelta:9},'H10'],['heal',{maxHp:50,hpDelta:10},'H6'],
 ['critical-success',{},'S16'],['critical-failure',{},'F1']])assert.equal(e.api.selectSample(kind,detail),id);
 e.gesture();assert.equal(e.api.emit('damage',{damageAmount:10,maxHp:50,hpDelta:-1}).sample,'D2');
 assert.equal(e.active().length,1);const source=e.active()[0];assert.equal(source.buffer.getChannelData(0).length,e.w.ListFeedbackSamples.D2.frames);
 const buffer=source.buffer;e.api.stop();e.gesture();e.api.emit('damage',{damageAmount:10,maxHp:50});assert.equal(e.active()[0].buffer,buffer);e.dom.window.close();
});
test('all dice maxima and minima trigger feedback; declared Pathfinder degree takes priority',()=>{
 const e=setup();for(const sides of [4,6,8,10,12,20,100]){assert.equal(e.api.classifyRoll({natural:sides,sides}),'Критический успех');assert.equal(e.api.classifyRoll({natural:1,sides}),'Критический провал');assert.equal(e.api.classifyRoll({natural:2,sides}),'');}
 assert.equal(e.api.classifyRoll({natural:20,sides:20,degree:'Провал'}),'Провал');assert.equal(e.api.classifyRoll({rolls:[6,3],sides:6}),'');assert.equal(e.api.classifyRoll({rolls:[6,6],sides:6}),'Критический успех');assert.equal(e.api.classifyRoll({rolls:[{value:4,sides:4},{value:8,sides:8}]}),'Критический успех');e.gesture();assert.equal(e.api.emit('roll',{natural:6,sides:6}).sample,'S16');e.dom.window.close();
});

test('backgrounding stops sound while preserving settled critical visuals',()=>{const e=setup();e.gesture();e.api.emit('critical-success',{degree:'Критический успех'});Object.defineProperty(e.w.document,'hidden',{value:true,configurable:true});e.w.document.dispatchEvent(new e.w.Event('visibilitychange'));assert.equal(e.active().length,0);assert.equal(e.clears.length,0);e.dom.window.close();});

test('material cues choose all three approved variants without consecutive repeats',()=>{
 const e=setup();e.gesture();
 for(const material of ['metal','leather','cloth','wood']){
  const heard=new Set();let last=null;
  for(let i=0;i<12;i++){
   e.w.Math.random=()=>i%3===2?.99:0;e.gesture();
   const result=e.api.emit('equipment',{material,equipped:i%2===0});
   assert.equal(result.sound,true);assert.notEqual(result.sample,last);assert.ok(result.sample.startsWith('equipment-'+material+'-'));
   heard.add(result.sample);last=result.sample;
  }
  assert.equal(heard.size,3);
 }
 e.api.stop();assert.equal(e.active().length,0);e.dom.window.close();
});
test('unselected glass stays silent; materials and existing native haptics remain compatible',()=>{
 const e=setup();e.gesture();assert.equal(e.api.emit('equipment',{material:'glass'}).sound,false);
 for(const [slug,type,category,expected] of [['rapier','weapon','','metal'],['leather-armor','armor','light','leather'],['padded-armor','armor','light','cloth'],['wooden-shield','shield','','wood'],['healing-potion-minor','consumable','potion','glass']])assert.equal(e.api.equipmentMaterial({slug,type,category}),expected);
 let native;e.w.NativeBridge={haptic:k=>native=k};e.gesture();e.api.emit('equipment',{material:'metal'});assert.equal(native,'roll');
 e.api.configure({sound:false,haptics:false,visual:false});const muted=e.api.emit('equipment',{material:'wood'});assert.equal(muted.sound,false);assert.equal(muted.haptics,false);assert.equal(muted.visual,false);
 e.dom.window.close();
});
