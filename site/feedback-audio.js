/* Offline, gesture-triggered game feedback. No music, requests or sound queue. */
(function(root){'use strict';
const key='list-feedback-v1',defaults={sound:true,volume:.3,haptics:true,visual:true};
const kinds=new Set(['damage','heal','roll','critical-success','critical-failure','invalid']);
let preferences={...defaults},context=null,master=null,gestureAt=-Infinity,audioEpoch=0;
const voices=new Set(),reduced=root.matchMedia?.('(prefers-reduced-motion: reduce)');
try{const saved=JSON.parse(root.localStorage.getItem(key)||'null');if(saved&&typeof saved==='object'){for(const name of ['sound','haptics','visual'])if(typeof saved[name]==='boolean')preferences[name]=saved[name];if(Number.isFinite(saved.volume))preferences.volume=Math.max(0,Math.min(1,saved.volume));}}catch{}
const ios=()=>/iPad|iPhone|iPod/.test(root.navigator?.userAgent||'')||root.navigator?.platform==='MacIntel'&&root.navigator?.maxTouchPoints>1;
const nativeHaptic=()=>typeof root.NativeBridge?.haptic==='function'||typeof root.webkit?.messageHandlers?.haptic?.postMessage==='function';
function capabilities(){return{sound:typeof(root.AudioContext||root.webkitAudioContext)==='function',haptics:nativeHaptic()||!ios()&&typeof root.navigator?.vibrate==='function',visual:true,reducedMotion:!!reduced?.matches};}
function prefs(){return{...preferences};}
function configure(patch){for(const name of ['sound','haptics','visual'])if(typeof patch?.[name]==='boolean')preferences[name]=patch[name];if(Number.isFinite(patch?.volume))preferences.volume=Math.max(0,Math.min(1,patch.volume));try{root.localStorage.setItem(key,JSON.stringify(preferences));}catch{}if(master&&context)master.gain.setTargetAtTime(preferences.volume*.65,context.currentTime,.015);if(!preferences.sound||!preferences.volume)stopAudio();if(!preferences.haptics)cancelHaptic();if(!preferences.visual)root.ListFeedbackVisual?.clear?.();return prefs();}
const recentGesture=()=>!document.hidden&&(root.navigator?.userActivation?.isActive===true||Date.now()-gestureAt<180);
function unlock(event){if(event?.isTrusted===true)gestureAt=Date.now();if(!recentGesture()||!preferences.sound||!preferences.volume||!capabilities().sound)return false;try{if(!context||context.state==='closed'){const Audio=root.AudioContext||root.webkitAudioContext;context=new Audio();master=context.createGain();master.gain.value=preferences.volume*.65;master.connect(context.destination);}if(context.state==='suspended'||context.state==='interrupted')context.resume()?.catch?.(()=>{});return true;}catch{return false;}}
function cancelHaptic(){try{if(!ios())root.navigator?.vibrate?.(0);}catch{}}
function stopAudio(){audioEpoch++;for(const voice of [...voices])voice.stop();}
function stop(){stopAudio();cancelHaptic();root.ListFeedbackVisual?.clear?.();}
/* All envelopes start and end at silence, including the filtered crack. */
function synth(ctx,output,kind,when=ctx.currentTime){
 const nodes=[],sources=[];let ended=0,finished=false;
 const record={stop(){if(finished)return;finished=true;for(const s of sources)try{s.stop();}catch{}for(const n of nodes)try{n.disconnect();}catch{}voices.delete(record);}};
 function node(n){nodes.push(n);return n;}
 function envelope(signal,source,level,start,length,attack=.008){const gain=node(ctx.createGain()),t=when+start;gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(level,t+attack);gain.gain.exponentialRampToValueAtTime(.0001,t+length);gain.gain.linearRampToValueAtTime(0,t+length+.015);signal.connect(gain);gain.connect(output);sources.push(source);source.onended=()=>{if(++ended===sources.length)record.stop();};source.start(t);source.stop(t+length+.02);}
 function tone(freq,end,start,length,level,type='sine'){const o=node(ctx.createOscillator());o.type=type;o.frequency.setValueAtTime(freq,when+start);if(end)o.frequency.exponentialRampToValueAtTime(end,when+start+length);envelope(o,o,level,start,length);}
 function noise(start,length,level,frequency,q=1){const buffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*length),ctx.sampleRate),data=buffer.getChannelData(0);let seed=7331;for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)|0;data[i]=(seed>>>0)/2147483648-1;}const source=node(ctx.createBufferSource()),filter=node(ctx.createBiquadFilter());source.buffer=buffer;filter.type='bandpass';filter.frequency.value=frequency;filter.Q.value=q;source.connect(filter);envelope(filter,source,level,start,length,.003);}
 switch(kind){
 case 'damage':tone(126,53,0,.34,.45);tone(188,110,.006,.18,.09);noise(0,.065,.15,420,.7);break;
 case 'heal':for(const [i,f]of [392,523.25,659.25].entries()){tone(f,null,i*.085,.49,.115);tone(f*2.003,null,i*.085,.29,.022);}tone(261.6,392,0,.38,.055);break;
 case 'roll':noise(0,.035,.085,1300,1.8);noise(.047,.027,.05,1900,2);tone(280,210,0,.055,.045);break;
 case 'critical-success':for(const[i,f]of [523.25,659.25,783.99].entries()){tone(f,null,i*.08,.48,.12);tone(f*2.005,null,i*.08,.28,.022);}tone(261.6,523.25,0,.26,.04);break;
 case 'critical-failure':noise(0,.055,.13,740,1.2);noise(.065,.045,.075,500,1.1);tone(147,62,.018,.36,.30);tone(207,130,.015,.14,.035);break;
 case 'invalid':noise(0,.035,.08,850,2);tone(330,260,0,.05,.045);break;
 }
 return record;
}
function play(kind){if(!preferences.sound||!preferences.volume||!recentGesture()||!unlock())return false;const active=context,deadline=Date.now()+120,epoch=audioEpoch;function start(){if(epoch!==audioEpoch||active!==context||active.state!=='running'||document.hidden||Date.now()>deadline||!preferences.sound||!preferences.volume)return false;while(voices.size>=3)voices.values().next().value.stop();const voice=synth(active,master,kind);voices.add(voice);return true;}if(active.state==='running')return start();try{active.resume().then(start).catch(()=>{});}catch{}return false;}
const patterns={damage:[22],heal:[9,45,12],roll:[7], 'critical-success':[12,55,18], 'critical-failure':[25,45,12],invalid:[9]};
function haptic(kind){if(!preferences.haptics||!recentGesture()||!capabilities().haptics)return false;try{if(typeof root.NativeBridge?.haptic==='function')root.NativeBridge.haptic(kind);else if(root.webkit?.messageHandlers?.haptic)root.webkit.messageHandlers.haptic.postMessage({kind});else root.navigator.vibrate(patterns[kind]);return true;}catch{return false;}}
function emit(kind,detail={}){if(!kinds.has(kind)||document.hidden)return{sound:false,haptics:false,visual:false};let visual=false;if(preferences.visual&&!detail.deferVisual)try{visual=root.ListFeedbackVisual?.emit?.(kind,detail)!==false&&!!root.ListFeedbackVisual;}catch{}let sound=false;try{sound=play(kind);}catch{stopAudio();}return{sound,haptics:haptic(kind),visual};}
function demo(kind,detail={}){return emit(kind,{...detail,preview:true});}
function settingsHTML(){const p=prefs(),cap=capabilities(),row=(name,title,sub='')=>`<button class="setting-switch" data-action="feedback-toggle" data-key="${name}" role="switch" aria-checked="${p[name]}" ${name==='haptics'&&!cap.haptics?'disabled':''}><span><b>${title}</b>${sub?`<small>${sub}</small>`:''}</span><span class="switch-track"><span></span></span></button>`;return row('sound','Звуки действий','Урон, лечение и броски')+`<div class="feedback-volume"><label for="feedback-volume">Громкость</label><input id="feedback-volume" type="range" min="0" max="100" step="1" value="${Math.round(p.volume*100)}" aria-label="Громкость звуков"><output for="feedback-volume">${Math.round(p.volume*100)}%</output></div>`+row('haptics','Вибрация',cap.haptics?'Короткий тактильный отклик':'Недоступна в этой среде')+row('visual','Визуальный отклик',cap.reducedMotion?'Упрощён с учётом настроек движения':'Подсветка здоровья и компаса')+`<div class="feedback-previews">${[['damage','Урон'],['heal','Лечение'],['critical-success','Крит. успех'],['critical-failure','Крит. провал']].map(([kind,label])=>`<button class="btn ghost compact" data-action="feedback-demo" data-kind="${kind}">${label}</button>`).join('')}</div>`;}
async function renderPreview(kind){if(!kinds.has(kind))throw Error('Unknown feedback kind');const Offline=root.OfflineAudioContext||root.webkitOfflineAudioContext;if(!Offline)throw Error('Offline audio unavailable');const ctx=new Offline(1,48000,48000),gain=ctx.createGain();gain.gain.value=.3*.65;gain.connect(ctx.destination);synth(ctx,gain,kind,0);return ctx.startRendering();}
for(const event of ['pointerdown','keydown','click'])document.addEventListener(event,e=>{if(e.isTrusted&&!(event==='keydown'&&e.repeat))unlock(e);},{capture:true,passive:true});
document.addEventListener('visibilitychange',()=>{if(document.hidden){gestureAt=-Infinity;stop();try{context?.suspend()?.catch?.(()=>{});}catch{}}});root.addEventListener('pagehide',()=>{gestureAt=-Infinity;stop();try{context?.suspend()?.catch?.(()=>{});}catch{}});
root.ListFeedback={prefs,configure,unlock,emit,stop,capabilities,demo,settingsHTML,renderPreview};
})(window);
