// Ảnh chân dung anh hùng dùng PNG thật (public/assets/heroes) thay avatar SVG/base64.
//
// Khoá các hành vi:
//   1. 14 anh hùng có ảnh đều được gán avatar trỏ assets/heroes/<id>.png.
//   2. Anh hùng chưa có ảnh (Wukong, Nezha, Hou Yi, Artemis) giữ avatar cũ.
//   3. File ảnh tồn tại thật, là PNG RGBA (nền trong suốt), cao >= 256px và nhẹ (< 400KB).
//   4. Ảnh toàn thân được neo `object-position: top` để khung vuông/tròn không cắt mất mặt.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const heroArtDir = new URL('../public/assets/heroes/', import.meta.url);

const mapStart = html.indexOf('const HERO_ART_FILES = {');
const mapEnd = html.indexOf('};', mapStart);
assert.ok(mapStart > -1, 'thiếu khai báo HERO_ART_FILES');
const heroArt = [...html.slice(mapStart, mapEnd).replace(/^\s*\/\/.*$/gm, '').matchAll(/([a-z_]+):\s*'([a-z_]+)'/g)]
  .map((m) => ({ heroId: m[1], file: m[2] }));

// Danh sách hero thật trong HEROES: mỗi phần tử mở đầu bằng `id: '...'` + `name: '...'`.
const heroesBlock = html.slice(html.indexOf('const HEROES = ['), html.indexOf('const HERO_ART_FILES'));
const heroIds = [...heroesBlock.matchAll(/\n\s+id: '([a-z_]+)',\n\s+name:/g)].map((m) => m[1]);

test('14 anh hùng có ảnh được gán avatar PNG, các hero còn lại giữ avatar cũ', () => {
  assert.equal(heroIds.length, 18, `phải nhận diện 18 anh hùng, đang có ${heroIds.length}`);
  assert.equal(heroArt.length, 14, `phải khai báo 14 ảnh, đang có ${heroArt.length}`);

  const mapped = new Set(heroArt.map((h) => h.heroId));
  for (const heroId of heroIds) {
    if (['wukong', 'nezha', 'hou_yi', 'artemis'].includes(heroId)) {
      assert.equal(mapped.has(heroId), false, `${heroId} chưa có ảnh, phải giữ avatar cũ`);
    } else {
      assert.equal(mapped.has(heroId), true, `${heroId} chưa được gán ảnh chân dung`);
    }
  }
  for (const entry of heroArt) {
    assert.equal(heroIds.includes(entry.heroId), true, `${entry.heroId} không phải hero có thật`);
  }
});

test('avatar được gán sau HEROES bằng vòng lặp, không sửa tay từng khối base64', () => {
  const loopStart = html.indexOf('for (const hero of HEROES) {', mapEnd);
  assert.ok(loopStart > 0, 'thiếu vòng lặp gán avatar');
  const loopBody = html.slice(loopStart, loopStart + 400);
  assert.match(loopBody, /HERO_ART_FILES\[hero\.id\]/);
  assert.match(loopBody, /hero\.avatar = `assets\/heroes\/\$\{heroArtFile\}\.png`/);
  // Avatar mới phải ghi đè sau khi mảng HEROES đã khai báo xong.
  assert.ok(loopStart > html.indexOf('const HEROES = ['), 'vòng lặp phải nằm sau khai báo HEROES');
});

test('mỗi file ảnh chân dung tồn tại, là PNG RGBA, đủ nét và không nặng', () => {
  const files = fs.readdirSync(heroArtDir).filter((f) => f.endsWith('.png'));
  assert.equal(files.length, 14, `assets/heroes phải có đúng 14 ảnh, đang có ${files.length}`);

  for (const entry of heroArt) {
    const path = new URL(`${entry.file}.png`, heroArtDir);
    assert.equal(fs.existsSync(path), true, `thiếu file assets/heroes/${entry.file}.png`);
    const buf = fs.readFileSync(path);
    assert.match(buf.subarray(0, 8).toString('hex'), /^89504e470d0a1a0a$/, `${entry.file}.png không phải PNG hợp lệ`);
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    assert.equal(buf[25], 6, `${entry.file}.png phải là RGBA (nền trong suốt)`);
    assert.ok(height >= 256 && width >= 128, `${entry.file}.png quá nhỏ (${width}×${height})`);
    assert.ok(buf.length < 400 * 1024, `${entry.file}.png quá nặng (${Math.round(buf.length / 1024)}KB > 400KB)`);
  }

  // Tổng dung lượng phải giữ ở mức tải được trên web (ảnh gốc ~93MB, đã hạ về 512px).
  const totalBytes = files.reduce((sum, f) => sum + fs.statSync(new URL(f, heroArtDir)).size, 0);
  assert.ok(totalBytes < 3 * 1024 * 1024, `tổng dung lượng ảnh hero quá lớn: ${(totalBytes / 1024 / 1024).toFixed(2)}MB`);
});

test('ảnh toàn thân được neo mép trên khi bị cắt vào khung vuông', () => {
  assert.match(html, /img\[src\^="assets\/heroes\/"\]\s*\{\s*object-position: top center;/);
});

test('tab Anh Hùng (dữ liệu PDF) hiển thị ảnh thật thay cho emoji', () => {
  // Bí danh: hero "Mumy" trong dữ liệu PDF dùng chung ảnh với "Mymu".
  assert.match(html, /const HERO_ART_ALIASES = \{ mumy: 'mymu' \};/);
  assert.match(html, /function getHeroArtFile\(heroId\)/);
  assert.match(html, /function heroArtImgTag\(heroId/);

  // Bệ đá lớn + lưới 21 hero đều phải dùng heroArtImgTag, không còn render emoji trần.
  const showcase = html.slice(html.indexOf('function renderVnHeroesAndWardrobeUI'), html.indexOf('function renderVnCollectiblesTabUI'));
  assert.ok(showcase.length > 1000, 'không tìm thấy renderVnHeroesAndWardrobeUI');
  assert.match(showcase, /heroArtImgTag\(heroMeta\.id, heroMeta\.spriteEmoji/);
  assert.match(showcase, /heroArtImgTag\(h\.id, h\.spriteEmoji/);
  assert.equal(/\n\s*\$\{heroMeta\.spriteEmoji\}\s*\n/.test(showcase), false, 'vẫn còn chỗ render emoji trần cho hero đang chọn');
  assert.equal(/\n\s*\$\{h\.spriteEmoji\}\s*\n/.test(showcase), false, 'vẫn còn chỗ render emoji trần trong lưới hero');
});

test('chiến đấu và bệ đá lobby vẽ ảnh chân dung lên canvas, có fallback vector', () => {
  // Loader ảnh + helper vẽ dùng chung cho cả hai nơi.
  assert.match(html, /function getHeroArtImage\(heroId\)/);
  assert.match(html, /function isHeroArtReady\(img\)/);
  assert.match(html, /function drawHeroArtOnCanvas\(ctx, img, opts = \{\}\)/);

  const battle = html.slice(html.indexOf('function drawChibiHeroSprite(ctx, p, nowMs)'), html.indexOf('function drawHeroWeaponSprite(ctx, p, nowMs)'));
  assert.match(battle, /const battleArtImg = getHeroArtImage\(p\.hero\.id\);/);
  assert.match(battle, /if \(useArtSprite\) \{\s*\n\s*drawHeroArtOnCanvas\(ctx, battleArtImg, \{ feetY: 16, height: 48, flip: facingLeft \}\);/);
  assert.match(battle, /\} else \{/, 'phải còn nhánh vẽ vector khi ảnh chưa tải xong');
  // Vũ khí vector chỉ vẽ trong nhánh fallback (ảnh PNG đã có vũ khí).
  const weaponCall = battle.lastIndexOf('drawHeroWeaponSprite(ctx, p, nowMs);');
  assert.ok(weaponCall > battle.indexOf('} else {'), 'vũ khí vector phải nằm trong nhánh fallback');

  const stage = html.slice(html.indexOf('function renderHeroStageCanvas(nowMs)'), html.indexOf('function renderHeroRoster()'));
  assert.match(stage, /const stageArtImg = getHeroArtImage\(heroId\);/);
  assert.match(stage, /drawHeroArtOnCanvas\(sctx, stageArtImg, \{ feetY: 6, height: 116 \}\);/);
  // Thanh sao 0★-8★ vẫn phải render sau khối thân nhân vật.
  assert.ok(stage.indexOf('// Render Star Arc') > stage.indexOf('drawHeroArtOnCanvas(sctx, stageArtImg'));
});

