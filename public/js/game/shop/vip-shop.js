// Classic-script view adapter. Giá/phần thưởng/giới hạn chỉ đọc từ /api/shop.
(function (root) {
  'use strict';
  function create(options) {
    const cloud = options.cloud;
    const fetcher = options.fetcher || ((url, init) => root.fetch(url, init));
    const onChange = options.onChange || (() => {});
    const confirmPurchase = options.confirmPurchase || (message => root.confirm(message));
    let offers = [], history = [], balances = {}, loading = null, attempted = false, error = '', busy = false;
    const currencyLabel = key => ({ vipCoins: 'xu VIP', gems: 'Kim Cương', gold: 'Vàng' })[key] || key;
    const price = offer => offer.price ?? offer.priceVip;
    const currency = offer => offer.currency || 'vipCoins';
    const number = value => Number(value).toLocaleString('vi-VN');
    const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
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
          if (body.offers.some(o => !o || !/^[a-z0-9_]+$/.test(o.id) || !Number.isSafeInteger(price(o)) || price(o) <= 0
              || !['vipCoins', 'gems', 'gold'].includes(currency(o))
              || (o.remaining !== null && (!Number.isSafeInteger(o.remaining) || o.remaining < 0)) || !o.rewards)) throw new Error('catalog');
          offers = body.offers;
          history = Array.isArray(body.history) ? body.history : [];
          balances = body.balances || {};
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
      history: () => history.slice(),
      historyMarkup() {
        if (error) return '<p>Không tải được lịch sử. Hãy làm mới cửa hàng.</p>';
        if (!history.length) return '<p>Chưa có giao dịch cửa hàng được ghi nhận.</p>';
        return history.map(receipt => {
          const key = receipt.currency || 'vipCoins';
          const after = Number.isSafeInteger(receipt.balanceAfter) ? `${number(receipt.balanceAfter)} ${currencyLabel(key)}` : 'Không có dữ liệu (giao dịch cũ)';
          const reward = this.rewardItemsFrom(receipt.rewards || {}).map(item => item.join(' × ')).join(', ');
          return `<article class="border-b border-white/20 py-2"><b>${escape(receipt.name || get(receipt.offerId)?.name || receipt.offerId)}</b><br>${escape(new Date(receipt.at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }))} (giờ Việt Nam)<br>Giá: ${escape(number(receipt.price ?? receipt.priceVip))} ${escape(currencyLabel(key))}<br>Phần thưởng: ${escape(reward)}<br>Số dư sau mua: ${escape(after)}<br><small>Mã giao dịch: ${escape(receipt.requestId)}</small></article>`;
        }).join('');
      },
      name(id) { return get(id)?.name || 'Đang tải gói…'; },
      error: () => error,
      priceLabel(id) {
        if (pending() === id) return 'Kiểm tra giao dịch';
        const offer = get(id);
        return offer ? `${number(price(offer))} ${currencyLabel(currency(offer))}` : (error ? 'Chưa tải được giá' : 'Đang tải giá…');
      },
      buttonAttributes(id) { return `data-vip-offer="${get(id)?.id || ''}"${canBuy(id) ? '' : ' disabled'}${busy ? ' aria-busy="true"' : ''}`; },
      remainingLabel(id) {
        const offer = get(id);
        if (!offer) return '';
        return offer.remaining === null ? 'Không giới hạn lượt mua' : offer.remaining === 0 ? 'Hết lượt mua trong chu kỳ' : `Còn có thể mua ${offer.remaining} lần`;
      },
      rewardItems(id) {
        return this.rewardItemsFrom(get(id)?.rewards || {});
      },
      rewardItemsFrom(rewards) {
        const items = [];
        if (rewards.gems) items.push(['💚 Kim Cương', rewards.gems.toLocaleString('vi-VN')]);
        if (rewards.chromaticKeys) items.push(['🗝️🌈 Chìa Ngũ Sắc', String(rewards.chromaticKeys)]);
        if (rewards.scrollsEach) items.push(['📜 Cuộn trang bị', `${rewards.scrollsEach} mỗi loại`]);
        if (rewards.aurocite) items.push(['💎🌸 Aurocite', rewards.aurocite.toLocaleString('vi-VN')]);
        if (rewards.sTierGear) items.push(['🏆', 'Epic S-Tier ×1']);
        if (rewards.gold) items.push(['🪙 Vàng', number(rewards.gold)]);
        if (rewards.wishTokens) items.push(['🪙 Cầu Nguyện', number(rewards.wishTokens)]);
        if (rewards.heroShards) for (const [hero, count] of Object.entries(rewards.heroShards)) items.push([`Mảnh ${{ hou_yi: 'Hậu Nghệ' }[hero] || hero}`, number(count)]);
        if (rewards.gearScrolls) for (const [slot, count] of Object.entries(rewards.gearScrolls)) items.push([`Cuộn ${{ weapon: 'Vũ Khí', armor: 'Giáp', helmet: 'Mũ', ring: 'Nhẫn', necklace: 'Dây Chuyền', boots: 'Giày Chiến' }[slot] || slot}`, number(count)]);
        if (rewards.seeds) for (const [seed, count] of Object.entries(rewards.seeds)) items.push([seed === 'sprout' ? 'Hạt Mầm Xanh' : `Hạt giống ${seed}`, number(count)]);
        if (rewards.gear) items.push(['Trang bị', rewards.gear.templateId === 'echo_boots' ? 'Ủng Echo (Thường) ×1' : String(rewards.gear.templateId || rewards.gear)]);
        return items;
      },
      async purchase(id) {
        if (!canBuy(id)) throw new Error('Gói chưa sẵn sàng hoặc đang xử lý giao dịch khác.');
        busy = true;
        onChange();
        try {
          let confirmedBalance;
          if (!pending()) {
            if (!await load()) throw new Error('Không tải được thông tin xác nhận từ máy chủ.');
            const offer = get(id);
            if (!offer || offer.remaining === 0) throw new Error('Gói này đã hết lượt mua.');
            const key = currency(offer), balance = balances[key];
            if (!Number.isSafeInteger(balance)) throw new Error('Chưa tải được số dư máy chủ. Hãy làm mới cửa hàng.');
            const after = balance - price(offer) + (offer.rewards[key] || 0);
            if (balance < price(offer)) throw new Error(`Không đủ ${currencyLabel(key)} để mua gói này.`);
            const rewards = this.rewardItems(id).map(item => item.join(' × ')).join('\n');
            const otherBalances = ['gold', 'gems', 'vipCoins'].filter(field => field !== key && Number.isSafeInteger(balances[field]))
              .map(field => `${currencyLabel(field)}: ${number(balances[field] + (offer.rewards[field] || 0))}`).join(' • ');
            const accepted = await confirmPurchase(`${offer.name}\nGiá: ${number(price(offer))} ${currencyLabel(key)}\nPhần thưởng:\n${rewards}\nSố dư sau mua: ${number(after)} ${currencyLabel(key)}\n${otherBalances}\nMáy chủ sẽ kiểm tra lại số dư khi thanh toán.`);
            if (!accepted) return { cancelled: true };
            confirmedBalance = balance;
          }
          const result = await cloud.purchaseShopOffer(id, confirmedBalance);
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
