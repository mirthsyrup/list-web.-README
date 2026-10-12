/* Versioned local journal plus an independent copy in the native app container. */
(function(root){'use strict';
const CURRENT='list-state',MIRROR='list-state-mirror',PENDING='list-state-pending',HISTORY='list-history',LIMIT=8;
function hash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return(h>>>0).toString(16).padStart(8,'0');}
function createStore(storage,validate,native={}){
 let sequence=0,lastError='',nativePending=false,nativeConfirmed=false,localSaved=false;
 const get=k=>{try{return storage.getItem(k);}catch{return null;}};
 function envelope(state,seq=sequence+1){const body=JSON.stringify(state);return{format:'list-store',version:1,sequence:seq,time:Date.now(),hash:hash(body),body};}
 function decode(raw,legacy=false){if(!raw)return null;let record=typeof raw==='string'?JSON.parse(raw):raw;if(record.format==='list-store'){if(record.version!==1||!Number.isSafeInteger(record.sequence)||record.sequence<0||typeof record.body!=='string'||record.hash!==hash(record.body))throw Error('Повреждена контрольная сумма сохранения.');return{record,state:JSON.parse(record.body)};}if(legacy)return{record:{sequence:0,time:0},state:record};throw Error('Неизвестный формат копии.');}
 function validateState(data){if(!data||typeof data!=='object'||!Array.isArray(data.characters)||data.characters.length>100)throw Error('Повреждён список персонажей.');const good=[],rejected=[];for(const c of data.characters){try{const v=validate(c);if(good.some(x=>x.id===v.id))throw Error('Повторяющийся персонаж');good.push(v);}catch(e){rejected.push({name:typeof c?.name==='string'?c.name:'Без имени',reason:e.message});}}return{state:{...data,characters:good,active:good.some(x=>x.id===data.active)?data.active:good[0]?.id||'',revision:Number.isSafeInteger(data.revision)?data.revision:0,dirty:!!data.dirty},rejected};}
 function load(fallback,nativeRecords=[]){let older=[];try{older=JSON.parse(get('list-backups')||'[]');if(!Array.isArray(older))older=[];}catch{}const sources=[[CURRENT,get(CURRENT),true],[MIRROR,get(MIRROR),false],[PENDING,get(PENDING),false],['list-backup',get('list-backup'),true],...nativeRecords.map((v,i)=>['native-'+i,v,false]),...older.map((v,i)=>['backup-'+i,v.state,true])],valid=[],bad=[];
  for(const [name,raw,legacy]of sources){if(!raw)continue;try{const decoded=decode(raw,legacy),checked=validateState(decoded.state);valid.push({...decoded,...checked,name,raw});}catch{bad.push({name,raw});}}
  const current=valid.find(x=>x.name===CURRENT);if(current){const matching=valid.filter(x=>x.record.body===current.raw).sort((a,b)=>b.record.sequence-a.record.sequence)[0];if(matching)current.record=matching.record;}valid.sort((a,b)=>b.record.sequence-a.record.sequence||Number(a.name!==CURRENT)-Number(b.name!==CURRENT));
  const best=valid[0];sequence=Math.max(sequence,best?.record.sequence||0);
  if(bad.length||best?.rejected.length){try{if(!get('list-quarantine'))storage.setItem('list-quarantine',JSON.stringify({time:Date.now(),sources:bad,partial:best?.rejected.length?best.raw:null}));}catch{}}
  return{state:best?.state||fallback,recovered:!!best&&best.name!==CURRENT,rejected:best?.rejected||[],damaged:bad.length,available:!!best||!sources.some(([,raw])=>raw)};
 }
 function history(){let list=[];try{list=JSON.parse(get(HISTORY)||'[]');if(!Array.isArray(list))list=[];}catch{}if(!list.length){try{const old=JSON.parse(get('list-backups')||'[]');if(Array.isArray(old))list=old.map((x,i)=>({id:'legacy-'+i,time:x.time||0,label:'Копия из версии 1.0.1',data:envelope(JSON.parse(x.state),0)}));}catch{}}return list.filter(x=>{try{return !!decode(x.data);}catch{return false;}}).slice(0,LIMIT);}
 function snapshot(state,label='Автоматическая копия',force=true){const copies=history(),now=Date.now();if(!state.characters?.length)return;if(!force&&copies[0]&&now-copies[0].time<300000)return;const record=envelope(state,sequence);copies.unshift({id:now.toString(36)+'-'+sequence+'-'+Math.random().toString(36).slice(2,7),time:now,label,data:record});try{storage.setItem(HISTORY,JSON.stringify(copies.slice(0,LIMIT)));}catch{try{storage.setItem(HISTORY,JSON.stringify(copies.slice(0,2)));}catch{}}}
 function writeNative(record){const raw=JSON.stringify(record);if(!native.save)return;try{nativePending=true;nativeConfirmed=false;const result=native.save(raw,record.sequence);if(result===true){nativePending=false;nativeConfirmed=true;}else if(result===false){nativePending=false;nativeConfirmed=false;lastError='Копия в памяти телефона не записана.';}}catch{nativePending=false;nativeConfirmed=false;lastError='Копия в памяти телефона не записана.';}}
 function save(state,{snapshotLabel='',forceSnapshot=false}={}){lastError='';const checked=validateState(state);if(checked.rejected.length)throw Error('Лист не прошёл проверку. Изменения оставлены в памяти; экспортируй копию.');const previous=get(CURRENT);if(previous){try{const old=validateState(JSON.parse(previous));if(!old.rejected.length){snapshot(old.state,snapshotLabel||'Автоматическая копия',forceSnapshot);storage.setItem('list-backup',previous);}}catch{}}
  const record=envelope(state,++sequence),raw=JSON.stringify(record);localSaved=false;
  // Journal copies are optional; only a durable current record determines success.
  try{storage.setItem(PENDING,raw);}catch{}
  try{storage.setItem(CURRENT,record.body);localSaved=true;}catch{
   // Reclaim old snapshots first, without removing the current or recovery records.
   try{storage.removeItem(HISTORY);storage.removeItem('list-backups');storage.removeItem('list-backup');storage.setItem(CURRENT,record.body);localSaved=true;}catch{}
  }
  if(localSaved){let mirrored=false;try{storage.setItem(MIRROR,raw);mirrored=true;}catch{try{storage.removeItem(MIRROR);}catch{}}if(mirrored){try{storage.removeItem(PENDING);}catch{}}}
  else lastError='Не удалось записать локальное сохранение.';
  writeNative(record);if(!localSaved&&!nativeConfirmed)throw Error('Не удалось сохранить. Экспортируй персонажа в файл.');return{localSaved,nativePending,nativeConfirmed};
 }
 function restore(id){const copy=history().find(x=>x.id===id);if(!copy)throw Error('Копия не найдена.');const checked=validateState(decode(copy.data).state);if(checked.rejected.length)throw Error('Эта копия повреждена.');return checked.state;}
 function acknowledge(seq,ok){if(seq!==sequence)return false;nativePending=false;nativeConfirmed=!!ok;if(ok)lastError='';return true;}
 return{load,save,history,snapshot,restore,acknowledge,decode,status:()=>({sequence,lastError,localSaved,nativePending,nativeConfirmed})};
}
const API={createStore,hash};if(typeof module!=='undefined')module.exports=API;root.ListStorage=API;
})(typeof window!=='undefined'?window:globalThis);
