"use strict";
/**
 * Сборка сайта без зависимостей: node scripts/build.cjs  ->  dist/
 * Все страницы (главная, каталоги, карточки, корзина, документы) строятся из одного шаблона,
 * данные берутся из data/*.json. Клиентский код: src/scripts/site.js, стили: src/styles/main.css.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf-8");
const readJson = (...p) => JSON.parse(read(...p));

const site = readJson("data", "site.json");
const SITE_URL = site.url.replace(/\/$/, "");
const TODAY = new Date().toISOString().slice(0, 10);

/* ---------- helpers ---------- */

const esc = (value) => String(value ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#039;");

const num = (value) => new Intl.NumberFormat("ru-RU").format(value).replace(/\u00a0|\u202f/g, "\u00a0");
const baht = (value) => `${num(value)}\u00a0฿`;
const bahtText = (text) => String(text || "").replace(/\s*THB/g, "\u00a0฿");
const jsonLd = (data) => `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;
const unique = (list) => [...new Set(list.filter(Boolean))];

function write(rel, content) {
  const target = path.join(DIST, rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

function copyDir(from, to) {
  if (!fs.existsSync(from)) return;
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, entry.name);
    const b = path.join(to, entry.name);
    entry.isDirectory() ? copyDir(a, b) : fs.copyFileSync(a, b);
  }
}

const hash = (text) => crypto.createHash("md5").update(text).digest("hex").slice(0, 8);

/* ---------- icons ---------- */

const ICONS = {
  wa: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12.04 2a9.9 9.9 0 0 0-8.5 14.9L2 22l5.25-1.38A9.9 9.9 0 1 0 12.04 2Zm0 1.8a8.1 8.1 0 1 1-4.3 14.96l-.3-.19-3.1.82.83-3.02-.2-.31A8.1 8.1 0 0 1 12.04 3.8Zm-3.2 3.9c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.07 3.3 5.1 4.5 2.52 1 3.03.8 3.57.75.55-.05 1.76-.72 2-1.41.25-.7.25-1.3.17-1.42-.07-.12-.27-.2-.57-.35-.3-.15-1.76-.87-2.03-.97-.28-.1-.48-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.18-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.5Z"/></svg>',
  tg: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21.9 4.4 18.7 19.5c-.24 1.07-.87 1.33-1.76.83l-4.85-3.58-2.34 2.25c-.26.26-.48.48-.98.48l.35-4.94 8.98-8.12c.39-.35-.08-.54-.6-.19L6.4 13.2 1.6 11.7c-1.04-.33-1.06-1.04.22-1.54L20.6 2.9c.87-.32 1.63.2 1.3 1.5Z"/></svg>',
  cart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M3 4h2.2l2 11h10.4l2-8H6.3M9.5 20a1 1 0 1 0 0-.01M17 20a1 1 0 1 0 0-.01"/></svg>',
  search: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="m20 20-4.2-4.2M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M5 12h14m-5-5 5 5-5 5"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
  clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>',
  users: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20M10 11.5a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5ZM20 20v-1.5a3.5 3.5 0 0 0-2.5-3.35M15.5 5.2a3.25 3.25 0 0 1 0 6.1"/></svg>',
  pulse: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M3 12h4l2.5-6 4 12 2.5-6H21"/></svg>',
  pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"/></svg>'
};

/* ---------- data ---------- */

const GROUPS = {
  sea: { label: "Морские экскурсии", short: "Морские", href: "/excursions/sea.html" },
  land: { label: "Наземные экскурсии", short: "Наземные", href: "/excursions/land.html" },
  show: { label: "Шоу и вечерние программы", short: "Шоу", href: "/excursions/show.html" },
  visa: { label: "Бордеран и визаран", short: "Бордеран", href: "/services/#visa" },
  rental: { label: "Аренда", short: "Аренда", href: "/rental/" },
  other: { label: "Услуги", short: "Услуги", href: "/services/#other" }
};

const DAY_LABELS = { daily: "ежедневно", mon: "пн", tue: "вт", wed: "ср", thu: "чт", fri: "пт", sat: "сб", sun: "вс" };
const FALLBACK_IMAGE = "/placeholder.svg";

function loadItems() {
  const excursions = readJson("data", "excursions.json").excursions || [];
  const rentals = readJson("data", "rentals.json").rentals || [];
  const services = readJson("data", "services.json").services || [];

  const items = [];

  excursions.forEach((raw) => {
    const programs = (raw.programs || []).map((p) => {
      const priceLike = /\d.*THB/i.test(p.priceLabel || "");
      return {
        ...p,
        priceLabel: priceLike ? bahtText(p.priceLabel) : `${baht(Number(p.price) || 0)} за человека`,
        tagline: priceLike ? "" : p.priceLabel || ""
      };
    });
    const prices = programs.map((p) => Number(p.price)).filter((n) => n > 0);
    items.push({
      kind: "excursion",
      group: GROUPS[raw.category] ? raw.category : "land",
      id: raw.id,
      slug: raw.slug || raw.id,
      url: `/excursions/${raw.slug || raw.id}.html`,
      title: raw.title,
      overview: raw.overview || "",
      description: raw.description || "",
      images: (raw.images || []).filter(Boolean),
      priceFrom: prices.length ? Math.min(...prices) : Number(raw.price) || 0,
      priceUnit: "за человека",
      multi: programs.length > 1,
      duration: raw.duration || "",
      rank: Number(raw.topRank) || 999,
      tags: raw.tags || [],
      raw: { ...raw, programs }
    });
  });

  services.forEach((raw) => {
    items.push({
      kind: "service",
      group: raw.category === "border-run" ? "visa" : "other",
      id: raw.id,
      slug: raw.slug || raw.id,
      url: `/services/${raw.slug || raw.id}.html`,
      title: raw.title,
      overview: raw.overview || "",
      description: raw.description || "",
      images: (raw.images || []).filter(Boolean),
      priceFrom: Number(raw.priceFrom) || 0,
      priceUnit: raw.unit || "",
      duration: raw.duration || "",
      rank: 500,
      tags: raw.tags || [],
      raw
    });
  });

  rentals.forEach((raw) => {
    items.push({
      kind: "rental",
      group: "rental",
      id: raw.id,
      slug: raw.slug || raw.id,
      url: `/rental/${raw.slug || raw.id}.html`,
      title: raw.title,
      overview: raw.overview || "",
      description: raw.description || "",
      images: (raw.images || []).filter(Boolean),
      priceFrom: Number(raw.prices?.day) || 0,
      priceUnit: "в день",
      duration: "",
      rank: 800,
      tags: raw.tags || [],
      raw
    });
  });

  return items.sort((a, b) => a.rank - b.rank);
}

const items = loadItems();
const itemsOf = (group) => items.filter((item) => item.group === group);
const activeGroups = Object.keys(GROUPS).filter((key) => itemsOf(key).length);
const image = (item) => item.images[0] || FALLBACK_IMAGE;

/* ---------- layout pieces ---------- */

const contacts = site.contacts || {};
const waNumber = String(contacts.whatsapp || "").replace(/\D/g, "");
const tgUser = String(contacts.telegram || "").replace(/^@+/, "");
const waLink = waNumber ? `https://wa.me/${waNumber}` : "";
const tgLink = tgUser ? `https://t.me/${tgUser}` : "";

const clientConfig = {
  endpoint: site.orders?.endpoint || "",
  whatsapp: waNumber,
  telegram: tgUser,
  hours: site.hours
};

const ASSET_CSS = `/assets/main.css?v=${hash(read("src", "styles", "main.css"))}`;
const ASSET_JS = `/assets/site.js?v=${hash(read("src", "scripts", "site.js"))}`;

function header() {
  const nav = activeGroups.map((key) => `<a href="${GROUPS[key].href}">${esc(GROUPS[key].short)}</a>`).join("") + '<a class="nav-quiz" href="/quiz/">Подобрать тур</a>';
  const messengers = [
    waLink ? `<a class="chat-btn chat-wa" href="${waLink}" target="_blank" rel="noopener" aria-label="Написать в WhatsApp">${ICONS.wa}<span>WhatsApp</span></a>` : "",
    tgLink ? `<a class="chat-btn chat-tg" href="${tgLink}" target="_blank" rel="noopener" aria-label="Написать в Telegram">${ICONS.tg}<span>Telegram</span></a>` : ""
  ].join("");

  return `<header class="site-header" data-header>
  <div class="container header-inner">
    <a class="brand" href="/" aria-label="${esc(site.name)}: на главную"><span class="brand-sun" aria-hidden="true"></span><span class="brand-name">${esc(site.name)}</span></a>
    <nav class="main-nav" id="mainNav" aria-label="Каталог">${nav}</nav>
    <div class="header-actions">
      ${messengers}
      <a class="cart-link" href="/cart.html" aria-label="Корзина">${ICONS.cart}<span class="cart-count" data-cart-count hidden>0</span></a>
      <button class="burger" type="button" aria-label="Меню" aria-expanded="false" aria-controls="mainNav" data-burger><span></span><span></span></button>
    </div>
  </div>
</header>`;
}

function footer() {
  const catalog = activeGroups.map((key) => `<a href="${GROUPS[key].href}">${esc(GROUPS[key].label)}</a>`).join("");
  const links = [
    waLink ? `<a href="${waLink}" target="_blank" rel="noopener">WhatsApp</a>` : "",
    tgLink ? `<a href="${tgLink}" target="_blank" rel="noopener">Telegram</a>` : "",
    contacts.email ? `<a href="mailto:${esc(contacts.email)}">${esc(contacts.email)}</a>` : ""
  ].join("");

  return `<footer class="site-footer">
  <div class="container footer-grid">
    <div class="footer-brand">
      <img src="/logo.webp" alt="${esc(site.name)}" width="140" height="140" loading="lazy" />
      <p>${esc(site.tagline)}. Подтверждаем заявки вручную, пишем в WhatsApp или Telegram.</p>
    </div>
    <nav class="footer-col" aria-label="Каталог"><h3>Каталог</h3>${catalog}</nav>
    <nav class="footer-col" aria-label="Документы"><h3>Документы</h3><a href="/privacy.html">Политика конфиденциальности</a><a href="/refund-policy.html">Условия возврата</a></nav>
    <div class="footer-col"><h3>Связь</h3>${links}<p class="muted-light">Рабочие часы: ${esc(site.hours)} (время Пхукета)</p></div>
  </div>
  <div class="container footer-bottom"><p>© ${new Date().getFullYear()} ${esc(site.name)}</p></div>
</footer>`;
}

function page({ title, description, path: pagePath, body, schema = [], noindex = false, ogImage = "/og.jpg", bodyClass = "" }) {
  const canonical = `${SITE_URL}${pagePath}`;
  const analytics = site.analyticsId
    ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${esc(site.analyticsId)}"></script>
  <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag("js",new Date());gtag("config","${esc(site.analyticsId)}");</script>`
    : "";

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  <meta name="robots" content="${noindex ? "noindex, nofollow" : "index, follow, max-image-preview:large"}" />
  <meta name="theme-color" content="#0f2a33" />
  <link rel="canonical" href="${canonical}" />
  <meta property="og:type" content="website" />
  <meta property="og:locale" content="ru_RU" />
  <meta property="og:site_name" content="${esc(site.name)}" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:image" content="${ogImage.startsWith("http") ? ogImage : SITE_URL + ogImage}" />
  <meta name="twitter:card" content="summary_large_image" />
  <link rel="icon" href="/favicon.ico" sizes="any" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap" />
  <link rel="stylesheet" href="${ASSET_CSS}" />
  ${schema.map(jsonLd).join("\n  ")}
  ${analytics}
</head>
<body class="${bodyClass}">
${header()}
<main id="main">
${body}
</main>
${footer()}
<script type="application/json" id="niko-config">${JSON.stringify(clientConfig)}</script>
<script src="${ASSET_JS}" defer></script>
</body>
</html>`;
}

const breadcrumbs = (trail) => `<nav class="breadcrumbs" aria-label="Хлебные крошки"><ol>${trail.map((t, i) => (i === trail.length - 1 || !t.href)
  ? `<li aria-current="page">${esc(t.name)}</li>`
  : `<li><a href="${t.href}">${esc(t.name)}</a></li>`).join("")}</ol></nav>`;

const breadcrumbSchema = (trail) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: trail.map((t, i) => ({ "@type": "ListItem", position: i + 1, name: t.name, item: `${SITE_URL}${t.href || ""}` }))
});

/* ---------- catalog components ---------- */

function card(item) {
  const search = [item.title, item.overview, GROUPS[item.group].label, ...item.tags, ...(item.raw.programs || []).map((p) => p.title)]
    .join(" ").toLowerCase().replace(/ё/g, "е");
  const price = item.priceFrom
    ? `<p class="card-price"><small>от</small> ${baht(item.priceFrom)} <small>${esc(item.priceUnit)}</small></p>`
    : `<p class="card-price">Цена по запросу</p>`;

  return `<article class="card" data-card data-group="${item.group}" data-search="${esc(search)}">
  <a class="card-media" href="${item.url}" tabindex="-1" aria-hidden="true"><img src="${esc(image(item))}" alt="" width="800" height="600" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='${FALLBACK_IMAGE}'" /></a>
  <div class="card-body">
    <p class="card-tag">${esc(GROUPS[item.group].label)}</p>
    <h3 class="card-title"><a href="${item.url}">${esc(item.title)}</a></h3>
    <p class="card-text">${esc(item.overview)}</p>
    <div class="card-foot">${price}${item.duration ? `<span class="card-meta">${ICONS.clock}${esc(item.duration)}</span>` : ""}</div>
  </div>
</article>`;
}

function catalog({ list, chips, activeKey, scope, searchPlaceholder = "Например: Пхи-Пхи, скутер, border run" }) {
  const chipHtml = chips.map((chip) => `<a class="chip${chip.key === activeKey ? " is-active" : ""}" href="${chip.href}" data-chip="${chip.key}"${chip.key === activeKey ? ' aria-current="true"' : ""}>${esc(chip.label)}<small>${chip.count}</small></a>`).join("");

  return `<div class="catalog" data-catalog data-scope="${scope}">
  <div class="catalog-tools">
    <div class="chips" role="navigation" aria-label="Категории">${chipHtml}</div>
    <label class="search"><span class="visually-hidden">Поиск по каталогу</span>${ICONS.search}<input type="search" placeholder="${esc(searchPlaceholder)}" data-search-input autocomplete="off" /></label>
  </div>
  <div class="grid" data-grid>${list.map(card).join("\n")}</div>
  <p class="empty" data-empty hidden>Ничего не нашли. Попробуйте другое слово или напишите нам: подскажем маршрут.</p>
</div>`;
}

const allChips = (keys, hrefAll, hrefOf) => [
  { key: "all", label: "Все", href: hrefAll, count: keys.reduce((s, k) => s + itemsOf(k).length, 0) },
  ...keys.map((k) => ({ key: k, label: GROUPS[k].short, href: hrefOf(k), count: itemsOf(k).length }))
];

const itemListSchema = (list, name) => ({
  "@context": "https://schema.org",
  "@type": "ItemList",
  name,
  itemListElement: list.map((item, i) => ({ "@type": "ListItem", position: i + 1, url: `${SITE_URL}${item.url}`, name: item.title }))
});

/* ---------- home ---------- */

const FAQ = [
  ["Как быстро вы подтверждаете заявку?", `В рабочие часы (${site.hours} по времени Пхукета) обычно в течение 15–30 минут. Заявки, отправленные ночью, мы обрабатываем утром.`],
  ["Как понять, что заявка принята?", "После отправки вы увидите подтверждение на сайте. Затем менеджер напишет вам в WhatsApp или Telegram, в зависимости от того, что вы выбрали."],
  ["Нужна ли оплата при оформлении заявки?", "Нет. Заявка не является оплатой: менеджер сначала подтвердит наличие мест, детали трансфера и порядок оплаты."],
  ["Можно ли изменить дату после оформления?", "Обычно да, при наличии мест. Напишите менеджеру как можно раньше, чтобы мы закрепили новый слот."],
  ["В какой валюте указаны цены?", "Цены указаны в тайских батах (฿). У многих программ отдельная цена для детей, она указана в описании программы."],
  ["Какие экскурсии подходят для отдыха с детьми?", "Семьям чаще подходят обзорные программы и спокойные островные маршруты. Возраст детей укажите в комментарии к заявке, и менеджер предложит подходящий формат."],
  ["В какие месяцы лучше ехать на экскурсии?", "Наиболее стабильная погода обычно с ноября по апрель. С мая по октябрь туры тоже проходят, но программа может меняться из-за погоды и состояния моря."],
  ["За сколько дней лучше бронировать?", "Рекомендуем за 2–5 дней, а в высокий сезон и на популярные маршруты за 5–7 дней: так больше шансов выбрать удобную дату."]
];

function homePage() {
  const topImage = image(items.find((i) => i.kind === "excursion" && i.images.length) || items[0]);
  const steps = [
    ["Выберите", "Откройте экскурсию, прочитайте программу и выберите дату и количество гостей."],
    ["Добавьте в корзину", "Можно собрать несколько экскурсий и отправить одной заявкой."],
    ["Менеджер напишет вам", "Подтвердим места и детали в WhatsApp или Telegram, как вам удобнее."]
  ];
  const facts = [
    [ICONS.users, "Местные гиды", "Работаем с проверенными партнёрами на острове"],
    [ICONS.pulse, "Прозрачные цены", "Стоимость в батах, цена для детей в программе"],
    [ICONS.clock, `Ответ ${site.hours}`, "Подтверждаем заявки вручную, без автоответчиков"],
    [ICONS.pin, "Трансфер из отеля", "Забираем из большинства отелей на западном побережье"]
  ];

  const body = `<section class="hero" style="--hero-image:url('${esc(topImage)}')">
  <div class="container hero-inner">
    <p class="eyebrow">Пхукет · Таиланд</p>
    <h1>Экскурсии на Пхукете</h1>
    <p class="hero-lead">Острова, море и впечатления без хлопот. Выбирайте маршрут, добавляйте в корзину и отправляйте одну заявку: менеджер подтвердит места и напишет вам в WhatsApp или Telegram.</p>
    <form class="hero-search" role="search" data-hero-search>
      ${ICONS.search}
      <input type="search" name="q" placeholder="Куда хотите? Пхи-Пхи, Симиланы, Джеймс Бонд…" aria-label="Поиск экскурсии" autocomplete="off" />
      <button class="btn btn-primary" type="submit">Найти</button>
    </form>
    <div class="hero-quick"><a class="quick-quiz" href="/quiz/">Подобрать за 30 секунд</a>${activeGroups.filter((k) => k !== "other").map((k) => `<a href="${GROUPS[k].href}" data-quick="${k}">${esc(GROUPS[k].short)}</a>`).join("")}</div>
  </div>
</section>

<section class="section" id="catalog">
  <div class="container">
    <div class="section-head"><p class="eyebrow">Каталог</p><h2>Что хотите сделать на острове?</h2></div>
    ${catalog({ list: items, chips: allChips(activeGroups, "/", (k) => GROUPS[k].href), activeKey: "all", scope: "all" })}
  </div>
</section>

<section class="section section-flush">
  <div class="container">
    <div class="quiz-banner">
      <div><p class="eyebrow">Подбор за 30 секунд</p><h2>Не знаете, что выбрать?</h2><p>Ответьте на 2–4 вопроса, и мы подскажем подходящую программу с учётом того, кто едет.</p></div>
      <a class="btn btn-primary" href="/quiz/">Подобрать экскурсию</a>
    </div>
  </div>
</section>

<section class="section section-tint" id="how">
  <div class="container">
    <div class="section-head"><p class="eyebrow">Как это работает</p><h2>Три шага до подтверждённой поездки</h2></div>
    <ol class="steps">${steps.map(([t, d], i) => `<li><span class="step-n">${i + 1}</span><h3>${t}</h3><p>${d}</p></li>`).join("")}</ol>
  </div>
</section>

<section class="section">
  <div class="container facts">${facts.map(([icon, t, d]) => `<div class="fact"><span class="fact-icon">${icon}</span><h3>${t}</h3><p>${d}</p></div>`).join("")}</div>
</section>

<section class="section section-tint" id="faq">
  <div class="container narrow">
    <div class="section-head"><p class="eyebrow">FAQ</p><h2>Частые вопросы</h2></div>
    <div class="faq">${FAQ.map(([q, a], i) => `<details${i === 0 ? " open" : ""}><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("")}</div>
  </div>
</section>`;

  const schema = [
    {
      "@context": "https://schema.org",
      "@type": "TravelAgency",
      name: site.name,
      url: SITE_URL,
      logo: `${SITE_URL}/logo.webp`,
      image: `${SITE_URL}/og.jpg`,
      description: "Экскурсии на Пхукете, бордеран, трансферы и аренда транспорта.",
      areaServed: { "@type": "Place", name: "Phuket, Thailand" },
      openingHours: "Mo-Su 09:00-21:00",
      sameAs: [tgLink, waLink].filter(Boolean),
      email: contacts.email || undefined
    },
    { "@context": "https://schema.org", "@type": "WebSite", name: site.name, url: SITE_URL },
    { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) }
  ];

  return page({
    title: "Экскурсии на Пхукете: Пхи-Пхи, Симиланы, Джеймс Бонд | Niko Phuket",
    description: "Экскурсии на Пхукете с русским гидом: острова Пхи-Пхи, Симиланы, залив Пханг-Нга. Бордеран, трансферы, аренда. Заявка онлайн, ответ в WhatsApp или Telegram.",
    path: "/",
    body,
    schema
  });
}

/* ---------- catalog pages ---------- */

function catalogPage({ path: pagePath, h1, lead, title, description, list, chips, activeKey, scope, trail }) {
  const body = `<section class="page-head">
  <div class="container">
    ${breadcrumbs(trail)}
    <h1>${esc(h1)}</h1>
    <p class="lead">${esc(lead)}</p>
  </div>
</section>
<section class="section section-flush">
  <div class="container">${catalog({ list, chips, activeKey, scope })}</div>
</section>`;

  return page({
    title,
    description,
    path: pagePath,
    body,
    schema: [breadcrumbSchema(trail), itemListSchema(list, h1)]
  });
}

function catalogPages() {
  const excursionGroups = activeGroups.filter((k) => ["sea", "land", "show"].includes(k));
  const excursions = items.filter((i) => i.kind === "excursion");
  const home = { name: "Главная", href: "/" };
  const exChips = (active) => allChips(excursionGroups, "/excursions/", (k) => GROUPS[k].href).map((c) => ({ ...c, key: c.key }));

  write("excursions/index.html", catalogPage({
    path: "/excursions/",
    h1: "Экскурсии на Пхукете",
    lead: "Морские и наземные программы с трансфером из отеля. Выберите маршрут, дату и количество гостей.",
    title: "Экскурсии на Пхукете: цены, программы, заявка онлайн | Niko Phuket",
    description: "Все экскурсии на Пхукете в одном каталоге: Пхи-Пхи, Симиланы, Джеймс Бонд, обзорные туры. Цены в батах, трансфер из отеля, заявка онлайн.",
    list: excursions,
    chips: exChips(),
    activeKey: "all",
    scope: "all",
    trail: [home, { name: "Экскурсии" }]
  }));

  const SEO = {
    sea: ["Морские экскурсии на Пхукете: острова и катера", "Морские экскурсии на Пхукете: Пхи-Пхи, Симиланские острова, залив Пханг-Нга. Скоростные катера и катамараны, трансфер из отеля, заявка онлайн."],
    land: ["Наземные экскурсии на Пхукете: город, храмы, природа", "Наземные экскурсии на Пхукете: обзорные туры, Старый город, храмы и смотровые площадки. Групповые и индивидуальные программы."],
    show: ["Шоу и вечерние программы на Пхукете", "Вечерние шоу и программы на Пхукете с трансфером из отеля. Выберите дату и отправьте заявку онлайн."]
  };

  excursionGroups.forEach((key) => {
    const [title, description] = SEO[key];
    write(`excursions/${key}.html`, catalogPage({
      path: GROUPS[key].href,
      h1: GROUPS[key].label,
      lead: description.split(". ")[0] + ".",
      title: `${title} | Niko Phuket`,
      description,
      list: itemsOf(key),
      chips: exChips(),
      activeKey: key,
      scope: key,
      trail: [home, { name: "Экскурсии", href: "/excursions/" }, { name: GROUPS[key].label }]
    }));
  });

  write("rental/index.html", catalogPage({
    path: "/rental/",
    h1: "Аренда на Пхукете",
    lead: "Скутеры, автомобили и катамараны с доставкой к отелю. Цены за день, неделю и месяц.",
    title: "Аренда скутера, авто и катамарана на Пхукете | Niko Phuket",
    description: "Аренда скутеров, автомобилей и яхт на Пхукете с доставкой к отелю. Цены за день, неделю и месяц, залог и условия на странице каждого предложения.",
    list: itemsOf("rental"),
    chips: [],
    activeKey: "all",
    scope: "all",
    trail: [home, { name: "Аренда" }]
  }));

  const services = [...itemsOf("visa"), ...itemsOf("other")];
  const servicesBody = `<section class="page-head"><div class="container">${breadcrumbs([home, { name: "Услуги" }])}<h1>Услуги: бордеран, Fast Track, трансферы</h1><p class="lead">Организованные выезды для визы, ускоренное прохождение аэропорта и частные трансферы.</p></div></section>
${["visa", "other"].filter((k) => itemsOf(k).length).map((k) => `<section class="section section-flush" id="${k}"><div class="container"><h2 class="group-title">${esc(GROUPS[k].label)}</h2><div class="grid">${itemsOf(k).map(card).join("")}</div></div></section>`).join("")}`;

  write("services/index.html", page({
    title: "Бордеран, Fast Track и трансферы на Пхукете | Niko Phuket",
    description: "Бордеран на 1 день, Fast Track в аэропорту Пхукета, частные трансферы. Цены в батах, заявка онлайн, подтверждение менеджером.",
    path: "/services/",
    body: servicesBody,
    schema: [breadcrumbSchema([home, { name: "Услуги", href: "/services/" }]), itemListSchema(services, "Услуги")]
  }));
}

/* ---------- detail pages ---------- */

const list = (arr) => `<ul class="checklist">${(arr || []).map((x) => `<li>${ICONS.check}<span>${esc(x)}</span></li>`).join("")}</ul>`;
const dayText = (days) => (days || []).map((d) => DAY_LABELS[d] || d).join(", ");

function bookingFields(item) {
  const comment = (hint) => `<label class="field wide"><span>Комментарий</span><textarea name="comment" rows="2" placeholder="${esc(hint)}"></textarea></label>`;

  if (item.kind === "rental") {
    return `<label class="field"><span>Дата начала</span><input name="date" type="date" required /></label>
      <label class="field"><span>Срок аренды</span><input name="duration" type="text" placeholder="Например: 5 дней" required /></label>
      ${comment("Например: нужен детский шлем, доставка в отель")}`;
  }

  return `<label class="field wide"><span>${item.kind === "excursion" ? "Дата экскурсии" : "Дата"}</span><input name="date" type="date" required /></label>
      <label class="field"><span>Взрослые</span><input name="adults" type="number" min="1" max="30" value="2" required /></label>
      <label class="field"><span>Дети</span><input name="children" type="number" min="0" max="30" value="0" required /></label>
      ${comment(item.kind === "excursion" ? "Возраст детей, особые пожелания" : "Например: рейс SU275, прилёт 14:20")}`;
}

function bookingCard(item) {
  const programs = item.kind === "excursion" ? item.raw.programs : [];
  const select = programs.length
    ? `<label class="field wide"><span>Программа</span><select name="program" required data-program>${programs.map((p, i) => `<option value="${esc(p.title)}" data-departure="${esc(p.departure || "")}" data-price="${esc(p.priceLabel)}"${i === 0 ? " selected" : ""}>${esc(p.title)}${p.departure ? ` · выезд ${esc(p.departure)}` : ""}</option>`).join("")}</select></label>`
    : "";
  const priceLine = programs.length
    ? programs[0].priceLabel
    : item.kind === "rental"
      ? `${baht(item.raw.prices?.day || 0)} в день`
      : `${baht(item.priceFrom)} ${item.priceUnit}`;

  return `<aside class="booking" id="book" data-booking-wrap>
  <div data-booking-form-wrap>
    <p class="booking-from">${programs.length ? "Стоимость" : "от"}</p>
    <p class="booking-price" data-price-out>${esc(priceLine)}</p>
    <form class="booking-form" data-booking novalidate data-kind="${item.kind}" data-id="${esc(item.id)}" data-title="${esc(item.title)}" data-url="${item.url}" data-image="${esc(image(item))}" data-price="${esc(priceLine)}">
      <div class="form-grid">${select}${bookingFields(item)}</div>
      <button class="btn btn-primary btn-block" type="submit">Добавить в корзину</button>
      <p class="booking-note">Это заявка, не оплата. Менеджер подтвердит места в ${esc(site.hours.split("–")[0])}–${esc(site.hours.split("–")[1])}.</p>
    </form>
  </div>
  <div class="booking-done" data-booking-done hidden>
    <span class="done-icon">${ICONS.check}</span>
    <h3>Добавлено в корзину</h3>
    <p data-done-count></p>
    <a class="btn btn-primary btn-block" href="/cart.html">Перейти в корзину</a>
    <a class="btn btn-ghost btn-block" href="${item.kind === "excursion" ? "/excursions/" : item.kind === "rental" ? "/rental/" : "/services/"}" data-back-to-catalog>Выбрать ещё</a>
    <button class="link-btn" type="button" data-add-another>Добавить ещё одну дату или программу</button>
  </div>
</aside>`;
}

function detailPage(item) {
  const r = item.raw;
  const base = { excursion: { name: "Экскурсии", href: "/excursions/" }, rental: { name: "Аренда", href: "/rental/" }, service: { name: "Услуги", href: "/services/" } }[item.kind];
  const trail = [{ name: "Главная", href: "/" }, base, { name: item.title }];
  const gallery = item.images.length ? item.images.slice(0, 3) : [FALLBACK_IMAGE];

  const facts = [];
  if (item.duration) facts.push([ICONS.clock, "Длительность", item.duration]);
  if (r.groupSize) facts.push([ICONS.users, "Группа", r.groupSize]);
  if (r.difficulty) facts.push([ICONS.pulse, "Нагрузка", r.difficulty]);
  if (item.kind === "excursion") {
    const departures = unique((r.programs || []).map((p) => p.departure)).sort();
    if (departures.length) facts.push([ICONS.pin, "Выезд", departures.length > 1 ? `${departures[0]}–${departures[departures.length - 1]}` : departures[0]]);
  }
  if (item.kind === "rental" && r.deposit) facts.push([ICONS.pulse, "Залог", bahtText(r.deposit)]);
  if (item.kind === "rental" && r.transmission) facts.push([ICONS.pin, "Коробка", r.transmission]);

  const sections = [];
  sections.push(`<section class="block"><h2>О программе</h2><p>${esc(item.description)}</p></section>`);

  if (item.kind === "excursion" && r.programs.length) {
    sections.push(`<section class="block"><h2>Программы и стоимость</h2><div class="programs">${r.programs.map((p) => `<article class="program">
      <div class="program-head"><h3>${esc(p.title)}</h3><p class="program-price">${esc(p.priceLabel)}</p></div>
      ${p.tagline ? `<p class="program-tagline">${esc(p.tagline)}</p>` : ""}
      <p class="program-meta">${p.departure ? `Выезд ${esc(p.departure)}` : ""}${p.days ? ` · ${esc(dayText(p.days))}` : ""}${p.pickupZones ? ` · трансфер: ${esc(p.pickupZones)}` : ""}</p>
      ${p.notes ? `<p>${esc(p.notes)}</p>` : ""}</article>`).join("")}</div></section>`);
  }

  if (item.kind === "rental") {
    const p = r.prices || {};
    const rows = [["День", p.day], ["Неделя", p.week], ["Месяц", p.month], ["Год", p.year]].filter(([, v]) => v);
    sections.push(`<section class="block"><h2>Тарифы</h2><table class="tariffs"><tbody>${rows.map(([k, v]) => `<tr><th scope="row">${k}</th><td>${baht(v)}</td></tr>`).join("")}</tbody></table></section>`);
    if (r.specs) sections.push(`<section class="block"><h2>Характеристики</h2><p>${esc(r.specs)}${r.fuel ? `<br>Топливо: ${esc(r.fuel)}` : ""}</p></section>`);
  }

  if (r.itinerary?.length) {
    sections.push(`<section class="block"><h2>Расписание дня</h2><ol class="timeline">${r.itinerary.map((s) => `<li><time>${esc(s.time)}</time><span>${esc(s.activity)}</span></li>`).join("")}</ol></section>`);
  }

  const included = r.included?.length ? `<section class="block"><h2>Что включено</h2>${list(r.included)}</section>` : "";
  const bring = r.bring?.length ? `<section class="block"><h2>Что взять с собой</h2>${list(r.bring)}</section>` : "";
  if (included && bring) sections.push(`<div class="two-col">${included}${bring}</div>`);
  else sections.push(included, bring);

  if (r.requirements?.length) sections.push(`<section class="block"><h2>Требования</h2>${list(r.requirements)}</section>`);
  if (r.notes) sections.push(`<section class="block note"><h2>Важно знать</h2><p>${esc(r.notes)}</p></section>`);

  const body = `<div class="container detail">
  ${breadcrumbs(trail)}
  <div class="detail-head">
    <p class="card-tag">${esc(GROUPS[item.group].label)}</p>
    <h1>${esc(item.title)}</h1>
    <p class="lead">${esc(item.overview)}</p>
  </div>
  <div class="gallery gallery-${gallery.length}">${gallery.map((src, i) => `<img src="${esc(src)}" alt="${i === 0 ? esc(item.title) : ""}" width="1200" height="800"${i === 0 ? ' fetchpriority="high"' : ' loading="lazy"'} decoding="async" onerror="this.onerror=null;this.src='${FALLBACK_IMAGE}'" />`).join("")}</div>
  ${facts.length ? `<ul class="facts-bar">${facts.map(([icon, k, v]) => `<li>${icon}<span><small>${k}</small>${esc(v)}</span></li>`).join("")}</ul>` : ""}
  <div class="detail-layout">
    <div class="detail-main">${sections.join("\n")}</div>
    ${bookingCard(item)}
  </div>
</div>
<div class="mobile-bar"><p>${item.priceFrom ? `<small>от</small> <strong>${baht(item.priceFrom)}</strong>` : ""}</p><a class="btn btn-primary" href="#book">Выбрать дату</a></div>`;

  const offers = item.kind === "excursion" && r.programs.length
    ? r.programs.map((p) => ({ "@type": "Offer", name: p.title, price: p.price, priceCurrency: "THB", url: `${SITE_URL}${item.url}` }))
    : { "@type": "Offer", price: item.priceFrom, priceCurrency: "THB", url: `${SITE_URL}${item.url}` };
  const provider = { "@type": "TravelAgency", name: site.name, url: SITE_URL };
  const main = item.kind === "excursion"
    ? { "@type": "TouristTrip", name: item.title, description: item.overview || item.description, image: gallery.map((g) => (g.startsWith("http") ? g : SITE_URL + g)), touristType: "Туристы на Пхукете", provider, offers }
    : item.kind === "rental"
      ? { "@type": "Product", name: item.title, description: item.overview || item.description, image: gallery.filter((g) => g.startsWith("http")), brand: { "@type": "Organization", name: site.name }, offers: { ...offers, availability: "https://schema.org/InStock" } }
      : { "@type": "Service", name: item.title, description: item.overview || item.description, provider, areaServed: { "@type": "Place", name: "Phuket, Thailand" }, offers };

  const labelWord = { excursion: "Экскурсия", rental: "Аренда", service: "Услуга" }[item.kind];
  return page({
    title: `${item.title}: цена и заявка | ${site.name}`,
    description: `${item.overview || item.description} ${item.priceFrom ? `От ${baht(item.priceFrom)} ${item.priceUnit}.` : ""} ${labelWord} на Пхукете, заявка онлайн.`.replace(/\s+/g, " ").trim().slice(0, 300),
    path: item.url,
    body,
    ogImage: gallery[0].startsWith("http") ? gallery[0] : "/og.jpg",
    schema: [{ "@context": "https://schema.org", ...main }, breadcrumbSchema(trail.map((t, i) => (i === trail.length - 1 ? { ...t, href: item.url } : t)))]
  });
}

/* ---------- cart & static pages ---------- */

function cartPage() {
  const body = `<section class="page-head"><div class="container"><h1>Корзина</h1><p class="lead" data-cart-lead>Проверьте выбранное и оставьте контакты. Менеджер напишет вам в удобный мессенджер.</p></div></section>
<section class="section section-flush">
  <div class="container cart-layout" data-cart-root>
    <div class="cart-empty" data-cart-empty hidden>
      <h2>В корзине пока пусто</h2>
      <p>Выберите экскурсию, дату и количество гостей, и она появится здесь.</p>
      <a class="btn btn-primary" href="/excursions/">Выбрать экскурсию</a>
    </div>
    <div class="cart-items" data-cart-items hidden>
      <ul class="cart-list" data-cart-list></ul>
      <a class="back-link" href="/excursions/" data-back-to-catalog>${ICONS.arrow}<span>Выбрать ещё</span></a>
    </div>
    <form class="checkout" data-checkout novalidate hidden>
      <h2>Ваши контакты</h2>
      <label class="field"><span>Имя и фамилия</span><input name="name" type="text" autocomplete="name" required /></label>
      <label class="field"><span>Номер телефона</span><input name="phone" type="tel" autocomplete="tel" placeholder="+7 ..." required /></label>
      <fieldset class="method">
        <legend>Где вам написать?</legend>
        <label class="method-option"><input type="radio" name="method" value="whatsapp" checked /><span>${ICONS.wa}WhatsApp</span></label>
        <label class="method-option"><input type="radio" name="method" value="telegram" /><span>${ICONS.tg}Telegram</span></label>
      </fieldset>
      <label class="field" data-nick-field hidden><span>Ник в Telegram (если есть)</span><input name="nick" type="text" placeholder="@nickname" autocomplete="off" /></label>
      <label class="field"><span>Отель для трансфера <em>(необязательно)</em></span><input name="hotel" type="text" placeholder="Название отеля" /></label>
      <label class="field"><span>Комментарий <em>(необязательно)</em></span><textarea name="comment" rows="2"></textarea></label>
      <input class="trap" name="website" type="text" tabindex="-1" autocomplete="off" aria-hidden="true" />
      <button class="btn btn-primary btn-block" type="submit" data-submit>Отправить заявку</button>
      <p class="form-note" data-note role="status" aria-live="polite"></p>
      <p class="booking-note">Это заявка, не оплата. Менеджер подтвердит места и детали, рабочие часы ${esc(site.hours)}.</p>
    </form>
  </div>
</section>
<dialog class="modal" data-done-dialog aria-labelledby="doneTitle">
  <div class="modal-card">
    <span class="done-icon">${ICONS.check}</span>
    <h2 id="doneTitle">Заявка отправлена</h2>
    <p>Менеджер свяжется с вами в ближайшие рабочие часы (${esc(site.hours)}) в <strong data-done-method>WhatsApp</strong>.</p>
    <a class="btn btn-primary btn-block" href="/excursions/" data-back-to-catalog>Вернуться к экскурсиям</a>
  </div>
</dialog>`;

  return page({ title: `Корзина | ${site.name}`, description: "Ваша заявка на экскурсии.", path: "/cart.html", body, noindex: true, bodyClass: "page-cart" });
}

function textPage(file, h1, pagePath, description) {
  const body = `<section class="page-head"><div class="container narrow">${breadcrumbs([{ name: "Главная", href: "/" }, { name: h1 }])}<h1>${esc(h1)}</h1></div></section>
<section class="section section-flush"><div class="container narrow prose">${read("content", file)}</div></section>`;
  return page({ title: `${h1} | ${site.name}`, description, path: pagePath, body });
}

function quizPage() {
  const quiz = readJson("data", "quiz.json");
  const bySlug = new Map(items.map((i) => [i.slug, i]));
  const used = new Set();
  Object.values(quiz.nodes).forEach((node) => node.answers.forEach((a) => (a.result || []).forEach((slug) => used.add(slug))));
  [...(quiz.rules.fallback || []), ...Object.values(quiz.rules).flatMap((r) => r.exclude || [])].forEach((slug) => used.add(slug));
  used.forEach((slug) => {
    if (!bySlug.has(slug)) throw new Error(`quiz.json: нет позиции со slug "${slug}"`);
  });
  Object.values(quiz.nodes).forEach((node) => node.answers.forEach((a) => {
    if (a.next && !quiz.nodes[a.next]) throw new Error(`quiz.json: нет узла "${a.next}"`);
  }));

  const chat = [
    waLink ? `<a class="btn btn-ghost" href="${waLink}" target="_blank" rel="noopener">${ICONS.wa}WhatsApp</a>` : "",
    tgLink ? `<a class="btn btn-ghost" href="${tgLink}" target="_blank" rel="noopener">${ICONS.tg}Telegram</a>` : ""
  ].join("");

  const body = `<section class="page-head"><div class="container narrow">${breadcrumbs([{ name: "Главная", href: "/" }, { name: "Подбор экскурсии" }])}<h1>Подбор экскурсии</h1><p class="lead">Ответьте на несколько вопросов: покажем программы, которые подходят именно вам.</p></div></section>
<section class="section section-flush">
  <div class="container narrow quiz" data-quiz>
    <div class="quiz-card" data-quiz-stage>
      <div class="quiz-top"><button class="link-btn" type="button" data-quiz-back hidden>← Назад</button><span class="quiz-step" data-quiz-step></span></div>
      <h2 data-quiz-question></h2>
      <p class="quiz-hint" data-quiz-hint hidden></p>
      <div class="quiz-answers" data-quiz-answers></div>
    </div>
    <div class="quiz-result" data-quiz-result hidden>
      <h2 data-quiz-title>Подходит вам</h2>
      <p class="lead" data-quiz-note hidden></p>
      <div class="grid quiz-grid">${[...used].map((slug) => `<div data-quiz-slug="${esc(slug)}" hidden>${card(bySlug.get(slug))}</div>`).join("")}</div>
      <div class="quiz-actions"><button class="btn btn-ghost" type="button" data-quiz-restart>Пройти заново</button>${chat ? `<span class="quiz-help">Нужна помощь с выбором?</span>${chat}` : ""}</div>
    </div>
    <script type="application/json" id="quiz-data">${JSON.stringify(quiz).replace(/</g, "\\u003c")}</script>
  </div>
</section>`;

  return page({
    title: `Подбор экскурсии на Пхукете за 30 секунд | ${site.name}`,
    description: "Квиз-подбор экскурсии на Пхукете: ответьте на несколько вопросов и получите подходящие программы с учётом возраста детей и состояния здоровья.",
    path: "/quiz/",
    body,
    schema: [breadcrumbSchema([{ name: "Главная", href: "/" }, { name: "Подбор экскурсии", href: "/quiz/" }])]
  });
}

function notFoundPage() {
  const body = `<section class="page-head"><div class="container narrow"><h1>Страница не найдена</h1><p class="lead">Возможно, адрес устарел. Вернитесь в каталог и выберите экскурсию.</p><p><a class="btn btn-primary" href="/excursions/">Открыть каталог</a></p></div></section>`;
  return page({ title: `404 | ${site.name}`, description: "Страница не найдена.", path: "/404.html", body, noindex: true });
}

/* ---------- build ---------- */

function build() {
  fs.rmSync(DIST, { recursive: true, force: true });
  copyDir(path.join(ROOT, "static"), DIST);
  fs.mkdirSync(path.join(DIST, "assets"), { recursive: true });
  fs.copyFileSync(path.join(ROOT, "src", "styles", "main.css"), path.join(DIST, "assets", "main.css"));
  fs.copyFileSync(path.join(ROOT, "src", "scripts", "site.js"), path.join(DIST, "assets", "site.js"));

  write("index.html", homePage());
  catalogPages();
  items.forEach((item) => write(item.url.replace(/^\//, ""), detailPage(item)));
  write("cart.html", cartPage());
  write("quiz/index.html", quizPage());
  write("privacy.html", textPage("privacy.html", "Политика конфиденциальности", "/privacy.html", "Как мы обрабатываем данные, которые вы указываете в заявке."));
  write("refund-policy.html", textPage("refund-policy.html", "Условия возврата", "/refund-policy.html", "Условия отмены, переноса и возврата для экскурсий и услуг."));
  write("404.html", notFoundPage());

  const urls = ["/", "/excursions/", ...activeGroups.filter((k) => ["sea", "land", "show"].includes(k)).map((k) => GROUPS[k].href), "/rental/", "/services/", "/quiz/", ...items.map((i) => i.url), "/privacy.html", "/refund-policy.html"];
  write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${SITE_URL}${u}</loc><lastmod>${TODAY}</lastmod></url>`).join("\n")}\n</urlset>\n`);
  write("robots.txt", `User-agent: *\nAllow: /\nDisallow: /cart.html\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);

  console.log(`Собрано: ${urls.length + 2} страниц -> dist/`);
}

build();
