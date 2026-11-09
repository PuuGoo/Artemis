import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { SHOP_OFFERS } from '../../lib/shop/catalog.js';
import { SHOP_S_TIER_TEMPLATES } from '../../lib/shop/rewards.js';

const html = fs.readFileSync(new URL('../../public/index.html', import.meta.url), 'utf8');
const start = html.indexOf('      function renderVnShopTabUI()');
const end = html.indexOf('      // 3. RENDER TAB 3:', start);
assert.ok(start >= 0 && end > start);
const renderer = html.slice(start, end);
const viewSource = fs.readFileSync(new URL('../../public/js/game/shop/vip-shop.js', import.meta.url), 'utf8');

function harness({ rejectPurchase = false } = {}) {
  let buttons = [], markup = '', requestCount = 0;
  let hidden = false;
  let scrollBody = { scrollTop: 0, scrollLeft: 0 };
  const panel = { classList: { contains: name => name === 'hidden' && hidden } };
  const purchases = [], notices = [];
  const container = {
    set innerHTML(value) {
      markup = value;
      scrollBody = { scrollTop: 0, scrollLeft: 0 };
      buttons = [...value.matchAll(/<button\b([^>]*)>/g)].map(([, raw]) => {
        const attributes = Object.fromEntries([...raw.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]));
        return { disabled: /(?:^|\s)disabled(?:\s|$)/.test(raw), getAttribute: key => attributes[key], attributes };
      });
    },
    querySelectorAll(selector) { const key = selector.slice(1, -1); return buttons.filter(b => Object.hasOwn(b.attributes, key)); },
    querySelector(selector) { return selector === '.sv2-body' ? scrollBody : null; },
  };
  const state = { gold: 500, gems: 50, vipCoins: 1000, aurocite: 0, chestKeys: {}, gearScrolls: {},
    vnUiState: { dealsPeriod: 'daily', topupTab: 'gems' }, save() {} };
  const cloud = { getState: () => ({ player: { id: 'A' } }), getPendingShopOffer: () => null,
    async purchaseShopOffer(offerId) {
      purchases.push(offerId);
      if (rejectPurchase) throw new Error('Không đủ xu VIP');
      return { ok: true, offerId, priceVip: SHOP_OFFERS.find(o => o.id === offerId).priceVip };
    } };
  const context = vm.createContext({ console, SaveState: state,
    window: { ArtemisCloud: cloud },
    document: { querySelector: () => null, getElementById: id => id === 'vnShopMainContainer' ? container : id === 'tabShopVn' ? panel : null },
    fetchCatalog: async () => { requestCount++; return { ok: true, json: async () => ({ ok: true, playerId: 'A', balances: { vipCoins: 100000, gems: 100000, gold: 100000 }, offers: SHOP_OFFERS.map(o => ({ ...o, remaining: o.limit })) }) }; },
    ensureVnAuthenticUIState() {}, formatCompactNumberVn: value => String(value),
    SoundFX: { levelUp() {}, coinPickup() {} }, showToast: message => notices.push(message),
    renderLobbyUI() { context.renderVnShopTabUI(); },
  });
  vm.runInContext(viewSource + '\nconst VipShop = ArtemisVipShop.create({cloud: window.ArtemisCloud, fetcher: fetchCatalog, confirmPurchase: () => true, onChange: () => renderVnShopTabUI()});\n' + renderer, context);
  return { context, state, purchases, notices,
    setHidden: value => { hidden = value; },
    markup: () => markup, requests: () => requestCount,
    buttons: key => container.querySelectorAll(`[${key}]`),
    render: () => context.renderVnShopTabUI(),
    load: () => vm.runInContext('VipShop.load()', context),
    scroll: () => scrollBody,
  };
}

test('hidden shop performs no network or rendering work until the tab opens', async () => {
  const h = harness();
  h.setHidden(true);
  h.render();
  assert.equal(h.requests(), 0);
  assert.equal(h.markup(), '');
  h.setHidden(false);
  h.render();
  await h.load();
  assert.equal(h.requests(), 1);
  assert.ok(h.markup().includes('xu VIP'));
});

test('actual shop renderer exposes every server offer across daily, deal and resource tabs', async () => {
  const h = harness();
  h.render();
  assert.ok(h.buttons('data-vip-offer').every(button => button.disabled));
  await h.load();
  assert.equal(h.requests(), 1, 'initial catalog load is single-flight');
  const seen = new Set();
  for (const period of ['daily', 'weekly', 'monthly']) {
    h.buttons('data-vn-deal-period').find(b => b.getAttribute('data-vn-deal-period') === period).onclick();
    for (const tab of ['gems', 'aurocite', 'gold']) {
      h.buttons('data-vn-topup-tab').find(b => b.getAttribute('data-vn-topup-tab') === tab).onclick();
      for (const button of h.buttons('data-vip-offer')) {
        const id = button.getAttribute('data-vip-offer');
        assert.ok(SHOP_OFFERS.some(offer => offer.id === id), id);
        assert.equal(typeof button.onclick, 'function', id);
        assert.equal(button.disabled, false, id);
        seen.add(id);
      }
      assert.equal(/₫|undefined|NaN/.test(h.markup()), false, `${period}/${tab}`);
    }
  }
  assert.deepEqual([...seen].sort(), SHOP_OFFERS.map(offer => offer.id).sort());
  assert.equal(h.requests(), 1, 'rendering does not repeatedly fetch catalog');
});

test('actual paid click handler delegates its offer ID and never grants local rewards', async () => {
  for (const rejected of [false, true]) {
    const h = harness({ rejectPurchase: rejected });
    await h.load();
    const before = { gems: h.state.gems, vipCoins: h.state.vipCoins };
    await h.buttons('data-vip-offer').find(b => b.getAttribute('data-vip-offer') === 'gems_80').onclick();
    assert.deepEqual(h.purchases, ['gems_80']);
    assert.deepEqual({ gems: h.state.gems, vipCoins: h.state.vipCoins }, before, 'only the cloud response rebuild may change paid resources');
    assert.ok(h.notices.some(message => message.includes(rejected ? 'Không đủ xu VIP' : 'Mua thành công')));
  }
});

test('shop keeps purchase position during catalog refresh, confirmation and payment result', async () => {
  const h = harness();
  await h.load();
  h.scroll().scrollTop = 1800;
  h.render();
  assert.equal(h.scroll().scrollTop, 1800, 'lobby render must retain the shop scroll offset');
  await h.load();
  assert.equal(h.scroll().scrollTop, 1800, 'catalog refresh must retain the selected purchase position');
  await h.buttons('data-vip-offer').find(b => b.getAttribute('data-vip-offer') === 'gems_80').onclick();
  assert.equal(h.scroll().scrollTop, 1800, 'confirmation/payment rerenders must not jump to the top');
});

test('chapter reward templates exist in the current game S-Tier sets', () => {
  assert.equal(SHOP_S_TIER_TEMPLATES.length, 18);
  const start = html.indexOf('const GEAR_SET_META = {');
  const end = html.indexOf('        echo:', start);
  assert.ok(start >= 0 && end > start);
  const sets = html.slice(start, end);
  for (const id of SHOP_S_TIER_TEMPLATES) assert.ok(sets.includes(`'${id}'`), id);
});
