/* Verify the unified site, real design reloads, legacy URLs and offline switching. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv[2]||'http://127.0.0.1:8080';
const output=path.resolve(process.argv[3]||'out/design-browser');fs.mkdirSync(output,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.LIST_CHROME||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:393,height:852},reducedMotion:'reduce'}),page=await context.newPage();
 const errors=[];context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));page.on('pageerror',e=>errors.push(e.message));
 async function boot(url){await page.goto(base+url);await page.waitForFunction(()=>window.ListTheme&&window.CATALOG?.spells&&document.querySelector('[data-action="settings"]'));}
 async function settings(){if(!await page.locator('.modal .design-choice').count())await page.locator('[data-action="settings"]').click();await page.waitForSelector('.design-choice');}
 async function close(){await page.keyboard.press('Escape');await page.waitForSelector('.modal',{state:'detached'});}
 async function switchDesign(value){
  await settings();
  await Promise.all([page.waitForEvent('load'),page.locator(`[data-action="design-set"][data-design="${value}"]`).click()]);
  await page.waitForFunction(value=>window.ListTheme?.design()===value&&!!document.querySelector('.design-choice'),value);
  await page.waitForFunction(()=>!!window.CATALOG?.spells);
 }
 async function snapshot(){return page.evaluate(()=>JSON.parse(localStorage.getItem('list-state')));}
 async function verify(design,theme){
  assert.equal(await page.locator('html').getAttribute('data-design'),design);
  assert.equal(await page.locator('html').getAttribute('data-theme'),theme);
  assert.equal(await page.locator(`[data-design="${design}"][data-action="design-set"]`).getAttribute('aria-pressed'),'true');
  await close();await page.waitForSelector('.quick-button .action-cost');
  assert.equal(await page.locator('.hero-name h1').innerText(),'Проверка дизайна');
  assert.notEqual(await page.locator('.quick-button .action-cost').evaluate(el=>getComputedStyle(el).display),'none');
  assert.equal(await page.evaluate(()=>ListFeedback.prefs().sound),false);
  const background=await page.locator('.shell').evaluate(el=>getComputedStyle(el).backgroundImage);
  if(design==='fantasy'){assert(background.includes('leather')||background.includes('blob:'));assert(await page.locator('.art-heart').count());}
  else {assert.equal(await page.locator('.fantasy-art').count(),0);assert(!background.includes('leather'));}
  await page.locator('.nav [data-action="tab"][data-tab="bag"]').click();
  assert.equal(await page.locator('.fantasy-wallet').count(),design==='fantasy'?1:0);
  await page.locator('[data-action="tab"][data-tab="sheet"]').click();
  await page.screenshot({path:path.join(output,`${design}-${theme}.png`),fullPage:true});
  await settings();
 }
 try{
  console.log('First visit and populated library');await boot('/');
  assert.equal((await snapshot()).characters.length,0);
  await settings();await switchDesign('fantasy');await switchDesign('modern');await close();assert.equal((await snapshot()).characters.length,0);
  await page.evaluate(()=>{
   const c=Rules.create();c.name='Проверка дизайна';c.hp=7;c.tempHp=2;c.coins={gp:31,sp:12,cp:4};
   c.quickAccess=[CATALOG.actions.find(x=>x.slug==='feint').id];c.notes='Не потерять заметки';
   c.inventory=[{id:CATALOG.equipment.find(x=>x.slug==='leather-armor').id,uid:Rules.uid(),quantity:1,equipped:true}];
   const canvas=document.createElement('canvas');canvas.width=canvas.height=8;canvas.getContext('2d').fillRect(0,0,8,8);c.portrait=canvas.toDataURL('image/jpeg');
   receiveNativeFile(JSON.stringify(c));ListFeedback.configure({sound:false,volume:.2,haptics:false});
   localStorage.setItem('list-theme','light');localStorage.setItem('fantasy-list-theme','light');
  });
  const before=await snapshot();await settings();await verify('modern','light');
  await page.locator('[data-action="theme-toggle"]').click();await verify('modern','dark');
  console.log('Switch in both directions and all four appearances');await switchDesign('fantasy');await verify('fantasy','light');
  await page.locator('[data-action="theme-toggle"]').click();await verify('fantasy','dark');
  await switchDesign('modern');await verify('modern','dark');
  assert.deepEqual((await snapshot()).characters,before.characters,'Design switches preserve every character field');
  await page.screenshot({path:path.join(output,'settings.png')});
  console.log('Draft and current catalog survive design reloads');
  await close();await page.locator('[data-action="characters"]').click();await page.locator('.modal [data-action="create"]').click();
  await page.locator('#wizard-name').fill('Черновик героя');const draft=await page.evaluate(()=>{const draft=JSON.parse(localStorage.getItem('list-draft'));draft.c=Rules.validateCharacter(draft.c);return draft;});
  await switchDesign('fantasy');await close();assert.equal(await page.locator('#wizard-name').inputValue(),'Черновик героя');
  assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('list-draft'))),draft);
  await page.locator('[data-action="wizard-cancel"]').click();await page.locator('[data-action="wizard-discard"]').click();
  await page.locator('.nav [data-action="tab"][data-tab="catalog"]').click();await page.locator('[data-action="category"][data-cat="conditions"]').click();
  await page.waitForFunction(()=>!!window.CATALOG?.conditions);await switchDesign('modern');await close();
  await page.waitForSelector('#catalog-results .item');assert(await page.locator('[data-action="category"][data-cat="conditions"]').getAttribute('class').then(value=>value.includes('on')));
  await page.locator('.nav [data-action="tab"][data-tab="sheet"]').click();await settings();
  console.log('Save failure prevents reload and changing the design');
  await page.evaluate(()=>{window.__testSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key.startsWith('list-state')||key==='list-design')throw new DOMException('Quota','QuotaExceededError');return window.__testSetItem.call(this,key,value);};});
  const frame=await page.evaluate(()=>performance.timeOrigin);await page.locator('[data-action="design-set"][data-design="fantasy"]').click();
  await page.waitForFunction(()=>document.querySelector('#toast')?.textContent.includes('Не удалось сохранить'));
  assert.equal(await page.evaluate(()=>performance.timeOrigin),frame);assert.equal(await page.locator('html').getAttribute('data-design'),'modern');
  await page.evaluate(()=>{Storage.prototype.setItem=window.__testSetItem;});
  console.log('Canonical and legacy URLs');await boot('/fantasy/');await page.waitForFunction(()=>ListTheme.design()==='fantasy');
  assert.equal(new URL(page.url()).pathname,new URL(base+'/').pathname);await settings();
  assert.deepEqual((await snapshot()).characters,before.characters);await switchDesign('modern');
  await boot('/site/');assert.equal(await page.evaluate(()=>ListTheme.design()),'modern');await settings();await switchDesign('fantasy');await verify('fantasy','dark');
  console.log('Offline reloads and design switches');await boot('/');
  await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  await context.setOffline(true);await settings();await switchDesign('modern');await verify('modern','dark');
  await switchDesign('fantasy');await verify('fantasy','dark');
  assert.deepEqual((await snapshot()).characters,before.characters);
  await boot('/fantasy/');await page.waitForFunction(()=>ListTheme.design()==='fantasy');
  assert.equal(new URL(page.url()).pathname,new URL(base+'/').pathname);
  console.log('Damaged storage remains untouched');
  const damaged=await browser.newContext({reducedMotion:'reduce'});await damaged.addInitScript(()=>localStorage.setItem('list-state','{invalid'));
  const bad=await damaged.newPage();await bad.goto(base+'/site/');await bad.waitForSelector('[data-action="settings"]');await bad.locator('[data-action="settings"]').click();
  await bad.locator('[data-action="design-set"][data-design="fantasy"]').click();await bad.waitForFunction(()=>document.querySelector('#toast')?.textContent.includes('Сначала восстанови'));
  assert.equal(await bad.evaluate(()=>localStorage.getItem('list-state')),'{invalid');assert.equal(await bad.locator('html').getAttribute('data-design'),'modern');await damaged.close();
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({fourAppearances:true,dataPreserved:true,saveFailureBlocked:true,legacyRedirect:true,offlineSwitching:true,draftPreserved:true,damagedStorageProtected:true,errors},null,2)+'\n');
  console.log('All design checks passed');
 }finally{await context.close();await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
