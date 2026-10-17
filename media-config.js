// ==========================================
// تنظیمات ریپوی مدیا (GitHub Pages)
// اگه بعداً ریپو یا هاست عوض شد، فقط baseUrl رو عوض کن
// ==========================================
const MEDIA = {
  owner: 'x-iran-x',
  repo: 'ryukmanga-media',
  branch: 'main',
  baseUrl: 'https://x-iran-x.github.io/ryukmanga-media/'
};

// مسیر نسبی (مثل /media/covers/naruto.jpg) رو به آدرس کامل تبدیل می‌کنه.
// آدرس‌های کامل http/https دست‌نخورده می‌مونن.
function mediaUrl(path) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  return MEDIA.baseUrl + String(path).replace(/^\/+/, '').split('/').map(encodeURIComponent).join('/');
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

// ==========================================
// خواندن لیست مانگاها و جلدها از catalog.json
// (این فایل رو GitHub Pages خودش از ورودی‌های پنل می‌سازه)
// ==========================================
function slugFromPath(path) {
  return String(path || '').split('/').pop().replace(/\.[^.]+$/, '');
}

let catalogPromise = null;

function fetchCatalogRaw() {
  if (!catalogPromise) {
    catalogPromise = fetch(MEDIA.baseUrl + 'catalog.json', { cache: 'no-cache' }).then(res => {
      if (!res.ok) throw new Error('catalog.json: ' + res.status);
      return res.json();
    });
  }
  return catalogPromise;
}

async function loadCatalog() {
  const raw = await fetchCatalogRaw();

  // جلدها رو بر اساس مانگای انتخاب‌شده گروه می‌کنیم
  const volumesBySlug = {};
  (raw.volumes || []).forEach(entry => {
    const d = entry.data || {};
    const slug = slugFromPath(d.manga);
    if (!slug) return;
    (volumesBySlug[slug] = volumesBySlug[slug] || []).push({
      number: Number(d.number),
      download: d.download_link || (d.download_file ? mediaUrl(d.download_file) : ''),
      read: d.read_link || ''
    });
  });

  return (raw.manga || [])
    .filter(entry => entry.data && !entry.data.draft)
    .map(entry => ({
      slug: entry.slug,
      ...entry.data,
      volumes: (volumesBySlug[entry.slug] || []).sort((a, b) => a.number - b.number)
    }))
    .sort((a, b) => String(a.title || '').localeCompare(String(b.title || '')));
}

// ==========================================
// انیمه‌ها و قسمت‌ها
// ==========================================
async function loadAnime() {
  const raw = await fetchCatalogRaw();

  const episodesBySlug = {};
  (raw.episodes || []).forEach(entry => {
    const d = entry.data || {};
    const slug = slugFromPath(d.anime);
    if (!slug) return;
    (episodesBySlug[slug] = episodesBySlug[slug] || []).push({
      number: Number(d.number),
      quality: d.quality || '',
      audio: d.audio || '',
      download: d.download_link || '',
      watch: d.watch_link || '',
      subtitle: d.subtitle_link || ''
    });
  });

  return (raw.anime || [])
    .filter(entry => entry.data && !entry.data.draft)
    .map(entry => ({
      slug: entry.slug,
      ...entry.data,
      episodes: (episodesBySlug[entry.slug] || [])
        .sort((a, b) => a.number - b.number || String(a.quality).localeCompare(String(b.quality)))
    }))
    .sort((a, b) => String(a.title || '').localeCompare(String(b.title || '')));
}

// ==========================================
// موسیقی و موزیک ویدیو
// ==========================================
async function loadMusic() {
  const raw = await fetchCatalogRaw();
  return (raw.music || [])
    .filter(entry => entry.data && !entry.data.draft)
    .map(entry => ({
      id: entry.id,
      ...entry.data,
      art: entry.data.artwork ? mediaUrl(entry.data.artwork) : '',
      audio: entry.data.audio_link || (entry.data.audio_file ? mediaUrl(entry.data.audio_file) : '')
    }))
    .sort((a, b) => String(b.id).localeCompare(String(a.id)));
}

// لینک یوتیوب یا آپارات رو به آدرس قابل‌نمایش (embed) تبدیل می‌کنه؛ برای بقیه رشته خالی برمی‌گردونه
function videoEmbedUrl(url) {
  const u = String(url || '');
  let m = u.match(/(?:youtube\.com\/watch\?(?:[^#]*&)?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/);
  if (m) return 'https://www.youtube-nocookie.com/embed/' + m[1];
  m = u.match(/aparat\.com\/v\/(\w+)/);
  if (m) return 'https://www.aparat.com/video/video/embed/videohash/' + m[1] + '/vt/frame';
  return '';
}

async function loadMv() {
  const raw = await fetchCatalogRaw();
  return (raw.mv || [])
    .filter(entry => entry.data && !entry.data.draft)
    .map(entry => {
      const d = entry.data;
      return {
        id: entry.id,
        ...d,
        thumb: d.thumbnail ? mediaUrl(d.thumbnail) : '',
        embed: videoEmbedUrl(d.video_link),
        video: d.video_link || (d.video_file ? mediaUrl(d.video_file) : '')
      };
    })
    .sort((a, b) => String(b.id).localeCompare(String(a.id)));
}
