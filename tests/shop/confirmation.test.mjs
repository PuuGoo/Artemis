import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../../public/js/game/shop/vip-shop.js', import.meta.url), 'utf8');
function harness({ accepted = true, failed = false, pending = null, history = [] } = {}) {
  const context = vm.createContext({ console });
  vm.runInContext(source, context);
  const posts = [], dialogs = [];
  const offer = { id: 'gold_6420', name: 'Một Nắm Vàng', price: 20, currency: 'gems', remaining: null, rewards: { gold: 6420 } };
  const shop = context.ArtemisVipShop.create({
    cloud: { getState: () => ({ player: { id: 'A' } }), getPendingShopOffer: () => pending,
      async purchaseShopOffer(...args) { posts.push(args); return { ok: true }; } },
    fetcher: async () => {
      if (failed) throw new Error('offline');
      return { ok: true, json: async () => ({ ok: true, playerId: 'A', offers: [offer], balances: { gems: 100 }, history }) };
    },
    confirmPurchase: message => { dialogs.push(message); return accepted; },
  });
  return { shop, posts, dialogs };
}

test('xác nhận lấy giá, thưởng và số dư máy chủ; hủy không gửi giao dịch', async () => {
  for (const accepted of [true, false]) {
    const h = harness({ accepted });
    await h.shop.load();
    const result = await h.shop.purchase('gold_6420');
    assert.equal(h.dialogs.length, 1);
    assert.match(h.dialogs[0], /Giá: 20 Kim Cương/);
    assert.match(h.dialogs[0], /6\.420/);
    assert.match(h.dialogs[0], /Số dư sau mua: 80 Kim Cương/);
    assert.equal(h.posts.length, accepted ? 1 : 0);
    if (accepted) assert.deepEqual(h.posts[0], ['gold_6420', 100]);
    else assert.equal(result.cancelled, true);
  }
});

test('mất catalog không xác nhận/mua; retry giao dịch chưa rõ không hỏi thanh toán lần nữa', async () => {
  const h = harness({ failed: true });
  await h.shop.load();
  await assert.rejects(h.shop.purchase('gold_6420'));
  assert.equal(h.posts.length, 0);
  const retry = harness({ pending: 'gold_6420' });
  await retry.shop.load();
  await retry.shop.purchase('gold_6420');
  assert.equal(retry.dialogs.length, 0);
  assert.equal(retry.posts.length, 1);
});

test('lịch sử hiển thị receipt máy chủ, múi giờ Việt Nam và escape nội dung', async () => {
  const h = harness({ history: [{ offerId: 'gold_6420', name: '<img src=x onerror=alert(1)>', requestId: '<script>',
    price: 20, currency: 'gems', rewards: { gold: 6420 }, balanceAfter: 80, at: '2026-11-08T17:00:00Z' }] });
  await h.shop.load();
  const markup = h.shop.historyMarkup();
  assert.ok(markup.includes('&lt;img'));
  assert.ok(markup.includes('&lt;script&gt;'));
  assert.ok(!markup.includes('<img'));
  assert.match(markup, /80 Kim Cương/);
  assert.match(markup, /6\.420/);
  assert.match(markup, /giờ Việt Nam/);
});
