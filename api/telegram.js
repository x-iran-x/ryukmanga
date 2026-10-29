const TELEGRAM_API = "https://api.telegram.org";

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));
}

function menuKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "🚀 باز کردن RyukManga", web_app: { url: "https://ryukmanga.vercel.app/" } }],
      [
        { text: "📚 مانگاها", url: "https://ryukmanga.vercel.app/manga/" },
        { text: "🎬 انیمه‌ها", url: "https://ryukmanga.vercel.app/anime/" }
      ],
      [
        { text: "🎵 موسیقی", url: "https://ryukmanga.vercel.app/music/" },
        { text: "🌐 وب‌سایت", url: "https://ryukmanga.vercel.app/" }
      ],
      [{ text: "ℹ️ راهنما", callback_data: "help" }]
    ]
  };
}

async function telegram(method, payload) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("Missing TELEGRAM_BOT_TOKEN environment variable");

  const response = await fetch(`${TELEGRAM_API}/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok || !data.ok) {
    throw new Error(`Telegram API ${method} failed: ${data.description || response.status}`);
  }
  return data.result;
}

async function sendMessage(chatId, text, extra = {}) {
  return telegram("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    ...extra
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (expectedSecret && req.headers["x-telegram-bot-api-secret-token"] !== expectedSecret) {
    return res.status(401).json({ ok: false, error: "Unauthorized webhook" });
  }

  try {
    const update = req.body || {};

    if (update.callback_query) {
      const callback = update.callback_query;
      await telegram("answerCallbackQuery", { callback_query_id: callback.id });
      if (callback.data === "help" && callback.message?.chat?.id) {
        await sendMessage(
          callback.message.chat.id,
          "راهنمای RyukManga ✨\n\nاز دکمهٔ «باز کردن RyukManga» برای ورود به سایت داخل تلگرام استفاده کن. با دکمه‌های «مانگاها»، «انیمه‌ها» و «موسیقی» هم می‌تونی مستقیم وارد بخش مربوطه بشی.\n\nدستورهای موجود: /start ، /help ، /about",
          { reply_markup: menuKeyboard() }
        );
      }
      return res.status(200).json({ ok: true });
    }

    const message = update.message;
    if (!message?.chat?.id || typeof message.text !== "string") {
      return res.status(200).json({ ok: true });
    }

    const chatId = message.chat.id;
    const text = message.text.trim();
    const firstName = escapeHtml(message.from?.first_name || "دوست من");

    if (/^\/start(?:@\w+)?(?:\s|$)/i.test(text)) {
      await sendMessage(
        chatId,
        `سلام ${firstName}! 👋\n\nبه <b>RyukManga</b> خوش اومدی؛ دنیای انیمه و مانگا.\n\nاز منوی زیر برای ورود مستقیم به بخش‌های سایت استفاده کن. 🖤`,
        { reply_markup: menuKeyboard() }
      );
    } else if (/^\/(help|about)(?:@\w+)?(?:\s|$)/i.test(text)) {
      await sendMessage(
        chatId,
        "🖤 <b>راهنمای RyukManga</b>\n\n• باز کردن RyukManga: ورود به سایت داخل تلگرام\n• مانگاها: آرشیو مانگا\n• انیمه‌ها: آرشیو انیمه\n• موسیقی: بخش موسیقی سایت\n\nبرای نمایش دوبارهٔ منو، /start را بزن.",
        { reply_markup: menuKeyboard() }
      );
    } else {
      await sendMessage(
        chatId,
        "پیامت رو دریافت کردم! فعلاً از منوی زیر برای رفتن به بخش‌های RyukManga استفاده کن. ✨",
        { reply_markup: menuKeyboard() }
      );
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("RyukManga Telegram webhook error:", error);
    return res.status(200).json({ ok: true });
  }
}
