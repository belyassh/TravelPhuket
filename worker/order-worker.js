/**
 * Niko Phuket: приём заявок с сайта и пересылка в Telegram-бота.
 * Cloudflare Worker. Токен бота хранится здесь, в секретах, а не в коде сайта.
 *
 * Переменные окружения (Settings -> Variables and Secrets):
 *   TELEGRAM_BOT_TOKEN  (Secret)  токен от @BotFather
 *   TELEGRAM_CHAT_IDS   (Text)    chat_id получателей через запятую: личный чат, группа и т.д.
 *   ALLOWED_ORIGINS     (Text)    https://nikophuket.com,https://www.nikophuket.com
 */

const MAX_TEXT_LENGTH = 3800; // лимит Telegram 4096 символов
const MIN_TEXT_LENGTH = 30;

export default {
  async fetch(request, env) {
    const origins = (env.ALLOWED_ORIGINS || "").split(",").map((item) => item.trim()).filter(Boolean);
    const origin = request.headers.get("Origin") || "";
    const originAllowed = origins.includes(origin);

    const cors = {
      "Access-Control-Allow-Origin": originAllowed ? origin : origins[0] || "",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
      Vary: "Origin"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    if (request.method !== "POST") {
      return json({ ok: false, error: "method_not_allowed" }, 405, cors);
    }

    if (!originAllowed) {
      return json({ ok: false, error: "forbidden_origin" }, 403, cors);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: "bad_json" }, 400, cors);
    }

    // ловушка для ботов: настоящий пользователь это поле не видит и не заполняет
    if (body && body.website) {
      return json({ ok: true }, 200, cors);
    }

    const text = typeof body?.text === "string" ? body.text.trim() : "";
    if (text.length < MIN_TEXT_LENGTH || text.length > MAX_TEXT_LENGTH) {
      return json({ ok: false, error: "bad_text" }, 400, cors);
    }

    const chatIds = (env.TELEGRAM_CHAT_IDS || "").split(",").map((item) => item.trim()).filter(Boolean);
    if (!env.TELEGRAM_BOT_TOKEN || !chatIds.length) {
      return json({ ok: false, error: "not_configured" }, 500, cors);
    }

    const replyUrl = buildReplyUrl(body.contact);
    const results = await Promise.all(chatIds.map((chatId) => sendToTelegram(env.TELEGRAM_BOT_TOKEN, chatId, text, replyUrl)));
    const delivered = results.filter(Boolean).length;

    if (!delivered) {
      return json({ ok: false, error: "telegram_failed" }, 502, cors);
    }

    return json({ ok: true, delivered }, 200, cors);
  }
};

// Кнопка под заявкой: открывает чат с клиентом в выбранном им мессенджере
function buildReplyUrl(contact) {
  if (!contact || typeof contact !== "object") return null;
  const digits = String(contact.phone || "").replace(/\D/g, "");

  if (contact.method === "whatsapp" && digits.length >= 7 && digits.length <= 15) {
    return { text: "Ответить в WhatsApp", url: `https://wa.me/${digits}` };
  }

  if (contact.method === "telegram") {
    const nick = String(contact.nick || "").replace(/^@+/, "");
    if (/^[A-Za-z0-9_]{5,32}$/.test(nick)) return { text: "Ответить в Telegram", url: `https://t.me/${nick}` };
    if (digits.length >= 7 && digits.length <= 15) return { text: "Ответить в Telegram по номеру", url: `https://t.me/+${digits}` };
  }

  return null;
}

async function sendToTelegram(token, chatId, text, reply) {
  try {
    const payload = { chat_id: chatId, text: `🆕 ${text}`, disable_web_page_preview: true };
    if (reply) payload.reply_markup = { inline_keyboard: [[{ text: reply.text, url: reply.url }]] };

    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    return response.ok;
  } catch {
    return false;
  }
}

function json(payload, status, headers) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...headers }
  });
}
