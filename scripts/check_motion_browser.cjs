// Real layout checks and relative work counters; these do not measure phone FPS.
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');

(async () => {
  const site = path.resolve(process.argv[2] || 'site');
  const baseline = process.argv[3] && path.resolve(process.argv[3]);
  const output = path.resolve(process.argv[4] || 'out/motion-browser-results.json');
  const mime = {'.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg'};
  const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.resolve(site, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(site + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
    res.setHeader('content-type', mime[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({executablePath:process.env.LIST_CHROME || '/usr/bin/chromium', args:['--no-sandbox']});
  const results = [];
  try {
    for (const variant of baseline ? ['before', 'after'] : ['after']) {
      const context = await browser.newContext({viewport:{width:390,height:844}, deviceScaleFactor:3, serviceWorkers:'block'});
      const page = await context.newPage(), errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await context.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.hostname !== '127.0.0.1') return route.abort();
        if (variant === 'before' && url.pathname === '/motion-ui.js') return route.fulfill({contentType:'text/javascript', body:fs.readFileSync(baseline)});
        return route.continue();
      });
      await page.goto(`http://127.0.0.1:${server.address().port}/`);
      await page.locator('[data-action="create"]').waitFor();
      await page.evaluate(() => {
        const c = Rules.create(); c.name = 'Проверка плавности'; c.level = 15;
        c.classId = CATALOG.classes.find(x => x.slug === 'swashbuckler').id;
        c.ancestry = CATALOG.ancestries.find(x => x.slug === 'human').id;
        receiveNativeFile(JSON.stringify(c));
      });
      await page.locator('[data-tab="abilities"]').click();
      const cdp = await context.newCDPSession(page);
      await cdp.send('Performance.enable');
      const metrics = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x=>[x.name,x.value]));
      const settled = () => page.evaluate(async () => { for(let i=0;i<3;i++){await Promise.all(document.getAnimations().map(a=>a.finished.catch(()=>{})));await new Promise(requestAnimationFrame);} });
      // Exercise the visible summary, not an off-screen group. Keep a real long
      // page below it so the normal-flow case is distinct from bottom clamping.
      await page.evaluate(() => {const footer=document.createElement('div');footer.id='qa-scroll-room';footer.style.height='1400px';document.querySelector('.shell').append(footer);const d=document.querySelector('.ability-group');scrollTo(0,scrollY+d.getBoundingClientRect().top-100);});
      await settled();
      const start = await metrics();
      const paths = await page.evaluate(async () => {
        const d=document.querySelector('.ability-group'), paths=[];
        for(let i=0;i<6;i++){
          ListMotion.fold(d, i%2===1);
          paths.push(d.getAnimations().map(a=>Object.keys(a.effect.getKeyframes()[0]).filter(k=>!['offset','computedOffset','easing','composite'].includes(k))));
          await Promise.all(document.getAnimations().map(a=>a.finished.catch(()=>{})));
          await new Promise(requestAnimationFrame);
        }
        return paths;
      });
      await settled();
      const end = await metrics(), counters = {};
      for(const key of ['LayoutCount','LayoutDuration','RecalcStyleCount','RecalcStyleDuration','TaskDuration']) counters[key]=end[key]-start[key];
      // Reversing, concurrent groups and navigation must not leave inline clips,
      // shifted rows or callbacks that mutate a different scene.
      const reversal = await page.evaluate(async () => {
        const d=document.querySelector('.ability-group'), card=d.querySelector('.item'), summary=d.querySelector('summary');
        for(let i=0;i<5;i++){summary.click();await new Promise(r=>setTimeout(r,35));}
        await Promise.all(document.getAnimations().map(a=>a.finished.catch(()=>{})));
        await new Promise(requestAnimationFrame);
        return {open:d.open,sameCard:card===d.querySelector('.item'),style:d.getAttribute('style')||'',scroll:scrollY};
      });
      assert.equal(reversal.open,false); assert(reversal.sameCard); assert.equal(reversal.style,'');
      await page.evaluate(() => document.querySelector('#qa-scroll-room').remove());
      await page.evaluate(async () => {for(const d of document.querySelectorAll('.ability-group'))ListMotion.fold(d,true);await Promise.all(document.getAnimations().map(a=>a.finished.catch(()=>{})));scrollTo(0,document.documentElement.scrollHeight);});
      const bottom = await page.evaluate(async () => {
        const groups=[...document.querySelectorAll('.ability-group')], d=groups.at(-1);
        const before=scrollY; ListMotion.fold(d,false);
        await Promise.all(document.getAnimations().map(a=>a.finished.catch(()=>{})));
        await new Promise(requestAnimationFrame);
        return {before,after:scrollY,max:Math.max(0,document.documentElement.scrollHeight-innerHeight),open:d.open,style:d.getAttribute('style')||'',overflow:document.documentElement.scrollWidth>innerWidth};
      });
      assert.equal(bottom.open,false); assert.equal(bottom.style,''); assert(bottom.after<=bottom.max+1); assert(!bottom.overflow);
      const endpoints = await page.evaluate(async () => {
        const results=[];
        for(const selector of ['.ability-group','#ability-choices','#ability-features']) {
          const el=document.querySelector(selector), anchor=el.querySelector(':scope > summary')||el.previousElementSibling, follower=el.nextElementSibling;
          ListMotion.fold(el,true); await Promise.all(document.getAnimations().map(a=>a.finished.catch(()=>{})));
          scrollTo(0,document.documentElement.scrollHeight);
          await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);
          for(const show of [false,true]) {
            ListMotion.fold(el,show);
            const animations=document.getAnimations();
            for(const a of animations)a.currentTime=a.effect.getTiming().duration;
            const before=[anchor.getBoundingClientRect().top,follower?.getBoundingClientRect().top];
            await Promise.all(animations.map(a=>a.finished.catch(()=>{})));
            await new Promise(requestAnimationFrame);
            const after=[anchor.getBoundingClientRect().top,follower?.getBoundingClientRect().top];
            results.push({selector,show,before,after,open:el.tagName==='DETAILS'?el.open:!el.hidden});
          }
        }
        return results;
      });
      for(const endpoint of endpoints){assert.equal(endpoint.open,endpoint.show);if(variant==='after')for(let i=0;i<2;i++)if(endpoint.before[i]!=null)assert(Math.abs(endpoint.before[i]-endpoint.after[i])<1.1,JSON.stringify(endpoint));}
      await page.evaluate(() => {const d=document.querySelector('.ability-group');d.querySelector('summary').click();document.querySelector('[data-tab="sheet"]').click();});
      await settled(); await page.locator('[data-tab="abilities"]').click(); await settled();
      assert.equal(await page.locator('.motion-snapshot').count(),0);
      assert.equal(await page.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').length),0);
      await page.emulateMedia({reducedMotion:'reduce'});
      const reduced = await page.evaluate(()=>{const d=document.querySelector('.ability-group');ListMotion.fold(d,false);return {open:d.open,animations:document.getAnimations().length};});
      assert.equal(reduced.open,false); assert.equal(reduced.animations,0);
      assert.deepEqual(errors,[]);
      results.push({variant,counters,paths,reversal,bottom,endpoints,checks:['rapid reversal and card identity','bottom scroll range and endpoint continuity','whole ability block collapse','scene change cancels animations','reduced motion','no JavaScript errors'],errors});
      console.log(JSON.stringify({variant,counters,checks:'passed'}));
      await context.close();
    }
    fs.mkdirSync(path.dirname(output),{recursive:true});
    fs.writeFileSync(output,JSON.stringify({passed:true,limitation:'Chromium layout regression and relative work counters; not device FPS, Safari/WKWebView or Android native verification.',results},null,2)+'\n');
  } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
