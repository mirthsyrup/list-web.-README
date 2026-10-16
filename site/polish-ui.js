/* Short, silent accents for real user changes. No character data is mutated. */
(function(root){'use strict';
const reduced=root.matchMedia?.('(prefers-reduced-motion: reduce)'),active=new Map();
const enabled=()=>!document.hidden&&!reduced?.matches&&root.ListFeedback?.prefs?.().visual!==false;
function clear(){for(const animation of active.values())animation.cancel();active.clear();}
function animate(el,frames,duration=500){
 if(!el?.isConnected||!el.animate||!enabled())return false;
 active.get(el)?.cancel();const animation=el.animate(frames,{duration,easing:'cubic-bezier(.2,.75,.25,1)'});
 active.set(el,animation);animation.finished.catch(()=>{}).then(()=>{if(active.get(el)===animation)active.delete(el);});return true;
}
function glow(el,duration=650){return animate(el,[{filter:'brightness(1)'},{filter:'brightness(1.22)',offset:.35},{filter:'brightness(1)'}],duration);}
function changed(before,after){
 if(!enabled())return;
 if(before.hero!==after.hero){
  const gained=after.hero>before.hero;
  document.querySelectorAll('.pips .pip').forEach((el,i)=>{
   if(i>=Math.min(before.hero,after.hero)&&i<Math.max(before.hero,after.hero))animate(el,
    gained?[{transform:'scale(.85)',filter:'brightness(1)'},{transform:'scale(1.14)',filter:'brightness(1.35)',offset:.4},{transform:'scale(1)',filter:'brightness(1)'}]
          :[{transform:'scale(1)',opacity:1},{transform:'scale(.88)',opacity:.5,offset:.4},{transform:'scale(1)',opacity:1}],550);
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
root.ListPolish={changed,level,navigation,clear};
})(window);
