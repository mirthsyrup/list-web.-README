/* Offline, gesture-triggered game feedback. No requests or sound queue. */
(function(root){'use strict';
const key='list-feedback-v1',defaults={sound:true,volume:1,haptics:true,visual:true};
const kinds=new Set(['damage','heal','roll','critical-success','critical-failure','invalid','equipment','coins','level-up']);
const lastMaterials=new Map();
let preferences={...defaults},context=null,master=null,gestureAt=-Infinity,audioEpoch=0;
const sampleBuffers=new WeakMap();
const voices=new Set(),reduced=root.matchMedia?.('(prefers-reduced-motion: reduce)');
try{const saved=JSON.parse(root.localStorage.getItem(key)||'null');if(saved&&typeof saved==='object'){for(const name of ['sound','haptics','visual'])if(typeof saved[name]==='boolean')preferences[name]=saved[name];if(Number.isFinite(saved.volume))preferences.volume=Math.max(0,Math.min(1,saved.volume));}}catch{}
// Reset once for each release; preserve the user's later changes within it.
try{const version=document.querySelector('meta[name="list-version"]')?.content;if(version&&root.localStorage.getItem('list-feedback-volume-version')!==version){preferences.volume=1;root.localStorage.setItem(key,JSON.stringify(preferences));root.localStorage.setItem('list-feedback-volume-version',version);}}catch{}
document.documentElement.toggleAttribute('data-feedback-paused',!preferences.visual);
const ios=()=>/iPad|iPhone|iPod/.test(root.navigator?.userAgent||'')||root.navigator?.platform==='MacIntel'&&root.navigator?.maxTouchPoints>1;
const nativeHaptic=()=>typeof root.NativeBridge?.haptic==='function'||typeof root.webkit?.messageHandlers?.haptic?.postMessage==='function';
function capabilities(){return{sound:typeof(root.AudioContext||root.webkitAudioContext)==='function',haptics:nativeHaptic()||!ios()&&typeof root.navigator?.vibrate==='function',visual:true,reducedMotion:!!reduced?.matches};}
function prefs(){return{...preferences};}
function equipmentMaterial(item={}){
 const explicit=item.mechanics?.material?.type||item.material;
 if(['metal','leather','cloth','wood','glass'].includes(explicit))return explicit;
 const slug=String(item.slug||'');
 if(item.category==='potion'||/potion|elixir|vial|flask|bottle/.test(slug))return 'glass';
 if(/leather|hide-armor/.test(slug))return 'leather';
 if(item.category==='unarmored'||/padded|clothing|robe|cloak|shirt|vestment/.test(slug))return 'cloth';
 if(/wood|bow|staff|club|spear|sling/.test(slug))return 'wood';
 return ['weapon','armor','shield'].includes(item.type)?'metal':'leather';
}
function configure(patch){for(const name of ['sound','haptics','visual'])if(typeof patch?.[name]==='boolean')preferences[name]=patch[name];if(Number.isFinite(patch?.volume))preferences.volume=Math.max(0,Math.min(1,patch.volume));try{root.localStorage.setItem(key,JSON.stringify(preferences));}catch{}if(master&&context)master.gain.setTargetAtTime(preferences.volume*.65,context.currentTime,.015);if(!preferences.sound||!preferences.volume)stopAudio();if(!preferences.haptics)cancelHaptic();document.documentElement.toggleAttribute('data-feedback-paused',!preferences.visual);if(!preferences.visual){root.ListVial?.clear?.();root.ListPolish?.clear?.();root.ListFeedbackVisual?.clear?.();root.ListMotion?.cancelCharacterReveal?.();}return prefs();}
const recentGesture=()=>!document.hidden&&(root.navigator?.userActivation?.isActive===true||Date.now()-gestureAt<180);
function unlock(event){if(event?.isTrusted===true)gestureAt=Date.now();if(!recentGesture()||!preferences.sound||!preferences.volume||!capabilities().sound)return false;try{if(!context||context.state==='closed'){const Audio=root.AudioContext||root.webkitAudioContext;context=new Audio();master=context.createGain();master.gain.value=preferences.volume*.65;master.connect(context.destination);}if(context.state==='suspended'||context.state==='interrupted')context.resume()?.catch?.(()=>{});return true;}catch{return false;}}
function cancelHaptic(){try{if(!ios())root.navigator?.vibrate?.(0);}catch{}}
function stopAudio(){audioEpoch++;for(const voice of [...voices])voice.stop();}
function stop(){stopAudio();cancelHaptic();root.ListFeedbackVisual?.clear?.();}
function selectSample(kind,detail={}){
 if(kind==='level-up')return 'level-up';
 if(kind==='equipment'||kind==='coins'){
  const material=kind==='coins'?'coins':detail.material;
  const pool=(root.ListInteractionPools?.[material]||[]).filter(id=>root.ListInteractionSamples?.[id]);
  const choices=pool.filter(id=>id!==lastMaterials.get(material));
  const available=choices.length?choices:pool;
  return available.length?available[Math.floor(Math.random()*available.length)]:null;
 }
 if(kind==='critical-success')return 'S16';if(kind==='critical-failure')return 'F1';
 if(kind!=='damage'&&kind!=='heal')return null;
 const max=Number(detail.maxHp),given=Number(detail.damageAmount);
 const amount=kind==='heal'?Math.max(0,Number(detail.hpDelta)||0):Number.isFinite(given)&&given>=0?given:Math.max(0,-(Number(detail.hpDelta)||0))+Math.max(0,-(Number(detail.tempDelta)||0));
 const large=Number.isFinite(max)&&max>0&&amount*5>=max;
 return kind==='heal'?(large?'H6':'H10'):(large?'D2':'D1');
}
function classifyRoll(detail={}){
 if(typeof detail.degree==='string'&&detail.degree)return detail.degree;
 const rolls=Array.isArray(detail.rolls)?detail.rolls:[detail.natural];
 if(!rolls.length)return '';
 const dice=rolls.map(roll=>typeof roll==='object'&&roll?{value:Number(roll.value),sides:Number(roll.sides)}:{value:Number(roll),sides:Number(detail.sides)});
 if(dice.some(d=>!Number.isInteger(d.value)||!Number.isInteger(d.sides)||d.sides<2||d.value<1||d.value>d.sides))return '';
 if(dice.every(d=>d.value===d.sides))return 'Критический успех';
 if(dice.every(d=>d.value===1))return 'Критический провал';return '';
}
function rollLabel(degree,detail={}){
 const sides=detail.sides!=null?[Number(detail.sides)]:(detail.rolls||[]).map(d=>Number(d&&d.sides));
 if(sides.length&&sides.every(s=>s>=2&&s!==20&&s!==100))return degree==='Критический успех'?'Сокрушительный удар':degree==='Критический провал'?'Осечка':degree;
 return degree;
}
function sampled(ctx,output,id,when){
 const entry=root.ListFeedbackSamples?.[id]||root.ListInteractionSamples?.[id]||root.ListLevelSamples?.[id];if(!entry)throw Error('Missing approved feedback sample '+id);
 let cache=sampleBuffers.get(ctx);if(!cache){cache=new Map();sampleBuffers.set(ctx,cache);}
 let buffer=cache.get(id);
 if(!buffer){const binary=root.atob(entry.pcm);buffer=ctx.createBuffer(1,entry.frames,entry.sampleRate);const data=buffer.getChannelData(0);
  for(let i=0;i<data.length;i++){const v=binary.charCodeAt(i*2)|(binary.charCodeAt(i*2+1)<<8);data[i]=(v>=32768?v-65536:v)/32768;}
  cache.set(id,buffer);
 }
 const source=ctx.createBufferSource(),boost=id==='S16'||id==='F1'?ctx.createGain():null;source.buffer=buffer;
 if(boost){boost.gain.value=1.9;source.connect(boost);boost.connect(output);}else source.connect(output);let finished=false;
 const record={stop(){if(finished)return;finished=true;try{source.stop();}catch{}source.disconnect();boost?.disconnect();voices.delete(record);}};
 source.onended=()=>record.stop();source.start(when);return record;
}
/* All envelopes start and end at silence, including the filtered crack. */
function synth(ctx,output,kind,when=ctx.currentTime,detail={}){
 const id=detail.sample||selectSample(kind,detail);if(id)return sampled(ctx,output,id,when);
 const nodes=[],sources=[];let ended=0,finished=false;
 const record={stop(){if(finished)return;finished=true;for(const s of sources)try{s.stop();}catch{}for(const n of nodes)try{n.disconnect();}catch{}voices.delete(record);}};
 function node(n){nodes.push(n);return n;}
 function envelope(signal,source,level,start,length,attack=.008){const gain=node(ctx.createGain()),t=when+start;gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(level,t+attack);gain.gain.exponentialRampToValueAtTime(.0001,t+length);gain.gain.linearRampToValueAtTime(0,t+length+.015);signal.connect(gain);gain.connect(output);sources.push(source);source.onended=()=>{if(++ended===sources.length)record.stop();};source.start(t);source.stop(t+length+.02);}
 function tone(freq,end,start,length,level,type='sine'){const o=node(ctx.createOscillator());o.type=type;o.frequency.setValueAtTime(freq,when+start);if(end)o.frequency.exponentialRampToValueAtTime(end,when+start+length);envelope(o,o,level,start,length);}
 function noise(start,length,level,frequency,q=1){const buffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*length),ctx.sampleRate),data=buffer.getChannelData(0);let seed=7331;for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)|0;data[i]=(seed>>>0)/2147483648-1;}const source=node(ctx.createBufferSource()),filter=node(ctx.createBiquadFilter());source.buffer=buffer;filter.type='bandpass';filter.frequency.value=frequency;filter.Q.value=q;source.connect(filter);envelope(filter,source,level,start,length,.003);}
 switch(kind){
 case 'roll':noise(0,.035,.34,1300,1.8);noise(.047,.027,.2,1900,2);tone(280,210,0,.055,.18);break;
 case 'invalid':noise(0,.035,.08,850,2);tone(330,260,0,.05,.045);break;
 }
 return record;
}
function play(kind,detail){if(!preferences.sound||!preferences.volume||!recentGesture()||!unlock())return false;const active=context,deadline=Date.now()+120,epoch=audioEpoch;function start(){if(epoch!==audioEpoch||active!==context||active.state!=='running'||document.hidden||Date.now()>deadline||!preferences.sound||!preferences.volume)return false;if(kind==='equipment'||kind==='coins')for(const old of [...voices])if(old.materialCue)old.stop();if(kind==='level-up')for(const old of [...voices])old.stop();while(voices.size>=3){const oldest=[...voices].find(voice=>!voice.levelCue);if(!oldest)return false;oldest.stop();}const voice=synth(active,master,kind,active.currentTime,detail);voice.levelCue=kind==='level-up';voice.materialCue=kind==='equipment'||kind==='coins';if(voice.materialCue)lastMaterials.set(detail.material,detail.sample);voices.add(voice);return true;}if(active.state==='running')return start();try{active.resume().then(start).catch(()=>{});}catch{}return false;}
const patterns={damage:[22],heal:[9,45,12],roll:[7], 'critical-success':[12,55,18], 'critical-failure':[25,45,12],invalid:[9],equipment:[8],coins:[6]};
function haptic(kind){if(kind==='level-up')return false;if(!preferences.haptics||!recentGesture()||!capabilities().haptics)return false;try{const nativeKind=kind==='equipment'||kind==='coins'?'roll':kind;if(typeof root.NativeBridge?.haptic==='function')root.NativeBridge.haptic(nativeKind);else if(root.webkit?.messageHandlers?.haptic)root.webkit.messageHandlers.haptic.postMessage({kind:nativeKind});else root.navigator.vibrate(patterns[kind]);return true;}catch{return false;}}
function emit(kind,detail={}){if(kind==='coins')detail={...detail,material:'coins'};if(['roll','critical-success','critical-failure'].includes(kind)){const degree=classifyRoll(detail)||(kind==='critical-success'?'Критический успех':kind==='critical-failure'?'Критический провал':'');detail={...detail,degree,label:rollLabel(degree,detail)};kind=degree==='Критический успех'?'critical-success':degree==='Критический провал'?'critical-failure':'roll';}if(!kinds.has(kind)||document.hidden)return{sound:false,haptics:false,visual:false};const sample=selectSample(kind,detail);if((kind==='equipment'||kind==='coins')&&!sample)return{sound:false,haptics:false,visual:false,sample:null};detail={...detail,sample};let visual=false;if(preferences.visual&&!detail.deferVisual)try{visual=root.ListFeedbackVisual?.emit?.(kind,detail)!==false&&!!root.ListFeedbackVisual;}catch{}const tactile=haptic(kind);let sound=false;try{sound=play(kind,detail);}catch{stopAudio();}return{sound,haptics:tactile,visual,sample};}
function demo(kind,detail={}){return emit(kind,{...detail,preview:true});}
function settingsHTML(){const p=prefs(),cap=capabilities(),row=(name,title,sub='')=>`<button class="setting-switch" data-action="feedback-toggle" data-key="${name}" role="switch" aria-checked="${p[name]}" ${name==='haptics'&&!cap.haptics?'disabled':''}><span><b>${title}</b>${sub?`<small>${sub}</small>`:''}</span><span class="switch-track"><span></span></span></button>`;return row('sound','Звуки действий','Броски, здоровье, снаряжение, монеты и новый уровень')+`<div class="feedback-volume"><label for="feedback-volume">Громкость</label><input id="feedback-volume" type="range" min="0" max="100" step="1" value="${Math.round(p.volume*100)}" aria-label="Громкость звуков"><output for="feedback-volume">${Math.round(p.volume*100)}%</output></div>`+row('haptics','Вибрация',cap.haptics?'Короткий тактильный отклик':'Недоступна в этой среде')+row('visual','Визуальный отклик',cap.reducedMotion?'Упрощён с учётом настроек движения':'Подсветка здоровья и компаса');}
async function renderPreview(kind,detail={}){if(!kinds.has(kind))throw Error('Unknown feedback kind');const Offline=root.OfflineAudioContext||root.webkitOfflineAudioContext;if(!Offline)throw Error('Offline audio unavailable');const ctx=new Offline(1,kind==='level-up'?Math.ceil(root.ListLevelSamples['level-up'].frames/root.ListLevelSamples['level-up'].sampleRate*48000):96000,48000),gain=ctx.createGain();gain.gain.value=.3*.65;gain.connect(ctx.destination);synth(ctx,gain,kind,0,detail);return ctx.startRendering();}
for(const event of ['pointerdown','keydown','click'])document.addEventListener(event,e=>{if(e.isTrusted&&!(event==='keydown'&&e.repeat))unlock(e);},{capture:true,passive:true});
document.addEventListener('visibilitychange',()=>{if(document.hidden){gestureAt=-Infinity;stopAudio();cancelHaptic();try{context?.suspend()?.catch?.(()=>{});}catch{}}});root.addEventListener('pagehide',()=>{gestureAt=-Infinity;stopAudio();cancelHaptic();try{context?.suspend()?.catch?.(()=>{});}catch{}});
root.ListFeedback={prefs,configure,unlock,emit,stop,capabilities,demo,settingsHTML,renderPreview,selectSample,classifyRoll,rollLabel,equipmentMaterial};
})(window);
