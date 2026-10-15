/**
 * Niko Phuket: приём заявок с сайта и пересылка в Telegram-бота.
 * Cloudflare Worker. Токен бота хранится здесь, в секретах, а не в коде сайта.
 *
 * Переменные окружения (Settings -> Variables and Secrets):
 *   TELEGRAM_BOT_TOKEN  (Secret)  токен от @BotFather
 *   TELEGRAM_CHAT_IDS   (Text)    chat_id получателей через запятую: личный чат, группа и т.д.
 *   ALLOWED_ORIGINS     (Text)    https://nikophuket.com,https://www.nikophuket.com
 *   SHEETS_WEBHOOK_URL  (Text)    необязательно: адрес веб-приложения Google Apps Script (см. sheets/README.md)
 *   SHEETS_SECRET       (Secret)  необязательно: общий секрет с Apps Script
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
    const telegramReady = Boolean(env.TELEGRAM_BOT_TOKEN && chatIds.length);
    const sheetsReady = Boolean(env.SHEETS_WEBHOOK_URL && env.SHEETS_SECRET);
    if (!telegramReady && !sheetsReady) {
      return json({ ok: false, error: "not_configured" }, 500, cors);
    }

    const replyUrl = buildReplyUrl(body.contact);
    const [results, sheet] = await Promise.all([
      Promise.all((telegramReady ? chatIds : []).map((chatId) => sendToTelegram(env.TELEGRAM_BOT_TOKEN, chatId, text, replyUrl))),
      sheetsReady && body.order ? sendToSheet(env, body.order) : Promise.resolve(false)
    ]);
    const delivered = results.filter(Boolean).length;

    // заявка не потеряна, если дошла хотя бы в одно место: бот или таблица
    if (!delivered && !sheet) {
      return json({ ok: false, error: "delivery_failed" }, 502, cors);
    }

    return json({ ok: true, delivered, sheet }, 200, cors);
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

// Таблица Google: заявка уходит в веб-приложение Apps Script, которое добавляет строку
const cut = (value, max = 500) => String(value ?? "").slice(0, max);

async function sendToSheet(env, order) {
  try {
    const customer = order.customer || {};
    const safe = {
      id: cut(order.id, 40),
      ref: cut(String(order.ref || "").toLowerCase().replace(/[^a-z0-9_-]/g, ""), 32),
      customer: {
        name: cut(customer.name, 120),
        phone: cut(customer.phone, 40),
        method: customer.method === "telegram" ? "telegram" : "whatsapp",
        nick: cut(customer.nick, 60),
        hotel: cut(customer.hotel, 160),
        comment: cut(customer.comment, 800)
      },
      items: (Array.isArray(order.items) ? order.items : []).slice(0, 30).map((item) => ({
        kind: cut(item.kind, 20), group: cut(item.group, 80), title: cut(item.title, 200), program: cut(item.program, 200),
        priceLabel: cut(item.priceLabel, 120), date: cut(item.date, 20), adults: Number(item.adults) || 0, children: Number(item.children) || 0,
        duration: cut(item.duration, 60), comment: cut(item.comment, 400), url: cut(item.url, 300)
      })),
      source: Object.fromEntries(Object.entries(order.source || {}).slice(0, 8).map(([k, v]) => [cut(k, 30), cut(v, 200)]))
    };

    const response = await fetch(env.SHEETS_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ secret: env.SHEETS_SECRET, order: safe }),
      redirect: "follow"
    });
    if (!response.ok) return false;
    const result = await response.json().catch(() => ({}));
    return result.ok === true;
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
