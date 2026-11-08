// Chỉ diễn giải dòng có số và phạm vi rõ ràng; không gán số cho mô tả định tính.
(function(root){
 'use strict';
 const labels=['Normal','Fine','Rare','Epic','Legendary','Mythic'];
 const ranks={Normal:1,Fine:2,Rare:3,Epic:4,'Epic +2':6,Legendary:7,'Legendary +1':8,'Legendary +2':9,'Legendary +3':10,Mythic:11};
 const types={'main weapon':'weapon',elemental:'elemental',circle:'circle',meteor:'meteor',sprite:'sprite',strike:'strike',plant:'plant',fire:'fire',poison:'poison',ice:'ice',lightning:'lightning'};
 function equipped(s){return [...new Set(Object.entries(s.equippedRuneSlots||{}).flatMap(([cat,ids])=>(Array.isArray(ids)?ids:[]).filter(id=>Number(s.runes?.[id])>0&&root.RuneWikiData?.[id]?.type?.toLowerCase()===cat)))];}
 function enchant(s,id){const n=Number(s.runeEnchantments?.[id]);return Number.isInteger(n)&&n>0&&n<=6&&Number(s.runes?.[id])>=6?n:0;}
 function lines(s,w,id){const n=enchant(s,id);return n?String(w[id]?.enchantments?.[labels[n-1]]||'')+'\n'+String(w[id]?.sharedEnchantments?.[labels[n-1]]||''):'';}
 function stats(s,w){let atk=0,hp=0;for(const id of equipped(s)){for(const line of lines(s,w,id).split('\n')){const m=/^(ATK PWR|Max HP)\s*\+\s*([\d.]+)$/.exec(line);if(m?.[1]==='ATK PWR')atk+=+m[2];if(m?.[1]==='Max HP')hp+=+m[2];}}return {atk,hp};}
 function damage(s,w,type,e,p,typedOnly=false){let flat=0,pct=0,critRate=0,critDmg=0,bossPct=0;
  for(const id of equipped(s)){
   const row=w[id],rank=Number(s.runes[id]);if(!row)continue;
   for(const [tier,text] of Object.entries(row.effects||{})){
    if(rank<(ranks[tier]||99))continue;
    const m=/^(Main Weapon|Elemental|Circle|Meteor|Sprite|Strike|Plant|Fire|Poison|Ice|Lightning) (?:damage|DMG)\s*\+\s*([\d.]+)$/i.exec(text);
    if(m&&types[m[1].toLowerCase()]===type)flat+=+m[2];
   }
   for(const line of lines(s,w,id).split('\n')){
    const m=/^(Main Weapon|Elemental|Circle|Meteor|Sprite|Strike|Plant) (DMG|CRIT Rate|CRIT DMG)\s*\+\s*([\d.]+)(%)?$/i.exec(line);
    if(m&&types[m[1].toLowerCase()]===type){if(m[2].toLowerCase()==='dmg'){if(m[4])pct+=+m[3]/100;else flat+=+m[3];}else if(m[2].toLowerCase()==='crit rate')critRate+=+m[3]/100;else critDmg+=+m[3]/100;}
    const b=/^(?:Boss DMG|More damage VS minions)\+([\d.]+)%$/.exec(line);if(!typedOnly&&b&&((e.isBoss&&line.startsWith('Boss'))||(!e.isBoss&&!line.startsWith('Boss'))))bossPct+=+b[1]/100;
    const c=/^CRIT DMG\+([\d.]+)%$/.exec(line);if(!typedOnly&&c)critDmg+=+c[1]/100;
   }
   if(id==='sharp_arrow'&&type==='weapon'&&rank>=4)pct+=rank>=11?.30:rank>=7?.20:.10;
   if(id==='potion_magnet'&&type==='meteor'&&rank>=7)pct+=rank>=11?.50:.25;
   if(id==='sawblade_circle'&&type==='circle'&&rank>=7)pct+=.50;
   if(id==='elemental_domain'&&['elemental','fire','poison','ice','lightning'].includes(type)&&e.hp<e.maxHp*.5&&rank>=9)pct+=rank>=11?.30:.15;
   if(id==='sword_strike_split'&&type==='strike'&&rank>=11&&e.hp<e.maxHp*.5)pct+=.20;
  }
  // Bonus nguyên tố chung cũng áp dụng cho lửa/độc/băng/sét, nhưng chỉ đúng một lần.
  if(['fire','poison','ice','lightning'].includes(type)){const all=damage(s,w,'elemental',e,p,true);flat+=all.flat;pct+=all.pct;critRate+=all.critRate;critDmg+=all.critDmg;}
  return {flat,pct,critRate,critDmg,bossPct};
 }
 function bounces(s,id){if(!equipped(s).includes(id))return 0;const n=enchant(s,id);return n>=6?4:n>=5?2:0;}
 function defense(s,w,source,context){let reduction=0,critReduction=0;const kind=({1:'Circle',2:'Sword Strike',3:'Meteor',4:'Main Weapon',5:'Sprite'})[context.exHurtAttack];
  for(const id of equipped(s))for(const line of lines(s,w,id).split('\n')){
   const boss=/^(Boss|Minion) DMG REDUC\+([\d.]+)%$/.exec(line);if(boss&&((boss[1]==='Boss')===!!source?.isBoss))reduction+=+boss[2]/100;
   const typed=/^Reduced (.+) DMG taken\+([\d.]+)%$/.exec(line);if(typed&&(typed[1]===kind||(typed[1]==='Elemental'&&[2,3,4,5,8].includes(context.hurtType))))reduction+=+typed[2]/100;
   const crit=/^CRIT DMG REDUC\+([\d.]+)%$/.exec(line);if(crit)critReduction+=+crit[1]/100;
  }return{reduction:Math.min(.9,reduction),critReduction};
 }
 root.ArtemisRuneModifiers=Object.freeze({equipped,enchant,stats,damage,bounces,defense});
})(window);
