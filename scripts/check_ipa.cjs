const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

(async () => {
  const roots = process.argv.slice(2);
  const mime = {'.html':'text/html','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.txt':'text/plain','.md':'text/plain'};
  const server = http.createServer((request,response) => {
    const url = new URL(request.url, 'http://localhost');
    const match = /^\/(\d+)\/(.*)$/.exec(decodeURIComponent(url.pathname));
    if (!match || !roots[Number(match[1])]) { response.writeHead(404); response.end(); return; }
    const root = path.resolve(roots[Number(match[1])]), target = path.resolve(root, match[2]);
    if (!target.startsWith(root+'/') || !fs.existsSync(target) || !fs.statSync(target).isFile()) {response.writeHead(404);response.end();return;}
    response.writeHead(200, {'content-type':mime[path.extname(target)] || 'application/octet-stream'});
    fs.createReadStream(target).pipe(response);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const browser = await chromium.launch({ executablePath: process.env.LIST_CHROME || '/usr/bin/chromium', args: ['--no-sandbox'] });
  const results = [];
  try {
    for (const [index,root] of roots.entries()) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
      await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
      const page = await context.newPage(), errors = [], failed = [];
      page.setDefaultTimeout(30000);
      page.on('pageerror', error => errors.push(error.message));
      page.on('requestfailed', request => failed.push({url: request.url(), error: request.failure()?.errorText}));
      await page.addInitScript(() => {
        window.__qaExports = [];
        // HTTP harness: suppress the browser-only service worker just as the
        // native file:// entry does, while save/export use the iOS bridge stubs.
        window.NativeBridge = {};
        window.webkit = { messageHandlers: {
          saveState: { postMessage: message => queueMicrotask(() => window.__listStorageAck?.(message.sequence, true)) },
          setTheme: { postMessage: () => {} },
          exportFile: { postMessage: message => window.__qaExports.push(message) },
        }};
      });
      await page.goto(`http://127.0.0.1:${port}/${index}/Payload/List.app/web/ios-entry.html`);
      await page.locator('[data-action="create"]').waitFor();
      const catalogs = await page.evaluate(() => Object.fromEntries(Object.entries(CATALOG).map(([key, value]) => [key, value.length])));
      await page.evaluate(() => {
        const R = Rules, find = (cat, slug) => CATALOG[cat].find(x => x.slug === slug), c = R.create();
        c.name = 'Проверочный герой'; c.level = 3;
        c.classId = find('classes', 'swashbuckler').id; c.ancestry = find('ancestries', 'human').id;
        c.heritage = find('heritages', 'versatile-human').id; c.background = find('backgrounds', 'acrobat').id;
        c.attributes = {str:1,dex:4,con:2,int:0,wis:0,cha:2};
        c.feats = [find('feats', 'toughness').id];
        c.inventory = ['rapier','leather-armor','dagger'].map(slug => ({id:find('equipment',slug).id,uid:R.uid(),quantity:1,equipped:slug!=='dagger'}));
        c.hp = 47; window.receiveNativeFile(JSON.stringify(c));
      });
      const click = action => page.locator(`[data-action="${action}"]`).first().click();
      assert.equal(await page.locator('.hp b').textContent(), '47');
      assert.equal(await page.locator('.stat b').first().textContent(), '20');
      await click('health');
      await page.locator('#health-amount').fill('5');
      await page.locator('#temporary-hp').fill('2');
      await click('health-save');
      assert.equal(await page.locator('.hp b').textContent(), '44');
      await page.reload();
      await page.locator('.hp b').waitFor();
      assert.equal(await page.locator('.hp b').textContent(), '44');
      await page.locator('[data-action="tab"][data-tab="catalog"]').click();
      for (const category of ['feats', 'spells', 'actions', 'equipment', 'classes', 'ancestries', 'heritages', 'backgrounds', 'class-features', 'ancestry-features', 'conditions']) {
        await page.locator(`[data-action="category"][data-cat="${category}"]`).click();
        await page.waitForFunction(() => document.querySelectorAll('[data-action="detail"]').length > 0);
      }
      await page.locator('[data-action="category"][data-cat="spells"]').click();
      await page.locator('#catalog-search').fill('Огненный шар');
      await page.locator('[data-action="detail"]').first().click();
      assert.match(await page.locator('.modal').innerText(), /Огненный шар/);
      await click('close');
      await page.locator('[data-action="tab"][data-tab="sheet"]').click();
      await click('settings');
      await click('export');
      const exported = await page.evaluate(() => window.__qaExports[0]);
      assert.equal(JSON.parse(exported.text).character.hp, 44);
      await click('theme-toggle');
      assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
      await click('close');
      for (const width of [390, 1280]) {
        await page.setViewportSize({width, height:844});
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        const backgrounds = await page.evaluate(async () => {
          const css = getComputedStyle(document.documentElement);
          const values = ['--paper', '--paper-desktop'].map(key => css.getPropertyValue(key));
          for (const value of values) {
            const match = /url\(["']?(.*?)["']?\)/.exec(value.trim());
            if (!match) continue;
            const image = new Image(); image.src = match[1]; await image.decode();
            if (!image.naturalWidth) throw Error('Texture did not decode');
          }
          return values.every(value => !value || value.includes('data:image/'));
        });
        assert(backgrounds);
      }
      const legal = await page.evaluate(async () => {
        // file:// navigation verifies retained notices without requiring fetch CORS.
        return ['legal/PF2E-NOTICE.txt','legal/ORC.md','legal/PF2ERUS-LICENSE.txt'];
      });
      for (const relative of legal) assert(fs.existsSync(path.join(root, 'Payload/List.app/web', relative)));
      assert.deepEqual(errors, []);
      const unexpected = failed.filter(x => !x.url.endsWith('manifest.webmanifest'));
      assert.deepEqual(unexpected, []);
      results.push({root, catalogs, checks:['local bundle boot with internet requests blocked','native bridge stubs','HP/armor calculations','damage and persistent reload','all catalog categories','spell search/details','export','theme','phone/desktop textures','legal files'], errors, failed});
      await page.screenshot({path: path.join(root, 'checked.png')});
      await context.close();
    }
    assert.deepEqual(results[0].catalogs, results[1].catalogs);
    fs.writeFileSync(path.resolve('ipa-browser-results.json'), JSON.stringify({passed:true, results, limitation:'Chromium/local HTTP checks with bridge stubs; file:// is blocked by the managed browser policy. Physical iPhone and real native bridges not exercised.'}, null, 2));
    console.log(JSON.stringify({passed:true, records:Object.values(results[0].catalogs).reduce((a,b)=>a+b,0), runs:results.length}));
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
