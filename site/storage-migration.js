/* Join the former fantasy library without deleting its independent backups. */
(function(root){'use strict';
const MARKER='list-fantasy-migration-v1';
const SETTINGS=['list-sync','list-draft','list-feedback-v1','list-catalog-ui','list-catalog-filters','list-catalog-explorer'];
function migrate(storage,validate){
 if(storage.getItem(MARKER))return{migrated:false};
 const legacy={getItem:key=>storage.getItem('fantasy-'+key),setItem:(key,value)=>storage.setItem('fantasy-'+key,value),removeItem:key=>storage.removeItem('fantasy-'+key)};
 const empty={characters:[],active:'',revision:0,dirty:false};
 const oldStore=root.ListStorage.createStore(legacy,validate),old=oldStore.load(empty);
 const store=root.ListStorage.createStore(storage,validate),current=store.load(empty);
 // Do not mark an unreadable or partially recovered library as transferred.
 if(!old.available||old.rejected.length||!current.available||current.rejected.length)throw Error('Нужен экспорт или восстановление старых сохранений.');
 const state={...current.state,characters:[...current.state.characters]};let added=0;
 for(const character of old.state.characters){
  const existing=state.characters.find(c=>c.id===character.id);
  if(existing&&JSON.stringify(existing)===JSON.stringify(character))continue;
  const copy={...character};
  if(existing){
   // Stable IDs make retrying safe if writing the marker fails after saving.
   copy.id='fantasy-'+root.ListStorage.hash(JSON.stringify(character));
   copy.name=(character.name+' · средневековая копия').slice(0,100);
   let suffix=0;
   while(state.characters.some(c=>c.id===copy.id&&JSON.stringify(c)!==JSON.stringify(copy)))copy.id='fantasy-'+root.ListStorage.hash(JSON.stringify(character))+'-'+(++suffix);
   if(state.characters.some(c=>c.id===copy.id))continue;
  }
  if(state.characters.length>=100)throw Error('Лимит — 100 персонажей. Старые листы оставлены отдельно.');
  state.characters.push(copy);added++;
 }
 if(added){
  if(current.state.characters.length)store.snapshot(current.state,'До объединения двух версий');
  store.snapshot(old.state,'Средневековая версия до объединения');
  state.active=current.state.characters.length?current.state.active:old.state.active;
  state.dirty=true;store.save(state);
  if(storage.getItem('list-state')!==JSON.stringify(state))throw Error('Перенос не записан.');
 }
 // Existing simple-version preferences win; each site's theme stays independent.
 for(const key of SETTINGS){
  if(storage.getItem(key)!==null)continue;
  const value=legacy.getItem(key);if(value===null)continue;
  try{JSON.parse(value);}catch{continue;}
  storage.setItem(key,value);
 }
 storage.setItem(MARKER,JSON.stringify({version:1,added,time:Date.now()}));
 return{migrated:true,added};
}
if(typeof module!=='undefined')module.exports={migrate};
root.ListStorageMigration={migrate};
if(root.document){try{migrate(root.localStorage,root.Rules.validateCharacter);}catch{root.__LIST_MIGRATION_ERROR=true;}}
})(typeof window!=='undefined'?window:globalThis);
