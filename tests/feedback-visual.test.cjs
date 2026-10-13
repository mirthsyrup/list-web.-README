const {test,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
const doms=[];after(()=>doms.forEach(dom=>dom.window.close()));
const tick=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
function harness(reduced=false){
 const dom=new JSDOM('<body><div id="app"><div id="page-content" data-scene="sheet"><section class="health"></section></div></div><div id="overlay"><div class="dice-result"><span class="result-seal"><svg><circle/><path/></svg></span><b>12</b></div><input id="amount" aria-describedby="help"><span id="help">Подсказка</span></div>',{runScripts:'outside-only',pretendToBeVisual:true});doms.push(dom);
 const w=dom.window,animations=[],timers=new Map();let nextTimer=0;
 const media={matches:reduced,addEventListener(type,callback){this.callback=callback;}};w.matchMedia=()=>media;
 w.setTimeout=callback=>{const id=++nextTimer;timers.set(id,callback);return id;};w.clearTimeout=id=>timers.delete(id);
 w.Element.prototype.animate=function(frames,options){let reject;const animation={target:this,frames,options,cancelled:false,finished:new Promise((resolve,r)=>{reject=r;}),cancel(){this.cancelled=true;reject(Error('cancel'));}};animations.push(animation);return animation;};
 w.eval(fs.readFileSync(path.join(__dirname,'../site/feedback-visual.js'),'utf8'));
 return {w,api:w.ListFeedbackVisual,animations,timers,media,$:selector=>w.document.querySelector(selector)};
}
test('Health cues show actual HP and absorbed temporary HP, never move the card',()=>{
 const h=harness(),anchor=h.$('.health');h.api.emit('damage',{anchor,hpDelta:-3,tempDelta:-5});
 assert.equal(h.$('.health-feedback-delta').textContent,'−3 ОЗ · −5 врем.');
 assert(h.$('.health-feedback-delta').classList.contains('feedback-combined'));
 assert(h.animations.length);assert(h.animations.every(a=>a.target!==anchor));
 h.api.clear();assert.equal(h.$('.health-feedback-delta'),null);assert.equal(h.timers.size,0);
 h.api.emit('heal',{anchor,hpDelta:0,tempDelta:0});assert.equal(h.animations.filter(a=>!a.cancelled).length,0);
 h.api.emit('damage',{anchor,hpDelta:0,tempDelta:-7});assert.equal(h.$('.health-feedback-delta').textContent,'−7 врем.');
});
test('Combined health labels retain large actual values and cannot wrap over the HP number',()=>{
 const h=harness();h.api.emit('damage',{anchor:h.$('.health'),hpDelta:-100000,tempDelta:-100000});
 assert.equal(h.$('.health-feedback-delta').textContent,'−100000 ОЗ · −100000 врем.');
 const css=fs.readFileSync(path.join(__dirname,'../site/feedback.css'),'utf8');
 assert.match(css,/\.health-feedback-delta\{[^}]*white-space:nowrap/);
 assert.match(css,/\.health-feedback-delta\.feedback-combined\{font-size:14px;padding:0;background:transparent\}/);
});
test('Combined delta sits between the meter and controls without crossing either during its motion',()=>{
 const h=harness(),anchor=h.$('.health');anchor.innerHTML='<div class="hp"><b>39</b></div><div class="meter"></div><div class="row"></div>';
 anchor.getBoundingClientRect=()=>({top:0});h.$('.meter').getBoundingClientRect=()=>({bottom:136.25});h.$('.meter + .row').getBoundingClientRect=()=>({top:157.25});
 h.api.emit('damage',{anchor,hpDelta:-5,tempDelta:-7});const delta=h.$('.health-feedback-delta');
 assert(Math.abs(parseFloat(delta.style.top)-139.05)<.01);assert.equal(delta.style.fontSize,'14px');
 const motion=h.animations.find(a=>a.target===delta);assert.equal(motion.frames[0].transform,'translateY(0)');assert.equal(motion.frames.at(-1).transform,'translateY(-2px)');
});
test('Rapid health feedback replaces its own effect and expires without leaked nodes or timers',async()=>{
 const h=harness(),anchor=h.$('.health');h.api.emit('damage',{anchor,hpDelta:-5});const first=[...h.animations];
 h.api.emit('heal',{anchor,hpDelta:2});assert(first.every(a=>a.cancelled));assert.equal(h.w.document.querySelectorAll('.health-feedback-delta').length,1);assert.equal(h.timers.size,1);
 for(const callback of [...h.timers.values()])callback();await tick();assert.equal(h.$('.health-feedback-delta'),null);assert.equal(h.timers.size,0);assert(h.animations.every(a=>a.cancelled));
});
test('Critical classification follows degree, and failure animates only compass lines',()=>{
 const h=harness(),anchor=h.$('.dice-result');h.api.emit('roll',{anchor,natural:20,total:20});assert.equal(anchor.dataset.feedbackDegree,undefined);assert.equal(h.animations.length,0);
 h.api.emit('roll',{anchor,natural:20,total:20,degree:'Критический провал'});assert.equal(anchor.dataset.feedbackDegree,'critical-failure');assert.equal(anchor.querySelector('h3').textContent,'Критический провал');assert(h.animations.every(a=>a.target.closest('svg')));assert(h.animations.every(a=>a.target!==anchor.querySelector('b')));
 h.api.emit('roll',{anchor,degree:'Критический успех'});assert.equal(anchor.dataset.feedbackDegree,'critical-success');assert(h.$('.feedback-seal-flare'));
});
test('Reduced motion keeps informative labels but creates no animated flash',()=>{
 const h=harness(true);h.api.emit('heal',{anchor:h.$('.health'),hpDelta:3});assert.equal(h.$('.health-feedback-delta').textContent,'+3 ОЗ');assert.equal(h.$('.health-feedback-wash'),null);
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
