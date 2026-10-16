const {chromium}=require('playwright'),fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const site=path.resolve(process.argv[2]||path.join(__dirname,'../site')),out=path.resolve(process.argv[3]||'out/character-arrival');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const server=http.createServer((req,res)=>{let p=path.resolve(site,'.'+new URL(req.url,'http://local').pathname);if(p===site)p+='/index.html';if(!p.startsWith(site+'/')||!fs.existsSync(p)){res.writeHead(404).end();return;}res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.png':'image/png','.svg':'image/svg+xml','.ttf':'font/ttf','.woff':'font/woff','.woff2':'font/woff2'})[path.extname(p)]||'application/octet-stream');fs.createReadStream(p).pipe(res);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.LIST_CHROME||'/usr/bin/chromium',args:['--no-sandbox']});const results=[];
 try{
 for(const design of ['modern','fantasy']){
  const context=await browser.newContext({viewport:{width:393,height:852},serviceWorkers:'block'});
  await context.addInitScript(design=>{localStorage.setItem('list-design',design);localStorage.setItem('list-feedback-v1',JSON.stringify({visual:true,sound:false,haptics:false}));},design);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/');await page.waitForFunction(()=>window.CATALOG?.feats&&window.CATALOG?.spells&&window.ListMotion);
  await page.evaluate(()=>{
   const db=Object.fromEntries(Object.values(CATALOG).flat().map(x=>[x.id,x])),c=Rules.create();
   c.name='Меровинген';c.classId=CATALOG.classes.find(x=>x.slug==='bard').id;c.ancestry=CATALOG.ancestries.find(x=>x.slug==='human').id;
   for(const kind of Rules.initialFeatKinds(c,db)){
    const feat=CATALOG.feats.find(x=>Rules.featForKind(c,x,kind,db));if(!feat)throw Error(kind);c.feats.push(feat.id);c.levelProgress['1:'+kind]=feat.id;
   }
   for(let i=0;i<12;i++){
    const missing=Rules.classChoiceSets(c,db).filter(x=>!x.selected);if(!missing.length)break;
    for(const set of missing){if(!set.choices.length)throw Error(set.sourceName);c.classChoices[set.flag]=set.choices[0].id;}
   }
   if(Rules.creationMissing(c,db).length)throw Error('Invalid creation draft');
   localStorage.setItem('list-draft',JSON.stringify({step:4,c}));
   ListFeedback.configure({sound:true});window.__sounds=[];const emit=ListFeedback.emit;ListFeedback.emit=(kind,detail)=>{const result=emit(kind,detail);__sounds.push({kind,...result});return result;};
   window.__arrivals=[];const run=ListMotion.revealCharacter;ListMotion.revealCharacter=function(scope){const result=run(scope);__arrivals.push({result,animations:scope.getAnimations({subtree:true}).filter(a=>a.effect.getTiming().iterations!==Infinity)});return result;};
  });
  await page.locator('[data-action="create"]').click();await page.locator('[data-action="wizard-next"]').waitFor();
  await page.evaluate(()=>scrollTo(0,200));await page.locator('[data-action="wizard-next"]').click();
  await page.waitForFunction(()=>window.__arrivals.length===1);
  const first=await page.evaluate(()=>{const state=JSON.parse(localStorage.getItem('list-state')),hero=state.characters[0];return {result:__arrivals[0].result,count:__arrivals[0].animations.length,top:scrollY,hp:hero.hp,max:Rules.calculate(hero,Object.fromEntries(Object.values(CATALOG).flat().map(x=>[x.id,x]))).maxHp,stored:JSON.stringify(state),meter:document.querySelector('.meter>div').style.transform};});
  assert.equal(first.result,true);assert(first.count>=12,'Cards and sheet sections each reveal separately');assert.equal(first.top,0);assert.equal(first.hp,first.max);
  assert.equal(await page.evaluate(()=>__sounds.filter(x=>x.kind==='level-up'&&x.sound).length),1,'Creation plays the approved fanfare once');
  assert.equal(await page.evaluate(()=>Math.max(...__arrivals[0].animations.map(a=>a.effect.getTiming().delay+a.effect.getTiming().duration))),7000);
  const entrances=await page.evaluate(()=>__arrivals[0].animations.filter(a=>a.effect.target.matches('.hero,.health,.stat,.save,.sheet-block')).map(a=>a.effect.getTiming().delay));
  assert.equal(new Set(entrances).size,entrances.length,'Every card and block has its own entrance time');
  assert(await page.locator('#app').evaluate(el=>el.inert));
  // Freeze only the new one-shot animations to inspect the entrance midway.
  await page.evaluate(()=>{for(const a of __arrivals[0].animations){a.pause();a.currentTime=a.effect.getTiming().delay+a.effect.getTiming().duration*.4;}});
  await page.screenshot({path:out+'/'+design+'-arrival.png'});
  const nav=await page.locator('.nav [data-tab="bag"]').boundingBox();await page.mouse.click(nav.x+nav.width/2,nav.y+nav.height/2);await page.keyboard.press('Enter');
  assert(await page.locator('#character-arrival-guard').count(),'Accidental input does not cancel intro');
  assert(await page.locator('#page-content').getAttribute('data-scene').then(x=>x.endsWith(':sheet')),'Input cannot switch tabs');
  await page.evaluate(async()=>{for(const a of __arrivals[0].animations)a.finish();await Promise.all(__arrivals[0].animations.map(a=>a.finished));});
  await page.locator('#character-arrival-guard').waitFor({state:'detached'});assert.equal(await page.locator('#app').evaluate(el=>el.inert),false);
  assert.equal(await page.evaluate(()=>JSON.stringify(JSON.parse(localStorage.getItem('list-state')))),first.stored,'Animation does not modify saved character');
  assert.equal(await page.locator('.meter>div').evaluate(el=>el.style.transform),first.meter);
  await page.locator('.nav [data-tab="bag"]').click();await page.locator('.nav [data-tab="sheet"]').click();assert.equal(await page.evaluate(()=>__arrivals.length),1,'Tab switches do not replay entrance');
  await page.reload();await page.locator('.hero-name').waitFor();assert.equal(await page.evaluate(()=>typeof __arrivals),'undefined','Reload does not start one-shot entrance');
  const lifecycle=await page.evaluate(async()=>{
   const scope=document.querySelector('#page-content'),finite=()=>scope.getAnimations({subtree:true}).filter(a=>a.effect.target.matches('.hero,.health,.stat,.save,.sheet-block,.meter>div,.avatar'));
   ListFeedback.configure({visual:false});const disabled=ListMotion.revealCharacter(scope);ListFeedback.configure({visual:true});
   ListMotion.revealCharacter(scope);document.body.dispatchEvent(new Event('pointerdown',{bubbles:true,cancelable:true}));document.querySelector('.nav [data-tab="bag"]').click();
   const blocked=!!document.querySelector('#character-arrival-guard')&&document.querySelector('#app').inert&&scope.dataset.scene.endsWith(':sheet');
   ListFeedback.configure({visual:false});await Promise.resolve();const switchedOff=finite().length;const released=!document.querySelector('#character-arrival-guard')&&!document.querySelector('#app').inert;ListFeedback.configure({visual:true});
   ListMotion.revealCharacter(scope);ListMotion.renderApp(document.querySelector('#app'),document.querySelector('#app').innerHTML,scope.dataset.scene);await Promise.resolve();const redrawn=finite().length;
   ListMotion.cancelCharacterReveal();
   return {disabled,blocked,switchedOff,released,redrawn};
  });assert.equal(lifecycle.disabled,false);assert.equal(lifecycle.blocked,true);assert.equal(lifecycle.switchedOff,0);assert.equal(lifecycle.released,true);assert(lifecycle.redrawn>=12);
  await page.evaluate(()=>ListMotion.revealCharacter(document.querySelector('#page-content')));await page.emulateMedia({reducedMotion:'reduce'});
  await page.locator('#character-arrival-guard').waitFor({state:'detached'});assert.equal(await page.locator('#app').evaluate(el=>el.inert),false);
  assert.equal(await page.evaluate(()=>ListMotion.revealCharacter(document.querySelector('#page-content'))),false);
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.evaluate(()=>{ListMotion.revealCharacter(document.querySelector('#page-content'));Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));Object.defineProperty(document,'hidden',{configurable:true,value:false});});
  assert.equal(await page.locator('#app').evaluate(el=>el.inert),false);assert.equal(await page.locator('#character-arrival-guard').count(),0);
  // Check natural completion on the actual clock, not just manual animation finish.
  await page.evaluate(()=>{window.__introStarted=performance.now();ListMotion.revealCharacter(document.querySelector('#page-content'));});
  await page.waitForTimeout(4000);await page.keyboard.press('Enter');
  const lockedAtFour=await page.evaluate(()=>!!document.querySelector('#character-arrival-guard')&&document.querySelector('#app').inert);assert(lockedAtFour,'Input stays locked beyond the old3.5-second duration');
  await page.locator('#character-arrival-guard').waitFor({state:'detached',timeout:9000});
  const elapsed=await page.evaluate(()=>performance.now()-__introStarted);assert(elapsed>=6900&&elapsed<8200,'Natural intro lasts about seven seconds');
  assert.equal(await page.locator('#app').evaluate(el=>el.inert),false);
  await page.evaluate(()=>{ListFeedback.configure({sound:true});window.__sounds=[];const emit=ListFeedback.emit;ListFeedback.emit=(kind,detail)=>{const result=emit(kind,detail);__sounds.push({kind,...result});return result;};});
  await page.locator('[data-action="level"]').first().click();
  for(let i=0;i<12&&await page.locator('[data-action="advance-apply"]').isDisabled();i++){
   await page.locator('[data-action="advance-pick"]:not(.selected),[data-action="advance-option"]:not(.selected)').first().click();
   await page.locator('[data-action="pick"]:not([disabled]),[data-action="advance-skill"]:not([disabled]),[data-action="advance-option-set"]:not([disabled])').first().click();
  }
  await page.locator('[data-action="advance-apply"]').click();
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('list-state')).characters[0].level),2);
  assert.equal(await page.evaluate(()=>__sounds.filter(x=>x.kind==='level-up'&&x.sound).length),1,'Saved level gain plays the fanfare once');
  await page.locator('.nav [data-tab="catalog"]').click();await page.locator('#catalog-results').waitFor();
  assert.deepEqual(errors,[]);results.push({design,passed:true,created_and_saved:true,hp_unchanged:true,no_replay:true,reduced_motion:true,visual_preference:true,duration_ms:7000,input_blocked_until_end:true,accidental_input_does_not_cancel:true,background_redraw_preserves_intro:true,unlocks_on_completion:true,unlocks_on_background:true,navigation_after_completion:true,physical_device_tested:false});await context.close();
 }
 fs.writeFileSync(out+'/results.json',JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify(results));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
