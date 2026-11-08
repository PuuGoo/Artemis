import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { RUNE_TIERS } from '../lib/runeCatalog.js';
const read = file => fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const ctx = vm.createContext({});
vm.runInContext(read('public/rune-art.js'), ctx);

// Tên file người dùng đặt: 10 Normal, 20 Fine, 30 Rare, 40 Epic (+41/+42), 50 Legendary (+51..53), 60 Mythic.
const suffixes = ['10', '20', '30', '40', '41', '42', '50', '51', '52', '53', '60'];
const family = { ability: 'skill', enhancement: 'grow', blessing: 'bless', etched: 'imprint' };

test('source-named crystal art covers every category at every quality it ships', () => {
  let mapped = 0;
  for (const [type, prefix] of Object.entries(family)) {
    RUNE_TIERS.forEach((tier, index) => {
      const file = `assets/runes/crystals/Rune_${prefix}_${suffixes[index]}.png`;
      const exists = fs.existsSync(new URL('../public/' + file, import.meta.url));
      const mappedFile = ctx.RuneArt.crystalSrc(type, tier);
      assert.ok(!exists || mappedFile === file, `${type}/${tier} có file nhưng chưa map`);
      if (type !== 'etched') assert.ok(!mappedFile || mappedFile === file, `${type}/${tier} map sai file`);
      if (mappedFile) {
        assert.ok(fs.existsSync(new URL('../public/' + mappedFile, import.meta.url)), `${mappedFile} thiếu trên đĩa`);
        const bytes = fs.readFileSync(new URL('../public/' + mappedFile, import.meta.url));
        assert.equal(bytes.readUInt32BE(0), 0x89504e47);
        mapped++;
      }
    });
  }
  // 11 bậc × 3 nhóm đủ ảnh + 9 bậc Khắc Ấn (Rare..Mythic).
  assert.equal(mapped, 42);
  assert.equal(fs.readdirSync(new URL('../public/assets/runes/crystals/', import.meta.url)).length, 37);
  assert.equal(ctx.RuneArt.crystalSrc('unknown', 'rare'), null);
  assert.equal(ctx.RuneArt.crystalSrc('ability', 'unknown'), null);
});

test('fallback palette uses the measured colours of the reference art', () => {
  const expect = { normal: '#5e6b8e', fine: '#198533', rare: '#2a5cb8', epic: '#a025a5', legendary: '#b7700a', mythic: '#af232f' };
  for (const tier of RUNE_TIERS) assert.equal(ctx.RuneArt.crystalPalette(tier).length, 3);
  for (const [tier, color] of Object.entries(expect)) assert.equal(ctx.RuneArt.crystalPalette(tier)[0], color, tier);
  assert.equal(ctx.RuneArt.crystalPalette('epic_2')[0], expect.epic);
  assert.equal(ctx.RuneArt.crystalPalette('legendary_3')[0], expect.legendary);
});

test('the rune screen no longer fakes quality with hue-rotate or saturate filters', () => {
  const css = read('public/rune-reference.css');
  assert.doesNotMatch(css, /hue-rotate\(/);
  assert.doesNotMatch(css, /saturate\(/);
});
