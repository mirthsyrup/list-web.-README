const {chromium}=require('playwright'),fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const site=path.resolve(process.argv[2]||path.join(__dirname,'../site')),out=path.resolve(process.argv[3]||'out/material-feedback');fs.mkdirSync(out,{recursive:true});
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
   const c=Rules.create();c.name='Отклики';c.classId=CATALOG.classes.find(x=>x.slug==='swashbuckler').id;c.ancestry=CATALOG.ancestries.find(x=>x.slug==='human').id;
   c.coins={gp:20,sp:0,cp:0};c.inventory=['healing-potion-minor','leather-armor','chain-mail','padded-armor','wooden-shield'].map((slug,i)=>({id:CATALOG.equipment.find(x=>x.slug===slug).id,uid:'cue-'+slug,quantity:2,equipped:i===1}));receiveNativeFile(JSON.stringify(c));
   ListFeedback.configure({sound:true,haptics:false,visual:true});window.__cues=[];const emit=ListFeedback.emit;ListFeedback.emit=function(kind,detail){const result=emit(kind,detail);if(kind==='equipment'||kind==='coins')__cues.push({kind,material:detail.material,equipped:detail.equipped,sample:result.sample,sound:result.sound});return result;};
  });
  await page.locator('.nav [data-tab="bag"]').click();
  async function edit(slug,toggle){await page.locator('[data-action="inventory"][data-uid="cue-'+slug+'"]').click();await page.locator('#item-equipped').waitFor();if(toggle)await page.locator('#item-equipped').click();await page.locator('[data-action="item-save"]').click();await page.locator('.modal').waitFor({state:'detached'});}
  await edit('chain-mail',true);assert.equal(await page.evaluate(()=>__cues.length),1);
  assert(await page.evaluate(()=>{const c=JSON.parse(localStorage.getItem('list-state')).characters[0];return c.inventory.find(x=>x.uid==='cue-chain-mail').equipped&&!c.inventory.find(x=>x.uid==='cue-leather-armor').equipped;}),'Automatic armour swap stays unchanged');
  await edit('chain-mail',false);assert.equal(await page.evaluate(()=>__cues.length),1,'No feedback for unchanged save');
  await edit('chain-mail',true);await edit('leather-armor',true);await edit('padded-armor',true);await edit('wooden-shield',true);
  const cues=await page.evaluate(()=>__cues);assert.deepEqual(cues.map(x=>x.material),['metal','metal','leather','cloth','wood']);assert(cues.every(x=>x.sound&&x.sample),'Approved material samples play on actual clicks');
  assert.equal(cues[1].equipped,false);assert.notEqual(cues[0].sample,cues[1].sample);
  await page.locator('[data-action="inventory"][data-uid="cue-healing-potion-minor"]').click();await page.locator('#item-quantity').fill('1');await page.locator('[data-action="item-save"]').click();await page.locator('.modal').waitFor({state:'detached'});
  assert.equal(await page.evaluate(()=>__cues.at(-1).material),'glass');
  async function money(value){await page.locator('[data-action="coins"]').click();if(value!==undefined)await page.locator('#coin-gp').fill(String(value));await page.locator('[data-action="coins-save"]').click();await page.locator('.modal').waitFor({state:'detached'});}
  await money(21);const coinCount=await page.evaluate(()=>__cues.filter(x=>x.kind==='coins').length);assert.equal(coinCount,1);
  await money();assert.equal(await page.evaluate(()=>__cues.filter(x=>x.kind==='coins').length),coinCount);
  await page.locator('.nav [data-tab="catalog"]').click();await page.locator('[data-action="category"][data-cat="equipment"]').click();await page.locator('#catalog-search').fill('Рапира');
  await page.locator('[data-action="detail"]').filter({has:page.locator('b',{hasText:/^Рапира$/})}).first().click();await page.locator('[data-action="item-buy"]').click();await page.locator('[data-action="item-acquire-confirm"]').click();await page.locator('.modal').waitFor({state:'detached'});
  const coins=await page.evaluate(()=>__cues.filter(x=>x.kind==='coins'));assert.equal(coins.length,2);assert.notEqual(coins[0].sample,coins[1].sample);assert(coins.every(x=>x.sound));
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('list-state')).characters[0].coins.gp),19,'Purchase cost remains correct');
  await page.locator('.nav [data-tab="bag"]').click();
  await page.waitForFunction(()=>!document.querySelector('.interaction-feedback-shine'));
  await page.evaluate(()=>ListFeedback.configure({sound:false,haptics:false,visual:false}));await edit('wooden-shield',true);
  assert.equal(await page.evaluate(()=>__cues.at(-1).sound),false);assert.equal(await page.locator('.interaction-feedback-shine').count(),0);
  await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>ListFeedback.configure({sound:false,haptics:false,visual:true}));await edit('leather-armor',true);assert.equal(await page.locator('.interaction-feedback-shine').count(),0);
  assert.deepEqual(errors,[]);results.push({design,passed:true,all_six_groups:true,confirmed_purchase:true,wallet_noop_silent:true,glass_quantity_change:true,no_duplicate_armour_swap:true,noop_save_silent:true,distinct_variants:true,preferences:true,reduced_motion:true,physical_device_tested:false});await context.close();
 }
 fs.writeFileSync(out+'/results.json',JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify(results));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
