/* Event-driven card feedback. Character state and rule calculations stay elsewhere. */
(function(root){'use strict';
const media=root.matchMedia?.('(prefers-reduced-motion: reduce)'),active=new Set(),owners=new WeakMap(),errors=new Map(),criticalMarks=new Set();
let errorId=0;
const quiet=()=>document.hidden||!!media?.matches;
function finish(record){
 if(!active.delete(record))return;
 clearTimeout(record.timer);
 for(const node of record.nodes)node.remove();
 for(const animation of record.animations)animation.cancel();
 record.anchor.classList.remove('health-feedback','interaction-feedback');
 if(owners.get(record.anchor)===record)owners.delete(record.anchor);
}
function beginRoll(){
 for(const record of [...active])if(record.critical)finish(record);
 for(const anchor of criticalMarks){delete anchor.dataset.feedbackDegree;anchor.querySelector(':scope > .feedback-roll-label')?.remove();}
 criticalMarks.clear();
}
function clear(){beginRoll();for(const record of [...active])finish(record);root.ListPolish?.clearFrames?.();}
function settleCritical(record){
 if(!active.has(record))return;clearTimeout(record.timer);record.timer=null;
 for(const {el,frame} of record.finalStyles)for(const key of ['opacity','transform'])if(frame[key]!==undefined)el.style[key]=String(frame[key]);
 for(const animation of record.animations)animation.cancel();record.animations.length=0;record.finalStyles.length=0;
 for(const el of record.nodes.filter(el=>el.classList.contains('feedback-seal-spark')))el.remove();
 record.nodes=record.nodes.filter(el=>el.isConnected);
}
function pause(){for(const record of [...active])record.critical?settleCritical(record):finish(record);}
function own(anchor,duration){
 if(!anchor?.isConnected)return null;
 const old=owners.get(anchor);if(old)finish(old);
 const record={anchor,nodes:[],animations:[],finalStyles:[],timer:null};active.add(record);owners.set(anchor,record);
 record.timer=setTimeout(()=>finish(record),duration);return record;
}
 function node(record,cls,text){
 const el=document.createElement('span');el.className=cls;el.setAttribute('aria-hidden','true');
 if(text!==undefined)el.textContent=text;record.anchor.append(el);record.nodes.push(el);return el;
}
function animate(record,el,frames,options){
 if(quiet()||!el?.animate)return;
 const animation=el.animate(frames,{easing:'cubic-bezier(.2,.7,.3,1)',...options});record.animations.push(animation);record.finalStyles.push({el,frame:frames.at(-1)});
 animation.finished.catch(()=>{});return animation;
}
function health(kind,detail){
 const hp=Number(detail.hpDelta)||0,temp=Number(detail.tempDelta)||0;
 const healing=kind==='heal'||kind==='health-heal';
 if(healing?hp<=0:hp>=0&&temp>=0)return;
 const anchor=detail.anchor||document.querySelector('.health');
 root.ListPolish?.frame(anchor,healing?'heal':'damage');
 const reduced=quiet(),record=own(anchor,reduced?1400:1150);
 if(!record||document.hidden){if(record)finish(record);return;}
 anchor.classList.add('health-feedback');
 // Show the actual loss including absorbed temporary HP, or the capped healing gain.
 const amount=healing?hp:Math.max(0,-hp)+Math.max(0,-temp);
 const delta=node(record,'health-feedback-delta '+(healing?'feedback-heal':'feedback-damage'),String(amount));
 const available=anchor.clientWidth-24;
 if(available>0&&delta.scrollWidth>available){
  const size=parseFloat(root.getComputedStyle(delta).fontSize)||27;
  delta.style.fontSize=Math.max(12,Math.floor(size*available/delta.scrollWidth))+'px';
 }
 // Measure once. The number starts below HP, then moves independently of the card.
 const card=anchor.getBoundingClientRect(),meter=anchor.querySelector('.meter'),controls=anchor.querySelector('.meter + .row');
 if(meter){
  const m=meter.getBoundingClientRect(),gap=controls?controls.getBoundingClientRect().top-m.bottom:24;
  delta.style.top=(m.bottom-card.top+Math.max(10,gap/2))+'px';
 }
 if(reduced||!delta.animate){delta.style.opacity='1';return;}
 const angle=Math.random()*Math.PI*2,distance=76+Math.random()*32;
 const origin=delta.getBoundingClientRect(),cx=origin.left+origin.width/2,cy=origin.top+origin.height/2;
 const marginX=12+origin.width/2,marginY=12+origin.height/2;
 const dx=Math.max(marginX-cx,Math.min(root.innerWidth-marginX-cx,Math.cos(angle)*distance));
 const dy=Math.max(marginY-cy,Math.min(root.innerHeight-marginY-cy,Math.sin(angle)*distance));
 const tilt=(Math.random()-.5)*18,position=(t)=>`translate(calc(-50% + ${dx*t}px),calc(-50% + ${dy*t}px)) rotate(${tilt*t}deg)`;
 const wash=node(record,'health-feedback-wash '+(healing?'feedback-heal':'feedback-damage'));
 animate(record,wash,[{opacity:0},{opacity:healing?.16:.2,offset:.22},{opacity:0}],{duration:healing?650:440,fill:'forwards'});
 const flight=animate(record,delta,[{opacity:0,transform:position(0)},{opacity:1,transform:position(.06),offset:.08},{opacity:.85,transform:position(.45),offset:.5},{opacity:0,transform:position(1)}],{duration:1000,fill:'forwards',easing:'cubic-bezier(.15,.55,.3,1)'});
 // The hidden base style and filled last frame prevent the old end-of-animation flash.
 flight?.finished.then(()=>finish(record),()=>{});
}
function roll(kind,detail){
 const degree=detail.degree,success=degree==='Критический успех',failure=degree==='Критический провал';
 if(!success&&!failure)return;
 const anchor=detail.anchor;if(!anchor?.isConnected||document.hidden)return;
 root.ListPolish?.frame(anchor,success?'gold':'damage');
 anchor.dataset.feedbackDegree=success?'critical-success':'critical-failure';criticalMarks.add(anchor);
 let label=anchor.querySelector(':scope > h3');
 if(!label){label=document.createElement('h3');label.className='feedback-roll-label';anchor.append(label);}label.textContent=detail.label||degree;
 const seal=anchor.querySelector('.result-seal');if(!seal||quiet())return;
 const record=own(anchor,1200),svg=seal.querySelector('svg');if(!record)return;if(!svg){finish(record);return;}record.critical=true;clearTimeout(record.timer);record.timer=setTimeout(()=>settleCritical(record),1150);
 const ring=node(record,'feedback-seal-ring '+(success?'feedback-victory':'feedback-fracture'));
 animate(record,ring,[{opacity:0,transform:'scale(.78)'},{opacity:success?.85:.7,transform:'scale(1)',offset:.18},{opacity:success?.42:.28,transform:`scale(${success?1.16:1.12})`}],{duration:success?1000:650,fill:'forwards'});
 if(success){
  const flare=node(record,'feedback-seal-flare');flare.append(svg.cloneNode(true));
  animate(record,flare,[{opacity:0,transform:'scale(.93)'},{opacity:1,transform:'scale(1.04)',offset:.22},{opacity:.26,transform:'scale(1.035)'}],{duration:900,fill:'forwards'});
 }else{
  // Broken compass quadrants fly apart; the original drawing settles in red.
  for(let i=0;i<4;i++){
   const fragment=node(record,'feedback-seal-fragment');fragment.append(svg.cloneNode(true));
   fragment.style.clipPath=['polygon(0 0,50% 0,50% 50%,0 50%)','polygon(50% 0,100% 0,100% 50%,50% 50%)','polygon(0 50%,50% 50%,50% 100%,0 100%)','polygon(50% 50%,100% 50%,100% 100%,50% 100%)'][i];
   const x=(i%2?1:-1)*(14+i*2),y=(i<2?-1:1)*18;
   animate(record,fragment,[{opacity:0,transform:'translate(0,0) rotate(0deg)'},{opacity:.95,transform:'translate(0,0) rotate(0deg)',offset:.12},{opacity:.42,transform:`translate(${x*.5}px,${y*.5}px) rotate(${i%2?7:-7}deg)`}],{duration:700,fill:'forwards'});
  }
  [...svg.children].forEach((path,i)=>animate(record,path,[{transform:'rotate(0deg) scale(1)'},{transform:`rotate(${i%2?-7:7}deg) scale(1.07,.93)`,offset:.2},{transform:'rotate(0deg) scale(1)'}],{duration:500,fill:'forwards'}));
 }
 const count=success?10:8;
 for(let i=0;i<count;i++){
  const spark=node(record,'feedback-seal-spark '+(success?'feedback-victory':'feedback-fracture'));
  const angle=(i/count)*Math.PI*2-Math.PI/2,radius=success?94:80;
  const x=Math.cos(angle)*radius,y=Math.sin(angle)*radius+(success?-6:18);
  animate(record,spark,[{opacity:0,transform:'translate(0,0) scale(.4) rotate(45deg)'},{opacity:1,transform:`translate(${x*.45}px,${y*.45}px) scale(1) rotate(45deg)`,offset:.22},{opacity:0,transform:`translate(${x}px,${y}px) scale(.2) rotate(${success?135:225}deg)`}],{duration:success?1000:850,delay:i*12,fill:'forwards'});
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
 if(kind==='equipment'||kind==='coins'){
  if(quiet()||!detail.anchor?.isConnected)return false;
  const equipment=kind==='equipment',record=own(detail.anchor,equipment?1900:650);if(!record)return false;
  if(kind==='equipment'&&detail.equipmentChanged){
   const state=detail.anchor.querySelector('.equipment-state');
   if(state)animate(record,state,detail.equipped?
    [{opacity:.55,transform:'translateY(2px)'},{opacity:1,transform:'translateY(0)'}]:
    [{opacity:.5},{opacity:1}],{duration:1260});
  }
  record.anchor.classList.add('interaction-feedback');
  const shine=node(record,'interaction-feedback-shine');
  const animation=animate(record,shine,[{opacity:0},{opacity:detail.equipped?.4:.22,offset:.4},{opacity:0}],{duration:equipment?1560:520,fill:'forwards',easing:'cubic-bezier(.35,0,.25,1)'});
  if(animation)animation.finished.catch(()=>{}).then(()=>finish(record));else finish(record);
  return true;
 }
 if(['damage','heal','health-damage','health-heal'].includes(kind))return health(kind,detail);
 if(['roll','critical-success','critical-failure'].includes(kind)){beginRoll();return roll(kind,detail);}
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
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
root.addEventListener('pagehide',pause);media?.addEventListener?.('change',()=>{if(media.matches)pause();});
root.ListFeedbackVisual={emit,clear,beginRoll,error,clearError};
})(window);
