import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { SHOP_OFFERS } from '../../lib/shop/catalog.js';
const html = fs.readFileSync(new URL('../../public/index.html', import.meta.url), 'utf8');
function runWish(value, state) {
  const start = html.indexOf("        el.querySelectorAll('[data-vn-wish-pull]')");
  const end = html.indexOf('        el.querySelectorAll(', start + 1);
  assert.ok(start > 0 && end > start);
  const button = { getAttribute: () => value };
  let pulls = 0, saves = 0;
  state.save = () => saves++;
  vm.runInNewContext(html.slice(start, end), {
    SaveState: state, el: { querySelectorAll: () => [button] }, showToast() {},
    SoundFX: { levelUp() {} }, renderLobbyUI() {},
    executeWikiOtherItemAction() { state.wishTokens--; pulls++; },
  });
  button.onclick();
  return { pulls, saves };
}
test('wish buttons retain main fix: charge 400 gems per pull and preserve tokens', () => {
  for (const count of [1, 10, 100]) {
    const state = { gems: 50000, wishTokens: 7 };
    const result = runWish(String(count), state);
    assert.equal(result.pulls, count);
    assert.equal(state.gems, 50000 - count * 400);
    assert.equal(state.wishTokens, 7);
    assert.equal(result.saves, 1);
  }
  const poor = { gems: 399, wishTokens: 7 };
  assert.equal(runWish('1', poor).pulls, 0);
  assert.equal(poor.wishTokens, 7);
});
test('daily/exchange client grants replaced by canonical checkout; main rewards preserved', () => {
  assert.equal(html.includes("el.querySelectorAll('[data-vn-topup-gold]')"), false);
  assert.equal(html.includes("el.querySelectorAll('[data-vn-daily-buy]')"), false);
  assert.ok(html.includes('VipShop.purchase(offerId)'));
  const offer = id => SHOP_OFFERS.find(row => row.id === id);
  assert.deepEqual(offer('ds_2').rewards.gear, { templateId: 'echo_boots', quality: 'common' });
  assert.deepEqual(offer('ds_3').rewards, { wishTokens: 1 });
  assert.deepEqual(offer('ds_4').rewards, { seeds: { sprout: 5 } });
  // Debit, insufficiency and exact grants are exercised through the real API in economy.test.mjs.
});
