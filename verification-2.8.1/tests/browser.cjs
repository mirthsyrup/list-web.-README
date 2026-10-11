const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright'),fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
const server=require('node:child_process').spawn('python',['-u','-m','http.server','8281','--directory',process.env.TEST_DIR||'site'],{stdio:['ignore','pipe','pipe']});await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('exit',code=>reject(Error('server exited '+code)));});process.on('exit',()=>server.kill());
const browser=await chromium.launch({executablePath:'/workspace/scratch/10ebd36cf0f3/release278/tools/chrome-headless-shell-linux64/chrome-headless-shell',args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(process.env.TEST_URL||'http://127.0.0.1:8281');await page.waitForFunction(()=>window.CATALOG?.feats&&window.CATALOG?.spells&&window.receiveNativeFile);await page.evaluate(()=>{localStorage.setItem('list-theme','dark');document.documentElement.dataset.theme='dark'});
let hero=JSON.parse(fs.readFileSync('tests/hero.json','utf8'));await page.evaluate(c=>window.receiveNativeFile(JSON.stringify(c)),hero);
await page.waitForSelector('[data-action="tab"][data-tab="abilities"]');await page.locator('[data-action="tab"][data-tab="abilities"]').click();assert.equal(await page.locator('#ability-search').count(),0);
await page.screenshot({path:'tests/abilities-dark.png',fullPage:true});
await page.locator('[data-action="tab"][data-tab="sheet"]').click();await page.locator('[data-action="level"]').click();await page.locator('[data-action="advance-pick"][data-kind="Способность класса"]').click();await page.locator('[data-mode="dedication"]').click();
const picks=page.locator('#picker-results [data-action="pick"]');const texts=await picks.allTextContents();assert(texts.some(x=>x.includes('Убежище')));assert(texts.some(x=>x.includes('Социальная сфера')));assert(texts[0].includes('Убежище')||texts[0].includes('Социальная сфера'));
await page.screenshot({path:'tests/archetype-level4.png',fullPage:true});await picks.filter({hasText:'Убежище'}).click();
await page.locator('[data-action="advance-pick"][data-kind="Способность навыка"]').click();await page.locator('#picker-results [data-action="pick"]').first().click();
await page.locator('[data-action="advance-pick"][data-kind="Бесплатная способность архетипа"]').click();await page.locator('#archetype-search').fill('Социальная сфера');await page.locator('#archetype-results [data-action="archetype-select"]').click();await page.locator('[data-action="archetype-apply"]').click();
while(await page.locator('.advance-nested [data-action="advance-option"]').filter({hasText:'Нужно выбрать вариант'}).count()){await page.locator('.advance-nested [data-action="advance-option"]').filter({hasText:'Нужно выбрать вариант'}).first().click();await page.locator('#picker-results [data-action="pick"], [data-action="advance-option-set"]:not([disabled])').first().click();}const apply=page.locator('[data-action="advance-apply"]');assert(await apply.isEnabled());await apply.click();await page.reload();await page.waitForFunction(()=>window.CATALOG?.feats);
const saved=await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('list-state'));return s.characters.find(c=>c.id===s.active)});assert.equal(saved.level,4);assert(saved.levelProgress['4:Способность класса']);assert(saved.freeArchetype.choices[4]);assert.notEqual(saved.freeArchetype.choices[4].id,saved.levelProgress['4:Способность класса']);
console.log('PASS browser: import, no owned search, paid continuation, independent free pick, apply, persistence on reload');
// Render catalog-backed cost examples in actual picker, and audit wrapped titles at mobile widths.
await page.locator('[data-action="tab"][data-tab="abilities"]').click();await page.locator('[data-action="add-spell"]').click();
await page.locator('#picker-search').fill('Адаптивная абляция');await page.screenshot({path:'tests/reaction-dark.png',fullPage:true});assert.equal(await page.locator('#picker-results .action-cost[aria-label="Реакция"]').count(),1);
for(const width of [320,390,1440]){
 await page.setViewportSize({width,height:900});await page.locator('#picker-search').fill('');
 const issues=await page.locator('#picker-results .ability-title').evaluateAll(items=>items.flatMap(el=>{const name=el.querySelector('.ability-name'),glyph=el.querySelector('.action-cost');if(!name||!glyph)return[];const a=name.getBoundingClientRect(),b=glyph.getBoundingClientRect();return b.top>a.top+12||b.right>el.getBoundingClientRect().right+1?[el.textContent]:[];}));assert.deepEqual(issues,[]);
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:`tests/spells-${width}.png`,fullPage:width!==1440});
}
const symbols=await page.evaluate(()=>[1,2,3].map(actions=>window.ListAbilityDisplay.glyph({actions})).concat(['free','reaction'].map(actionType=>window.ListAbilityDisplay.glyph({actionType}))));assert(symbols.every(x=>x.includes('role="img"')&&x.includes('aria-hidden="true"')&&x.includes('scale(1 -1)')));
await page.evaluate(()=>document.documentElement.dataset.theme='light');await page.screenshot({path:'tests/spells-light.png',fullPage:true});assert.deepEqual(errors,[]);console.log('PASS standard action/reaction/free glyphs, accessible labels, long-title alignment, 320/390/1440 widths, light/dark, no JS errors');
await browser.close();server.kill();
})().catch(e=>{console.error(e);process.exit(1)});
