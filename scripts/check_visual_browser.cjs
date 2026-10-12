// Verify that decorative feedback leaves actual input, rolls and navigation intact.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
(async()=>{
 const root=path.resolve(process.argv[2]||'site'),out=path.resolve(process.argv[3]||'out/visual-check');fs.mkdirSync(out,{recursive:true});
 const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png','.webmanifest':'application/manifest+json'};
 const server=http.createServer((req,res)=>{const uri=new URL(req.url,'http://localhost').pathname,file=path.resolve(root,'.'+(uri==='/'?'/index.html':uri));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}res.setHeader('content-type',mime[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({executablePath:process.env.LIST_CHROME||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,serviceWorkers:'block'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.locator('[data-action="create"]').waitFor();
  await page.evaluate(()=>{const c=Rules.create();c.name='Мираэль';c.level=3;c.classId=CATALOG.classes.find(x=>x.slug==='swashbuckler').id;c.ancestry=CATALOG.ancestries.find(x=>x.slug==='human').id;c.hp=39;receiveNativeFile(JSON.stringify(c));});
  const finite=()=>page.evaluate(async()=>{await Promise.all(document.getAnimations().filter(a=>a.effect.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));});
  const clean=()=>page.evaluate(()=>{document.querySelector('#toast').classList.remove('on');});
  const snapshot=async name=>{await finite();await clean();await page.screenshot({path:path.join(out,name+'.png')});};
  const marker=async()=>{await finite();return page.evaluate(()=>{const a=document.querySelector('.nav button.on').getBoundingClientRect(),b=document.querySelector('.nav-active-surface').getBoundingClientRect();return [Math.abs(a.left-b.left),Math.abs(a.top-b.top),Math.abs(a.width-b.width),Math.abs(a.height-b.height)];});};
  assert((await marker()).every(x=>x<1));await snapshot('sheet-light');
  const cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');
  const metric=async()=>Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x=>[x.name,x.value]));
  const idleBefore=await metric();await page.waitForTimeout(650);const idleAfter=await metric();
  const idleLayouts=idleAfter.LayoutCount-idleBefore.LayoutCount;assert.equal(idleLayouts,0);
  await page.locator('[data-tab="catalog"]').click();assert((await marker()).every(x=>x<1));
  await page.waitForTimeout(700);const hint=await page.locator('#catalog-search').getAttribute('placeholder');await page.waitForTimeout(160);assert.notEqual(await page.locator('#catalog-search').getAttribute('placeholder'),hint);
  await page.locator('#catalog-search').fill('Огненный шар');await page.waitForTimeout(200);assert.equal(await page.locator('#catalog-search').inputValue(),'Огненный шар');
  await page.locator('#catalog-search').fill('');await page.locator('#catalog-search').blur();await snapshot('catalog-light');
  await page.locator('[data-tab="sheet"]').click();await finite();
  // Pointer and keyboard feedback must not intercept the action or leak overlays.
  const button=page.locator('[data-action="health"]').first();await button.focus();await page.keyboard.press('Enter');await page.locator('#health-amount').waitFor();
  await page.locator('#health-amount').fill('5');await page.locator('[data-action="health-save"]').click();await finite();assert.equal(await page.locator('.hp>b').textContent(),'34');
  await page.waitForTimeout(500);assert.equal(await page.locator('.ink-surface').count(),0);
  await page.locator('[data-action="check"]').first().click();await page.evaluate(()=>{Rules.roll=()=>17;});
  const bonus=Number(await page.locator('[data-action="table-roll"]').getAttribute('data-bonus'));await page.locator('[data-action="table-roll"]').click();
  assert.equal(await page.locator('#table-check-result .dice-result>b').textContent(),String(17+bonus));assert(await page.locator('#table-check-result').innerText().then(t=>t.includes('На кости 17')));
  assert.equal(await page.locator('.result-seal[aria-hidden="true"]').count(),1);await snapshot('result-light');
  await page.locator('[data-action="close"]').first().click();await page.locator('[data-action="settings"]').click();await page.locator('[data-action="theme-toggle"]').click();await page.locator('[data-action="close"]').click();await finite();assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');await snapshot('sheet-dark');
  await page.locator('[data-action="check"]').first().click();await page.locator('[data-action="table-roll"]').click();await snapshot('result-dark');await page.locator('[data-action="close"]').first().click();await finite();
  const layouts=[];
  for(const width of [320,390,1280]){await page.setViewportSize({width,height:900});await finite();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);const delta=await marker();assert(delta.every(x=>x<1),JSON.stringify({width,delta}));layouts.push({width,markerMatchesButton:true,noHorizontalOverflow:true});}
  await snapshot('desktop-dark');
  await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(100);
  await page.locator('[data-tab="catalog"]').click();await page.waitForTimeout(700);const staticHint=await page.locator('#catalog-search').getAttribute('placeholder');await page.waitForTimeout(150);assert.equal(await page.locator('#catalog-search').getAttribute('placeholder'),staticHint);
  assert.equal(await page.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').length),0);assert.equal(await page.locator('.ink-surface').count(),0);
  await page.emulateMedia({reducedMotion:'no-preference'});await page.locator('[data-tab="sheet"]').click();await finite();
  await page.evaluate(()=>{const b=document.querySelector('.stat'),r=b.getBoundingClientRect();ListVisual.press(b,r.left+5,r.top+5);Object.defineProperty(document,'hidden',{value:true,configurable:true});document.dispatchEvent(new Event('visibilitychange'));});
  assert.equal(await page.locator('.ink-surface').count(),0);assert(await page.locator('html').getAttribute('data-ui-paused').then(x=>x!==null));
  await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
  assert.deepEqual(errors,[]);
  const report={passed:true,layouts,idleSheetLayouts:idleLayouts,checks:['typed input unchanged','keyboard action and HP persistence','roll total stays exact','decorations hidden from accessibility tree','pointer feedback cleans up','light and dark layouts','navigation indicator aligns after resize','reduced motion stops decorative motion','visibility event clears overlays'],errors,limitation:'Chromium with local HTTP; hardware Safari/Android execution and actual device FPS not measured.'};
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));await context.close();
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
