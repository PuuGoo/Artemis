import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(resolve(root, 'public/index.html'), 'utf8');
const signs = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];
const chapters = html.slice(html.indexOf('const CHAPTERS = ['), html.indexOf('\n      ];', html.indexOf('const CHAPTERS = [')));

for (const [index, sign] of signs.entries()) {
  const number = index + 8;
  test(`Chương ${number} (${sign}) có map, đấu trường và boss`, () => {
    const chapter = chapters.match(new RegExp(`\\n\\s+id: ${number},([\\s\\S]*?)(?=\\n\\s+id: ${number + 1},|$)`))?.[1];
    assert.ok(chapter, 'thiếu metadata chương');
    assert.match(chapter, new RegExp(`chapterId: ${number - 1}\\b`));
    assert.match(chapter, /rooms: 15,/);
    assert.match(chapter, new RegExp(`map-ch${number}-zodiac-${sign}\\.svg`));
    const file = resolve(root, `public/assets/map-ch${number}-zodiac-${sign}.svg`);
    assert.ok(existsSync(file), 'thiếu ảnh bản đồ');
    const svg = readFileSync(file, 'utf8');
    assert.match(svg, /viewBox="0 0 1200 600"/);
    assert.match(svg, /@keyframes orbit/);
    assert.match(svg, /prefers-reduced-motion/);
    assert.ok((svg.match(/<circle/g) || []).length >= 20, 'thiếu sao và chòm sao');
    assert.match(html, new RegExp(`def\\('zodiac_${sign}'`));
    assert.match(html, new RegExp(`${number}: \\['zodiac_${sign}'\\]`));
    assert.match(html, new RegExp(`zodiac_${sign}: drawZodiacBoss`));
    assert.match(html, new RegExp(`${number}: \\{ mobHp: [0-9]+, mobAtk: [0-9]+, bossHp: [0-9]+, bossAtk: [0-9]+ \\}`));
  });
}

test('Có thể xem chương khóa nhưng không thể vào trận', () => {
  assert.match(html, /previewChapterIdx = idx;\s*renderMapSelect\(\);\s*return;/);
  assert.match(html, /\$\{locked \? 'disabled' : ''\}/);
  assert.match(html, /if \(mode\.hasChapters && isChapterLocked\(ch\)\)/);
});
