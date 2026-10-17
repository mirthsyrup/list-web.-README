/* Edge-back on iPhone, and containment of gestures at the document/dialog edges. */
(function(root){'use strict';
root.ListMobileNavigation=function(api){
 const ios=/iPad|iPhone|iPod/.test(root.navigator?.userAgent||'')||root.navigator?.platform==='MacIntel'&&root.navigator?.maxTouchPoints>1;
 const mobile=ios||/Android|Mobile/.test(root.navigator?.userAgent||'')||root.navigator?.maxTouchPoints>0;
 document.documentElement.dataset.mobileLayout=String(mobile);
 const horizontal='.tabs,.catalog-editions,.class-choice-tabs,.table-pager';
 let touch=null;
 const prevent=e=>{if(e.cancelable)e.preventDefault();};
 function canScroll(target,dy){
  const modal=target.closest?.('.modal');
  for(let el=target;el&&el!==document.body;el=el.parentElement){
   const style=getComputedStyle(el);
   if(/auto|scroll/.test(style.overflowY)&&el.scrollHeight>el.clientHeight+1){
    if(dy>0&&el.scrollTop>0||dy<0&&el.scrollTop+el.clientHeight<el.scrollHeight-1)return true;
   }
   if(el===modal)return false;
  }
  const el=document.scrollingElement;
  return dy>0?el.scrollTop>0:el.scrollTop+root.innerHeight<el.scrollHeight-1;
 }
 document.addEventListener('touchstart',e=>{
  if(e.touches.length!==1||e.target.closest?.('input[type="range"],#portrait-canvas,.portrait-crop-stage,[data-photo-stage]')){touch=null;return;}
  const p=e.touches[0];touch={x:p.clientX,y:p.clientY,lastX:p.clientX,lastY:p.clientY,target:e.target,time:Date.now(),edge:ios&&p.clientX<=28&&api.canBack(),back:false};
 },{passive:true,capture:true});
 document.addEventListener('touchmove',e=>{
  if(!touch||e.touches.length!==1)return;const p=e.touches[0],dx=p.clientX-touch.x,dy=p.clientY-touch.y;
  const stepY=p.clientY-touch.lastY;touch.lastX=p.clientX;touch.lastY=p.clientY;
  if(touch.edge&&dx>12&&Math.abs(dx)>Math.abs(dy)*1.5){touch.back=true;prevent(e);return;}
  if(Math.abs(dx)>Math.abs(dy)){
   const area=touch.target.closest?.(horizontal);
   if(!area||dx>0&&area.scrollLeft<=0||dx<0&&area.scrollLeft+area.clientWidth>=area.scrollWidth-1)prevent(e);
  }else if(Math.abs(dy)>4&&!canScroll(touch.target,stepY))prevent(e);
 },{passive:false,capture:true});
 document.addEventListener('touchend',e=>{
  const current=touch;touch=null;if(!current?.back)return;
  const dx=current.lastX-current.x,dy=current.lastY-current.y,elapsed=Math.max(1,Date.now()-current.time);
  if(dx>=70&&Math.abs(dx)>Math.abs(dy)*1.5||dx>=40&&dx/elapsed>.5){prevent(e);api.back();}
 },{passive:false,capture:true});
 document.addEventListener('touchcancel',()=>{touch=null;},{passive:true,capture:true});
 function lockPortrait(){if(!mobile)return;try{root.screen?.orientation?.lock?.('portrait-primary')?.catch?.(()=>{});}catch{}}
 lockPortrait();root.addEventListener('orientationchange',lockPortrait);document.addEventListener('pointerdown',lockPortrait,{once:true,passive:true});
 return{ios};
};
})(window);
