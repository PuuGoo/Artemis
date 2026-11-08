/* Nền sàn lấy từ ảnh thật: chỉ vẽ hình, không đổi va chạm, hitbox hay toạ độ. */
(function (root) {
  'use strict';
  const KEYS = ['chengbao_13x17', 'dianfeng_13x21_01', 'duizhan_13x25_01', 'duizhan_13x25_02',
    'duizhan_13x25_03', 'duizhan_13x25_04', 'duizhan_13x25_05', 'duizhan_13x25_06',
    'duizhan_13x25_07', 'duizhan_13x25_08', 'duizhan_13x25_09_new', 'duizhan_13x25_10_new',
    'duizhan_13x25_11_new', 'duizhan_13x25_12', 'duizhan_13x25_13', 'duizhan_13x25_14',
    'duizhan_13x25_15', 'duizhan_13x25_16', 'duizhan_13x25_17', 'duizhan_13x25_18',
    'meilizhi_battle_02', 'meilizhi_battle_03', 'meilizhi_battle_04', 'meilizhi_battle_05',
    'meilizhi_dianfeng_02', 'meilizhi_dianfeng_03', 'meilizhi_dianfeng_04', 'meilizhi_dianfeng_05'];
  const cache = new Map();
  const motion = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  function pick(chapter, room) {
    // Cùng một chương/phòng luôn ra cùng nền; đổi phòng thì đổi nền.
    const ch = Math.max(1, Number(chapter) || 1);
    const r = Math.max(1, Number(room) || 1);
    const index = (ch * 7 + r * 3 + Math.floor(ch / 4)) % KEYS.length;
    return KEYS[(index + KEYS.length) % KEYS.length];
  }

  function shouldDraw(game) {
    return !!game && !game.lowGfx && !motion.matches && !game.reduceMotion;
  }

  function image(key) {
    if (cache.has(key)) return cache.get(key);
    const ImageCtor = root.Image;
    if (typeof ImageCtor !== 'function') { cache.set(key, null); return null; }
    const img = new ImageCtor();
    img.decoding = 'async';
    img.src = 'assets/maps/' + key + '.webp';
    cache.set(key, img);
    return img;
  }

  function draw(c, w, h, pad, chapter, room, game) {
    if (!shouldDraw(game)) return false;
    const key = pick(chapter, room);
    const img = image(key);
    // Ảnh chưa giải mã xong thì bỏ qua frame này, không chặn render.
    if (!img || !img.complete || !img.naturalWidth) return false;
    const innerW = Math.max(1, w - pad * 2);
    const innerH = Math.max(1, h - pad * 2);
    // Vẽ phủ toàn sàn, luôn lấp đầy khung nhìn; lớp tối nhẹ để nhân vật/đạn nổi trên ảnh.
    c.globalAlpha = 0.92;
    c.drawImage(img, pad, pad, innerW, innerH);
    c.globalAlpha = 0.28;
    c.fillStyle = '#050a14';
    c.fillRect(pad, pad, innerW, innerH);
    // drawArena bọc lệnh này trong save/restore của nó; ở đây không tự save để mỗi frame
    // chỉ có đúng một drawImage + một fillRect, không giữ trạng thái canvas.
    return true;
  }

  root.ArenaGround = { KEYS, pick, shouldDraw, draw, _cache: cache };
})(globalThis);
