// ==========================================
// تنظیمات ریپوی مدیا (GitHub Pages)
// اگه بعداً ریپو یا هاست عوض شد، فقط همین‌جا رو عوض کن
// ==========================================
const MEDIA = {
  owner: 'x-iran-x',
  repo: 'ryukmanga-media',
  branch: 'main',
  baseUrl: 'https://x-iran-x.github.io/ryukmanga-media/'
};

// مسیر نسبی (مثل manga/chainsaw-man/cover.jpg) رو به آدرس کامل تبدیل می‌کنه.
// آدرس‌های کامل http/https (مثل کاورهای قدیمی توی Supabase) دست‌نخورده می‌مونن.
function mediaUrl(path) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  return MEDIA.baseUrl + path.split('/').map(encodeURIComponent).join('/');
}

// جلوگیری از اجرای HTML/JS تزریقی توی متن‌هایی که با innerHTML نمایش داده می‌شن
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
