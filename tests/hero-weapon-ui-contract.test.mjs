import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');

test('UI không còn lựa chọn vũ khí chính và vẫn giữ tương thích selectedWeaponId', () => {
  assert.doesNotMatch(html, /weaponCardsGrid|select-weapon-btn|Chọn Vũ Khí Chủ Đạo/);
  assert.match(html, /selectedWeaponId:/);
  assert.match(html, /WEAPONS\.find\(w => w\.id === SaveState\.selectedWeaponId\)/);
});

test('Bảng nâng sao và cộng hưởng chỉ mở sau click, có aria trạng thái và đóng bằng Escape', () => {
  assert.doesNotMatch(html, /btnToggleStageStarSkin|stageStarSkinDrawer|btnBattleOpenStarSkin/);
  assert.equal((html.match(/data-hero-upgrade-disclosure=/g) || []).length, 1);
  assert.match(html, /id="btnToggleCharStarResonance"[^>]*aria-expanded=/);
  assert.match(html, /id="charHeroStatsStarSkinPanel"[^>]*class="hidden/);
  assert.match(html, /btnToggleCharStarResonance[\s\S]{0,1800}keydown/);
  assert.match(html, /Escape/);
});

test('Nút mở bảng hero có copy tiếng Việt rõ ràng và target disclosure', () => {
  assert.match(html, />Nâng sao<\/button>/);
  assert.match(html, /aria-controls="charHeroStatsStarSkinPanel"/);
  assert.match(html, /data-hero-upgrade-disclosure/);
});

test('Chỉ roster chính chọn anh hùng; không còn picker phụ hoặc chọn linh thú', () => {
  assert.doesNotMatch(html, /heroSelectList|hero-card-btn|charSubtabHeroGrid|char-subtab-hero-btn|stageQuickHeroBar|stage-quick-hero-btn|btnStagePrevHero|btnStageNextHero|petCardsGrid|select-pet-btn|data-pet-id|renderVnHeroesAndWardrobeUI|data-vn-hero-starup/);
  assert.match(html, /id="heroRosterGrid"/);
  assert.match(html, /grid.querySelectorAll\('\[data-hero-pick\]'\)/);
  assert.match(html, /selectedPetId: this.selectedPetId/);
  assert.match(html, /resonanceSlots: this.resonanceSlots/);
});

test('Không có export/handler chọn vũ khí chính còn sót trên production surface', () => {
  assert.doesNotMatch(html, /data-weapon-id|\.select-weapon-btn|Chọn Vũ Khí Chủ Đạo/);
});
