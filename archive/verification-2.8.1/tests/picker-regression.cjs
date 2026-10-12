const assert=require('node:assert/strict'),fs=require('node:fs');
global.window=global;global.document={addEventListener(){}};global.CATALOG={};global.registerCatalog=(k,v)=>CATALOG[k]=v;
for(const n of ['classes','ancestries','heritages','backgrounds','class-features','ancestry-features','equipment','feats','spells'])require('../site/data/'+n+'.js');
global.Rules=require('../site/engine.js');const R=require('../site/rules-v2.js');global.ListContactDrag=()=>{};require('../site/ability-display.js');require('../site/ui-v2.js');
const db=Object.fromEntries(Object.values(CATALOG).flat().map(x=>[x.id,x]));
const dedication=db[R.archetypeData.groups.vigilante.dedications[0]];
let c=R.create();c.name='Проверка линчевателя';c.classId=CATALOG.classes.find(x=>x.slug==='animist').id;c.ancestry=CATALOG.ancestries.find(x=>x.slug==='human').id;c.level=3;c.skills={...c.skills,deception:1,acrobatics:1,athletics:1};c.feats=[dedication.id];c.levelProgress['2:Способность класса']=dedication.id;
const basic=()=>'',capture={};const ui=ListV2UI({R,$:basic,esc:String,btn:basic,ib:basic,icon:basic,note:String,empty:String,field:basic,input:basic,option:basic,open:basic,close:basic,toast:basic,cur:()=>c,change(){},render:basic,get:id=>db[id],name:id=>db[id]?.name||id,load:async()=>{},pick:async(cat,done,opts)=>{capture.opts=opts;capture.done=done;},log:basic,Store:{},state:()=>({}),db:()=>db});
(async()=>{
 ui.development();await ui.handle('advance-pick',{kind:'Способность класса',mode:'dedication'});
 let choices=CATALOG.feats.filter(capture.opts.predicate).sort(capture.opts.compare);
 const followups=choices.filter(f=>R.archetypeData.members[f.id]==='vigilante'&&!f.tags.includes('dedication'));
 assert.deepEqual(followups.map(x=>x.name).sort(),['Социальная сфера','Убежище'].sort());
 assert(!choices.some(f=>f.category!=='class'));assert(!choices.some(f=>f.id===dedication.id));
 assert.equal(R.archetypeData.members[choices[0].id],'vigilante');console.log('PASS actual paid UI predicate offers Vigilante follow-ups at 4 before other archetypes');
 const oldPaid=JSON.stringify(c);const draft=R.newLevel(c);draft.choices['Способность класса']=followups.find(x=>x.name==='Убежище').id;
 const at=R.clone(c);at.level=4;const skill=CATALOG.feats.filter(f=>f.category==='skill'&&f.level<=4).find(f=>R.featForKind(at,f,'Способность навыка',db)&&!c.feats.includes(f.id));draft.choices['Способность навыка']=skill.id;
 const p=R.previewLevel(c,draft,db);console.log('Preview missing',p.missing);assert.deepEqual(p.missing,[]);
 const result=R.commitLevel(c,draft,db);assert.equal(result.level,4);assert.equal(result.levelProgress['4:Способность класса'],draft.choices['Способность класса']);assert.deepEqual(result.freeArchetype,c.freeArchetype);assert.equal(JSON.stringify(c),oldPaid);
 console.log('PASS selected follow-up commits in ordinary class slot; free archetype unchanged');
 // Also reproduce when the level-2 dedication came from the independent Free Archetype slot.
 delete c.levelProgress['2:Способность класса'];c.freeArchetype={enabled:true,choices:{2:{id:dedication.id,override:false,reasons:[]}}};
 ui.development();await ui.handle('advance-pick',{kind:'Способность класса',mode:'dedication'});
 choices=CATALOG.feats.filter(capture.opts.predicate).sort(capture.opts.compare);assert.equal(R.archetypeData.members[choices[0].id],'vigilante');assert(choices.some(x=>x.name==='Убежище'));
 const freeDraft=R.newLevel(c);freeDraft.choices['Способность класса']=followups.find(x=>x.name==='Убежище').id;freeDraft.choices['Способность навыка']=skill.id;
 let next=R.previewLevel(c,freeDraft,db);assert(next.missing.includes(R.ARCTYPE));assert(!next.character.freeArchetype.choices[4]);
 freeDraft.choices[R.ARCTYPE]=followups.find(x=>x.name==='Социальная сфера').id;let staged=R.previewLevel(c,freeDraft,db);freeDraft.choiceOptions={};for(const set of staged.nested.filter(x=>!x.selected)){const opt=set.choices.find(x=>!db[x.id]||R.buildChoiceAvailability(staged.character,set.flag,db[x.id],db).ok);assert(opt);freeDraft.choiceOptions[set.flag]=opt.id;}next=R.commitLevel(c,freeDraft,db);assert.equal(next.freeArchetype.choices[4].id,freeDraft.choices[R.ARCTYPE]);assert.equal(next.levelProgress['4:Способность класса'],freeDraft.choices['Способность класса']);
 console.log('PASS paid and Free Archetype level-4 slots remain separate');
 const blocked=CATALOG.feats.find(f=>f.slug==='acrobat-dedication');assert.equal(R.featAvailability({...c,level:4},blocked,db).ok,false);
 for(let level=4;level<=20;level+=2){const all=CATALOG.feats.filter(f=>R.isArchetype(f)&&f.category==='class').sort(R.archetypePickOrder(c,level,db));assert.equal(R.archetypeData.members[all[0].id],'vigilante');assert(!all[0].tags.includes('dedication'));}
 console.log('PASS priority at all even levels 4–20 and dedication prerequisites retained');
 fs.writeFileSync('tests/hero.json',JSON.stringify(c,null,2));
})().catch(e=>{console.error(e);process.exit(1)});
