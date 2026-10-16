/* Short, silent accents for real user changes. No character data is mutated. */
(function(root){'use strict';
const reduced=root.matchMedia?.('(prefers-reduced-motion: reduce)'),active=new Map(),frames=new Map();
const enabled=()=>!document.hidden&&!reduced?.matches&&root.ListFeedback?.prefs?.().visual!==false;
function clearFrames(){for(const [anchor,record]of frames){clearTimeout(record.timer);active.get(record.node)?.cancel();active.delete(record.node);record.node.remove();anchor.classList.remove('frame-feedback');}frames.clear();}
function clear(){for(const animation of active.values())animation.cancel();active.clear();clearFrames();}
function animate(el,frames,duration=500){
 if(!el?.isConnected||!el.animate||!enabled())return false;
 active.get(el)?.cancel();const animation=el.animate(frames,{duration,easing:'cubic-bezier(.2,.75,.25,1)'});
 active.set(el,animation);animation.finished.catch(()=>{}).then(()=>{if(active.get(el)===animation)active.delete(el);});return animation;
}
function sync(scope=document){for(const el of scope.querySelectorAll('.health')){const ratio=Number(el.querySelector('.meter')?.dataset.fill??1);el.style.setProperty('--heart-period',(ratio>.75?3.8:ratio>.5?2.8:ratio>.25?1.85:1.1)+'s');el.toggleAttribute('data-heart-still',ratio<=0);}}
function frame(anchor,tone='gold'){
 if(!anchor?.isConnected||!enabled())return false;
 const old=frames.get(anchor);if(old){clearTimeout(old.timer);active.get(old.node)?.cancel();active.delete(old.node);old.node.remove();}
 const node=document.createElement('span');node.className='frame-feedback-edge '+tone;node.setAttribute('aria-hidden','true');anchor.classList.add('frame-feedback');anchor.append(node);
 const animation=animate(node,[{opacity:0},{opacity:.55,offset:.35},{opacity:0}],1100),record={node};frames.set(anchor,record);
 const cleanup=()=>{clearTimeout(record.timer);animation?.cancel();active.delete(node);node.remove();if(frames.get(anchor)===record){frames.delete(anchor);anchor.classList.remove('frame-feedback');}};
 record.timer=setTimeout(cleanup,1500);if(animation)animation.finished.catch(()=>{}).then(cleanup);else cleanup();
 return !!animation;
}
function glow(el,duration=650){return animate(el,[{filter:'brightness(1)'},{filter:'brightness(1.22)',offset:.35},{filter:'brightness(1)'}],duration);}
function changed(before,after){
 if(!enabled())return;
 if(before.hero!==after.hero){
  const gained=after.hero>before.hero;
  document.querySelectorAll('.pips .pip').forEach((el,i)=>{
   if(i>=Math.min(before.hero,after.hero)&&i<Math.max(before.hero,after.hero)){
    const token=el.querySelector('.fantasy-art')||el,filter=root.getComputedStyle(token).filter;
    animate(token,gained?
     [{transform:'perspective(240px) rotateY(-180deg) scale(.85)',filter:'grayscale(1) brightness(.7)',opacity:.6},{transform:'perspective(240px) rotateY(-70deg) scale(1.06)',filter:'brightness(1.2)',opacity:1,offset:.5},{transform:'perspective(240px) rotateY(0deg) scale(1)',filter,opacity:1}]
     :[{filter:'grayscale(0) brightness(1.15)',opacity:1},{filter,opacity:.75}],850);
   }
  });
 }
 const states=c=>JSON.stringify([c.conditions,(c.effects||[]).filter(x=>x.active&&x.rounds!==0).map(x=>[x.id,x.name,x.rounds])]);
 if(states(before)!==states(after)){
  document.querySelectorAll('.conditions-list .condition-card,.status-chip').forEach(el=>glow(el,400));
  const chips=document.querySelector('#page-content .conditions-chips');glow(chips,400);
 }
}
function level(){glow(document.querySelector('.hero .level'),1500);glow(document.querySelector('.hero-name .avatar'),1100);}
function navigation(tab){
 const el=[...document.querySelectorAll('.nav [data-tab]')].find(el=>el.dataset.tab===tab);
 const art=el?.querySelector('.fantasy-art,svg')||el;
 animate(art,[{transform:'translateY(0)'},{transform:'translateY(-3px)',offset:.4},{transform:'translateY(0)'}],280);
}
document.addEventListener('visibilitychange',()=>{if(document.hidden)clear();});root.addEventListener('pagehide',clear);
reduced?.addEventListener?.('change',()=>{if(reduced.matches)clear();});
root.ListPolish={changed,level,navigation,clear,clearFrames,sync,frame};
})(window);
