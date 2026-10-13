/* Event-driven card feedback. Character state and rule calculations stay elsewhere. */
(function(root){'use strict';
const media=root.matchMedia?.('(prefers-reduced-motion: reduce)'),active=new Set(),owners=new WeakMap(),errors=new Map();
let errorId=0;
const quiet=()=>document.hidden||!!media?.matches;
function finish(record){
 if(!active.delete(record))return;
 clearTimeout(record.timer);for(const animation of record.animations)animation.cancel();
 for(const node of record.nodes)node.remove();
 record.anchor.classList.remove('health-feedback');
 if(owners.get(record.anchor)===record)owners.delete(record.anchor);
}
function clear(){for(const record of [...active])finish(record);}
function own(anchor,duration){
 if(!anchor?.isConnected)return null;
 const old=owners.get(anchor);if(old)finish(old);
 const record={anchor,nodes:[],animations:[],timer:null};active.add(record);owners.set(anchor,record);
 record.timer=setTimeout(()=>finish(record),duration);return record;
}
 function node(record,cls,text){
 const el=document.createElement('span');el.className=cls;el.setAttribute('aria-hidden','true');
 if(text!==undefined)el.textContent=text;record.anchor.append(el);record.nodes.push(el);return el;
}
function animate(record,el,frames,options){
 if(quiet()||!el?.animate)return;
 const animation=el.animate(frames,{easing:'cubic-bezier(.2,.7,.3,1)',...options});record.animations.push(animation);
 animation.finished.catch(()=>{});return animation;
}
function health(kind,detail){
 const hp=Number(detail.hpDelta)||0,temp=Number(detail.tempDelta)||0;
 const healing=kind==='heal'||kind==='health-heal';
 if(healing?hp<=0:hp>=0&&temp>=0)return;
 const anchor=detail.anchor||document.querySelector('.health');
 const record=own(anchor,quiet()?1400:900);if(!record||document.hidden){if(record)finish(record);return;}
 anchor.classList.add('health-feedback');
 const label=detail.label||(healing?'+'+hp+' ОЗ':[
  hp<0?'−'+Math.abs(hp)+' ОЗ':'',temp<0?'−'+Math.abs(temp)+' врем.':''
 ].filter(Boolean).join(' · '));
 const delta=node(record,'health-feedback-delta '+(healing?'feedback-heal':'feedback-damage'),label);
 const combined=hp<0&&temp<0;if(combined)delta.classList.add('feedback-combined');
 // Fit once before starting the animation; never measure geometry per frame.
 const available=anchor.clientWidth-24;
 if(available>0&&delta.scrollWidth>available){
  const size=parseFloat(root.getComputedStyle(delta).fontSize)||(hp<0&&temp<0?14:18);
  const padding=combined?0:14;
  delta.style.fontSize=Math.max(9,Math.floor(size*Math.max(1,available-padding)/Math.max(1,delta.scrollWidth-padding)))+'px';
 }
 let inMeterGap=false;
 if(combined){
  const meter=anchor.querySelector('.meter'),controls=anchor.querySelector('.meter + .row');
  if(meter&&controls){
   const cardRect=anchor.getBoundingClientRect(),meterRect=meter.getBoundingClientRect(),controlsRect=controls.getBoundingClientRect(),gap=controlsRect.top-meterRect.bottom;
   if(gap>=14){
    const current=parseFloat(root.getComputedStyle(delta).fontSize)||14;
    const size=Math.min(current,Math.max(9,(gap-4)/1.1));delta.style.fontSize=size+'px';
    delta.style.top=(meterRect.bottom-cardRect.top+(gap-size*1.1)/2)+'px';inMeterGap=true;
   }
  }
 }
 if(!quiet()){
  const wash=node(record,'health-feedback-wash '+(healing?'feedback-heal':'feedback-damage'));
  animate(record,wash,[{opacity:0},{opacity:healing ? .16 : .2,offset:.22},{opacity:0}],{duration:healing?650:440});
  animate(record,delta,[{opacity:0,transform:inMeterGap?'translateY(0)':'translateY(3px)'},{opacity:1,transform:'translateY(0)',offset:.16},{opacity:1,transform:inMeterGap?'translateY(0)':'translateY(-4px)',offset:.72},{opacity:0,transform:inMeterGap?'translateY(-2px)':'translateY(-7px)'}],{duration:820});
 }
}
function roll(kind,detail){
 const degree=detail.degree;
 const success=degree==='Критический успех',failure=degree==='Критический провал';
 // The caller must supply the rules' computed degree; a natural 20/1 alone is insufficient.
 if(!success&&!failure)return;
 const anchor=detail.anchor;if(!anchor?.isConnected||document.hidden)return;
 anchor.dataset.feedbackDegree=success?'critical-success':'critical-failure';
 let label=anchor.querySelector(':scope > h3');
 if(!label){label=document.createElement('h3');anchor.append(label);}label.textContent=degree;
 const seal=anchor.querySelector('.result-seal');if(!seal||quiet())return;
 const record=own(anchor,700);if(!record)return;
 const svg=seal.querySelector('svg');if(!svg)return;
 if(success){
  const flare=node(record,'feedback-seal-flare');flare.append(svg.cloneNode(true));
  animate(record,flare,[{opacity:0,transform:'scale(.99)'},{opacity:.85,transform:'scale(1.025)',offset:.28},{opacity:0,transform:'scale(1.04)'}],{duration:600});
 }else{
  // Deform only the drawing; the result number stays centred and stationary.
  const paths=[...svg.children];
  paths.forEach((path,i)=>animate(record,path,[{transform:'rotate(0deg) scale(1)'},{transform:`rotate(${i%2?-3:3}deg) scale(1.025,.975)`,offset:.24},{transform:'rotate(0deg) scale(1)'}],{duration:390}));
 }
}
function clearError(field){
 const record=errors.get(field);if(!record)return;
 record.node.remove();field.removeEventListener('input',record.listener);
 if(record.invalid===null)field.removeAttribute('aria-invalid');else field.setAttribute('aria-invalid',record.invalid);
 const described=(field.getAttribute('aria-describedby')||'').split(/\s+/).filter(id=>id&&id!==record.node.id);
 if(described.length)field.setAttribute('aria-describedby',described.join(' '));else field.removeAttribute('aria-describedby');
 field.classList.remove('feedback-invalid');errors.delete(field);
}
function error(field,message){
 if(typeof field==='string')field=document.querySelector(field);if(!field?.isConnected)return;
 clearError(field);
 const node=document.createElement('div');node.id='feedback-error-'+(++errorId);node.className='feedback-field-error';node.setAttribute('role','alert');node.textContent=String(message||'Проверь введённое значение.');
 const invalid=field.getAttribute('aria-invalid'),described=field.getAttribute('aria-describedby');
 field.classList.add('feedback-invalid');field.setAttribute('aria-invalid','true');field.setAttribute('aria-describedby',[described,node.id].filter(Boolean).join(' '));field.insertAdjacentElement('afterend',node);
 const listener=()=>clearError(field);errors.set(field,{node,invalid,listener});field.addEventListener('input',listener);
 field.focus?.({preventScroll:true});
}
function emit(kind,detail={}){
 if(['damage','heal','health-damage','health-heal'].includes(kind))return health(kind,detail);
 if(['roll','critical-success','critical-failure'].includes(kind))return roll(kind,detail);
 if(kind==='invalid'){
  const anchor=detail.field||detail.anchor;if(!anchor?.isConnected||quiet())return;
  const record=own(anchor,360);if(record)animate(record,anchor,[{opacity:.75},{opacity:1}],{duration:240});
 }
}
function prune(){
 for(const record of [...active])if(!record.anchor.isConnected||record.nodes.some(node=>!node.isConnected))finish(record);
 for(const [field,record] of [...errors])if(!field.isConnected||!record.node.isConnected)clearError(field);
}
const app=document.querySelector('#app'),overlay=document.querySelector('#overlay');
const observer=new MutationObserver(records=>{
 if(records.some(record=>record.type==='attributes'&&record.attributeName==='data-scene'))clear();
 prune();
});
if(app)observer.observe(app,{subtree:true,childList:true,attributes:true,attributeFilter:['data-scene']});
if(overlay)observer.observe(overlay,{subtree:true,childList:true});
document.addEventListener('visibilitychange',()=>{if(document.hidden)clear();});
root.addEventListener('pagehide',clear);media?.addEventListener?.('change',()=>{if(media.matches)clear();});
root.ListFeedbackVisual={emit,clear,error,clearError};
})(window);
