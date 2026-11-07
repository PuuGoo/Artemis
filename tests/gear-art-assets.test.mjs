// Trang bị dùng ảnh PNG thật (public/assets/gear) thay cho SVG vẽ tay.
//
// Khoá các hành vi:
//   1. Mọi template trang bị (trừ bộ Khởi Đầu) đều có ảnh PNG riêng.
//   2. File ảnh được khai báo trong GEAR_ART_FILES phải tồn tại thật trên đĩa.
//   3. Không hai trang bị nào dùng chung một file ảnh (36 trang bị ↔ 36 ảnh).
//   4. Ảnh là PNG RGBA (nền trong suốt) và đủ lớn để không bị vỡ khi phóng to.
//   5. getGearItemSvgArt() trả về <img> trỏ assets/gear cho mọi trang bị có ảnh.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const projectRoot = new URL('../', import.meta.url);
const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const gearArtDir = new URL('../public/assets/gear/', import.meta.url);

// GEAR_ART_FILES = { templateId: 'file-slug', ... }
const artBlockStart = html.indexOf('const GEAR_ART_FILES = {');
const artBlockEnd = html.indexOf('};', artBlockStart);
assert.ok(artBlockStart > -1, 'thiếu khai báo GEAR_ART_FILES');
const artBlock = html.slice(artBlockStart, artBlockEnd);
const noComments = (s) => s.replace(/^\s*\/\/.*$/gm, '');
const artEntries = [...noComments(artBlock).matchAll(/([a-z0-9_]+):\s*'([a-z0-9-]+)'/g)]
  .map((m) => ({ templateId: m[1], file: m[2] }));

// Bảng template trang bị: id + slot + wikiSet (bỏ qua GEAR_SLOTS_META vì khác định dạng).
const templateEntries = [...html.matchAll(/\n\s+id: '([a-z0-9_]+)', slot: '(weapon|necklace|ring|armor|helmet|boots)'[^\n]*wikiSet: '([^']+)'/g)]
  .map((m) => ({ id: m[1], slot: m[2], wikiSet: m[3] }));
const starterIds = new Set(templateEntries.filter((t) => t.wikiSet === 'Starter Gear').map((t) => t.id));

test('36 ảnh trang bị: mỗi trang bị không thuộc bộ Khởi Đầu đều có ảnh riêng', () => {
  assert.equal(templateEntries.length, 42, 'phải có 42 template trang bị (7 bộ × 6)');
  assert.equal(starterIds.size, 6, 'phải nhận diện được 6 trang bị Khởi Đầu');
  assert.equal(artEntries.length, 36, `phải khai báo 36 ảnh, đang có ${artEntries.length}`);

  const mapped = new Set(artEntries.map((e) => e.templateId));
  for (const tpl of templateEntries) {
    if (starterIds.has(tpl.id)) {
      assert.equal(mapped.has(tpl.id), false, `${tpl.id} là bộ Khởi Đầu, phải giữ SVG`);
    } else {
      assert.equal(mapped.has(tpl.id), true, `${tpl.id} chưa được gán ảnh PNG`);
    }
  }

  const knownIds = new Set(templateEntries.map((t) => t.id));
  for (const entry of artEntries) {
    assert.equal(knownIds.has(entry.templateId), true, `${entry.templateId} không phải template trang bị có thật`);
  }
});

test('mỗi file ảnh tồn tại trên đĩa, là PNG RGBA và không bị trùng', () => {
  const used = new Map();
  for (const entry of artEntries) {
    if (used.has(entry.file)) {
      assert.fail(`ảnh ${entry.file}.png dùng cho cả ${used.get(entry.file)} và ${entry.templateId}`);
    }
    used.set(entry.file, entry.templateId);

    const path = new URL(`${entry.file}.png`, gearArtDir);
    assert.equal(fs.existsSync(path), true, `thiếu file public/assets/gear/${entry.file}.png`);
    const buf = fs.readFileSync(path);
    assert.match(buf.subarray(0, 8).toString('hex'), /^89504e470d0a1a0a$/, `${entry.file}.png không phải PNG hợp lệ`);
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    const colorType = buf[25];
    assert.equal(colorType, 6, `${entry.file}.png phải là RGBA (nền trong suốt), colorType=${colorType}`);
    assert.ok(width >= 128 && height >= 128, `${entry.file}.png quá nhỏ (${width}×${height})`);
  }
  assert.equal(used.size, 36, `phải dùng đủ 36 ảnh riêng biệt, đang có ${used.size}`);

  const onDisk = fs.readdirSync(gearArtDir).filter((f) => f.endsWith('.png'));
  assert.equal(onDisk.length, 36, `thư mục assets/gear phải có đúng 36 ảnh, đang có ${onDisk.length}`);
});

test('getGearItemSvgArt trả về ảnh PNG cho trang bị có ảnh, SVG chỉ còn cho bộ Khởi Đầu', () => {
  const fnStart = html.indexOf('function getGearItemSvgArt(templateId) {');
  assert.ok(fnStart > -1, 'thiếu getGearItemSvgArt');
  const fnBody = html.slice(fnStart, html.indexOf('function getWeaponSvgArt(', fnStart));
  assert.match(fnBody, /const artFile = GEAR_ART_FILES\[templateId\];/);
  assert.match(fnBody, /<img src="assets\/gear\/\$\{artFile\}\.png"/);
  // Ảnh phải phủ kín ô (object-contain) và không chặn click vào thẻ trang bị.
  assert.match(fnBody, /object-contain/);
  assert.match(fnBody, /pointer-events-none/);

  // Mọi nơi hiển thị trang bị đều đi qua getGearItemSvgArt (thẻ túi, ô đang mặc, popup chi tiết, lò rèn).
  for (const marker of ['gear-item-card-btn', 'gearModalSvgBox', 'data-gear-uid']) {
    assert.ok(html.includes(marker), `thiếu điểm hiển thị ${marker}`);
  }
  const callSites = [...html.matchAll(/getGearItemSvgArt\(/g)].length;
  assert.ok(callSites >= 4, `phải có >=4 nơi dùng getGearItemSvgArt, đang có ${callSites}`);
  assert.equal(fs.existsSync(new URL('public/assets/gear/agile-knuckles.png', projectRoot)), true);
});
