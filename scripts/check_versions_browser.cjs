/* Run against a repository-root HTTP server, including the public ZIP loader. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv[2]||'http://127.0.0.1:8080';
const output=path.resolve(process.argv[3]||'out/versions-browser');
fs.mkdirSync(output,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.LIST_CHROME||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:393,height:852},reducedMotion:'reduce'});
 const errors=[];context.on('page',page=>page.on('pageerror',error=>errors.push(error.message)));
 const page=await context.newPage();const results=[];
 async function boot(url){console.log('Opening',url);await page.goto(base+url);await page.waitForSelector('[data-action="create"],.hero-name');await page.waitForFunction(()=>window.CATALOG?.actions&&window.CATALOG?.spells);}
 async function ready(){await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>!!navigator.serviceWorker.controller);}
 async function close(){const button=page.locator('.modal [data-action="close"]').first();if(await button.count())await button.click();else await page.keyboard.press('Escape');}
 try{
  await boot('/');await ready();
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('list-state')).characters.length),0);
  await boot('/fantasy/');await ready();
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('list-state')).characters.length),0,'No automatic medieval demo');
  await page.evaluate(()=>{
   const c=Rules.create();c.name='Проверка двух версий';c.hp=7;
   c.quickAccess=[CATALOG.actions.find(x=>x.slug==='feint').id];
   const canvas=document.createElement('canvas');canvas.width=canvas.height=8;canvas.getContext('2d').fillRect(0,0,8,8);c.portrait=canvas.toDataURL('image/jpeg');
   window.receiveNativeFile(JSON.stringify(c));
   ListFeedback.configure({sound:false,volume:.2,haptics:false});
   localStorage.setItem('list-theme','light');localStorage.setItem('fantasy-list-theme','dark');
  });
  for(const url of ['/','/fantasy/','/site/']){
   await boot(url);await ready();await page.waitForSelector('.quick-button .action-cost');
   assert.equal(await page.locator('.hero-name h1').textContent(),'Проверка двух версий');
   assert.equal(await page.evaluate(()=>ListFeedback.prefs().sound),false);
   assert.equal(await page.locator('html').getAttribute('data-theme'),url==='/fantasy/'?'dark':'light');
   assert.equal(await page.locator('.quick-grid').evaluate(el=>getComputedStyle(el).display),'flex');
   assert.notEqual(await page.locator('.quick-button .action-cost').evaluate(el=>getComputedStyle(el).display),'none');
   await page.locator('[data-action="characters"]').click();
   assert.equal(await page.locator('.modal .avatar img').count(),1,'Character list displays the custom portrait');await close();
   await page.locator('[data-action="effects"]').first().click();
   assert.equal(await page.locator('[data-action="modifier-report"]').count(),0);
   assert(!(await page.locator('.modal').innerText()).includes('Бонусы одного типа не складываются'));await close();
   await page.locator('[data-action="conditions"]').first().click();
   assert(!(await page.locator('.modal').innerText()).includes('Число — значение состояния'));await close();
   await page.locator('[data-action="health"][data-mode="damage"]').click();
   assert(!(await page.locator('.modal').innerText()).includes('Введи итог после сопротивлений'));await close();
   await page.screenshot({path:path.join(output,url==='/fantasy/'?'fantasy.png':url==='/site/'?'simple-direct.png':'simple-public.png'),fullPage:true});
   results.push({url,sharedCharacter:true,sharedSettings:true,portrait:true,quickActionCost:true,noModifierReport:true});
  }
  const other=await context.newPage();await other.goto(base+'/fantasy/');await other.waitForSelector('.hero-name');
  await other.locator('[data-action="health"][data-mode="damage"]').click();await other.locator('#health-amount').fill('1');await other.locator('[data-action="health-save"]').click();
  await page.waitForFunction(()=>document.querySelector('.hp>b')?.textContent==='6');
  await other.evaluate(()=>ListFeedback.configure({sound:true}));await page.waitForFunction(()=>ListFeedback.prefs().sound===true);
  await page.evaluate(()=>ListFeedback.configure({sound:false}));await other.waitForFunction(()=>ListFeedback.prefs().sound===false);
  await other.close();
  results.forEach(result=>result.liveSharedUpdates=true);
  await context.setOffline(true);
  for(const url of ['/','/fantasy/','/site/']){
   await boot(url);await page.waitForSelector('.quick-button .action-cost');
   assert.equal(await page.locator('.hero-name h1').textContent(),'Проверка двух версий');
   assert(await page.evaluate(()=>[...document.images].every(image=>image.complete&&image.naturalWidth>0)),'Portraits and artwork load offline');
   await page.locator('[data-action="tab"][data-tab="catalog"]').click();await page.waitForSelector('#catalog-search');
   results.find(r=>r.url===url).offline=true;
  }
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify(results));
 }finally{await context.close();await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
