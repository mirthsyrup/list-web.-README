/* Separate Free Archetype slots; explicit, selection-specific GM exceptions. */
(function(root){'use strict';
const DATA=root.LIST_ARCHETYPES||(typeof require!=='undefined'?require('./data/archetypes.js'):null);
const KIND='Бесплатная способность архетипа';
function install(R){
 const before={create:R.create,validate:R.validateCharacter,plan:R.levelPlan,availability:R.featAvailability,kind:R.featForKind};
 const defaults=()=>({enabled:false,choices:{}});
 R.ARCTYPE=KIND;R.archetypeData=DATA;
 R.create=()=>({...before.create(),freeArchetype:defaults(),archetypeExceptions:{}});
 R.validateCharacter=function(x){const c=before.validate(x),f=R.clone(x.freeArchetype??defaults()),ex=R.clone(x.archetypeExceptions??{});const obj=v=>v&&typeof v==='object'&&!Array.isArray(v),record=v=>obj(v)&&typeof v.id==='string'&&v.id.length>0&&v.id.length<=100&&typeof v.override==='boolean'&&Array.isArray(v.reasons)&&v.reasons.length<=30&&v.reasons.every(t=>typeof t==='string'&&t.length<=2000);
 if(!obj(f)||typeof f.enabled!=='boolean'||!obj(f.choices)||Object.keys(f.choices).length>10)throw Error('Повреждены бесплатные выборы архетипа.');
 const ids=new Set();for(const [level,v]of Object.entries(f.choices)){if(!/^(2|4|6|8|10|12|14|16|18|20)$/.test(level)||+level>c.level||!record(v)||!c.feats.includes(v.id)||ids.has(v.id))throw Error('Повреждён выбор архетипа.');ids.add(v.id);}
 if(!obj(ex)||Object.keys(ex).length>3000)throw Error('Повреждены исключения мастера.');for(const [id,v]of Object.entries(ex))if(id!==v.id||!record(v)||!v.override||!c.feats.includes(id))throw Error('Повреждено исключение мастера.');
 c.freeArchetype=f;c.archetypeExceptions=ex;return c;};
 R.levelPlan=(c,db,from=c.level,to=c.level)=>before.plan(c,db,from,to).map(p=>({...p,picks:[...p.picks,...(c.freeArchetype?.enabled&&p.level%2===0?[KIND]:[])]}));
 R.archetypeSlots=c=>Array.from({length:Math.floor(c.level/2)},(_,i)=>({level:(i+1)*2,choice:c.freeArchetype?.choices[(i+1)*2]||null}));
 R.archetypeAtLevel=function(c,level){const next=R.clone(c);next.level=level;const future=new Set(Object.entries(c.levelProgress||{}).filter(([k])=>+k.split(':')[0]>level).map(([,v])=>v));for(const [n,v]of Object.entries(c.freeArchetype?.choices||{}))if(+n>=level)future.add(v.id);next.feats=next.feats.filter(id=>!future.has(id));return next;};
 R.archetypeOwned=(c,db)=>new Set(R.features(c,db).map(f=>f.id));
 const ded=id=>DATA.groups[DATA.members[id]]?.dedications.includes(id);
 R.isArchetype=f=>!!f&&(!!DATA.members[f.id]||f.tags?.includes('archetype'));
 function unmet(c,f,db,{free=false,other=false,facts=null,ignoreLevel=false,dedicationSource=''}={}){
 const reasons=[],owned=facts?.owned||R.archetypeOwned(c,db),ranks=facts?.ranks||R.calculate(c,db).skillRanks;
 if(!ignoreLevel&&f.level>c.level)reasons.push('Нужен '+f.level+' уровень; сейчас '+c.level+'.');
 if(f.category!=='class'&&free)reasons.push('Бесплатный выбор предназначен для способности класса архетипа. Эта способность относится к другой категории.');
 if(other)reasons.push('Связь этой способности с выбранным архетипом не указана в справочнике. Доступ и уровень её получения нужно согласовать с мастером.');
 const attr=DATA.attributes[f.id]||[];const attrOk=a=>a.any?a.any.some(attrOk):c.attributes[a.stat]>=a.value,attrLabel=a=>a.any?a.any.map(attrLabel).join(' или '):R.ATTRS[a.stat]+': нужно '+R.signed(a.value)+'; сейчас '+R.signed(c.attributes[a.stat]);for(const a of attr)if(!attrOk(a))reasons.push(attrLabel(a)+'.');
 function ok(q){if(q.any)return q.any.some(ok);if(q.skill)return(ranks[q.skill]||0)>=q.rank;if(q.feat)return owned.has(q.feat);return false;}
 function label(q){if(q.any)return q.any.map(label).join(' или ');if(q.skill)return R.SKILLS[q.skill]?.[0]+' · '+R.RANKS[q.rank];if(q.feat)return db[q.feat]?.name||'Предварительная способность';return f.prereq||'Условия из описания';}
 for(const q of f.mechanics?.requirements||[])if(!ok(q))reasons.push('Требуется: '+label(q)+'.');
 if(ded(f.id)){
  const group=DATA.members[f.id];if(f.tags?.includes('multiclass')&&db[c.classId]?.slug===group)reasons.push('Нельзя взять мультиклассовое посвящение своего класса.');
  for(const id of owned)if(ded(id)&&DATA.members[id]!==group){const g=DATA.members[id],social=g==='vigilante'&&db[dedicationSource]?.slug==='social-purview'&&owned.has(dedicationSource);if(social)continue;const count=[...owned].filter(x=>DATA.members[x]===g&&!ded(x)).length;if(count<2)reasons.push('Перед новым посвящением нужны ещё '+(2-count)+' способности архетипа «'+(db[id]?.name||g)+'».');}
 }else if(DATA.members[f.id]){const g=DATA.groups[DATA.members[f.id]];if(!g.dedications.some(id=>owned.has(id)))reasons.push('Сначала нужно посвящение: '+g.dedications.map(id=>db[id]?.name||'Посвящение архетипа').join(' или ')+'.');}
 if((f.mechanics?.unresolvedRequirements||0)>(DATA.parsedAttributeRequirements[f.id]||0))reasons.push('Проверь с мастером условия, которые лист не может проверить: '+(f.prereq||'см. описание способности')+'.');
 return [...new Set(reasons)];}
 R.archetypeRequirements=(c,f,db,options={})=>{if(!f||f.cat!=='feats')throw Error('Способность не найдена.');const reasons=unmet(c,f,db,options);return{ok:!reasons.length,reasons};};
 R.archetypeCandidates=(c,db,other=false)=>{const owned=R.archetypeOwned(c,db),groups=new Set([...owned].filter(ded).map(id=>DATA.members[id]));return Object.values(db).filter(f=>f.cat==='feats'&&!owned.has(f.id)&&(other||ded(f.id)||groups.has(DATA.members[f.id])));};
 // Keep the level-2 archetype first in ordinary class-feat substitution; Free Archetype has its own picker.
 R.archetypePickOrder=function(c,level,db){
 const owned=R.archetypeOwned(c,db),paid=c.levelProgress?.['2:Способность класса'],initialId=ded(paid)?paid:c.freeArchetype?.choices?.[2]?.id||[...R.archetypeOwned(R.archetypeAtLevel(c,2),db)].find(ded),initialGroup=DATA.members[initialId],ownedGroups=new Set([...owned].filter(ded).map(id=>DATA.members[id]));
 const priority=f=>level>2&&level%2===0&&!ded(f.id)?DATA.members[f.id]===initialGroup?0:ownedGroups.has(DATA.members[f.id])?1:2:2;
 return(a,b)=>priority(a)-priority(b)||Number(!!ded(a.id))-Number(!!ded(b.id))||a.level-b.level||a.name.localeCompare(b.name,'ru');
 };
 R.takeFreeArchetype=function(c,level,id,override,db,{other=false}={}){
 if(!c.freeArchetype?.enabled||level<2||level>c.level||level%2||c.freeArchetype.choices[level])throw Error('Этот бесплатный выбор недоступен.');
 const prior=R.archetypeSlots({...c,level:level-1}).find(s=>!s.choice);if(prior)throw Error('Сначала заполни бесплатный выбор '+prior.level+' уровня.');
 const at=R.archetypeAtLevel(c,level),f=db[id];if(!f||R.archetypeOwned(c,db).has(id))throw Error('Эта способность уже есть в листе.');
 const actualOther=other||!R.archetypeCandidates(at,db).some(f=>f.id===id),status=R.archetypeRequirements(at,f,db,{free:true,other:actualOther});
 if(!status.ok&&!override)throw Error('Не выполнены требования. Нужно отдельное разрешение мастера.');
 c.feats.push(id);c.freeArchetype.choices[level]={id,override:!!override,reasons:override?status.reasons:[]};return c;};
 R.archetypeSource=(c,id)=>{const slot=Object.entries(c.freeArchetype?.choices||{}).find(([,v])=>v.id===id);if(slot)return 'Бесплатный архетип · '+slot[0]+' уровень'+(slot[1].override?' · Исключение мастера':'');return c.archetypeExceptions?.[id]?'Исключение мастера':'';};
 R.featAvailability=(c,f,db,options={})=>{if(!R.isArchetype(f))return before.availability(c,f,db,options);const r=R.archetypeRequirements(c,f,db,options);return{ok:r.ok,reason:r.reasons.join(' ')};};
 R.featForKind=(c,f,kind,db)=>kind==='Способность класса'&&R.isArchetype(f)?f.category==='class'&&R.featAvailability(c,f,db).ok:before.kind(c,f,kind,db);
 return R;
}
const api={install,KIND,DATA};root.ListArchetypeTools=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
