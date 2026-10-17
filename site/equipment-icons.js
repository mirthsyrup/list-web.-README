/* Shared equipment artwork selection for the catalog, picker and backpack. */
(function(root){'use strict';
function equipmentIcon(d){
 const type=d?.type||'',category=d?.category||d?.mechanics?.category||'',tags=new Set(d?.tags||[]),slug=d?.slug||'',name=(d?.name||'').toLocaleLowerCase('ru'),usage=d?.mechanics?.usage?.value||'';
 if(type==='weapon')return 'sword';
 if(type==='shield')return 'item-shield';
 if(type==='armor')return 'item-armor';
 if(usage.includes('etched-')||/rune|runestone/.test(slug)||/руна|рунн|руничес/.test(name))return 'item-rune';
 if(/healer.*(?:kit|tool)|medic.*(?:kit|tool)|bandage|first-aid|surgical/.test(slug)||/перевяз|хирург|набор.*(?:лекар|целител)|(?:лекар|целител).*набор/.test(name))return 'item-medical';
 if(tags.has('food')||category==='food'||/(^|-)(?:rations?|meal|bread|cheese|food|drink|wine|ale|provisions)(-|$)/.test(slug)||/провиант|рацион|па[её]к|пища|сухпа/.test(name))return 'item-food';
 if(['potion','elixir','mutagen','poison','oil'].includes(category))return 'item-potions';
 if(tags.has('alchemical')||/alchemist/.test(slug)||/алхим/.test(name))return 'item-alchemy';
 if(category==='scroll'||type==='backpack'||type==='kit'||type==='ammo')return 'item-tools';
 if(category==='talisman'||category==='gem'||tags.has('talisman')||['magical','arcane','occult','divine','primal'].some(x=>tags.has(x))||/amulet|talisman|necklace|charm/.test(slug))return 'item-amulet';
 return 'item-tools';
}
root.ListEquipmentIcon=equipmentIcon;if(typeof module!=='undefined')module.exports=equipmentIcon;
})(typeof window!=='undefined'?window:globalThis);
