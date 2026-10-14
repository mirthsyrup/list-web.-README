/* A separate demo on first visit; never imports or reads the original store. */
(async()=>{
 // The app writes an empty journal during startup. Its mere existence does not
 // mean the user already has a character; preserve populated or unreadable data.
 if(localStorage.getItem('fantasy-demo-initialized'))return;
 const raw=localStorage.getItem('fantasy-list-state');
 if(raw){try{const record=JSON.parse(raw),state=record.body?JSON.parse(record.body):record;if(state.characters?.length)return;}catch{return;}}
 const load=cat=>new Promise((resolve,reject)=>{if(CATALOG[cat])return resolve();const s=document.createElement('script');s.src='../site/data/'+cat+'.js';s.onload=resolve;s.onerror=reject;document.head.append(s);});
 try{
  await Promise.all(['feats','actions'].map(load));
  const find=(cat,slug)=>CATALOG[cat].find(x=>x.slug===slug),c=Rules.create();
  c.name='Меровинген';c.demo=true;c.level=1;c.classId=find('classes','swashbuckler').id;c.ancestry=find('ancestries','human').id;c.heritage=find('heritages','versatile-human')?.id||'';c.background=find('backgrounds','acrobat')?.id||'';
  c.attributes={str:0,dex:4,con:1,int:2,wis:1,cha:2};
  c.skills=Object.fromEntries(['acrobatics','athletics','deception','diplomacy','intimidation','performance','society','stealth','thievery'].map(s=>[s,1]));
  const fleet=find('feats','fleet');if(fleet)c.feats.push(fleet.id);
  c.inventory=[{id:find('equipment','leather-armor').id,uid:Rules.uid(),quantity:1,equipped:true}];c.hp=19;
  const wanted=['Подстрекающий финт','Очаровательный лжец','Эффектное уклонение','Стильный боец'];
  c.quickAccess=[];
  for(const title of wanted){const d=[...CATALOG.feats,...CATALOG.actions,...CATALOG['class-features']].find(x=>x.name.toLowerCase()===title.toLowerCase());if(d){if(d.cat==='feats'||CATALOG.feats.includes(d)){if(!c.feats.includes(d.id))c.feats.push(d.id);}c.quickAccess.push(d.id);}}
  if(c.quickAccess.length<4){for(const slug of ['feint','demoralize','tumble-through','trip']){const d=find('actions',slug);if(d&&!c.quickAccess.includes(d.id)&&c.quickAccess.length<4)c.quickAccess.push(d.id);}}
  const portrait=new Image();portrait.src='assets/portrait.png';await portrait.decode();const canvas=document.createElement('canvas');canvas.width=160;canvas.height=160;canvas.getContext('2d').drawImage(portrait,0,0,160,160);c.portrait=canvas.toDataURL('image/jpeg',.8);
  window.receiveNativeFile(JSON.stringify(c));
  const saved=JSON.parse(localStorage.getItem('fantasy-list-state')||'{}'),state=saved.body?JSON.parse(saved.body):saved;
  if(state.characters?.length)localStorage.setItem('fantasy-demo-initialized','1');
 }catch(e){console.warn('Fantasy demo could not be prepared',e);}
})();
