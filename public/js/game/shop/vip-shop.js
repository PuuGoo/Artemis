// Classic-script view adapter. Giá/phần thưởng/giới hạn chỉ đọc từ /api/shop.
(function (root) {
  'use strict';
  function create(options) {
    const cloud = options.cloud;
    const fetcher = options.fetcher || ((url, init) => root.fetch(url, init));
    const onChange = options.onChange || (() => {});
    let offers = [], loading = null, attempted = false, error = '', busy = false;
    const get = id => offers.find(offer => offer.id === id);
    const pending = () => cloud.getPendingShopOffer ? cloud.getPendingShopOffer() : null;
    function canBuy(id) {
      const offer = get(id), pendingId = pending();
      return !busy && !!offer && (!pendingId || pendingId === id) && (offer.remaining !== 0 || pendingId === id);
    }
    function load() {
      if (loading) return loading;
      attempted = true;
      loading = (async () => {
        try {
          const response = await fetcher('/api/shop', { credentials: 'same-origin', cache: 'no-store' });
          const body = await response.json();
          if (!response.ok || body.ok !== true || body.playerId !== cloud.getState().player?.id || !Array.isArray(body.offers)) throw new Error('catalog');
          if (body.offers.some(o => !o || !/^[a-z0-9_]+$/.test(o.id) || !Number.isSafeInteger(o.priceVip) || o.priceVip <= 0
              || (o.remaining !== null && (!Number.isSafeInteger(o.remaining) || o.remaining < 0)) || !o.rewards)) throw new Error('catalog');
          offers = body.offers;
          error = '';
          return true;
        } catch {
          offers = [];
          error = 'Không tải được giá cửa hàng VIP. Hãy bấm Thử lại.';
          return false;
        } finally {
          loading = null;
          onChange();
        }
      })();
      return loading;
    }
    return Object.freeze({
      load,
      ensureLoaded() { if (!attempted) void load(); },
      offers: () => offers.slice(),
      error: () => error,
      priceLabel(id) {
        if (pending() === id) return 'Kiểm tra giao dịch';
        const offer = get(id);
        return offer ? `💠 ${offer.priceVip.toLocaleString('vi-VN')} xu VIP` : (error ? 'Chưa tải được giá' : 'Đang tải giá…');
      },
      buttonAttributes(id) { return `data-vip-offer="${get(id)?.id || ''}"${canBuy(id) ? '' : ' disabled'}${busy ? ' aria-busy="true"' : ''}`; },
      remainingLabel(id) {
        const offer = get(id);
        if (!offer) return '';
        return offer.remaining === null ? 'Không giới hạn lượt mua' : offer.remaining === 0 ? 'Hết lượt mua trong chu kỳ' : `Còn có thể mua ${offer.remaining} lần`;
      },
      rewardItems(id) {
        const rewards = get(id)?.rewards || {}, items = [];
        if (rewards.gems) items.push(['💚', rewards.gems.toLocaleString('vi-VN')]);
        if (rewards.chromaticKeys) items.push(['🗝️🌈', String(rewards.chromaticKeys)]);
        if (rewards.scrollsEach) items.push(['📜', `${rewards.scrollsEach} mỗi loại`]);
        if (rewards.aurocite) items.push(['💎🌸', rewards.aurocite.toLocaleString('vi-VN')]);
        if (rewards.sTierGear) items.push(['🏆', 'Epic S-Tier ×1']);
        return items;
      },
      async purchase(id) {
        if (!canBuy(id)) throw new Error('Gói chưa sẵn sàng hoặc đang xử lý giao dịch khác.');
        busy = true;
        onChange();
        try {
          const result = await cloud.purchaseShopOffer(id);
          await load();
          return result;
        } finally {
          busy = false;
          onChange();
        }
      },
    });
  }
  root.ArtemisVipShop = Object.freeze({ create });
})(globalThis);
