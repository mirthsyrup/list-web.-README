/* Small, event-driven accents. No decorative timers or changes to character data. */
(function(root){'use strict';
document.fonts?.load('400 46px "List Folio Numerals"','0123456789+-−').catch(()=>{});
const seal=`<svg class="folio-seal" viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="44"/><circle cx="60" cy="60" r="39" stroke-dasharray="1 7"/><path d="m60 5 6 11-6 11-6-11zm0 88 6 11-6 11-6-11zM5 60l11-6 11 6-11 6zm88 0 11-6 11 6-11 6zM23 23l10 3-7 7zm64 64 10 10-3-10zM23 97l3-10 7 7zm64-64 10-10-10 3z"/><path d="M39 20q-14 4-19 18m81 44q-5 14-20 19M20 81q5 15 19 19m42-80q14 5 19 19"/><path d="M43 18q-5 0-6 5 6 0 6-5zm-24 23q0-5 5-6 0 6-5 6zm82 38q0 5-5 6 0-6 5-6zm-24 23q5 0 6-5-6 0-6 5z"/></svg>`;
const media=root.matchMedia?.('(prefers-reduced-motion: reduce)'),ripples=new Set(),values=new WeakMap(),activeValues=new Set();
const quiet=()=>document.hidden||!!media?.matches;
let layer=null;
function clearRipples(){for(const r of ripples){r.animation?.cancel();r.node.remove();}ripples.clear();}
function press(button,x,y){
 if(quiet()||!button?.animate||button.disabled||button.getAttribute('aria-disabled')==='true')return;
 const rect=button.getBoundingClientRect();if(!rect.width||!rect.height)return;
 if(!layer){layer=document.createElement('div');layer.id='list-ink-layer';layer.setAttribute('aria-hidden','true');document.body.append(layer);}
 while(ripples.size>=3){const first=ripples.values().next().value;first.animation.cancel();first.node.remove();ripples.delete(first);}
 const surface=document.createElement('span'),wave=document.createElement('span'),size=Math.hypot(rect.width,rect.height)*2;
 surface.className='ink-surface';wave.className='ink-wave';
 const radius=root.getComputedStyle(button).borderRadius;
 Object.assign(surface.style,{left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px',borderRadius:radius});
 Object.assign(wave.style,{width:size+'px',height:size+'px',left:((x??rect.left+rect.width/2)-rect.left-size/2)+'px',top:((y??rect.top+rect.height/2)-rect.top-size/2)+'px'});
 surface.append(wave);layer.append(surface);
 const animation=wave.animate([{transform:'scale(.08)',opacity:.5},{transform:'scale(1)',opacity:0}],{duration:430,easing:'cubic-bezier(.2,.7,.3,1)'});
 const record={node:surface,animation};ripples.add(record);
 animation.finished.catch(()=>{}).then(()=>{surface.remove();ripples.delete(record);});
}
document.addEventListener('pointerdown',e=>{if(e.button!==0||e.isPrimary===false)return;const button=e.target.closest?.('button');if(button)press(button,e.clientX,e.clientY);},{passive:true});
document.addEventListener('click',e=>{if(e.detail===0){const button=e.target.closest?.('button');if(button)press(button);}},{passive:true});
document.addEventListener('scroll',clearRipples,{passive:true,capture:true});
root.addEventListener('resize',clearRipples,{passive:true});
const app=document.querySelector('#app');
if(app)new MutationObserver(records=>{
 if(quiet())return;
 const changed=new Set();for(const record of records){const el=record.target.parentElement;if(el?.matches('.hp>b,.stat>b,.save>b,.level>b'))changed.add(el);}
 for(const el of changed){
  values.get(el)?.cancel();
  const animation=el.animate?.([{opacity:.65,transform:'translateY(2px)'},{opacity:1,transform:'translateY(0)'}],{duration:210,easing:'cubic-bezier(.2,.7,.3,1)'});
  if(!animation)continue;values.set(el,animation);activeValues.add(animation);
  animation.finished.catch(()=>{}).then(()=>{activeValues.delete(animation);if(values.get(el)===animation)values.delete(el);});
 }
}).observe(app,{subtree:true,characterData:true});
const overlay=document.querySelector('#overlay');if(overlay)new MutationObserver(clearRipples).observe(overlay,{childList:true});
function preferences(){document.documentElement.toggleAttribute('data-ui-paused',document.hidden);if(quiet()){clearRipples();for(const animation of activeValues)animation.cancel();activeValues.clear();}}
document.addEventListener('visibilitychange',preferences);media?.addEventListener?.('change',preferences);preferences();
root.ListVisual={press,clear:clearRipples,seal};
})(window);
