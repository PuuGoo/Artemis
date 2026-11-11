import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(resolve(root, 'public/index.html'), 'utf8');
const renderer = readFileSync(resolve(root, 'public/js/game/rendering/arena-renderer.js'), 'utf8');
const signs = ['leo', 'aries', 'taurus', 'gemini', 'cancer', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];
const legacyMapIds = [12, 8, 9, 10, 11, 13, 14, 15, 16, 17, 18, 19];
const chapters = html.slice(html.indexOf('const CHAPTERS = ['), html.indexOf('\n      ];', html.indexOf('const CHAPTERS = [')));

for (const [index, sign] of signs.entries()) {
  const number = index + 1;
  const legacyMapId = legacyMapIds[index];
  test(`Chương ${number} (${sign}) có map, đấu trường và boss`, () => {
    const chapter = chapters.match(new RegExp(`\\n\\s+id: ${number},([\\s\\S]*?)(?=\\n\\s+id: ${number + 1},|$)`))?.[1];
    assert.ok(chapter, 'thiếu metadata chương');
    assert.match(chapter, number===1 ? /unlock: null/ : new RegExp(`chapterId: ${number - 1}\\b`));
    assert.match(chapter, /rooms: 15,/);
    assert.match(chapter, new RegExp(`map-ch${legacyMapId}-zodiac-${sign}\\.svg`));
    const file = resolve(root, `public/assets/map-ch${legacyMapId}-zodiac-${sign}.svg`);
    assert.ok(existsSync(file), 'thiếu ảnh bản đồ');
    const svg = readFileSync(file, 'utf8');
    assert.match(svg, /viewBox="0 0 1200 600"/);
    assert.match(svg, /@keyframes orbit/);
    assert.match(svg, /prefers-reduced-motion/);
    assert.ok((svg.match(/<circle/g) || []).length >= 20, 'thiếu sao và chòm sao');
    assert.match(renderer, new RegExp(`def\\('zodiac_${sign}'`));
    assert.match(renderer, new RegExp(`${number}: \\['zodiac_${sign}'\\]`));
    assert.match(renderer, new RegExp(`zodiac_${sign}: drawZodiacBoss`));
    assert.match(html, new RegExp(`${number}: \\{ mobHp: [0-9]+, mobAtk: [0-9]+, bossHp: [0-9]+, bossAtk: [0-9]+ \\}`));
  });
}

test('Có thể xem chương khóa nhưng không thể vào trận', () => {
  const map = html.slice(html.indexOf('function renderMapSelect()'), html.indexOf('function openBestiaryModal()'));
  assert.ok(/previewChapterIdx = idx;\s*renderMapSelect\(\);[\s\S]{0,160}?return;/.test(map));
  const launch = html.slice(html.indexOf('function syncBattleLaunch()'), html.indexOf('function renderMapSelect()'));
  assert.ok(/start\.disabled = locked/.test(launch));
  assert.ok(/if \(mode\.hasChapters && isChapterLocked\(ch\)\)/.test(html));
});
