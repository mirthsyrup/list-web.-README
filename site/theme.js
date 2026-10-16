(function(root){'use strict';
const DESIGN_KEY='list-design',valid=value=>value==='modern'||value==='fantasy';
let design='fantasy',theme='light';
try{
 const url=new URL(location.href),requested=url.searchParams.get('design');
 const saved=localStorage.getItem(DESIGN_KEY);design=valid(saved)?saved:'fantasy';
 if(valid(requested)){
  design=requested;localStorage.setItem(DESIGN_KEY,design);
  url.searchParams.delete('design');history.replaceState(null,'',url.href);
 }
}catch{}
const themeKey=()=>design==='fantasy'?'fantasy-list-theme':'list-theme';
try{theme=localStorage.getItem(themeKey())==='dark'?'dark':'light';}catch{}
function apply(){
 const light=theme==='light',medieval=design==='fantasy';
 document.documentElement.dataset.design=design;
 document.documentElement.dataset.theme=theme;
 if(root.webkit?.messageHandlers?.saveState)document.documentElement.dataset.nativeIos='true';
 if(root.NativeBridge||root.webkit?.messageHandlers?.saveState)document.documentElement.dataset.nativeApp='true';
 try{root.NativeBridge?.setTheme?.(theme);root.webkit?.messageHandlers?.setTheme?.postMessage(theme);}catch{}
 document.querySelector('meta[name="theme-color"]')?.setAttribute('content',medieval?(light?'#2c2117':'#15120f'):(light?'#e9dfce':'#3b3b40'));
}
apply();
const sun='<svg class="theme-sun" width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true" focusable="false"><circle cx="10" cy="10" r="3.4"/><path d="M10 1.5v2m0 13v2M1.5 10h2m13 0h2M4 4l1.4 1.4m9.2 9.2L16 16M4 16l1.4-1.4m9.2-9.2L16 4"/></svg>';
root.ListTheme={
 design:()=>design,
 setDesign(value){
  if(!valid(value))throw Error('Неизвестное оформление.');
  localStorage.setItem(DESIGN_KEY,value);
  if(localStorage.getItem(DESIGN_KEY)!==value)throw Error('Не удалось сохранить оформление. Попробуй ещё раз.');
 },
 toggle(){theme=theme==='light'?'dark':'light';try{localStorage.setItem(themeKey(),theme);}catch{}apply();},
 designControl(){return `<div class="design-choice"><b id="design-label">Дизайн</b><div class="design-options" role="group" aria-labelledby="design-label">${[['modern','Современный'],['fantasy','Средневековый']].map(([value,label])=>`<button class="btn ${value===design?'primary':'ghost'}" data-action="design-set" data-design="${value}" aria-pressed="${value===design}">${label}</button>`).join('')}</div></div>`;},
 control(){const medieval=design==='fantasy';return `<button class="setting-switch" data-action="theme-toggle" role="switch" aria-checked="${theme==='light'}"><span><b>Светлая тема</b><small>${medieval?(theme==='light'?'Тёплая кожа':'Тёмная кожа'):(theme==='light'?'Бежевая бумага':'Тёмная фактура')}</small></span><span class="switch-track"><span>${theme==='light'?sun:''}</span></span></button>`;}
};
})(window);
