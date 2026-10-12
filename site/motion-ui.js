/* One motion lifecycle; DOM updates preserve controls instead of restarting them. */
(function(root){'use strict';
const prepared=new WeakSet(),states=new WeakMap(),folds=new WeakMap(),reducedQuery=root.matchMedia?.('(prefers-reduced-motion: reduce)'),ease='cubic-bezier(.2,.75,.25,1)';
const reduced=()=>!!reducedQuery?.matches;
const active=new Set();
function stop(el){const s=states.get(el);if(!s)return;s.cancelled=true;s.cancel();states.delete(el);}
function own(el,cancel){stop(el);const s={cancelled:false,cancel};states.set(el,s);return s;}
const key=n=>n.nodeType===1?(n.id?'id:'+n.id:n.dataset.motionKey?'motion:'+n.dataset.motionKey:n.dataset.group?'group:'+n.dataset.group:n.dataset.contactGroup?'contacts:'+n.dataset.contactGroup:n.dataset.journalGroup?'journal-group:'+n.dataset.journalGroup:n.dataset.sheetBlock?'block:'+n.dataset.sheetBlock:n.dataset.journalId?'journal:'+n.dataset.journalId:n.dataset.contactId?'contact:'+n.dataset.contactId:n.dataset.filterBlock?'filter:'+n.dataset.filterBlock:n.dataset.action?'action:'+n.dataset.action+':'+['id','uid','key','tab','cat','view','kind','value','flag','n','delta','i','target','filter'].map(k=>n.dataset[k]||'').join('|'):null):null;
const same=(a,b)=>a.nodeType===b.nodeType&&(a.nodeType!==1||a.tagName===b.tagName)&&key(a)===key(b);
function patchNode(a,b,pool){if(a.nodeType===3||a.nodeType===8){if(a.nodeValue!==b.nodeValue)a.nodeValue=b.nodeValue;return;}
 const focused=a===document.activeElement,transient=states.has(a)||folds.has(a);
 for(const x of [...a.attributes])if(!b.hasAttribute(x.name)&&!((['open','hidden'].includes(x.name)&&folds.has(a))||(x.name==='style'&&transient)||(x.name==='data-motion-open'&&folds.has(a))))a.removeAttribute(x.name);
 for(const x of b.attributes)if(a.getAttribute(x.name)!==x.value&&!((['open','hidden'].includes(x.name)&&folds.has(a))||(x.name==='style'&&transient)||(x.name==='data-motion-open'&&folds.has(a))))a.setAttribute(x.name,x.value);
 if(pool.animateLists&&['catalog-results','ability-results','bag-results','picker-results','magic-results','effects-results','archetype-results','table-results'].includes(a.id)&&a.innerHTML!==b.innerHTML){list(a,b.innerHTML);return;}
 if(a.tagName==='TEXTAREA'){if(!focused)a.value=b.value;}else children(a,b,pool);
 if(a.tagName==='INPUT'){a.checked=b.checked;a.indeterminate=b.indeterminate;if(!focused&&a.value!==b.value)a.value=b.value;}
 if(a.tagName==='SELECT'&&!focused)a.value=b.value;

}
function children(a,b,pool=new Map()){const previous=[...a.childNodes],used=new Set(),keys=new Map(previous.map(n=>[key(n),n]).filter(([k])=>k));let cursor=a.firstChild;
 for(const desired of [...b.childNodes]){let found=key(desired)?keys.get(key(desired))||pool.get(key(desired)):null;if(found&&(!same(found,desired)||used.has(found)))found=null;
 if(!found&&cursor&&!used.has(cursor)&&same(cursor,desired))found=cursor;
 if(!found&&!key(desired))found=previous.find(n=>!used.has(n)&&!key(n)&&same(n,desired));
 if(found){used.add(found);if(found!==cursor)a.insertBefore(found,cursor);pool.delete(key(desired));patchNode(found,desired,pool);cursor=found.nextSibling;}else{const node=desired.cloneNode(true);a.insertBefore(node,cursor);used.add(node);}}
 for(const old of previous)if(!used.has(old)&&old.parentNode===a){if(!pool.has(key(old)))dispose(old);old.remove();}
}
function dispose(el){if(el.nodeType!==1)return;stop(el);const f=folds.get(el);if(f){f.cancel();if(el.tagName==='DETAILS')el.open=f.show;else el.hidden=!f.show;}for(const x of el.querySelectorAll('*')){stop(x);const f=folds.get(x);if(f){f.cancel();if(x.tagName==='DETAILS')x.open=f.show;else x.hidden=!f.show;}}}
function template(html){const t=document.createElement('template');t.innerHTML=html;return t.content;}
const moving='.sheet-block,.layout-row,.journal-entry,.contact-name,.quick-button,.ability-group,.item';
function patch(el,html,{movingRows=true,lists=true}={}){if(!el)return;const focus=document.activeElement,before=movingRows?rectangles(moving,el):null,scroll=[el,...el.querySelectorAll('.modal,.tabs,.catalog-editions,.picker-list,.catalog-filter-body')].map(x=>[x,x.scrollTop,x.scrollLeft]);const pool=new Map([...el.querySelectorAll('.journal-entry,.contact-name')].map(x=>[key(x),x]));pool.animateLists=lists;children(el,typeof html==='string'?template(html):html,pool);prepare(el);if(focus?.isConnected&&document.activeElement!==focus)focus.focus({preventScroll:true});for(const [x,top,left]of scroll){x.scrollTop=top;x.scrollLeft=left;}if(before)move(before,moving,el);for(const old of pool.values())if(!old.isConnected)dispose(old);}
// Content stays visible. Ordinary updates never fade a page or result list.
function list(el,html){if(!el||el.innerHTML===html)return;patch(el,html,{movingRows:false,lists:false});}
function renderApp(el,html,scene){const t=template(html),old=el.querySelector('#page-content'),changed=old&&old.dataset.scene!==scene;if(changed)dispose(old);patch(el,t,{movingRows:!changed,lists:!changed});}
function rectangles(selector,scope=document){const out=new Map();if(reduced())return out;for(const el of scope.querySelectorAll(selector)){if(el.parentElement?.closest(selector)&&scope.contains(el.parentElement.closest(selector)))continue;const k=key(el),r=el.getBoundingClientRect();if(k&&r.height&&r.bottom>0&&r.top<root.innerHeight)out.set(k,r);}return out;}
function move(before,selector,scope=document){if(reduced())return;for(const el of scope.querySelectorAll(selector)){const old=before?.get(key(el));if(!old||!el.animate)continue;stop(el);const r=el.getBoundingClientRect(),dx=old.left-r.left,dy=old.top-r.top;if(Math.abs(dx)+Math.abs(dy)<1)continue;let a;const state=own(el,()=>a?.cancel());a=el.animate([{transform:`translate(${dx}px,${dy}px)`},{transform:'translate(0,0)'}],{duration:200,easing:ease});active.add(a);a.finished.catch(()=>{}).then(()=>{active.delete(a);if(states.get(el)===state)states.delete(el);});}}
function fold(el,show,onDone){if(!el)return;const prior=folds.get(el),from=el.getBoundingClientRect().height;const opacity=root.getComputedStyle(el).opacity;prior?.cancel();el.dataset.motionOpen=String(show);el.dispatchEvent(new CustomEvent('list-fold',{bubbles:true,detail:{open:show}}));if(el.tagName==='DETAILS')el.open=true;else el.hidden=false;
 if(reduced()||!el.animate){if(el.tagName==='DETAILS')el.open=show;else el.hidden=!show;onDone?.();return;}
 const summary=el.tagName==='DETAILS'?el.querySelector(':scope > summary'):null,end=show?el.getBoundingClientRect().height:summary?(()=>{el.open=false;const h=el.getBoundingClientRect().height;el.open=true;return h;})():0;
 const saved={height:el.style.height,overflow:el.style.overflow,marginBottom:el.style.marginBottom,paddingTop:el.style.paddingTop,paddingBottom:el.style.paddingBottom};let a;const s={show,cancel(){a?.cancel();Object.assign(el.style,saved);folds.delete(el);}};folds.set(el,s);el.style.overflow='hidden';
 const frames=[{height:from+'px'},{height:end+'px'}];if(!summary){frames[0].opacity=prior?opacity:(show?0:1);frames[1].opacity=show?1:0;}
 a=el.animate(frames,{duration:Math.min(300,Math.max(190,190+Math.abs(end-from)*.06)),easing:ease,fill:'both'});active.add(a);a.finished.catch(()=>{}).then(()=>{active.delete(a);if(folds.get(el)!==s)return;s.cancel();if(summary)el.open=show;else el.hidden=!show;onDone?.();});
}
function prepare(scope){for(const d of scope.querySelectorAll('details')){if(prepared.has(d))continue;prepared.add(d);const summary=d.querySelector(':scope > summary');if(!summary)continue;summary.addEventListener('click',e=>{if(e.target.closest('button,a,input,select'))return;e.preventDefault();const show=!(folds.get(d)?.show??d.open);fold(d,show);});}
}
function resize(el,mutate){if(!el)return;const from=el.getBoundingClientRect().height;stop(el);mutate();if(reduced()||!el.animate)return;const to=el.getBoundingClientRect().height;if(Math.abs(from-to)<1)return;const overflow=el.style.overflow;el.style.overflow='hidden';let a;const s=own(el,()=>{a?.cancel();el.style.overflow=overflow;});a=el.animate([{height:from+'px'},{height:to+'px'}],{duration:220,easing:ease,fill:'both'});active.add(a);a.finished.catch(()=>{}).then(()=>{active.delete(a);if(states.get(el)===s){s.cancel();states.delete(el);}});}
let modalState=null;
function showModal(overlay,html,kind,force=false){const existing=overlay.firstElementChild,closing=modalState?.closing,opacity=existing?root.getComputedStyle(existing).opacity:'0',desired=typeof html==='string'?template(html).firstElementChild:html;
 if(existing&&existing.querySelector('.modal')?.dataset.modalKind===kind&&!closing&&!force&&typeof html==='string'){patch(existing,desired);return;}
 modalState?.cancel();const previous=overlay.firstElementChild,next=desired;if(previous&&previous!==next)dispose(previous);next.inert=false;overlay.replaceChildren(next);prepare(next);document.body.classList.add('lock');let a,b;const s={closing:false,opening:true,cancel(){a?.cancel();b?.cancel();if(modalState===s)modalState=null;}};modalState=s;
 if(reduced()||!next.animate){s.opening=false;return;}const panel=next.querySelector('.modal');a=next.animate([{opacity:previous?opacity:0},{opacity:1}],{duration:180,easing:ease});b=panel.animate([{opacity:previous?0.5:0,transform:previous?'translateY(7px)':'translateY(18px)'},{opacity:1,transform:'translateY(0)'}],{duration:previous?170:230,easing:ease});active.add(a);active.add(b);Promise.all([a.finished.catch(()=>{}),b.finished.catch(()=>{})]).then(()=>{active.delete(a);active.delete(b);s.opening=false;});
}
function hideModal(overlay,onDone){const node=overlay.firstElementChild;if(!node){onDone?.();return;}if(modalState?.closing)return;node.inert=true;const panel=node.querySelector('.modal'),opacity=root.getComputedStyle(node).opacity,panelOpacity=root.getComputedStyle(panel).opacity,transform=root.getComputedStyle(panel).transform;modalState?.cancel();let a,b;const s={closing:true,cancel(){a?.cancel();b?.cancel();if(modalState===s)modalState=null;}};modalState=s;const finish=()=>{if(modalState!==s)return;s.cancel();if(overlay.firstElementChild===node)overlay.replaceChildren();document.body.classList.remove('lock');onDone?.();};if(reduced()||!panel?.animate){finish();return;}a=node.animate([{opacity},{opacity:0}],{duration:165,easing:'ease-in',fill:'both'});b=panel.animate([{opacity:panelOpacity,transform:transform==='none'?'translateY(0)':transform},{opacity:panelOpacity,transform:'translateY(12px)'}],{duration:165,easing:ease,fill:'both'});active.add(a);active.add(b);Promise.all([a.finished.catch(()=>{}),b.finished.catch(()=>{})]).then(()=>{active.delete(a);active.delete(b);finish();});}
document.addEventListener('click',e=>{if(modalState?.closing&&e.target.closest('#overlay')){e.preventDefault();e.stopImmediatePropagation();}},true);
function reducedChanged(){if(!reduced())return;for(const a of active)a.finish?.();}
reducedQuery?.addEventListener?.('change',reducedChanged);
root.ListMotion={patch,list,resize,renderApp,showModal,hideModal,fold,prepare,rectangles,move,reduced,closing:()=>!!modalState?.closing,expanded:el=>folds.get(el)?.show??el.open};
})(window);
