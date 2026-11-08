// Local dev chỉ hỗ trợ rewrite literal nội bộ /api; không giả lập toàn bộ Vercel router.
export function resolveApiRequestUrl(value, rewrites = []) {
  const url = new URL(value);
  const pathname = url.pathname.replace(/\/+$/, '') || '/';
  const rewrite = rewrites.find(rule => rule.source === pathname);
  if (!rewrite) return url;
  const destination = new URL(rewrite.destination, url.origin);
  if (destination.origin !== url.origin || !destination.pathname.startsWith('/api/')) {
    throw new Error('Local API rewrite phải trỏ tới đường dẫn /api nội bộ.');
  }
  url.pathname = destination.pathname;
  // Discriminator từ cấu hình luôn thắng query do client tự khai.
  for (const [key, value] of destination.searchParams) url.searchParams.set(key, value);
  return url;
}
