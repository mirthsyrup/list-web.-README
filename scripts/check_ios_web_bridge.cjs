// Exercise the exact inline IPA entry with the WK bridge and an empty new store.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
(async()=>{
 const root=path.resolve(process.argv[2]),out=path.resolve(process.argv[3]);fs.mkdirSync(out,{recursive:true});
 const entry=fs.readFileSync(path.join(root,'index.html'));
 const server=http.createServer((req,res)=>{if(new URL(req.url,'http://local').pathname!=='/'){res.writeHead(404);res.end();return;}res.setHeader('content-type','text/html');res.end(entry);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}/`;
 const browser=await chromium.launch({executablePath:process.env.LIST_CHROME||'/usr/bin/chromium',args:['--no-sandbox']});
 const errors=[];
 try{
  const options={viewport:{width:390,height:844},userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',serviceWorkers:'block'};
  const install=async(context,snapshot)=>{
   await context.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
   await context.addInitScript(raw=>{
    window.__nativeWrites=[];window.__haptics=[];window.__exports=[];window.__themes=[];
    if(raw)window.__LIST_NATIVE_SNAPSHOTS=[raw];
    window.webkit={messageHandlers:{
     saveState:{postMessage(m){window.__nativeWrites.push(m);queueMicrotask(()=>window.__listStorageAck?.(m.sequence,true));}},
     haptic:{postMessage(m){window.__haptics.push(m);}},
     exportFile:{postMessage(m){window.__exports.push(m);}},
     setTheme:{postMessage(m){window.__themes.push(m);}},
     appStatus:{postMessage(){}}
    }};
   },snapshot);
  };
  const old=await browser.newContext(options);await install(old,null);const seed=await old.newPage();seed.on('pageerror',e=>errors.push(e.message));await seed.goto(url,{waitUntil:'domcontentloaded',timeout:60000});await seed.locator('[data-action="create"]').waitFor();
  const characterId=await seed.evaluate(()=>{const c=Rules.create();c.name='Мираэль🧝🏻';c.level=3;c.classId=CATALOG.classes.find(x=>x.slug==='swashbuckler').id;c.ancestry=CATALOG.ancestries.find(x=>x.slug==='human').id;c.hp=33;window.receiveNativeFile(JSON.stringify(c));return c.id;});
  const snapshot=await seed.evaluate(()=>window.__nativeWrites.at(-1).payload);await old.close();
  const fresh=await browser.newContext(options);await install(fresh,snapshot);const page=await fresh.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});await page.locator('.hp>b').waitFor();
  assert.equal(await page.locator('.hero-name h1').textContent(),'Мираэль🧝🏻');assert.equal(await page.locator('.hp>b').textContent(),'33');
  const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('list-state')));assert.equal(state.active,characterId);assert.equal(state.characters.length,1);
  assert.equal(await page.evaluate(()=>ListFeedback.capabilities().haptics),true);assert.equal(await page.locator('html').getAttribute('data-native-ios'),'true');
  await page.locator('[data-action="health"][data-mode="damage"]').click();await page.locator('#health-amount').fill('5');await page.locator('[data-action="health-save"]').click();
  await page.waitForFunction(()=>window.__haptics.length>0);assert.equal(await page.locator('.hp>b').textContent(),'28');assert.deepEqual(await page.evaluate(()=>window.__haptics.at(-1)),{kind:'damage'});
  await page.waitForFunction(()=>!document.querySelector('#overlay .modal'));await page.locator('[data-action="settings"]').click();
  assert.equal(await page.locator('[data-action="feedback-toggle"][data-key="haptics"]').isDisabled(),false);
  await page.evaluate(()=>ListFeedback.emit('critical-success',{degree:'Критический успех'}));assert.deepEqual(await page.evaluate(()=>window.__haptics.at(-1)),{kind:'critical-success'});
  await page.locator('[data-action="feedback-toggle"][data-key="haptics"]').click();const count=await page.evaluate(()=>window.__haptics.length);
  await page.evaluate(()=>ListFeedback.emit('critical-failure',{degree:'Критический провал'}));assert.equal(await page.evaluate(()=>window.__haptics.length),count);
  await page.locator('[data-action="export"]').click();await page.waitForFunction(()=>window.__exports.length>0);
  const exported=await page.evaluate(()=>window.__exports.at(-1));assert.equal(JSON.parse(exported.text).character.name,'Мираэль🧝🏻');
  await page.locator('[data-action="about"]').click();assert.match(await page.locator('.modal-head h2').textContent(),/2\.9\.3/);
  assert.deepEqual(errors,[]);
  const report={passed:true,checks:['exact IPA inline entry boots with iPhone WK bridge','old native snapshot restores Unicode hero into empty localStorage','same character ID and HP survive migration','iPhone native haptics are available and settings enabled','damage and critical-success send typed WK commands','muting haptics suppresses bridge calls','export keeps Unicode character content','About identifies native version2.9.3'],errors,physical_device_tested:false};
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));await fresh.close();
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
