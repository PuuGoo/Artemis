import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const html = fs.readFileSync(new URL('public/index.html', root), 'utf8');
const code = fs.readFileSync(new URL('public/zodiac-chibi-bosses.js', root), 'utf8');
const signs = ['aries','taurus','gemini','cancer','leo','virgo','libra','scorpio','sagittarius','capricorn','aquarius','pisces'];

test('12 hình SVG chibi tồn tại, riêng biệt và không nhúng ảnh bên ngoài', () => {
  const artworks = [];
  signs.forEach((sign, index) => {
    const chap = index + 8;
    const asset = 'public/assets/boss-ch' + chap + '-' + sign + '.svg';
    const source = fs.readFileSync(new URL(asset, root), 'utf8');
    assert.match(source, /<svg\b[^>]*viewBox="0 0 256 256"/);
    assert.match(source, /<title>[^<]+<\/title>/);
    assert.match(source, /<path\b/);
    assert.doesNotMatch(source, /https?:\/\/|<script\b|<foreignObject\b/i);
    assert.match(code, new RegExp('boss-ch' + chap + '-' + sign + '\\.svg'));
    artworks.push(source);
  });
  assert.equal(new Set(artworks).size, 12);
});

test('renderer canvas có ảnh, có fallback và không đụng logic damage', () => {
  class FakeImage {
    constructor() { this.naturalWidth = 512; }
    set src(value) { this.url = value; if (this.onload) this.onload(); }
  }
  const globals = { window: {}, Image: FakeImage };
  vm.runInNewContext(code, globals);
  const art = globals.window.ArtemisZodiacBosses;
  assert.ok(art);
  assert.equal(Object.keys(art.sources).length, 12);
  const used = [];
  const ctx = {
    save() {}, restore() {}, translate() {}, rotate() {}, scale() {},
    drawImage(img) { used.push(img.url); },
    beginPath() {}, ellipse() {}, stroke() {}
  };
  for (const sign of signs) {
    assert.equal(art.draw(ctx, 'zodiac_' + sign, 35, 1000, .2, true), true);
  }
  assert.equal(used.length, 12);
  assert.equal(art.draw(ctx, 'zodiac_unknown', 35, 1000, 1, false), false);
  assert.equal(art.draw(ctx, 'zodiac_aries', 0, 1000, 1, false), false);
  assert.match(html, /<script src="\/zodiac-chibi-bosses\.js"><\/script>/);
  const delegator = html.slice(html.indexOf('function drawZodiacBoss('), html.indexOf('const BOSSFN'));
  assert.match(delegator, /ArtemisZodiacBosses/);
  assert.match(delegator, /\.draw\(ctx, curBiome\?\.boss, r, t, hr, charge\)/);
  assert.match(html, /zodiac_pisces:\s*drawZodiacBoss/);
});

test('lỗi tải SVG phải trả quyền vẽ về renderer Canvas cũ', () => {
  class BrokenImage { constructor() { this.naturalWidth = 0; } set src(_) { this.onerror(); } }
  const globals = { window: {}, Image: BrokenImage };
  vm.runInNewContext(code, globals);
  const art = globals.window.ArtemisZodiacBosses;
  assert.equal(art.draw({}, 'zodiac_aries', 35, 1000, 1, false), false);
});