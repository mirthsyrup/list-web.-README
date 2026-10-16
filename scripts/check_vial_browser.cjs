const {chromium}=require('playwright'),fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const site=path.resolve(process.argv[2]||'site'),out=path.resolve(process.argv[3]||'/workspace/vial-preview');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const server=http.createServer((req,res)=>{let p=path.resolve(site,'.'+new URL(req.url,'http://local').pathname);if(p===site)p+='/index.html';if(!p.startsWith(site+'/'))return res.writeHead(403).end();if(!fs.existsSync(p))return res.writeHead(404).end();res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf'})[path.extname(p)]||'application/octet-stream');fs.createReadStream(p).pipe(res);});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']}),results=[];
 try{for(const design of process.env.LIST_DESIGN?[process.env.LIST_DESIGN]:['modern','fantasy'])for(const theme of ['light','dark']){
  const context=await browser.newContext({viewport:{width:393,height:852},deviceScaleFactor:2,serviceWorkers:'block'});
  await context.addInitScript(({design,theme})=>{localStorage.setItem('list-design',design);localStorage.setItem('list-theme',theme);localStorage.setItem('list-feedback-v1',JSON.stringify({sound:false,haptics:false,visual:true}));},{design,theme});
  if(process.env.LIST_NATIVE)await context.addInitScript(platform=>{
   if(platform==='android')window.NativeBridge={getSavedState:()=>'',saveState:()=>true,setTheme(){},haptic(){},exportFile(){}};
   else window.webkit={messageHandlers:{saveState:{postMessage:m=>queueMicrotask(()=>window.__listStorageAck?.(m.sequence,true))},setTheme:{postMessage(){}},haptic:{postMessage(){}},exportFile:{postMessage(){}}}};
  },process.env.LIST_NATIVE);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/');await page.waitForFunction(()=>window.CATALOG?.feats&&window.CATALOG?.spells);
  await page.evaluate(()=>{const c=Rules.create();c.name='Меровинген';c.classId=CATALOG.classes.find(x=>x.slug==='swashbuckler').id;c.ancestry=CATALOG.ancestries.find(x=>x.slug==='human').id;const db=Object.fromEntries(Object.values(CATALOG).flat().map(x=>[x.id,x]));c.hp=Rules.calculate(c,db).maxHp;c.inventory=['leather-armor','chain-mail'].map((slug,i)=>({id:CATALOG.equipment.find(x=>x.slug===slug).id,uid:slug,quantity:1,equipped:!i}));receiveNativeFile(JSON.stringify(c));window.__cues=[];const emit=ListFeedback.emit;ListFeedback.emit=(kind,detail)=>{__cues.push(kind);return emit(kind,detail);};});
  const stored=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('list-state')).characters[0]);
  const initial=await stored(),max=initial.hp;assert.equal(await page.locator('.meter').getAttribute('data-fill'),'1');
  await page.locator('.health').screenshot({path:out+'/'+design+'-'+theme+'-initial.png'});
  if(design==='fantasy'){
   assert.equal(await page.locator('.vial-liquid').count(),1);assert.equal(await page.locator('.meter>div').evaluate(el=>getComputedStyle(el).visibility),'hidden');
   assert(await page.locator('.vial-liquid').evaluate(el=>el.getContext('2d').getImageData(0,0,el.width,el.height).data.some((n,i)=>i%4===3&&n>0)),await page.locator('.vial-liquid').evaluate(el=>JSON.stringify({width:el.width,height:el.height,rect:el.getBoundingClientRect(),fill:el.parentElement.dataset.fill})));
  }else assert.equal(await page.locator('.vial-liquid').count(),0);
  await page.locator('.health').screenshot({path:out+'/'+design+'-'+theme+'-full.png'});
  async function health(mode,amount){await page.locator('[data-action="health"][data-mode="'+mode+'"]').click();await page.locator('#health-amount').fill(String(amount));await page.locator('[data-action="health-save"]').click();await page.locator('.modal').waitFor({state:'detached'});}
  await health('damage',Math.ceil(max*.47));const damaged=await stored();assert.equal(damaged.hp,max-Math.ceil(max*.47));
  await page.locator('.health').screenshot({path:out+'/'+design+'-'+theme+'-wave.png'});
  if(design==='fantasy'){
   const first=await page.locator('.vial-liquid').evaluate(el=>el.toDataURL());await page.waitForTimeout(180);const next=await page.locator('.vial-liquid').evaluate(el=>el.toDataURL());assert.notEqual(first,next,'surface moves after damage');
   await page.waitForTimeout(2300);const rest=await page.locator('.vial-liquid').evaluate(el=>el.toDataURL());await page.waitForTimeout(160);assert.equal(await page.locator('.vial-liquid').evaluate(el=>el.toDataURL()),rest,'surface stops at rest');
   assert.equal((await stored()).hp,damaged.hp,'animation does not change saved HP');
   await page.locator('.health').screenshot({path:out+'/'+design+'-'+theme+'-half.png'});
   await health('damage',2);await health('heal',1);await page.waitForTimeout(2450);
   assert.equal((await stored()).hp,damaged.hp-1,'rapid changes settle at the latest saved value');
   assert.equal(Number(await page.locator('.meter').getAttribute('data-fill')),(damaged.hp-1)/max);
   await health('heal',2);await page.waitForTimeout(90);await page.locator('.health').screenshot({path:out+'/'+design+'-'+theme+'-healing.png'});
   await page.evaluate(()=>ListFeedback.configure({visual:false}));const quiet=await page.locator('.vial-liquid').evaluate(el=>el.toDataURL());await page.waitForTimeout(100);assert.equal(await page.locator('.vial-liquid').evaluate(el=>el.toDataURL()),quiet);
   await health('damage',9999);assert.equal((await stored()).hp,0);assert(await page.locator('.vial-liquid').evaluate(el=>!el.getContext('2d').getImageData(0,0,el.width,el.height).data.some(n=>n)),'zero HP leaves an empty vessel');
   await page.evaluate(()=>ListFeedback.configure({visual:true}));await page.emulateMedia({reducedMotion:'reduce'});await health('heal',2);const reduced=await page.locator('.vial-liquid').evaluate(el=>el.toDataURL());await page.waitForTimeout(110);assert.equal(await page.locator('.vial-liquid').evaluate(el=>el.toDataURL()),reduced);await page.emulateMedia({reducedMotion:'no-preference'});
   await page.evaluate(()=>ListVial.introduce(document.querySelector('#page-content')));await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));Object.defineProperty(document,'hidden',{configurable:true,value:false});});
   const background=await page.locator('.vial-liquid').evaluate(el=>el.toDataURL());await page.waitForTimeout(90);assert.equal(await page.locator('.vial-liquid').evaluate(el=>el.toDataURL()),background);
   await page.evaluate(()=>{const frame=requestAnimationFrame;window.__frames=0;window.requestAnimationFrame=callback=>{__frames++;return frame(callback);};});await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>__frames),0,'no animation frames are requested at rest');
   for(const width of [320,768]){await page.setViewportSize({width,height:852});await page.waitForTimeout(80);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert(await page.locator('.vial-liquid').evaluate(el=>el.width>0));}
   await page.setViewportSize({width:393,height:852});
  }
  await page.locator('.nav [data-tab="bag"]').click();await page.locator('[data-action="inventory"][data-uid="chain-mail"]').click();await page.locator('#item-equipped').check();await page.locator('[data-action="item-save"]').click();await page.locator('.modal').waitFor({state:'detached'});
  const row=page.locator('[data-action="inventory"][data-uid="chain-mail"]');assert.equal(await row.getAttribute('data-equipped'),'true');assert.equal(await row.locator('.equipment-state').textContent(),'Экипировано');assert(await row.locator('.equipment-state').evaluate(el=>el.getAnimations().length>0),'existing equipment label animates');
  assert.equal(await page.locator('[data-action="inventory"][data-uid="leather-armor"]').getAttribute('data-equipped'),'false');assert.equal(await page.evaluate(()=>__cues.filter(x=>x==='equipment').length),1,'armour swap has a single cue');
  await page.locator('#bag-results').screenshot({path:out+'/'+design+'-'+theme+'-equipment.png'});
  await row.click();await page.locator('[data-action="item-save"]').click();await page.locator('.modal').waitFor({state:'detached'});assert.equal(await page.evaluate(()=>__cues.filter(x=>x==='equipment').length),1,'unchanged save is quiet');
  await page.locator('.nav [data-tab="sheet"]').click();assert.equal(await page.locator('.vial-liquid').count(),design==='fantasy'?1:0);assert.deepEqual(errors,[]);results.push({design,theme,passed:true,saved_hp_unchanged:true,equipment_label:true,no_duplicate_armour_sound:true,physical_device_tested:false});await context.close();
 }
 fs.writeFileSync(out+'/results.json',JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify(results));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
