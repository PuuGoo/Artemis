import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { SHOP_OFFERS } from '../../lib/shop/catalog.js';

const moduleUrl = new URL('../../public/js/game/shop/vip-shop.js', import.meta.url);
function harness({ fetcher, purchase, confirmPurchase = () => true } = {}) {
  assert.ok(fs.existsSync(moduleUrl), 'Cần module giao diện shop VIP riêng');
  const context = vm.createContext({ console });
  vm.runInContext(fs.readFileSync(moduleUrl, 'utf8'), context);
  const posts = [];
  let updates = 0;
  const shop = context.ArtemisVipShop.create({
    confirmPurchase,
    cloud: { getState: () => ({ player: { id: 'A' } }), getPendingShopOffer: () => null,
      async purchaseShopOffer(id) { posts.push(id); return purchase ? purchase(id) : { ok: true, offerId: id }; } },
    fetcher: fetcher || (async () => ({ ok: true, json: async () => ({ ok: true, playerId: 'A', balances: { vipCoins: 100000, gems: 100000, gold: 100000 }, offers: SHOP_OFFERS.map(o => ({ ...o, remaining: o.limit })) }) })),
    onChange: () => { updates++; },
  });
  return { shop, posts, updates: () => updates };
}

test('VIP shop view takes every price and actual reward from the server catalog', async () => {
  const { shop } = harness();
  assert.match(shop.priceLabel('gems_80'), /Đang tải/);
  assert.match(shop.buttonAttributes('gems_80'), /disabled/);
  await shop.load();
  assert.equal(shop.offers().length, SHOP_OFFERS.length);
  assert.match(shop.priceLabel('gems_80'), /24 xu VIP/);
  assert.match(shop.priceLabel('chapter_91'), /2\.500 xu VIP/);
  assert.doesNotMatch(shop.buttonAttributes('gems_80'), /disabled/);
  assert.match(shop.buttonAttributes('gems_80'), /data-vip-offer="gems_80"/);
  assert.equal(shop.rewardItems('dl_1')[0][1], '500');
  assert.equal(shop.rewardItems('dl_1')[1][1], '10');
  assert.match(shop.rewardItems('dl_1')[2][1], /20.*mỗi loại/);
  assert.match(shop.remainingLabel('mo_4'), /2 lần/);
});

test('missing, sold out and failed catalog prices never become purchasable', async () => {
  const failed = harness({ fetcher: async () => { throw new Error('offline'); } });
  assert.equal(await failed.shop.load(), false);
  assert.match(failed.shop.buttonAttributes('gems_80'), /disabled/);
  assert.match(failed.shop.error(), /Không tải được/);
  const sold = harness({ fetcher: async () => ({ ok: true, json: async () => ({ ok: true, playerId: 'A', offers: [{ ...SHOP_OFFERS[0], remaining: 0 }] }) }) });
  await sold.shop.load();
  assert.match(sold.shop.buttonAttributes('chapter_91'), /disabled/);
  assert.match(sold.shop.remainingLabel('chapter_91'), /Hết lượt/);
  await assert.rejects(sold.shop.purchase('chapter_91'));
  const foreign = harness({ fetcher: async () => ({ ok: true, json: async () => ({ ok: true, playerId: 'B', offers: SHOP_OFFERS }) }) });
  assert.equal(await foreign.shop.load(), false);
  assert.equal(foreign.shop.offers().length, 0);
});

test('purchase buttons are single-flight, delegate payment and refresh remaining limits', async () => {
  let resolve;
  const pending = new Promise(r => { resolve = r; });
  const { shop, posts } = harness({ purchase: () => pending });
  await shop.load();
  const first = shop.purchase('gems_80');
  assert.match(shop.buttonAttributes('gems_500'), /disabled/);
  await assert.rejects(shop.purchase('gems_500'));
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(posts, ['gems_80']);
  resolve({ ok: true, offerId: 'gems_80' });
  await first;
  assert.doesNotMatch(shop.buttonAttributes('gems_500'), /disabled/);
});

test('shop integration removes real-money labels and direct paid reward handlers', () => {
  const html = fs.readFileSync(new URL('../../public/index.html', import.meta.url), 'utf8');
  assert.equal(/₫|\bVNĐ\b/.test(html), false, 'Còn giá tiền đ trong giao diện');
  assert.ok(html.includes('src="/js/game/shop/vip-shop.js"'));
  assert.ok(html.includes("VipShop.purchase(offerId)"));
  for (const old of ['data-vn-shop-buy-pack', 'data-vn-deal-buy', 'data-vn-topup-gems', 'data-vn-topup-aurocite']) {
    assert.equal(html.includes(old), false, `Còn handler cấp thưởng client: ${old}`);
  }
  assert.ok(html.includes('aurocite: this.aurocite'));
  assert.equal(html.includes('st.aurocite || 51'), false);
});
