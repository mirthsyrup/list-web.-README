/* Edge-back on iPhone, and containment of gestures at the document/dialog edges. */
(function(root){'use strict';
root.ListMobileNavigation=function(api){
 const ios=/iPad|iPhone|iPod/.test(root.navigator?.userAgent||'')||root.navigator?.platform==='MacIntel'&&root.navigator?.maxTouchPoints>1;
 const mobile=ios||/Android|Mobile/.test(root.navigator?.userAgent||'')||root.navigator?.maxTouchPoints>0;
 document.documentElement.dataset.mobileLayout=String(mobile);
 const horizontal='.tabs,.catalog-editions,.class-choice-tabs,.table-pager';
 let touch=null,stretchNodes=[],divider=null,elastic=null,frame=0;
 const reduced=()=>!!root.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 const now=()=>root.performance.now();
 const rubber=pull=>Math.sign(pull)*100*(1-Math.exp(-Math.abs(pull)/210));
 const unRubber=distance=>-Math.sign(distance)*210*Math.log(1-Math.min(.99999,Math.abs(distance)/100));
 function cancelFrame(){if(frame)root.cancelAnimationFrame(frame);frame=0;}
 function resetStretch(){
  cancelFrame();
  for(const n of stretchNodes){n.el.style.translate=n.translate;n.el.style.scale=n.scale;n.el.style.transformOrigin=n.origin;}
  if(divider){divider.style.removeProperty('--edge-divider-y');divider.classList.remove('edge-divider-pull');}
  stretchNodes=[];divider=null;elastic=null;
 }
 function prepareStretch(target){
  const container=target.closest?.('.dice-scroll-body,.catalog-filter-body,.picker-list,.modal')||document.querySelector('#page-content');if(!container)return false;
  if(elastic?.container===container)return true;
  resetStretch();
  const page=container.id==='page-content',rect=container.getBoundingClientRect(),top=page?0:Math.max(0,rect.top),bottom=page?root.innerHeight:Math.min(root.innerHeight,rect.bottom),height=Math.max(1,bottom-top);
  function add(el){const r=el.getBoundingClientRect();if(r.height<0||r.bottom<top||r.top>bottom)return;stretchNodes.push({el,translate:el.style.translate,scale:el.style.scale,origin:el.style.transformOrigin,center:(r.top+r.bottom)/2,top,bottom,height});}
  function collect(parent){for(const el of parent.children){
   if(el.matches('.modal-foot,script,style')||getComputedStyle(el).position==='fixed')continue;
   const style=getComputedStyle(el),border=['borderTopWidth','borderBottomWidth'].some(k=>parseFloat(style[k])>0);
   if(!border&&el.matches('.stack,.grid,.combat,.combat>section,.health-layout,.stats,.saves,#bag-results,#catalog-results,.dice-scroll-body,.catalog-filter-body,.picker-list')){collect(el);continue;}
   add(el);
  }}
  if(page){add(container);divider=document.querySelector('html[data-design="modern"] .topbar');if(divider)divider.classList.add('edge-divider-pull');}else collect(container);
  elastic={container,distance:0,velocity:0,returning:false,last:now()};return true;
 }
 function paintStretch(){
  if(!elastic)return;
  const distance=elastic.distance;
  if(divider)divider.style.setProperty('--edge-divider-y',`${distance*.65}px`);
  for(const n of stretchNodes){const depth=distance>=0?(n.center-n.top)/n.height:(n.bottom-n.center)/n.height,weight=.65+depth*.7;n.el.style.transformOrigin='50% 50%';n.el.style.translate=`0 ${distance*weight}px`;n.el.style.scale=`1 ${1+Math.abs(distance)*.7/n.height}`;}
 }
 function springFrame(time){
  frame=0;if(!elastic)return;
  if(!elastic.container.isConnected||reduced()){resetStretch();return;}
  let remaining=Math.min(.064,Math.max(0,(time-elastic.last)/1000));elastic.last=time;
  // Small fixed substeps keep 60 Hz and 120 Hz displays on the same damped spring.
  while(remaining>0){const dt=Math.min(1/240,remaining);elastic.velocity+=(-210*elastic.distance-29*elastic.velocity)*dt;elastic.distance+=elastic.velocity*dt;remaining-=dt;}
  if(Math.abs(elastic.distance)<.015&&Math.abs(elastic.velocity)<.15){resetStretch();return;}
  paintStretch();frame=root.requestAnimationFrame(springFrame);
 }
 function releaseStretch(){
  if(!elastic)return;if(reduced()){resetStretch();return;}
  elastic.returning=true;elastic.velocity=0;elastic.last=now();cancelFrame();frame=root.requestAnimationFrame(springFrame);
 }
 function stretch(target,amount){
  if(reduced())return;if(!prepareStretch(target))return;
  cancelFrame();elastic.returning=false;elastic.distance=rubber(amount);elastic.velocity=0;paintStretch();
 }
 function momentumStretch(target,velocity){
  if(reduced()||!prepareStretch(target))return;
  elastic.returning=true;elastic.distance=0;elastic.velocity=Math.max(-900,Math.min(900,velocity*350));elastic.last=now();cancelFrame();frame=root.requestAnimationFrame(springFrame);
 }

 const prevent=e=>{if(e.cancelable)e.preventDefault();};
 function scrollBudget(target,dy){
  const modal=target.closest?.('.modal');
  const budget=el=>{const viewport=el===document.scrollingElement?root.innerHeight:el.clientHeight,max=Math.max(0,el.scrollHeight-viewport),position=Math.max(0,Math.min(max,el.scrollTop));return{el,max,available:dy>0?position:max-position};};
  for(let el=target;el&&el!==document.body;el=el.parentElement){
   if(/auto|scroll/.test(getComputedStyle(el).overflowY)&&el.scrollHeight>el.clientHeight+1){const result=budget(el);if(result.available>.25||el===modal)return result;}
   if(el===modal)return budget(el);
  }
  return budget(document.scrollingElement);
 }
 document.addEventListener('touchstart',e=>{
  if(e.touches.length!==1||e.target.closest?.('input[type="range"],#portrait-canvas,.portrait-crop-stage,[data-photo-stage]')){touch=null;releaseStretch();return;}
  cancelFrame();if(elastic)elastic.returning=false;const p=e.touches[0];touch={pull:elastic?unRubber(elastic.distance):0,x:p.clientX,y:p.clientY,lastX:p.clientX,lastY:p.clientY,target:e.target,time:Date.now(),edge:ios&&p.clientX<=28&&api.canBack(),back:false};
 },{passive:true,capture:true});
 document.addEventListener('touchmove',e=>{
  if(!touch)return;if(e.touches.length!==1){touch=null;releaseStretch();return;}const p=e.touches[0],dx=p.clientX-touch.x,dy=p.clientY-touch.y;
  const stepY=p.clientY-touch.lastY;touch.lastX=p.clientX;touch.lastY=p.clientY;
  if(touch.edge&&dx>12&&Math.abs(dx)>Math.abs(dy)*1.5){touch.back=true;releaseStretch();prevent(e);return;}
  if(!touch.axis&&Math.max(Math.abs(dx),Math.abs(dy))>4)touch.axis=Math.abs(dx)>Math.abs(dy)?'x':'y';
  if(touch.axis==='x'){
   const area=touch.target.closest?.(horizontal);
   if(!area||dx>0&&area.scrollLeft<=0||dx<0&&area.scrollLeft+area.clientWidth>=area.scrollWidth-1)prevent(e);
  }else if(touch.axis==='y'){if(touch.pull&&Math.sign(stepY)!==Math.sign(touch.pull)){const next=touch.pull+stepY;if(Math.sign(next)===Math.sign(touch.pull)){touch.pull=next;stretch(touch.target,next);}else{touch.pull=0;resetStretch();const budget=scrollBudget(touch.target,next);budget.el.scrollTop=Math.max(0,Math.min(budget.max,budget.el.scrollTop-next));}prevent(e);}else{const budget=touch.pull?null:scrollBudget(touch.target,stepY),excess=touch.pull?Math.abs(stepY):Math.max(0,Math.abs(stepY)-budget.available);if(excess>0){if(!touch.pull)budget.el.scrollTop=stepY>0?0:budget.max;touch.pull+=Math.sign(stepY)*excess;stretch(touch.target,touch.pull);prevent(e);}else if(stretchNodes.length){touch.pull=0;resetStretch();}}}
 },{passive:false,capture:true});
 document.addEventListener('touchend',e=>{
  const current=touch;touch=null;releaseStretch();if(!current?.back)return;
  const dx=current.lastX-current.x,dy=current.lastY-current.y,elapsed=Math.max(1,Date.now()-current.time);
  if(dx>=70&&Math.abs(dx)>Math.abs(dy)*1.5||dx>=40&&dx/elapsed>.5){prevent(e);api.back();}
 },{passive:false,capture:true});
 document.addEventListener('touchcancel',()=>{touch=null;releaseStretch();},{passive:true,capture:true});
 // Momentum scroll events continue after touchend; ease into an edge rebound.
 const scrollSamples=new WeakMap();let lastRebound=0;
 document.addEventListener('scroll',event=>{
  const el=event.target===document?document.scrollingElement:event.target;if(!el||!('scrollTop' in el))return;
  const now=root.performance.now(),y=el.scrollTop,previous=scrollSamples.get(el),viewport=el===document.scrollingElement?root.innerHeight:el.clientHeight,max=Math.max(0,el.scrollHeight-viewport);
  const delta=previous?y-previous.y:0,instant=previous?delta/Math.max(8,now-previous.time):0,velocity=previous&&Math.abs(instant)<Math.abs(previous.velocity||0)?instant*.3+(previous.velocity||0)*.7:instant;
  scrollSamples.set(el,{y,time:now,velocity});if(touch||!previous||now-previous.time>120||max<1||now-lastRebound<650||elastic)return;
  const atTop=y<=1&&delta<0,atBottom=y>=max-1&&delta>0;
  if((atTop||atBottom)&&Math.abs(velocity)>.12&&!reduced()){
   lastRebound=now;const target=el===document.scrollingElement?document.querySelector('#page-content'):el;
   if(target)momentumStretch(target,-velocity);
  }
 },{passive:true,capture:true});
 function lockPortrait(){if(!mobile)return;try{root.screen?.orientation?.lock?.('portrait-primary')?.catch?.(()=>{});}catch{}}
 lockPortrait();root.addEventListener('orientationchange',lockPortrait);document.addEventListener('pointerdown',lockPortrait,{once:true,passive:true});
 return{ios};
};
})(window);
