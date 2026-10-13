const {test,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
const doms=[];after(()=>doms.forEach(dom=>dom.window.close()));
const tick=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
function harness(reduced=false){
 const dom=new JSDOM('<body><div id="app"><div id="page-content" data-scene="sheet"><section class="health"></section></div></div><div id="overlay"><div class="dice-result"><span class="result-seal"><svg><circle/><path/></svg></span><b>12</b></div><input id="amount" aria-describedby="help"><span id="help">Подсказка</span></div>',{runScripts:'outside-only',pretendToBeVisual:true});doms.push(dom);
 const w=dom.window,animations=[],timers=new Map();let nextTimer=0;
 const media={matches:reduced,addEventListener(type,callback){this.callback=callback;}};w.matchMedia=()=>media;
 w.setTimeout=callback=>{const id=++nextTimer;timers.set(id,callback);return id;};w.clearTimeout=id=>timers.delete(id);
 w.Element.prototype.animate=function(frames,options){let reject,resolve;const animation={target:this,frames,options,cancelled:false,finished:new Promise((ok,r)=>{resolve=ok;reject=r;}),complete(){resolve();},cancel(){this.cancelled=true;reject(Error('cancel'));}};animations.push(animation);return animation;};
 w.eval(fs.readFileSync(path.join(__dirname,'../site/feedback-visual.js'),'utf8'));
 return {w,api:w.ListFeedbackVisual,animations,timers,media,$:selector=>w.document.querySelector(selector)};
}
test('Health numbers show actual total loss and capped gain with no signs, units or background',()=>{
 const h=harness(),anchor=h.$('.health');h.api.emit('damage',{anchor,hpDelta:-3,tempDelta:-5});
 assert.equal(h.$('.health-feedback-delta').textContent,'8');assert(h.$('.health-feedback-delta').classList.contains('feedback-damage'));
 assert(h.animations.length);assert(h.animations.every(a=>a.target!==anchor));
 h.api.clear();assert.equal(h.$('.health-feedback-delta'),null);assert.equal(h.timers.size,0);
 h.api.emit('heal',{anchor,hpDelta:0,tempDelta:0});assert.equal(h.animations.filter(a=>!a.cancelled).length,0);
 h.api.emit('damage',{anchor,hpDelta:0,tempDelta:-7});assert.equal(h.$('.health-feedback-delta').textContent,'7');
 const css=fs.readFileSync(path.join(__dirname,'../site/feedback.css'),'utf8');assert.match(css,/health-feedback-delta\{[^}]*background:transparent/);
});
test('Health number flies a substantial random distance for one second and is removed at completion',async()=>{
 const h=harness(),anchor=h.$('.health'),endpoints=new Set();
 for(let i=0;i<6;i++){
  h.api.emit('damage',{anchor,hpDelta:-5,tempDelta:-7});const delta=h.$('.health-feedback-delta');
  assert.equal(delta.textContent,'12');const a=h.animations.findLast(a=>a.target===delta);
  assert.equal(a.options.duration,1000);assert.equal(a.options.fill,'forwards');assert.equal(a.frames.at(-1).opacity,0);
  endpoints.add(a.frames.at(-1).transform);a.complete();await tick();assert.equal(delta.isConnected,false);assert.equal(h.timers.size,0);
 }
 assert(endpoints.size>1);
});
test('Rapid health feedback replaces its own effect and expires without leaked nodes or timers',async()=>{
 const h=harness(),anchor=h.$('.health');h.api.emit('damage',{anchor,hpDelta:-5});const first=[...h.animations];
 h.api.emit('heal',{anchor,hpDelta:2});assert(first.every(a=>a.cancelled));assert.equal(h.w.document.querySelectorAll('.health-feedback-delta').length,1);assert.equal(h.timers.size,1);
 for(const callback of [...h.timers.values()])callback();await tick();assert.equal(h.$('.health-feedback-delta'),null);assert.equal(h.timers.size,0);assert(h.animations.every(a=>a.cancelled));
});
test('Critical classification follows degree, and failure animates only compass lines',()=>{
 const h=harness(),anchor=h.$('.dice-result');h.api.emit('roll',{anchor,natural:20,total:20});assert.equal(anchor.dataset.feedbackDegree,undefined);assert.equal(h.animations.length,0);
 h.api.emit('roll',{anchor,natural:20,total:20,degree:'Критический провал'});assert.equal(anchor.dataset.feedbackDegree,'critical-failure');assert.equal(anchor.querySelector('h3').textContent,'Критический провал');assert(h.$('.feedback-seal-fragment'));assert.equal(anchor.querySelectorAll('.feedback-seal-spark').length,8);assert(h.animations.every(a=>a.target!==anchor.querySelector('b')));
 h.api.emit('roll',{anchor,degree:'Критический успех'});assert.equal(anchor.dataset.feedbackDegree,'critical-success');assert(h.$('.feedback-seal-flare'));
});
test('Reduced motion keeps informative labels but creates no animated flash',()=>{
 const h=harness(true);h.api.emit('heal',{anchor:h.$('.health'),hpDelta:3});assert.equal(h.$('.health-feedback-delta').textContent,'3');assert.equal(h.$('.health-feedback-wash'),null);assert.equal(h.$('.health-feedback-delta').style.opacity,'1');
 h.api.emit('roll',{anchor:h.$('.dice-result'),degree:'Критический успех'});assert.equal(h.$('.dice-result h3').textContent,'Критический успех');assert.equal(h.$('.feedback-seal-flare'),null);assert.equal(h.animations.length,0);
});
test('Inline error preserves previous descriptions and clears only when its field changes',()=>{
 const h=harness(),field=h.$('#amount');h.api.error(field,'Введи целое число.');const first=h.$('.feedback-field-error');
 assert.equal(field.getAttribute('aria-invalid'),'true');assert.equal(first.getAttribute('role'),'alert');assert.equal(field.getAttribute('aria-describedby'),'help '+first.id);assert.equal(h.w.document.activeElement,field);
 h.api.error(field,'Число слишком большое.');assert.equal(h.w.document.querySelectorAll('.feedback-field-error').length,1);assert.equal(first.isConnected,false);
 field.dispatchEvent(new h.w.Event('input',{bubbles:true}));assert.equal(h.$('.feedback-field-error'),null);assert.equal(field.getAttribute('aria-describedby'),'help');assert.equal(field.hasAttribute('aria-invalid'),false);
});
test('Scene changes, detached results, pagehide, visibility and reduced preference cancel active cues',async()=>{
 const h=harness();h.api.emit('damage',{anchor:h.$('.health'),hpDelta:-1});h.$('#page-content').dataset.scene='bag';await tick();assert.equal(h.timers.size,0);
 h.api.emit('roll',{anchor:h.$('.dice-result'),degree:'Критический провал'});h.$('.dice-result').remove();await tick();assert.equal(h.timers.size,0);
 h.api.emit('heal',{anchor:h.$('.health'),hpDelta:1});h.w.dispatchEvent(new h.w.Event('pagehide'));assert.equal(h.timers.size,0);
 h.api.emit('heal',{anchor:h.$('.health'),hpDelta:1});h.media.matches=true;h.media.callback();assert.equal(h.timers.size,0);
 h.media.matches=false;h.api.emit('heal',{anchor:h.$('.health'),hpDelta:1});Object.defineProperty(h.w.document,'hidden',{value:true,configurable:true});h.w.document.dispatchEvent(new h.w.Event('visibilitychange'));assert.equal(h.timers.size,0);assert(h.animations.every(a=>a.cancelled));
});

test('critical drawing settles into a persistent seal until another roll; turning visuals off clears it',async()=>{
 const h=harness(),anchor=h.$('.dice-result');h.api.emit('roll',{anchor,degree:'Критический успех'});
 for(const callback of [...h.timers.values()])callback();await tick();
 assert.equal(anchor.dataset.feedbackDegree,'critical-success');assert(h.$('.feedback-seal-ring'));assert.equal(h.$('.feedback-seal-ring').style.opacity,'0.42');assert.equal(h.$('.feedback-seal-spark'),null);assert.equal(h.timers.size,0);assert(h.animations.every(a=>a.cancelled));
 h.api.emit('roll',{anchor,degree:''});assert.equal(anchor.dataset.feedbackDegree,undefined);assert.equal(h.$('.feedback-seal-ring'),null);assert.equal(h.$('.feedback-roll-label'),null);
 h.api.emit('roll',{anchor,degree:'Критический провал'});h.api.clear();assert.equal(anchor.dataset.feedbackDegree,undefined);assert.equal(h.$('.feedback-seal-fragment'),null);
});

test('critical seal survives backgrounding and reduced motion until the next actual roll',()=>{const h=harness(),anchor=h.$('.dice-result');h.api.emit('roll',{anchor,degree:'Критический провал'});Object.defineProperty(h.w.document,'hidden',{value:true,configurable:true});h.w.document.dispatchEvent(new h.w.Event('visibilitychange'));assert.equal(anchor.dataset.feedbackDegree,'critical-failure');assert(h.$('.feedback-seal-ring'));assert.equal(h.timers.size,0);h.media.matches=true;h.media.callback();assert.equal(anchor.dataset.feedbackDegree,'critical-failure');h.api.clear();assert.equal(h.$('.feedback-seal-ring'),null);});
