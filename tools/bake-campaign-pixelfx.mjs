// Xuất atlas từ checkout Pixelfx đã ghim; không thêm dependency/runtime pixel simulation.
// node --max-old-space-size=192 tools/bake-campaign-pixelfx.mjs <pixelfx-checkout>
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const upstream = path.resolve(process.argv[2] || '');
const revision = '044e12a45dc9cc312cec50ee606dfc98afe5adc2';
if (execFileSync('git', ['-C', upstream, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() !== revision) throw Error('Checkout Pixelfx không đúng revision đã duyệt');
const load = p => import(pathToFileURL(path.join(upstream, p)).href);
const { createFrame, clearFrame, createFx, composite } = await load('src/core/index.js');
const { encodePNG } = await load('tools/lib/png.mjs');
const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(project, 'public/assets/pixelfx');
fs.mkdirSync(out, { recursive: true });
fs.copyFileSync(path.join(upstream, 'LICENSE'), path.join(out, 'LICENSE.txt'));
const specs = [
  ['torch', 'fire/torch', 16, 1, 'both'],
  ['portal', 'arcane/portal', 15, 1, 'both'],
  // Khí quyển chạy sau lớp nền ở độ mờ thấp: 5–8 fps vẫn đọc được chuyển động và giảm mạnh số frame.
  ['leaves', 'weather/falling-leaves', 6, 2, 'front'],
  ['snow', 'weather/snow', 8, 2, 'front'],
  ['fog', 'weather/fog', 5, 2, 'both'],
  ['rays', 'weather/god-rays', 5, 2, 'light'],
  ['aurora', 'weather/aurora', 5, 2, 'both'],
];
const atlas = {}, contacts = [];
for (const [id, effect, fps, scale, layer] of specs) {
  const mod = await load(`src/fx/${effect}.js`), meta = mod.meta;
  const [sw, sh] = meta.size, width = sw / scale, height = sh / scale;
  const frames = Math.round(meta.duration * fps), columns = 8, rows = Math.ceil(frames / columns);
  const aw = width * columns, ah = height * rows, rgba = new Uint8ClampedArray(aw * ah * 4);
  const frame = createFrame(sw, sh), bytes = new Uint8ClampedArray(sw * sh * 4);
  const inst = createFx(mod, { x: meta.origin[0], y: meta.origin[1], light: .65 });
  const preview = new Uint8ClampedArray(width * 4 * height * 4);
  let visible = 0, transparent = 0;
  for (let n = 0; n < frames; n++) {
    if (n) inst.update(1 / fps);
    clearFrame(frame); inst.draw(frame, layer === 'front' ? 'front' : undefined);
    // Chỉ giữ tia sáng, bỏ lớp không khí tối của bản demo.
    if (layer === 'light') frame.color.fill(0);
    composite(frame, bytes);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      let a = 0, r = 0, g = 0, b = 0;
      for (let yy = 0; yy < scale; yy++) for (let xx = 0; xx < scale; xx++) {
        const s = ((y * scale + yy) * sw + x * scale + xx) * 4, alpha = bytes[s + 3];
        a += alpha; r += bytes[s] * alpha; g += bytes[s + 1] * alpha; b += bytes[s + 2] * alpha;
      }
      const edge = Math.min(1, x / 6, y / 6, (width - 1 - x) / 6, (height - 1 - y) / 6);
      const pixel = [a ? r / a : 0, a ? g / a : 0, a ? b / a : 0, a / (scale * scale) * edge];
      const d = ((Math.floor(n / columns) * height + y) * aw + n % columns * width + x) * 4;
      rgba.set(pixel, d);
      if (pixel[3] > 0) visible++; else transparent++;
      const sample = [0, Math.floor(frames / 4), Math.floor(frames / 2), Math.floor(frames * 3 / 4)].indexOf(n);
      if (sample >= 0) preview.set(pixel, (y * width * 4 + sample * width + x) * 4);
    }
  }
  if (!visible || !transparent) throw Error(`${id}: atlas phải có hình và pixel trong suốt`);
  const png = encodePNG(aw, ah, rgba);
  fs.writeFileSync(path.join(out, `${id}.png`), png);
  atlas[id] = { src: `/assets/pixelfx/${id}.png`, width, height, columns, frames, fps, effect, bytes: png.length };
  contacts.push({ id, width: width * 4, height, rgba: preview });
  console.log(JSON.stringify({ id, frames, bytes: png.length, visible, transparent }));
}
fs.writeFileSync(path.join(project, 'public/campaign-pixelfx-atlas.js'), '// Sinh bởi tools/bake-campaign-pixelfx.mjs; nguồn MIT được ghi trong docs/pixelfx.md.\nwindow.ArtemisPixelFXAtlas = Object.freeze(' + JSON.stringify(atlas, null, 2) + ');\n');
// Contact sheet nhỏ để xem trước các frame, ngoài asset production.
const cw = Math.max(...contacts.map(c => c.width)), ch = contacts.reduce((n, c) => n + c.height, 0), contact = new Uint8ClampedArray(cw * ch * 4);
let top = 0;
for (const c of contacts) {
  for (let y = 0; y < c.height; y++) contact.set(c.rgba.subarray(y * c.width * 4, (y + 1) * c.width * 4), ((top + y) * cw) * 4);
  top += c.height;
}
fs.writeFileSync(path.join(upstream, 'artemis-contact.png'), encodePNG(cw, ch, contact));
let css = '/* Sinh từ atlas Pixelfx; mỗi keyframe chọn đúng ô, không chạy vòng lặp JS. */\n';
for (const [id, m] of Object.entries(atlas)) {
  const rows = Math.ceil(m.frames / m.columns);
  css += `.world-map-effect.fx-${id}{--pixel-image:url("${m.src}");--pixel-animation:pixel-${id};--pixel-duration:${m.frames / m.fps}s;background-size:${m.columns * 100}% ${rows * 100}%}\n`;
  css += `@keyframes pixel-${id}{\n`;
  for (let n = 0; n < m.frames; n++) css += `${(n / m.frames * 100).toFixed(5)}%{background-position:${(n % m.columns / (m.columns - 1) * 100).toFixed(5)}% ${(Math.floor(n / m.columns) / (rows - 1) * 100).toFixed(5)}%}\n`;
  css += '100%{background-position:0% 0%}}\n';
}
fs.writeFileSync(path.join(project, 'public/campaign-pixelfx-atlas.css'), css);
