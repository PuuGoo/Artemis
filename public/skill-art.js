/* Ảnh chỉ dùng ở giao diện; hiệu ứng chiến đấu là hình vector, không kéo giãn PNG. */
(function (root) {
  'use strict';
  const data = root.SkillArtData;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const aliases = {'Multishot':'Rapid Fire',"Warrior's Soul":'Warriors Soul','Sprite Frenzy':'Frenzy Sprite','Ricochet Arrow':'Ricocheting Arrow','Beam Strike':'Flying Sword Beam','Super Circle':'Super Rotating Balls'};
  root.renderSkillIcon = function (skill, size = 32) {
    const slug = data.mapping[skill.id];
    const fallback = '<span aria-hidden="true" style="grid-area:1/1">' + esc(skill.icon || '✦') + '</span>';
    if (!slug) return fallback;
    return '<span style="display:inline-grid;place-items:center;width:'+size+'px;height:'+size+'px;vertical-align:middle;flex-shrink:0;pointer-events:none">'+fallback+'<img src="assets/skills/'+slug+'.png" alt="'+esc(skill.wikiName || skill.name)+'" width="'+size+'" height="'+size+'" loading="lazy" decoding="async" style="grid-area:1/1;object-fit:contain;width:100%;height:100%;pointer-events:none" onload="this.previousElementSibling.hidden=true" onerror="this.hidden=true"></span>';
  };
  root.renderSkillReference = function (skill) {
    const name = skill.wikiName;
    const wiki = data.wiki.find(r => r.name === name);
    const editorial = data.editorial.find(r => r.name === (aliases[name] || name));
    if (!wiki && !editorial) return '';
    return '<details class="mt-2 text-[10px] text-slate-400"><summary>Tham chiếu kỹ năng (không đổi chỉ số trận)</summary>'+
      (wiki ? '<p><a href="'+data.sources.wiki.url+'?oldid=1858" target="_blank" rel="noopener noreferrer">Wiki r1858</a>: '+esc(wiki.effects)+'</p>' : '')+
      (editorial ? '<p><a href="'+data.sources.editorial.url+'" target="_blank" rel="noopener noreferrer">mobi.gg</a> · Hạng biên tập '+esc(editorial.tier)+' (không phải độ hiếm): '+esc(editorial.effect)+'</p>' : '')+'</details>';
  };
})(globalThis);
