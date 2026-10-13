const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM,ResourceLoader,VirtualConsole}=require('jsdom');

test('Public ZIP loader applies all release styles, boots feedback and preserves lazy catalog URLs',async()=>{
  const base=path.resolve(__dirname,'..'),bytes=fs.readFileSync(base+'/list-site-2.8.8.zip'),blobs=new Map(),errors=[],requested=[];
  let w,id=0;
  class Resources extends ResourceLoader{
    fetch(url){
      if(url.startsWith('blob:')){
        const b=blobs.get(url);assert(b,'Every blob script or CSS URL must resolve');
        return b.arrayBuffer().then(x=>Buffer.from(x));
      }
      return null;
    }
  }
  const console=new VirtualConsole();console.on('jsdomError',e=>errors.push(e.message));console.on('error',e=>errors.push(String(e)));
  const dom=new JSDOM(fs.readFileSync(base+'/index.html','utf8'),{
    url:'https://mirthsyrup.github.io/list-web.-README/',runScripts:'dangerously',resources:new Resources(),pretendToBeVisual:true,virtualConsole:console,
    beforeParse(win){
      w=win;win.setImmediate=setImmediate;win.clearImmediate=clearImmediate;win.Blob=Blob;
      win.URL.createObjectURL=b=>{const url='blob:https://mirthsyrup.github.io/'+ ++id;blobs.set(url,b);return url;};
      win.fetch=async url=>{requested.push(url);return{ok:true,arrayBuffer:async()=>win.Uint8Array.from(bytes).buffer};};
      win.matchMedia=()=>({matches:true,addEventListener(){}});win.scrollTo=()=>{};win.scrollBy=()=>{};
    }
  });
  try{
    const deadline=Date.now()+15000;
    while(!w.ListVisual?.seal||!w.ListMotion?.showModal||!w.document.querySelector('[data-action="tab"]')){
      if(Date.now()>deadline)throw Error('ZIP bootstrap timeout: '+JSON.stringify({errors,requested,blobs:blobs.size,status:w.document.querySelector('#status')?.textContent}));
      await new Promise(r=>setTimeout(r,25));
    }
    assert.equal(requested[0],'list-site-2.8.8.zip');
    assert.match(w.document.querySelector('h1').textContent,/Pathfinder 2e/);
    assert(w.__ZIP_URLS['data/feats.js'].startsWith('blob:'));
    assert(w.document.querySelector('script[src]').src.startsWith('blob:'));
    const styles=[...w.document.querySelectorAll('link[rel="stylesheet"]')];assert.equal(styles.length,3);
    for(const link of styles){assert(link.href.startsWith('blob:'),'Every stylesheet must be resolved from the release ZIP');assert(link.sheet?.cssRules.length>0,'Every stylesheet must actually load');}
    const holder=w.document.createElement('div');holder.innerHTML=w.ListVisual.seal;w.document.body.append(holder);
    assert.equal(w.getComputedStyle(holder.firstChild).fill,'none','The compass must be an outline');
    // JSDOM does not apply @supports selector(:has()). Navigation geometry is
    // checked through this same ZIP entry in check_visual_browser.cjs.
    assert.deepEqual(errors,[]);
  }finally{dom.window.close();}
});
