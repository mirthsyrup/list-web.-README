/* Display structured rule fields using Russian labels only. */
window.ruleMetadata=function(d,db,c=null){
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const usage=window.ListUpgradeTools.usageFields(d),usageLabels=new Set(usage.map(x=>x.label==='Действия'?'Сотворение':x.label)),m=d.mechanics||{},lines=[...new Set((d.details||[]).map(s=>String(s).trim()).filter(Boolean))].filter(s=>!usageLabels.has(String(s).split(':')[0])),ranks=['Нет обучения','Обучен','Эксперт','Мастер','Легенда'];
 const saves={fortitude:'Стойкость',reflex:'Рефлекс',will:'Воля'},damage={piercing:'колющий',slashing:'рубящий',bludgeoning:'дробящий',fire:'огонь',cold:'холод',acid:'кислота',electricity:'электричество',sonic:'звук',force:'сила',spirit:'дух',poison:'яд',vitality:'жизненная энергия',void:'пустота',mental:'ментальный',bleed:'кровотечение'};
 if(d.cat==='classes'){
  lines.push('ОЗ за уровень: '+m.hp+' + Телосложение');
  if(m.keyAbility?.value)lines.push('Ключевая характеристика: '+m.keyAbility.value.map(k=>Rules.ATTRS[k]||'по выбору').join(' / '));
  lines.push('Восприятие: '+ranks[m.perception||0]);
  for(const [k,v]of Object.entries(m.savingThrows||{}))lines.push((saves[k]||'Спасбросок')+': '+ranks[v]);
  if(m.trainedSkills)lines.push('Обученные навыки: '+(m.trainedSkills.value||[]).map(k=>Rules.SKILLS[k]?.[0]||'по выбору').join(', ')+`; ещё ${m.trainedSkills.additional||0} + Интеллект`);
 }else if(d.cat==='ancestries'){lines.push('Начальные ОЗ: '+m.hp);lines.push('Скорость: '+m.speed+' футов');}
 const stats=[];
 const stat=(label,value,tone='')=>stats.push({label,value,tone});
 const bonus=value=>Number(value)>0?'positive':Number(value)<0?'negative':'';
 if(d.cat==='equipment'){
  if(m.price?.value){const coins={gp:'зм',sp:'см',cp:'мм',pp:'пм'};stat('Цена',Object.entries(m.price.value).map(([k,v])=>v+' '+(coins[k]||'монет')).join(', '));}
  if(m.bulk?.value!==undefined)stat('Масса',m.bulk.value==='L'||m.bulk.value===0.1?'Л':m.bulk.value);
  if(d.type==='armor'){
   stat('Бонус КБ',Rules.signed(m.acBonus||0),bonus(m.acBonus));
   stat('Предел Ловкости',Rules.signed(m.dexCap||0));
   stat('Порог Силы',m.strength===null?'—':Rules.signed(m.strength||0));
   stat('Базовый штраф проверок',m.checkPenalty||0,bonus(m.checkPenalty));
   stat('Штраф скорости',(m.speedPenalty||0)+' футов',bonus(m.speedPenalty));
   if(c){const met=m.strength!==null&&c.attributes.str>=(m.strength||0),check=met?0:(m.checkPenalty||0),speed=Math.min(0,(m.speedPenalty||0)+(met?5:0));stat('Для персонажа · штраф проверок',check,bonus(check));if(met&&d.tags?.includes('noisy'))stat('Для персонажа · Скрытность',m.checkPenalty||0,bonus(m.checkPenalty));stat('Для персонажа · штраф скорости',speed+' футов',bonus(speed));}
  }
  if(d.type==='shield'){
   stat('КБ при поднятом щите',Rules.signed(m.acBonus||0),bonus(m.acBonus));
   if(d.slug==='tower-shield')stat('КБ после «Укрыться»','+4','positive');
   stat('Штраф скорости',(m.speedPenalty||0)+' футов',bonus(m.speedPenalty));
  }
  if(d.type==='weapon'&&m.damage){stat('Базовый урон',m.damage.dice+String(m.damage.die||'').replace('d','к')+' · '+(damage[m.damage.damageType]||'по описанию'));if(m.range)stat('Шаг дистанции',m.range+' футов');}
  if(m.hardness)stat('Твёрдость',m.hardness);if(m.hp?.max)stat('ОЗ предмета',m.hp.max);
  if(m.hp?.brokenThreshold!==undefined)stat('Порог поломки',m.hp.brokenThreshold);
 }
 const statsHtml=stats.length?'<section class="equipment-stats note" aria-label="Характеристики предмета"><dl>'+stats.map(x=>'<div><dt>'+escape(x.label)+'</dt><dd'+(x.tone?' class="stat-'+x.tone+'"':'')+'>'+escape(x.value)+'</dd></div>').join('')+'</dl>'+(d.type==='shield'?'<p class="equipment-hint">Бонус КБ действует, пока щит поднят. Штраф скорости — пока держишь щит.'+(d.slug==='tower-shield'?' «Укрыться» с поднятым щитом увеличивает бонус до +4, а не добавляет ещё +4.':'')+'</p>':d.type==='armor'?'<p class="equipment-hint">Предел Ловкости ограничивает её бонус к КБ, а не повышает Ловкость. При Силе не ниже указанного порога штраф проверок снимается, а штраф скорости уменьшается на 5 футов, минимум до 0. Гибкий доспех не штрафует Акробатику и Атлетику; шумный сохраняет штраф Скрытности даже при достаточной Силе.</p>':'')+'</section>':'';
 const displayLines=[...new Set(lines)];
 const usageHtml=usage.length?'<section class="usage-card" aria-label="Условия применения"><h3>Требования и применение</h3><dl>'+usage.map(x=>'<div><dt>'+escape(x.label)+'</dt><dd>'+(window.renderRuleText?window.renderRuleText(x.value,d.id):escape(x.value))+'</dd></div>').join('')+'</dl></section>':'';
 let html=usageHtml+statsHtml+(displayLines.length?'<div class="note" style="margin-top:16px">'+displayLines.map(s=>window.renderRuleText?window.renderRuleText(s,d.id):escape(s)).join('<br>')+'</div>':'');
 if(d.cat==='classes'){
  const feats={ancestryFeatLevels:'Способность родословной',classFeatLevels:'Способность класса',skillFeatLevels:'Способность навыка',generalFeatLevels:'Общая способность',skillIncreaseLevels:'Повышение навыка'},items=Object.values(m.items||{});
  html+='<details class="progression"><summary>Развитие класса · уровни 1–20</summary>';
  for(let level=1;level<=20;level++){
   const picks=Object.entries(feats).filter(([k])=>m[k]?.value?.includes(level)).map(([,n])=>n);if([5,10,15,20].includes(level))picks.push('Повышения характеристик');
   const features=items.filter(x=>x.level===level);
   html+=`<div class="progression-row"><b>${level}</b><div>${picks.map(escape).join(' · ')}${features.map(x=>db[x.id]?`<button class="linkbtn" data-action="detail" data-id="${escape(x.id)}">${escape(db[x.id].name)}</button>`:`<span class="small">${escape(x.name)}</span>`).join('')}</div></div>`;
  }html+='</details>';
 }
 return html;
};
