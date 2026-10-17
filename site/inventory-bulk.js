/* Pathfinder Bulk from catalog values, never inferred kilograms. */
(function(root){'use strict';
function total(character,db){
 let hundredths=0,unknown=0,count=0;
 for(const item of character.inventory||[]){
  if(!item.equipped)continue;
  const quantity=Math.max(1,Number(item.quantity)||1),record=db[item.id],value=record?.mechanics?.bulk?.value;
  if(!Number.isFinite(value)||value<0){unknown+=quantity;continue;}
  const pack=record.type==='ammo'?Math.max(1,Number(record.mechanics?.price?.per)||1):1;
  hundredths+=Math.round(value*quantity*100/pack);count+=quantity;
 }
 return{value:hundredths/100,unknown,count};
}
function format(value){return new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(value)+' Bulk';}
const api={total,format};root.ListInventoryBulk=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
