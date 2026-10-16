/* A small damped fluid surface, drawn behind the existing glass artwork.
   The saved HP is always authoritative. At rest there is no animation loop. */
(function(root){'use strict';
const reduced=root.matchMedia?.('(prefers-reduced-motion: reduce)'),states=new Map();
const clamp=n=>Math.max(0,Math.min(1,Number(n)||0));
const moving=()=>!document.hidden&&!reduced?.matches&&root.ListFeedback?.prefs?.().visual!==false;
function stop(s){if(s.frame)root.cancelAnimationFrame(s.frame);s.frame=0;}
function surface(s,t){
 const progress=clamp((t-s.start)/s.duration),ease=1-Math.pow(1-progress,3);
 return s.from+(s.target-s.from)*ease;
}
function draw(s,t){
 const canvas=s.canvas,ctx=s.ctx,w=s.width,h=s.height;if(!w||!h)return;
 ctx.clearRect(0,0,w,h);
 const amount=clamp(s.running?surface(s,t):s.target);if(!amount)return;
 const elapsed=Math.max(0,t-(s.start??t)),wake=s.running&&t>=s.start&&moving();
 // Leave a narrow air gap, even when the hero has full health.
 const level=h*(.98-.88*amount),decay=wake?Math.exp(-elapsed/570):0;
 const strength=Math.min(h*.13,Math.max(h*.045,Math.abs(s.target-s.from)*h*.4))*decay;
 function y(x){if(!strength)return level;const u=x/w;return level+strength*(Math.sin(elapsed/140+u*5.4)*.7+Math.sin(elapsed/210-u*8.1)*.3)+strength*Math.cos(elapsed/190)*(u-.5)*.8;}
 ctx.beginPath();ctx.moveTo(0,h);ctx.lineTo(0,y(0));
 for(let x=2;x<w;x+=2)ctx.lineTo(x,y(x));ctx.lineTo(w,y(w));ctx.lineTo(w,h);ctx.closePath();
 const liquid=ctx.createLinearGradient(0,Math.max(0,level-2),0,h);
 liquid.addColorStop(0,'#b35a45');liquid.addColorStop(.19,'#8d3027');liquid.addColorStop(.67,'#641d1a');liquid.addColorStop(1,'#310e12');
 ctx.fillStyle=liquid;ctx.fill();ctx.save();ctx.clip();
 const depth=ctx.createLinearGradient(0,0,w,0);depth.addColorStop(0,'#1e090b66');depth.addColorStop(.14,'#ffffff00');depth.addColorStop(.8,'#ffffff00');depth.addColorStop(1,'#21090b88');ctx.fillStyle=depth;ctx.fillRect(0,0,w,h);
 if(wake&&s.target>s.from&&amount>.12){
  for(let i=0;i<2;i++){const rise=((elapsed/1100+i*.47)%1),x=w*(.32+i*.37),cy=h-rise*(h-level);
   ctx.beginPath();ctx.arc(x,cy,Math.max(.45,h*.035)*(1-rise*.3),0,Math.PI*2);ctx.strokeStyle=`rgba(235,180,144,${Math.sin(rise*Math.PI)*decay*.34})`;ctx.lineWidth=.55;ctx.stroke();}
 }
 ctx.restore();ctx.beginPath();ctx.moveTo(0,y(0));for(let x=2;x<w;x+=2)ctx.lineTo(x,y(x));ctx.lineTo(w,y(w));ctx.strokeStyle='rgba(244,177,142,.48)';ctx.lineWidth=.7;ctx.stroke();
}
function tick(s,t){
 s.frame=0;if(!s.canvas.isConnected||!moving()||!s.visible){settle(s);return;}
 draw(s,t);
 if(t>=s.start+s.duration+1450){settle(s);return;}
 s.frame=root.requestAnimationFrame(time=>tick(s,time));
}
function settle(s){stop(s);s.running=false;s.from=s.target;draw(s,performance.now());}
function transition(s,from,to,delay=0,duration=740){
 stop(s);s.from=clamp(from);s.target=clamp(to);s.start=performance.now()+delay;s.duration=duration;
 s.running=moving()&&s.visible&&Math.abs(s.from-s.target)>.00001;
 if(s.running){draw(s,s.start-delay);s.frame=root.requestAnimationFrame(time=>tick(s,time));}else settle(s);
}
const observer=typeof root.IntersectionObserver==='function'?new IntersectionObserver(entries=>{
 for(const entry of entries){const s=states.get(entry.target);if(!s)continue;s.visible=entry.isIntersecting;if(!s.visible)settle(s);}
}):null;
function resize(s){
 const rect=s.canvas.getBoundingClientRect(),scale=Math.min(2,root.devicePixelRatio||1);
 if(!rect.width||!rect.height)return;
 s.width=rect.width;s.height=rect.height;const width=Math.round(rect.width*scale),height=Math.round(rect.height*scale);
 if(s.canvas.width!==width||s.canvas.height!==height){s.canvas.width=width;s.canvas.height=height;}
 s.ctx.setTransform(scale,0,0,scale,0,0);draw(s,performance.now());
}
function sync(scope=document){
 for(const [canvas,s] of states)if(!canvas.isConnected){stop(s);observer?.unobserve(canvas);states.delete(canvas);}
 for(const canvas of scope.querySelectorAll('.vial-liquid')){
  const meter=canvas.parentElement,target=clamp(meter.dataset.fill),owner=meter.dataset.owner;
  let s=states.get(canvas);
  if(!s){const ctx=canvas.getContext?.('2d');if(!ctx)continue;const rect=canvas.getBoundingClientRect();
   s={canvas,ctx,owner,target,from:target,running:false,frame:0,visible:rect.bottom>0&&rect.top<root.innerHeight};states.set(canvas,s);observer?.observe(canvas);
  }
  meter.setAttribute('data-vial-ready','');resize(s);
  if(owner!==s.owner){s.owner=owner;s.target=target;settle(s);}
  else if(target!==s.target){const from=s.running?surface(s,performance.now()):s.target;transition(s,from,target);}
 }
}
function introduce(scope,delay=1100,duration=2400){for(const s of states.values())if(scope.contains(s.canvas)&&moving())transition(s,0,s.target,delay,duration);}
function clear(){for(const s of states.values())settle(s);}
root.addEventListener('resize',()=>{for(const s of states.values())resize(s);},{passive:true});
document.addEventListener('visibilitychange',()=>{if(document.hidden)clear();});root.addEventListener('pagehide',clear);
reduced?.addEventListener?.('change',()=>{if(reduced.matches)clear();});
root.ListVial={sync,introduce,clear};
})(window);
