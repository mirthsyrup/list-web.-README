/* Physical item form wins over decorative words in a magical item's name. */
(function(root){'use strict';
const precise=['bow','helmet','gloves','boots','cloak','belt','ring','necklace','staff','wand','scroll','book','gem','lantern','bomb','herbs','coins','key','lock','toolkit','rope','tent','arrows','bolts','bullets','instrument','pouch','map','handcuffs','chain','climbing','sleeping','saddle','cage','trap','cart','lockpicks','drink','wood','ore','chest','circlet','earrings','brooch','clothes','uniform','document','seal','crates','perfume','chair','painting','cards','wolf','horse','firearm','shuriken','drug','poison','ingot','axe','mace','hammer','spear','dagger','flail','crossbow','orb','mirror','mask','pickaxe','bracelet','quiver'];
const worn={wornamulet:'necklace',wornnecklace:'necklace',worncollar:'necklace',wornring:'ring',worncloak:'cloak',worncape:'cloak',wornbelt:'belt',wornshoes:'boots',wornanklets:'boots',worngloves:'gloves',wornbracers:'bracelet',wornbracelet:'bracelet',wornarmbands:'bracelet',wornmask:'mask',worngarment:'clothes',wornclothing:'clothes',worncirclet:'circlet',worneyepiece:'eye',worneyeglasses:'eye',wornsaddle:'saddle',wornbackpack:'bag'};
const alcohol=new Set(['alcohol','alkenstar-ice-wine','iron-wine','matsukis-medicinal-wine','elven-absinthe']);
const overrides={
 'marvelous-miniature-horse':'horse','wondrous-figurine-obsidian-steed':'horse',
 'alchemists-toolkit':'alchemy','healers-toolkit':'medical','healers-tools':'medical',
 'grappling-gun':'firearm','grappling-gun-clockwork':'firearm',
 'wrist-grappler':'firearm','wrist-grappler-clockwork':'firearm',
 'wolf-fang':'amulet','amulet-of-the-slumberer':'necklace','dragonscale-amulet':'necklace',
 'sandcastle':'tools','bomb-coagulant-alembic':'alchemy','bomb-launcher':'firearm'
};
// Whole noun tokens only: horse != dragon, lock != clockwork, lumber != slumberer.
const nouns={
 necklace:['амулет','амулеты','ожерелье','ожерелья','кулон','медальон','колье','брелок','amulet','necklace','pendant','locket','medallion'],
 ring:['кольцо','кольца','перстень','ring'],bracelet:['браслет','браслеты','наручи','bracelet','bangles','bracers','armbands'],
 handcuffs:['наручники','кандалы','handcuffs','manacles'],
 crossbow:['арбалет','crossbow','crossbows'],bow:['лук','longbow','shortbow','bow'],
 firearm:['пистолет','мультипистолет','ружье','ружьё','винтовка','бластер','мушкет','аркебуза','пищаль','пистоль','pistol','multipistol','musket','arquebus','firearm','gun','rifle','blunderbuss'],
 axe:['топор','секира','топорик','axe','greataxe','hatchet','battleaxe'],
 mace:['булава','дубина','палица','дубинка','mace','club','cudgel','greatclub'],hammer:['молот','молоток','hammer','warhammer','maul'],
 spear:['копье','копьё','пика','алебарда','глефа','трезубец','нагината','spear','pike','halberd','glaive','trident','naginata','lance','javelin'],
 dagger:['кинжал','нож','dagger','knife','starknife','kukri'],flail:['цеп','кистень','flail'],shuriken:['сюрикен','shuriken'],
 sword:['меч','рапира','клинок','сабля','шпага','катана','скимитар','sword','rapier','blade','katana','scimitar','longsword','shortsword','greatsword'],
 staff:['посох','staff'],wand:['жезл','wand'],shield:['щит','баклер','shield','buckler'],armor:['доспех','доспехи','кольчуга','броня','латы','armor','armour'],
 helmet:['шлем','helmet','helm'],gloves:['перчатки','рукавицы','gloves','gauntlets'],boots:['ботинки','сапоги','сандалии','башмаки','коньки','boots','shoes','sandals','skates','spats'],
 cloak:['плащ','накидка','cloak','cape'],belt:['пояс','ремень','belt'],circlet:['ободок','обруч','венец','корона','диадема','headband','circlet','crown','diadem'],
 earrings:['серьги','earrings'],brooch:['брошь','броши','brooch'],mask:['маска','маски','mask'],clothes:['мантия','одежда','одеяние','костюм','риза','ряса','clothing','clothes','outfit','robe','vestments'],uniform:['мундир','униформа','uniform'],
 ingot:['слиток','слитки','ingot'],ore:['руда','кусок','фрагмент','ore','chunk','nugget'],wood:['пиломатериал','дрова','бревна','брёвна','lumber','firewood','timber'],
 gem:['камень','камни','алмаз','агат','аметист','опал','самоцвет','рубин','сапфир','изумруд','кристалл','кристаллы','жемчужина','gem','gemstone','crystal','crystals','diamond','opal','ruby','sapphire','emerald','pearl','agate'],
 orb:['сфера','шар','orb','sphere'],mirror:['зеркало','mirror'],eye:['глаз','око','очки','линза','телескоп','goggles','eyeglasses','eye','lens','scope','spyglass','telescope'],
 scroll:['свиток','фулу','пергамент','scroll','fulu','parchment'],book:['книга','гримуар','том','кодекс','бестиарий','манускрипт','рукопись','book','grimoire','tome','spellbook','bestiary','manuscript','codex'],
 document:['документ','контракт','document','contract'],seal:['печать','сургуч','seal','wax'],
 lantern:['фонарь','факел','свеча','lantern','torch','candle'],bomb:['бомба','бомбы','мина','bomb','mine'],
 herbs:['трава','травы','herb','herbs'],coins:['монета','монеты','coins','coin'],key:['ключ','ключи','key'],lock:['замок','замки','lock','padlock'],
 rope:['веревка','верёвка','канат','rope'],chain:['цепь','chain'],tent:['палатка','tent'],sleeping:['спальник','bedroll'],
 saddle:['седло','saddle'],cage:['клетка','cage'],trap:['ловушка','силок','капкан','snare','trap'],cart:['повозка','телега','тележка','cart','wagon'],
 lockpicks:['отмычка','отмычки','lockpick','lockpicks'],climbing:['альпинистский','скалолазный'],pickaxe:['кирка','pickaxe'],
 medical:['бинт','бинты','перевязочный','bandage','bandages'],toolkit:['инструменты','набор','комплект','toolkit','tools'],
 chest:['сундук','шкатулка','chest'],crates:['ящик','crate'],pouch:['мешок','мешочек','кошелек','кошелёк','сумка','сумки','чехол','pouch','sack','purse','bag'],
 quiver:['колчан','quiver'],instrument:['барабан','барабаны','лютня','арахнолютня','волынка','флейта','дудка','горн','свирель','рожок','инструмент','lute','flute','drum','drums','horn','instrument','bagpipes'],
 bullets:['пуля','пули','патрон','патроны','магазин','bullets','cartridges','magazine'],bolts:['болт','болты','bolts'],arrows:['стрелы','arrows'],
 map:['карта','атлас','map','atlas','chart'],cards:['колода','cards','deck'],chair:['кресло','стул','стульчик','chair','stool','wheelchair'],
 painting:['картина','портрет','painting','portrait'],perfume:['духи','парфюм','perfume'],
 drink:['алкоголь','вино','эль','пиво','абсент','кружка','бокал','drink','wine','ale','beer','absinthe','mug','tankard'],
 food:['рационы','рацион','провиант','паек','паёк','еда','хлеб','сыр','банкет','rations','ration','provisions','food','bread','cheese','meal','banquet'],
 potions:['бутылка','бутыль','флакон','зелье','масло','сыворотка','bottle','flask','potion','oil','serum'],
 rune:['руна','руны','рунный','runestone','rune'],gear:['шестерня','шестеренка','шестерёнка','механизм','cogwheel','gear'],dice:['кости','кубики','dice']
};
const ruHeads=new Map(),enHeads=new Map();for(const [key,words]of Object.entries(nouns))for(const word of words)(/[а-яё]/u.test(word)?ruHeads:enHeads).set(word,key);
const tokens=s=>String(s||'').toLocaleLowerCase('ru').match(/[\p{L}\p{N}]+/gu)||[];
function head(d){
 if(/^спальный мешок(?:\s|$)/u.test((d.name||'').toLocaleLowerCase('ru')))return 'sleeping';
 const ru=tokens((d.name||'').split(/[(:]/)[0]),end=ru.findIndex(x=>['из','для','с','со','от','под','без','к'].includes(x));
 for(const word of end<0?ru:ru.slice(0,end)){if(ruHeads.has(word))return ruHeads.get(word);}
 const en=tokens(d.slug),stop=en.findIndex(x=>['of','with','for'].includes(x));
 for(const word of stop<0?en:en.slice(0,stop)){if(enHeads.has(word))return enHeads.get(word);}
 return null;
}
function explain(d={}){
 const type=d.type||'',category=d.category||d.mechanics?.category||'',tags=new Set(d.tags||[]),slug=d.slug||'',usage=d.mechanics?.usage?.value||'';
 const result=(key,reason)=>({icon:['sword','bag','gear','eye','dice'].includes(key)?key:'item-'+key,reason});
 const form=head(d);
 if(overrides[slug])return result(overrides[slug],'reviewed item');
 if(tags.has('bomb'))return result('bomb','bomb');
 if(type==='weapon')return result(tags.has('staff')?'staff':['bow','crossbow','firearm','axe','mace','hammer','spear','dagger','flail','shuriken','staff'].includes(form)?form:tags.has('concussive')||tags.has('kickback')||/^air-repeater(?:-|$)/.test(slug)?'firearm':'sword','weapon');
 if(type==='shield')return result('shield','shield');if(type==='armor')return result('armor','armor');
 if(type==='ammo')return result(/(?:^|-)(?:bolt|bolts)(?:-|$)/.test(slug)?'bolts':/(?:^|-)(?:bullet|bullets|cartridge|cartridges|round|rounds|magazine)(?:-|$)/.test(slug)?'bullets':'arrows','ammunition');
 if(usage.startsWith('etched-')||form==='rune')return result('rune','rune');
 if(category==='wand')return result('wand','wand');
 if(usage==='tattooed-on-the-body')return result('rune','magical tattoo');
 if(alcohol.has(slug))return result('drink','alcohol');
 if(category==='drug'||tags.has('drug'))return result('drug','drug');
 if(category==='poison'||type==='consumable'&&tags.has('poison')&&!['potion','elixir','mutagen'].includes(category))return result('poison','poison');
 if(['potion','elixir','mutagen','oil'].includes(category))return result('potions','potion or elixir');
 if(category==='scroll'||category==='fulu')return result('scroll','scroll');if(category==='wand')return result('wand','wand');
 if(tags.has('bomb'))return result('bomb','bomb');if(category==='snare')return result('trap','snare');
 if(category==='gem')return result('gem','gem');if(category==='coin')return result('coins','coin');
 if(type==='backpack')return result(usage==='wornsaddle'||/^(?:saddle|saddlebags)(?:-|$)/.test(slug)?'saddle':'bag','backpack');
 if(worn[usage])return result(worn[usage],'wearing slot');
 if(category==='talisman')return result(['necklace','brooch','ring','bracelet'].includes(form)?form:'amulet','talisman');
 if(/^(?:healers?|medic|surgical|first-aid|battle-medic)-(?:toolkit|kit|tools)(?:-|$)/.test(slug))return result('medical','medical kit');
 if(/^thieves-(?:toolkit|tools)(?:-|$)/.test(slug))return result('lockpicks','thieves tools');
 if(/^climbing-(?:kit|gear)(?:-|$)/.test(slug))return result('climbing','climbing kit');
 if(/^alchemists?-(?:toolkit|tools)(?:-|$)/.test(slug))return result('alchemy','alchemical toolkit');
 if(/^alchemical-chart(?:-|$)/.test(slug))return result('document','alchemical chart');
 if(/^карта харро(?:\s|$)/u.test((d.name||'').toLocaleLowerCase('ru')))return result('cards','harrow card');
 if(form)return result(form,'physical noun');
 if(tags.has('food')||category==='food')return result('food','food');
 if(tags.has('alchemical'))return result('alchemy','alchemical item');
 if(category==='gadget')return result('gear','mechanical gadget');
 return result('tools','unspecified equipment');
}
function equipmentIcon(d){return explain(d).icon;}
equipmentIcon.precise=precise;equipmentIcon.explain=explain;
root.ListEquipmentIcon=equipmentIcon;if(typeof module!=='undefined')module.exports=equipmentIcon;
})(typeof window!=='undefined'?window:globalThis);
