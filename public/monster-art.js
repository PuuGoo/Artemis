/* Mỹ thuật quái được cung cấp: chỉ đổi ngoại hình, không thay AI/chỉ số/hitbox. */
(function (root) {
  'use strict';
  const assets = [
    ['Icon_Bat_Gray_4f8a9c.png', 'stone', false],
    ['Icon_BatMage_Gray_bc6707.png', 'stone', false],
    ['Icon_BatMage_Purple_f6213f.png', 'void', false],
    ['Icon_Bee_Yellow_ad322d.png', 'forest', false],
    ['Icon_Boss_BeeQueen_Purple_5581a1.png', 'forest', true],
    ['Icon_Boss_Boar_Blue_d0c00b.png', 'ice', true],
    ['Icon_Boss_Boar_Brown_b3eaae.png', 'stone', true],
    ['Icon_Boss_SnowMan_Purple_390f75.png', 'ice', true],
    ['Icon_Boss_With_Red_cd3f56.png', 'fire', true],
    ['Icon_BossBingMo_Purple_dc21fe.png', 'ice', true],
    ['Icon_BossDemon_Purple_37ff22.png', 'void', true],
    ['Icon_BossDemon_Red_ccb16c.png', 'fire', true],
    ['Icon_BossFlameDemon_Red_f96019.png', 'fire', true],
    ['Icon_BossSunflower_Yellow_fbbdb2.png', 'forest', true],
    ['Icon_GhostFireCenter_623481.png', 'void', false],
    ['Icon_Grim_Purple_cd4116.png', 'void', false],
    ['Icon_Grim_Red_0aeec8.png', 'fire', false],
    ['Icon_HaiGuZhanShi_Blue_ac9d54.png', 'ice', false],
    ['Icon_HaiGuZhanShi_Brown_da5ea2.png', 'stone', false],
    ['Icon_HuoYanLingZhu_375559.png', 'fire', false],
    ['Icon_KuLouYuanCheng_Skin_c1f9cd.png', 'stone', false],
    ['Icon_KuLouYuanCheng_Skin_Blue_36532c.png', 'ice', false],
    ['Icon_LeiDianMao_b05c67.png', 'sky', false],
    ['Icon_MeiDuSha_Green_c185fa.png', 'forest', false],
    ['Icon_MeiDuSha_Purple_ed3092.png', 'void', false],
    ['Icon_MoFaShu_f817c6.png', 'forest', false],
    ['Icon_MoveFlower_Blue_3118df.png', 'ice', false],
    ['Icon_MoveFlower_Purple_91997c.png', 'void', false],
    ['Icon_MoveFlower_Red_fec301.png', 'fire', false],
    ['Icon_PenHuoLong_Purple_af9f48.png', 'sky', false],
    ['Icon_ScorpoinBig_Red_2eb985.png', 'fire', false],
    ['Icon_ScorpoinSmall_Orange_b0ebac.png', 'stone', false],
    ['Icon_ShuYao_64da08.png', 'forest', false],
    ['ICon_ShuYao_Red_5296e5.png', 'fire', false],
    ['Icon_SmilmeSmall_ccca1d.png', 'stone', false],
    ['Icon_UndergroundWormNew_Red_336601.png', 'fire', false],
    ['Icon_Whirlwind_Green_542e6c.png', 'sky', false],
    ['Icon_Witch_Blue_dc7027.png', 'ice', false],
    ['Icon_Wolf_f26b27.png', 'forest', false],
    ['Icon_Wolf_Red_691e7a.png', 'fire', false]
  ].map(([file, theme, boss]) => Object.freeze({ file, theme, boss, path: '/assets/monsters/' + file }));
  const byFile = new Map(assets.map(a => [a.file, a]));
  // Chương 1–7 theo môi trường; chương hoàng đạo luân phiên các họ ngoại hình.
  const themes = ['stone', 'fire', 'void', 'sky', 'void', 'ice', 'forest'];
  const zodiacThemes = ['fire', 'stone', 'sky', 'ice', 'fire', 'forest', 'sky', 'void', 'forest', 'stone', 'ice', 'void'];
  const cache = new Map(); // Tối đa đúng số ảnh trong manifest; lỗi tải không thử lại mỗi khung.
  function themeFor(chapterId) {
    const id = Number(chapterId) || 1;
    return id >= 8 && id <= 19 ? zodiacThemes[id - 8] : themes[(Math.max(1, id) - 1) % themes.length];
  }
  function pool(chapterId, boss) {
    const theme = themeFor(chapterId);
    // Bầu trời dùng trùm băng; không đưa ảnh trùm vào quái thường.
    return assets.filter(a => a.boss === !!boss && a.theme === (boss && theme === 'sky' ? 'ice' : theme));
  }
  function hash(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
    return h >>> 0;
  }
  function beginRun(game) {
    game.monsterArtSeed = Math.floor(Math.random() * 4294967296) >>> 0;
  }
  function assignRoom(game) {
    if (!Number.isInteger(game.monsterArtSeed)) beginRun(game);
    const chapterId = game.chapter && game.chapter.id || 1;
    const normal = pool(chapterId, false), bosses = pool(chapterId, true);
    // Cố định trong lượt/chương/phòng; dựng lại phòng không đổi ảnh và draw không tung xúc xắc.
    const offset = hash(game.monsterArtSeed + ':' + chapterId);
    game.enemies.forEach((enemy, index) => {
      const choices = enemy.isBoss ? bosses : normal;
      const room = Math.max(1, Number(game.room) || 1);
      enemy.monsterArtFile = choices[(offset + room - 1 + index) % choices.length].file;
    });
  }
  function imageFor(file) {
    const asset = byFile.get(file);
    if (!asset || typeof root.Image !== 'function') return null;
    if (!cache.has(file)) {
      const image = new root.Image();
      const entry = { image, failed: false };
      cache.set(file, entry);
      image.onerror = () => { entry.failed = true; };
      image.src = asset.path;
    }
    const entry = cache.get(file), image = entry.image;
    return !entry.failed && image.complete && image.naturalWidth > 0 && image.naturalHeight > 0 ? image : null;
  }
  function draw(ctx, enemy) {
    const asset = byFile.get(enemy.monsterArtFile);
    if (!asset || asset.boss !== !!enemy.isBoss || !Number.isFinite(enemy.r) || enemy.r <= 0) return false;
    const image = imageFor(asset.file);
    if (!image) return false;
    const size = enemy.r * 2.5;
    const scale = size / Math.max(image.naturalWidth, image.naturalHeight);
    const width = image.naturalWidth * scale, height = image.naturalHeight * scale;
    // Giữ tỉ lệ ảnh và neo đáy vào chân; chuyển động thuộc entity gốc, không kéo méo PNG.
    ctx.drawImage(image, -width / 2, enemy.r - height, width, height);
    return true;
  }
  root.MonsterArt = Object.freeze({ assets: Object.freeze(assets), themeFor, pool, beginRun, assignRoom, draw });
  // Sprite-sheet renderer is optional and only replaces icons with authored atlases.
  // Missing/invalid images continue to use this original MonsterArt.draw() implementation.
  if(root.document?.head && !root.document.querySelector('script[data-monster-sprite-animation]')){
    const script=root.document.createElement('script');
    script.dataset.monsterSpriteAnimation='1';
    script.src='/monster-sprite-animation.js?v=leo-royal-minions-20261111';
    root.document.head.appendChild(script);
  }
})(globalThis);
