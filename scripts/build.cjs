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
  ig: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" d="M7.5 3h9A4.5 4.5 0 0 1 21 7.5v9a4.5 4.5 0 0 1-4.5 4.5h-9A4.5 4.5 0 0 1 3 16.5v-9A4.5 4.5 0 0 1 7.5 3Zm4.5 5.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"/><circle cx="17.2" cy="6.8" r="1.1" fill="currentColor"/></svg>',
  pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"/></svg>'
};

/* ---------- data ---------- */

const GROUPS = {
  islands: { label: "Море и острова", short: "Море", emoji: "🏝", href: "/excursions/islands.html", seo: ["Морские экскурсии на Пхукете: Пхи-Пхи, Джеймс Бонд, Рача, дайвинг", "Морские экскурсии с Пхукета: Пхи-Пхи и бухта Майя, остров Джеймса Бонда, Рача и Корал, катамараны, дайвинг и рыбалка. Цены для взрослых и детей, заявка онлайн.", "Пхи-Пхи, Джеймс Бонд, Краби, Рача, дайвинг и рыбалка: цены для взрослых и детей в батах."] },
  land: { label: "Наземные туры", short: "Суша", emoji: "🌿", href: "/excursions/land.html", seo: ["Наземные экскурсии на Пхукете: сити-тур, Чео Лан, слоны, аквапарк", "Наземные туры с Пхукета: обзорная по острову, озеро Чео Лан, Као Лак, слоны, Аватар, рафтинг и зиплайн, аквапарк Andamanda. Цены и заявка онлайн.", "Обзорная экскурсия, Чео Лан, джунгли, слоны, рафтинг и аквапарк."] },
  show: { label: "Шоу и вечер", short: "Шоу", emoji: "🎭", href: "/excursions/show.html", seo: ["Шоу на Пхукете: Fantasea, Siam Niramit, Carnaval Magic, тайский бокс", "Вечерние шоу Пхукета: Fantasea, Siam Niramit, Carnaval Magic, Simon Cabaret и тайский бокс. Билеты со сборами, цены для взрослых и детей, заявка онлайн.", "Fantasea, Siam Niramit, Carnaval Magic, кабаре и тайский бокс."] },
  visa: { label: "Бордеран и визаран", short: "Бордеран", emoji: "🛂", href: "/services/#visa" },
  rental: { label: "Аренда транспорта", short: "Аренда", emoji: "🛵", href: "/rental/" },
  other: { label: "Услуги", short: "Услуги", emoji: "🚐", href: "/services/#other" }
};
const EXCURSION_GROUPS = ["islands", "land", "show"];

const TAG_WORDS = {
  islands: "острова остров", snorkel: "снорклинг", diving: "дайвинг", kayak: "каяки каноэ", dawn: "рассвет", sunset: "закат",
  wildlife: "животные дикая природа", elephants: "слоны слон", dolphins: "дельфины дельфинарий", nature: "природа джунгли водопады озеро", culture: "город храмы культура", adventure: "адреналин экстрим",
  family: "семья дети", show: "шоу вечер", premium: "премиум vip комфорт катамаран", multiday: "с ночёвкой несколько дней", abroad: "другая страна", action: "гидроцикл рафтинг квадроцикл зиплайн",
  fishing: "рыбалка", flight: "полёт небо", relax: "отдых спа", beach: "пляж", bay: "пханг нга джеймс бонд краби", calm: "спокойно", views: "виды панорама"
};

const DAY_LABELS = { daily: "ежедневно", mon: "пн", tue: "вт", wed: "ср", thu: "чт", fri: "пт", sat: "сб", sun: "вс" };
const FALLBACK_IMAGE = "/placeholder.svg";

// «Название — 1 200 / 800 ฿» и «1 200 / 800 ฿ — название»
const OPTION_RE = /^(.{2,60}?)\s+[—–-]\s+(\d[\d\s\u00a0/]*\u00a0?฿(?:\s*\([^)]{0,40}\))?)/;
const OPTION_RE_PRICE_FIRST = /^(\d[\d\s\u00a0/]*\u00a0?฿(?:\s*\([^)]{0,40}\))?)\s+[—–-]\s+(.{2,80})$/;

function deriveOptions(lines) {
  const found = (lines || [])
    .filter((l) => !/^(Взрослый|Детский|Одноместное|Доплат)/.test(l))
    .map((l) => {
      const a = l.match(OPTION_RE_PRICE_FIRST);
      if (a) return { title: a[2].trim(), label: a[1].trim() };
      const b = l.match(OPTION_RE);
      return b ? { title: b[1].trim(), label: b[2].trim() } : null;
    })
    .filter(Boolean);
  return found.length >= 2 ? found : [];
}

const optionLabel = (p) => (p.priceLabel && p.priceLabel.length <= 42 ? p.priceLabel : p.price ? `от ${baht(p.price)}` : "");

function normExcursion(raw, index) {
  const programs = (raw.programs || []).map((p) => ({
    ...p,
    priceLabel: bahtText(p.priceLabel || ""),
    priceLines: (p.priceLines || []).map(bahtText),
    extras: (p.extras || []).map(bahtText),
    notes: (p.notes || []).map(bahtText)
  }));
  const priceLines = (raw.priceLines || []).map(bahtText);
  const options = programs.length
    ? programs.map((p) => ({ title: p.title, label: optionLabel(p), departure: "" }))
    : deriveOptions(priceLines);

  return {
    kind: "excursion",
    group: GROUPS[raw.category] ? raw.category : "land",
    id: raw.slug,
    slug: raw.slug,
    url: `/excursions/${raw.slug}.html`,
    title: raw.title,
    overview: raw.overview || "",
    description: raw.description || [],
    images: (raw.images || []).filter(Boolean),
    priceFrom: Number(raw.price) || 0,
    priceUnit: raw.priceUnit || "за человека",
    childPrice: Number(raw.childPrice) || 0,
    fromPrice: Boolean(raw.fromPrice),
    schedule: raw.schedule || "",
    duration: raw.duration || "",
    badge: raw.badge || "",
    tags: raw.tags || [],
    minAge: raw.minAge || 0,
    restrictions: raw.restrictions || [],
    rank: index,
    options,
    raw: { ...raw, programs, priceLines, extras: (raw.extras || []).map(bahtText), notes: (raw.notes || []).map(bahtText) }
  };
}

function loadItems() {
  const excursions = readJson("data", "excursions.json").excursions || [];
  const rentals = readJson("data", "rentals.json").rentals || [];
  const services = readJson("data", "services.json").services || [];
  const items = excursions.map(normExcursion);

  services.forEach((raw, n) => {
    items.push({
      kind: "service", group: raw.category === "border-run" ? "visa" : "other", id: raw.id, slug: raw.slug || raw.id,
      url: `/services/${raw.slug || raw.id}.html`, title: raw.title, overview: raw.overview || "", description: raw.description ? [raw.description] : [],
      images: (raw.images || []).filter(Boolean), priceFrom: Number(raw.priceFrom) || 0, priceUnit: raw.unit || "", duration: raw.duration || "",
      badge: "", tags: raw.tags || [], minAge: 0, restrictions: [], rank: 500 + n, options: [], raw
    });
  });

  rentals.forEach((raw, n) => {
    items.push({
      kind: "rental", group: "rental", id: raw.id, slug: raw.slug || raw.id, url: `/rental/${raw.slug || raw.id}.html`,
      title: raw.title, overview: raw.overview || "", description: raw.description ? [raw.description] : [], images: (raw.images || []).filter(Boolean),
      priceFrom: Number(raw.prices?.day) || 0, priceUnit: "в день", duration: "", badge: "", tags: raw.tags || [], minAge: 0, restrictions: [],
      rank: 800 + n, options: [], raw
    });
  });

  return items.sort((a, b) => a.rank - b.rank);
}

const items = loadItems();
const itemsOf = (group) => items.filter((item) => item.group === group);
const activeGroups = Object.keys(GROUPS).filter((key) => itemsOf(key).length);
const image = (item) => item.images[0] || "";

/* ---------- layout pieces ---------- */

const contacts = site.contacts || {};
const waNumber = String(contacts.whatsapp || "").replace(/\D/g, "");
const tgUser = String(contacts.telegram || "").replace(/^@+/, "");
const waLink = waNumber ? `https://wa.me/${waNumber}` : "";
const tgLink = tgUser ? `https://t.me/${tgUser}` : "";
const igLink = contacts.instagram || "";
const address = site.address || {};
const mapQuery = encodeURIComponent(address.line || "");
const mapEmbed = `https://www.google.com/maps?q=${mapQuery}&output=embed`;
const mapLink = `https://www.google.com/maps/search/?api=1&query=${mapQuery}`;

const clientConfig = {
  endpoint: site.orders?.endpoint || "",
  whatsapp: waNumber,
  telegram: tgUser,
  hours: site.hours
};

const ASSET_CSS = `/assets/main.css?v=${hash(read("src", "styles", "main.css"))}`;
const ASSET_JS = `/assets/site.js?v=${hash(read("src", "scripts", "site.js"))}`;

const excursionGroups = EXCURSION_GROUPS.filter((key) => itemsOf(key).length);
const hasGroup = (key) => itemsOf(key).length > 0;

function header() {
  const drop = excursionGroups.map((key) => `<a role="menuitem" href="${GROUPS[key].href}"><span aria-hidden="true">${GROUPS[key].emoji}</span>${esc(GROUPS[key].label)}</a>`).join("");
  const nav = `<div class="nav-drop" data-drop>
      <button class="nav-drop-btn" type="button" aria-haspopup="true" aria-expanded="false" data-drop-btn>Экскурсии<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="m6 9 6 6 6-6"/></svg></button>
      <div class="nav-panel" role="menu"><a role="menuitem" href="/excursions/"><strong>Все экскурсии</strong></a>${drop}</div>
    </div>
    ${hasGroup("visa") ? `<a href="/services/#visa">Бордеран</a>` : ""}
    ${hasGroup("rental") ? `<a href="/rental/">Аренда</a>` : ""}
    <a href="/services/">Услуги</a>
    <a class="nav-quiz" href="/quiz/">Подобрать тур</a>`;
  const messengers = [
    igLink ? `<a class="chat-btn chat-ig" href="${igLink}" target="_blank" rel="noopener" aria-label="Instagram">${ICONS.ig}<span>Instagram</span></a>` : "",
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
  const catalogLinks = [...excursionGroups, "visa", "rental", "other"].filter(hasGroup).map((key) => `<a href="${GROUPS[key].href}">${esc(GROUPS[key].label)}</a>`).join("");
  const links = [
    waLink ? `<a href="${waLink}" target="_blank" rel="noopener">WhatsApp</a>` : "",
    tgLink ? `<a href="${tgLink}" target="_blank" rel="noopener">Telegram</a>` : "",
    igLink ? `<a href="${igLink}" target="_blank" rel="noopener">Instagram</a>` : "",
    contacts.email ? `<a href="mailto:${esc(contacts.email)}">${esc(contacts.email)}</a>` : ""
  ].join("");

  return `<footer class="site-footer">
  <div class="container footer-grid">
    <div class="footer-brand">
      <img src="/logo.webp" alt="${esc(site.name)}" width="96" height="96" loading="lazy" />
      <p>${esc(site.tagline)}. Подтверждаем заявки вручную, пишем в WhatsApp или Telegram.</p>
    </div>
    <nav class="footer-col" aria-label="Каталог"><h3>Каталог</h3>${catalogLinks}</nav>
    <nav class="footer-col" aria-label="Документы"><h3>Документы</h3><a href="/quiz/">Подбор экскурсии</a><a href="/privacy.html">Политика конфиденциальности</a><a href="/refund-policy.html">Условия возврата</a></nav>
    <div class="footer-col"><h3>Связь</h3>${links}<a href="${mapLink}" target="_blank" rel="noopener">${esc(address.street || "")}, Патонг</a><p class="muted-light">Заявки: ${esc(site.hours)}. Офисы: ${esc(site.officeHours)}</p></div>
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
  <script>document.documentElement.classList.add("js");</script>
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

const cover = (item, extra = "") => item.images[0]
  ? `<img src="${esc(item.images[0])}" alt="" width="800" height="600" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='${FALLBACK_IMAGE}'" />`
  : `<span class="cover cover-${item.group} ${extra}" aria-hidden="true"><i>${GROUPS[item.group].emoji}</i></span>`;

function card(item, index = 0, initial = Infinity) {
  const search = [item.title, item.overview, GROUPS[item.group].label, ...item.tags.map((t) => TAG_WORDS[t] || t)]
    .join(" ").toLowerCase().replace(/ё/g, "е");
  const price = item.priceFrom
    ? `<p class="card-price">${item.fromPrice ? "<small>от</small> " : ""}${baht(item.priceFrom)} <small>${esc(item.priceUnit)}</small>${item.childPrice ? `<span class="card-child">дети ${baht(item.childPrice)}</span>` : ""}</p>`
    : `<p class="card-price">Цена по запросу</p>`;

  return `<article class="card" data-card data-group="${item.group}" data-search="${esc(search)}"${index >= initial ? " data-extra" : ""}>
  <a class="card-media" href="${item.url}" tabindex="-1" aria-hidden="true">${cover(item)}${item.badge ? `<span class="badge">${esc(item.badge)}</span>` : ""}</a>
  <div class="card-body">
    <p class="card-tag">${esc(GROUPS[item.group].label)}</p>
    <h3 class="card-title"><a href="${item.url}">${esc(item.title)}</a></h3>
    <p class="card-text">${esc(item.overview)}</p>
    <div class="card-foot">${price}${item.duration || item.schedule ? `<span class="card-meta">${ICONS.clock}${esc([item.duration, item.schedule].filter(Boolean).join(" · "))}</span>` : ""}</div>
  </div>
</article>`;
}

function catalog({ list, chips, activeKey, scope, initial = 12, searchPlaceholder = "Например: Пхи-Пхи, слоны, дайвинг, закат" }) {
  const chipHtml = chips.map((chip) => `<a class="chip${chip.key === activeKey ? " is-active" : ""}" href="${chip.href}" data-chip="${chip.key}"${chip.key === activeKey ? ' aria-current="true"' : ""}>${esc(chip.label)}<small>${chip.count}</small></a>`).join("");
  const more = list.length > initial
    ? `<div class="more"><button class="btn btn-ghost" type="button" data-more>Показать ещё</button></div>`
    : "";

  return `<div class="catalog" data-catalog data-scope="${scope}" data-initial="${initial}">
  <div class="catalog-tools">
    <div class="chips" role="navigation" aria-label="Категории">${chipHtml}</div>
    <label class="search"><span class="visually-hidden">Поиск по каталогу</span>${ICONS.search}<input type="search" placeholder="${esc(searchPlaceholder)}" data-search-input autocomplete="off" /></label>
  </div>
  <div class="grid" data-grid>${list.map((item, i) => card(item, i, initial)).join("\n")}</div>
  ${more}
  <p class="empty" data-empty hidden>Ничего не нашли. Попробуйте другое слово или напишите нам: подскажем маршрут.</p>
</div>`;
}

const groupChips = (keys, hrefAll, hrefOf) => [
  { key: "all", label: "Все", href: hrefAll, count: keys.reduce((sum, k) => sum + itemsOf(k).length, 0) },
  ...keys.map((k) => ({ key: k, label: GROUPS[k].short, href: hrefOf(k), count: itemsOf(k).length }))
];

const itemListSchema = (list, name) => ({
  "@context": "https://schema.org",
  "@type": "ItemList",
  name,
  itemListElement: list.slice(0, 50).map((item, i) => ({ "@type": "ListItem", position: i + 1, url: `${SITE_URL}${item.url}`, name: item.title }))
});

/* ---------- home ---------- */

const FAQ = [
  ["Как быстро вы подтверждаете заявку?", `Заявки принимаем ${site.hours}, менеджер отвечает в WhatsApp или Telegram в ближайшее время. Офисы в Патонге и Кате работают ${site.officeHours} по времени Пхукета.`],
  ["Как понять, что заявка принята?", "После отправки вы увидите подтверждение на сайте. Затем менеджер напишет вам в WhatsApp или Telegram, в зависимости от того, что вы выбрали."],
  ["Нужна ли оплата при оформлении заявки?", "Нет. Заявка не является оплатой: менеджер сначала подтвердит наличие мест, детали трансфера и порядок оплаты."],
  ["Можно ли изменить дату после оформления?", "Обычно да, при наличии мест. Напишите менеджеру как можно раньше, чтобы мы закрепили новый слот."],
  ["В какой валюте указаны цены?", "Цены указаны в тайских батах (฿), отдельно для взрослых и детей. Окончательную стоимость и порядок оплаты подтверждает менеджер после заявки."],
  ["Какие экскурсии подходят для отдыха с детьми?", "Семьям чаще подходят аквапарк, шоу Carnaval Magic и Fantasea, Као Лак и наземные туры. Возраст детей укажите в комментарии или пройдите подбор: он учтёт ограничения. На морских турах для беременных действуют ограничения, предупредите менеджера заранее."],
  ["В какие месяцы лучше ехать на экскурсии?", "Наиболее стабильная погода обычно с ноября по апрель. С мая по октябрь туры тоже проходят, но программа может меняться из-за погоды и состояния моря."],
  ["За сколько дней лучше бронировать?", "Рекомендуем за 2–5 дней, а в высокий сезон и на популярные маршруты за 5–7 дней: так больше шансов выбрать удобную дату."]
];

function contactSection() {
  const buttons = [
    waLink ? `<a class="btn btn-ghost" href="${waLink}" target="_blank" rel="noopener">${ICONS.wa}WhatsApp</a>` : "",
    tgLink ? `<a class="btn btn-ghost" href="${tgLink}" target="_blank" rel="noopener">${ICONS.tg}Telegram</a>` : "",
    igLink ? `<a class="btn btn-ghost" href="${igLink}" target="_blank" rel="noopener">${ICONS.ig}Instagram</a>` : ""
  ].join("");

  return `<section class="section" id="contacts">
  <div class="container contact-grid">
    <div class="contact-info">
      <p class="eyebrow">Как нас найти</p>
      <h2>Заходите в гости или напишите</h2>
      <p class="lead">${esc(address.line || "")}</p>
      <p class="contact-hours">Офисы в Патонге и Кате: ежедневно ${esc(site.officeHours)} (время Пхукета). Заявки и сообщения: ${esc(site.hours)}.</p>
      <div class="contact-actions">${buttons}</div>
      <a class="map-link" href="${mapLink}" target="_blank" rel="noopener">${ICONS.pin}<span>Открыть в Google Картах</span></a>
    </div>
    <div class="map-frame"><iframe title="Наш адрес на карте: ${esc(address.street || "")}, Патонг" src="${mapEmbed}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe></div>
  </div>
</section>`;
}

function instagramStrip() {
  if (!igLink) return "";
  return `<section class="section-tight"><div class="container"><a class="ig-strip" href="${igLink}" target="_blank" rel="noopener"><span class="ig-icon">${ICONS.ig}</span><span class="ig-text"><strong>Мы в Instagram</strong><small>@nikolai_phuket: фото и видео с наших маршрутов</small></span><span class="ig-go">${ICONS.arrow}</span></a></div></section>`;
}

function homePage() {
  const steps = [
    ["Выберите", "Откройте экскурсию, прочитайте программу и выберите дату и количество гостей."],
    ["Добавьте в корзину", "Можно собрать несколько экскурсий и отправить одной заявкой."],
    ["Менеджер напишет вам", "Подтвердим места и детали в WhatsApp или Telegram, как вам удобнее."]
  ];
  const facts = [
    [ICONS.users, "Русскоязычные гиды", "Работаем с проверенными партнёрами на острове"],
    [ICONS.pulse, "Прозрачные цены", "Стоимость в батах, цена для детей в программе"],
    [ICONS.clock, "Заявки 24/7", `Офисы в Патонге и Кате: ${site.officeHours}`],
    [ICONS.pin, "Трансфер из отеля", "Организуем из большинства районов Пхукета"]
  ];
  const quick = [...excursionGroups, "visa", "rental"].filter(hasGroup).slice(0, 6);

  const slides = (site.hero?.images || []).filter(Boolean);
  const SLIDE = 6; // секунд на кадр
  const frame = 100 / Math.max(slides.length, 1);
  const heroCss = slides.length > 1
    ? `<style>.hero-slides img{animation:heroFade ${slides.length * SLIDE}s infinite}${slides.map((_, i) => `.hero-slides img:nth-child(${i + 1}){animation-delay:${i * SLIDE}s}`).join("")}@keyframes heroFade{0%{opacity:0}${(frame * 0.12).toFixed(1)}%{opacity:1}${frame.toFixed(1)}%{opacity:1}${(frame * 1.12).toFixed(1)}%{opacity:0}100%{opacity:0}}</style>`
    : "";
  const slidesHtml = slides.length
    ? `<div class="hero-slides" aria-hidden="true">${slides.map((src, i) => `<img src="${esc(src)}" alt="" width="1920" height="1080"${i === 0 ? ' fetchpriority="high"' : ' loading="lazy"'} decoding="async" />`).join("")}</div>`
    : "";

  const body = `${heroCss}<section class="hero${slides.length ? " has-photo" : ""}">
  ${slidesHtml}
  <div class="container hero-inner">
    <p class="eyebrow">Пхукет · Таиланд</p>
    <h1>Экскурсии на Пхукете</h1>
    <p class="hero-lead">Острова, море и впечатления без хлопот. Выбирайте маршрут, добавляйте в корзину и отправляйте одну заявку: менеджер подтвердит места и напишет вам в WhatsApp или Telegram.</p>
    <form class="hero-search" role="search" data-hero-search>
      ${ICONS.search}
      <input type="search" name="q" placeholder="Куда хотите? Пхи-Пхи, Джеймс Бонд, слоны, дайвинг…" aria-label="Поиск экскурсии" autocomplete="off" />
      <button class="btn btn-primary" type="submit">Найти</button>
    </form>
    <div class="hero-quick"><a class="quick-quiz" href="/quiz/">Подобрать за 30 секунд</a>${quick.map((k) => `<a href="${GROUPS[k].href}" data-quick="${k}">${esc(GROUPS[k].short)}</a>`).join("")}</div>
  </div>
</section>

<section class="section" id="catalog">
  <div class="container">
    <div class="section-head"><p class="eyebrow">Каталог</p><h2>Что хотите сделать на острове?</h2></div>
    ${catalog({ list: items, chips: groupChips([...excursionGroups, "visa", "rental", "other"].filter(hasGroup), "/", (k) => GROUPS[k].href), activeKey: "all", scope: "all" })}
  </div>
</section>

<section class="section section-flush">
  <div class="container">
    <div class="quiz-banner">
      <div><p class="eyebrow">Подбор за 30 секунд</p><h2>Не знаете, что выбрать?</h2><p>Ответьте на 2–4 вопроса, и мы подскажем подходящие программы с учётом того, кто едет, и того, что вам хочется.</p></div>
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

${instagramStrip()}
${contactSection()}

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
      description: "Экскурсии на Пхукете, бордеран, трансферы и аренда транспорта. Офисы в Патонге и Кате.",
      address: { "@type": "PostalAddress", streetAddress: address.street, addressLocality: address.locality, addressRegion: address.region, postalCode: address.postalCode, addressCountry: address.country },
      hasMap: mapLink,
      areaServed: { "@type": "Place", name: "Phuket, Thailand" },
      openingHours: "Mo-Su 12:00-20:00",
      sameAs: [tgLink, waLink, igLink].filter(Boolean),
      email: contacts.email || undefined
    },
    { "@context": "https://schema.org", "@type": "WebSite", name: site.name, url: SITE_URL },
    { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) }
  ];

  return page({
    title: "Экскурсии на Пхукете: острова, Джеймс Бонд, шоу | Niko Phuket",
    description: "Лучшие экскурсии Пхукета с русским гидом: Пхи-Пхи, Джеймс Бонд, Краби, слоны, шоу, бордеран. Цены для взрослых и детей, заявка онлайн, ответ в WhatsApp или Telegram.",
    path: "/",
    body,
    schema
  });
}

/* ---------- catalog pages ---------- */

function catalogPage({ path: pagePath, h1, lead, title, description, list, chips, activeKey, scope, trail, initial = 12 }) {
  const body = `<section class="page-head">
  <div class="container">
    ${breadcrumbs(trail)}
    <h1>${esc(h1)}</h1>
    <p class="lead">${esc(lead)}</p>
  </div>
</section>
<section class="section section-flush">
  <div class="container">${catalog({ list, chips, activeKey, scope, initial })}</div>
</section>`;

  return page({ title, description, path: pagePath, body, schema: [breadcrumbSchema(trail), itemListSchema(list, h1)] });
}

function catalogPages() {
  const home = { name: "Главная", href: "/" };
  const excursions = items.filter((i) => i.kind === "excursion");
  const chips = groupChips(excursionGroups, "/excursions/", (k) => GROUPS[k].href);

  write("excursions/index.html", catalogPage({
    path: "/excursions/",
    h1: "Экскурсии на Пхукете",
    lead: "Море, наземные туры и вечерние шоу. Цены для взрослых и детей в батах, выберите маршрут, дату и количество гостей.",
    title: "Экскурсии на Пхукете: цены, программы, заявка онлайн | Niko Phuket",
    description: "Все основные экскурсии на Пхукете в одном каталоге: Пхи-Пхи, Джеймс Бонд, Краби, слоны, шоу. Цены в батах для взрослых и детей, заявка онлайн.",
    list: excursions,
    chips,
    activeKey: "all",
    scope: "all",
    trail: [home, { name: "Экскурсии" }]
  }));

  excursionGroups.forEach((key) => {
    const [title, description, lead] = GROUPS[key].seo;
    write(`excursions/${GROUPS[key].href.split("/").pop()}`, catalogPage({
      path: GROUPS[key].href,
      h1: GROUPS[key].label,
      lead,
      title: `${title} | Niko Phuket`,
      description,
      list: itemsOf(key),
      chips,
      activeKey: key,
      scope: key,
      trail: [home, { name: "Экскурсии", href: "/excursions/" }, { name: GROUPS[key].label }]
    }));
  });

  write("rental/index.html", catalogPage({
    path: "/rental/",
    h1: "Аренда транспорта на Пхукете",
    lead: "Скутеры и автомобили с доставкой к отелю. Яхты и катамараны смотрите в разделе Premium.",
    title: "Аренда скутера и автомобиля на Пхукете | Niko Phuket",
    description: "Аренда скутеров и автомобилей на Пхукете с доставкой к отелю. Цены за день, неделю и месяц, залог и условия на странице каждого предложения.",
    list: itemsOf("rental"),
    chips: [],
    activeKey: "all",
    scope: "all",
    trail: [home, { name: "Аренда" }]
  }));

  const services = [...itemsOf("visa"), ...itemsOf("other")];
  const servicesBody = `<section class="page-head"><div class="container">${breadcrumbs([home, { name: "Услуги" }])}<h1>Услуги: бордеран, Fast Track, трансферы</h1><p class="lead">Организованные выезды для визы, ускоренное прохождение аэропорта и частные трансферы.</p></div></section>
${["visa", "other"].filter(hasGroup).map((k) => `<section class="section section-flush" id="${k}"><div class="container"><h2 class="group-title">${esc(GROUPS[k].label)}</h2><div class="grid">${itemsOf(k).map((it) => card(it)).join("")}</div></div></section>`).join("")}`;

  write("services/index.html", page({
    title: "Бордеран, Fast Track и трансферы на Пхукете | Niko Phuket",
    description: "Бордеран на 1 день, Fast Track в аэропорту Пхукета, частные трансферы. Цены в батах, заявка онлайн, подтверждение менеджером.",
    path: "/services/",
    body: servicesBody,
    schema: [breadcrumbSchema([home, { name: "Услуги", href: "/services/" }]), itemListSchema(services, "Услуги")]
  }));
}

/* ---------- detail pages ---------- */

const DAYS = { daily: "ежедневно", mon: "пн", tue: "вт", wed: "ср", thu: "чт", fri: "пт", sat: "сб", sun: "вс" };
const dayText = (days) => (Array.isArray(days) ? days : []).map((d) => DAYS[d] || d).join(", ");
const checklist = (arr) => `<ul class="checklist">${arr.map((x) => `<li>${ICONS.check}<span>${esc(x)}</span></li>`).join("")}</ul>`;
const paragraphs = (arr) => arr.map((t) => `<p>${esc(t)}</p>`).join("");

/** Универсальный блок содержимого: цены, допы, текст, расписание, включено, взять, важно. */
function blockHtml(b, level) {
  const h = (text) => `<h${level}>${text}</h${level}>`;
  const out = [];
  if (b.priceLines?.length) out.push(`${h("Стоимость")}<ul class="pricelist">${b.priceLines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>`);
  if (b.extras?.length) out.push(`${h("Дополнительно")}<ul class="pricelist soft">${b.extras.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>`);
  if (b.text?.length) out.push(paragraphs(b.text));
  if (b.itinerary?.length) out.push(`${h("Как пройдёт день")}<ol class="timeline">${b.itinerary.map((s) => `<li><time>${esc(s.time)}</time><span>${esc(s.activity)}</span></li>`).join("")}</ol>`);
  if (b.included?.length) out.push(`${h("Что включено")}${checklist(b.included)}`);
  if (b.bring?.length) out.push(`${h("Что взять с собой")}${checklist(b.bring)}`);
  if (b.notes?.length) out.push(`<div class="note">${h("Важно знать")}${paragraphs(b.notes)}</div>`);
  return out.join("\n");
}

function programsHtml(item) {
  const programs = item.raw.programs || [];
  if (!programs.length) return "";
  return `<section class="block"><h2>Программы и стоимость</h2><div class="programs">${programs.map((p, i) => `<details class="program"${i === 0 ? " open" : ""}>
    <summary><span class="program-name">${esc(p.title)}</span><span class="program-price">${esc(optionLabel(p))}</span></summary>
    <div class="program-body">${p.departure ? `<p class="program-meta">Выезд ${esc(p.departure)}${p.days ? ` · ${esc(dayText(p.days))}` : ""}</p>` : ""}${blockHtml(p, 4)}</div>
  </details>`).join("")}</div></section>`;
}

function fleetLines(lines) {
  const out = [];
  let list = [];
  const flush = () => { if (list.length) { out.push(`<ul class="fleet-list">${list.join("")}</ul>`); list = []; } };
  lines.forEach((raw) => {
    const line = raw.replace(/^[\s\u2600-\u27BF\uFE0F\u200d\u{1F000}-\u{1FAFF}]+/u, "").trim();
    if (!line) return;
    if (/^[•·\-–]\s*/.test(line)) { list.push(`<li>${esc(line.replace(/^[•·\-–]\s*/, ""))}</li>`); return; }
    flush();
    out.push(/:$/.test(line) || (line === line.toUpperCase() && line.length < 60) ? `<h4>${esc(line.replace(/:$/, ""))}</h4>` : `<p>${esc(line)}</p>`);
  });
  flush();
  return out.join("");
}

function fleetHtml(item) {
  const fleet = item.raw.fleet || [];
  if (!fleet.length) return "";
  return `<section class="block"><h2>Суда, маршруты и цены</h2><div class="programs">${fleet.map((b, i) => `<details class="program"${i === 0 ? " open" : ""}>
    <summary><span class="program-name">${esc(b.title)}</span></summary>
    <div class="program-body">${b.photos ? `<p><a class="photo-link" href="${esc(b.photos)}" target="_blank" rel="noopener">Смотреть фото судна</a></p>` : ""}${fleetLines(b.lines || [])}</div>
  </details>`).join("")}</div></section>`;
}

function bookingFields(item) {
  const comment = (hint) => `<label class="field wide"><span>Комментарий</span><textarea name="comment" rows="2" placeholder="${esc(hint)}"></textarea></label>`;

  if (item.kind === "rental") {
    return `<label class="field"><span>Дата начала</span><input name="date" type="date" required /></label>
      <label class="field"><span>Срок аренды</span><input name="duration" type="text" placeholder="Например: 5 дней" required /></label>
      ${comment("Например: нужен детский шлем, доставка в отель")}`;
  }

  const hints = {
    excursion: "Возраст детей, особые пожелания",
    service: "Например: рейс SU275, прилёт 14:20"
  };
  return `<label class="field wide"><span>Желаемая дата</span><input name="date" type="date" required /></label>
      <label class="field"><span>Взрослые</span><input name="adults" type="number" min="1" max="60" value="2" required /></label>
      <label class="field"><span>Дети</span><input name="children" type="number" min="0" max="60" value="0" required /></label>
      ${comment(hints[item.kind] || hints.excursion)}`;
}

function bookingCard(item) {
  const options = item.options || [];
  const select = options.length
    ? `<label class="field wide"><span>${item.raw.programs?.length ? "Программа" : "Вариант"}</span><select name="program" required data-program>${options.map((o, i) => `<option value="${esc(o.title)}" data-price="${esc(o.label)}"${i === 0 ? " selected" : ""}>${esc(o.title)}${o.label ? ` · ${esc(o.label)}` : ""}</option>`).join("")}</select></label>`
    : "";
  const priceLine = options.length && options[0].label
    ? options[0].label
    : item.priceFrom ? `${baht(item.priceFrom)}${item.childPrice ? ` взр. · ${baht(item.childPrice)} дет.` : ` ${item.priceUnit}`}` : "По запросу";
  const lead = options.length && options[0].label ? "Стоимость" : item.priceFrom ? (item.fromPrice ? "от" : "Цена") : "Цена";
  const backHref = { excursion: "/excursions/", rental: "/rental/", service: "/services/" }[item.kind];

  return `<aside class="booking" id="book" data-booking-wrap>
  <div data-booking-form-wrap>
    <p class="booking-from">${lead}</p>
    <p class="booking-price" data-price-out>${esc(priceLine)}</p>
    <form class="booking-form" data-booking novalidate data-kind="${item.kind}" data-id="${esc(item.id)}" data-title="${esc(item.title)}" data-url="${item.url}" data-image="${esc(image(item))}" data-price="${esc(priceLine)}" data-group="${esc(GROUPS[item.group].label)}">
      <div class="form-grid">${select}${bookingFields(item)}</div>
      <button class="btn btn-primary btn-block" type="submit">Добавить в корзину</button>
      <p class="booking-note">Это заявка, не оплата. Менеджер подтвердит места и порядок оплаты в WhatsApp или Telegram.</p>
    </form>
  </div>
  <div class="booking-done" data-booking-done hidden>
    <span class="done-icon">${ICONS.check}</span>
    <h3>Добавлено в корзину</h3>
    <p data-done-count></p>
    <a class="btn btn-primary btn-block" href="/cart.html">Перейти в корзину</a>
    <a class="btn btn-ghost btn-block" href="${backHref}" data-back-to-catalog>Выбрать ещё</a>
    <button class="link-btn" type="button" data-add-another>Добавить ещё одну дату или программу</button>
  </div>
</aside>`;
}

function detailPage(item) {
  const r = item.raw;
  const base = { excursion: { name: "Экскурсии", href: "/excursions/" }, rental: { name: "Аренда", href: "/rental/" }, service: { name: "Услуги", href: "/services/" } }[item.kind];
  const trail = [{ name: "Главная", href: "/" }, base];
  if (item.kind === "excursion") trail.push({ name: GROUPS[item.group].label, href: GROUPS[item.group].href });
  trail.push({ name: item.title });

  const gallery = item.images.slice(0, 3);
  const facts = [];
  if (item.schedule) facts.push([ICONS.clock, "Выезды", item.schedule]);
  if (item.duration) facts.push([ICONS.clock, "Длительность", item.duration]);
  if (r.groupSize) facts.push([ICONS.users, "Группа", r.groupSize]);
  if (r.difficulty) facts.push([ICONS.pulse, "Нагрузка", r.difficulty]);
  if (item.minAge) facts.push([ICONS.users, "Возраст", `от ${item.minAge} ${item.minAge === 1 ? "года" : "лет"}`]);
  if (item.kind === "rental" && r.deposit) facts.push([ICONS.pulse, "Залог", bahtText(r.deposit)]);
  if (item.kind === "rental" && r.transmission) facts.push([ICONS.pin, "Коробка", r.transmission]);

  const sections = [];
  const desc = item.description.length ? item.description : [];
  if (desc.length) sections.push(`<section class="block"><h2>О программе</h2>${paragraphs(desc)}</section>`);

  if (item.kind === "rental") {
    const p = r.prices || {};
    const rows = [["День", p.day], ["Неделя", p.week], ["Месяц", p.month], ["Год", p.year]].filter(([, v]) => v);
    sections.push(`<section class="block"><h2>Тарифы</h2><table class="tariffs"><tbody>${rows.map(([k, v]) => `<tr><th scope="row">${k}</th><td>${baht(v)}</td></tr>`).join("")}</tbody></table></section>`);
    if (r.specs) sections.push(`<section class="block"><h2>Характеристики</h2><p>${esc(r.specs)}${r.fuel ? `<br>Топливо: ${esc(r.fuel)}` : ""}</p></section>`);
    if (r.included?.length) sections.push(`<section class="block"><h2>Что включено</h2>${checklist(r.included)}</section>`);
    if (r.requirements?.length) sections.push(`<section class="block"><h2>Требования</h2>${checklist(r.requirements)}</section>`);
    if (r.notes && typeof r.notes === "string") sections.push(`<section class="block note"><h2>Важно знать</h2><p>${esc(r.notes)}</p></section>`);
  } else if (item.kind === "service") {
    if (r.itinerary?.length) sections.push(`<section class="block"><h2>Расписание</h2><ol class="timeline">${r.itinerary.map((s) => `<li><time>${esc(s.time)}</time><span>${esc(s.activity)}</span></li>`).join("")}</ol></section>`);
    const inc = r.included?.length ? `<section class="block"><h2>Что включено</h2>${checklist(r.included)}</section>` : "";
    const bring = r.bring?.length ? `<section class="block"><h2>Что взять с собой</h2>${checklist(r.bring)}</section>` : "";
    sections.push(inc && bring ? `<div class="two-col">${inc}${bring}</div>` : inc || bring);
    if (r.requirements?.length) sections.push(`<section class="block"><h2>Требования</h2>${checklist(r.requirements)}</section>`);
    if (r.notes && typeof r.notes === "string") sections.push(`<section class="block note"><h2>Важно знать</h2><p>${esc(r.notes)}</p></section>`);
  } else {
    sections.push(programsHtml(item));
    sections.push(fleetHtml(item));
    const own = blockHtml({ priceLines: r.priceLines, extras: r.extras, itinerary: r.itinerary, included: r.included, bring: r.bring, notes: r.notes }, 3);
    if (own) sections.push(`<section class="block block-flow">${own}</section>`);
  }

  const heroCover = gallery.length
    ? `<div class="gallery gallery-${gallery.length}">${gallery.map((src, i) => `<img src="${esc(src)}" alt="${i === 0 ? esc(item.title) : ""}" width="1200" height="800"${i === 0 ? ' fetchpriority="high"' : ' loading="lazy"'} decoding="async" onerror="this.onerror=null;this.src='${FALLBACK_IMAGE}'" />`).join("")}</div>`
    : `<div class="cover-banner cover-${item.group}" aria-hidden="true"><i>${GROUPS[item.group].emoji}</i></div>`;

  const body = `<div class="container detail">
  ${breadcrumbs(trail)}
  <div class="detail-head">
    <p class="card-tag">${esc(GROUPS[item.group].label)}${item.badge ? ` · ${esc(item.badge)}` : ""}</p>
    <h1>${esc(item.title)}</h1>
    <p class="lead">${esc(item.overview)}</p>
  </div>
  ${heroCover}
  ${facts.length ? `<ul class="facts-bar">${facts.map(([icon, k, v]) => `<li>${icon}<span><small>${k}</small>${esc(v)}</span></li>`).join("")}</ul>` : ""}
  <div class="detail-layout">
    <div class="detail-main">${sections.filter(Boolean).join("\n")}</div>
    ${bookingCard(item)}
  </div>
</div>
<div class="mobile-bar"><p>${item.priceFrom ? `<small>${item.fromPrice ? "от" : "взр."}</small> <strong>${baht(item.priceFrom)}</strong>${item.childPrice ? ` <small>дет. ${baht(item.childPrice)}</small>` : ""}` : ""}</p><a class="btn btn-primary" href="#book">Выбрать дату</a></div>`;

  const provider = { "@type": "TravelAgency", name: site.name, url: SITE_URL };
  const offers = item.options.length && r.programs?.length
    ? r.programs.filter((p) => p.price).map((p) => ({ "@type": "Offer", name: p.title, price: p.price, priceCurrency: "THB", url: `${SITE_URL}${item.url}` }))
    : { "@type": "Offer", price: item.priceFrom, priceCurrency: "THB", url: `${SITE_URL}${item.url}` };
  const imgs = gallery.map((g) => (g.startsWith("http") ? g : SITE_URL + g));
  const main = item.kind === "rental"
    ? { "@type": "Product", name: item.title, description: item.overview || desc[0], image: imgs, brand: { "@type": "Organization", name: site.name }, offers: { ...offers, availability: "https://schema.org/InStock" } }
    : item.kind === "service"
      ? { "@type": "Service", name: item.title, description: item.overview || desc[0], image: imgs, provider, areaServed: { "@type": "Place", name: "Phuket, Thailand" }, offers }
      : { "@type": "TouristTrip", name: item.title, description: item.overview || desc[0], image: imgs, touristType: "Туристы на Пхукете", provider, offers };

  const priceNote = item.priceFrom ? ` ${item.fromPrice ? "От " : "Цена: "}${baht(item.priceFrom)} ${item.priceUnit}${item.childPrice ? `, дети ${baht(item.childPrice)}` : ""}.` : "";
  return page({
    title: `${item.title}: цена и заявка | ${site.name}`,
    description: `${item.overview || desc[0] || ""}${priceNote} Заявка онлайн, подтверждение менеджером.`.replace(/\s+/g, " ").trim().slice(0, 300),
    path: item.url,
    body,
    ogImage: gallery[0] ? (gallery[0].startsWith("http") ? gallery[0] : gallery[0]) : "/og.jpg",
    schema: [{ "@context": "https://schema.org", ...main }, breadcrumbSchema(trail.map((t, i) => (i === trail.length - 1 ? { ...t, href: item.url } : t)))]
  });
}

/* ---------- cart, static pages ---------- */

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
      <p class="booking-note">Это заявка, не оплата. Менеджер подтвердит места и порядок оплаты в WhatsApp или Telegram.</p>
    </form>
  </div>
</section>
<dialog class="modal" data-done-dialog aria-labelledby="doneTitle">
  <div class="modal-card">
    <span class="done-icon">${ICONS.check}</span>
    <h2 id="doneTitle">Заявка отправлена</h2>
    <p>Менеджер свяжется с вами в ближайшее время в <strong data-done-method>WhatsApp</strong>.</p>
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


function notFoundPage() {
  const body = `<section class="page-head"><div class="container narrow"><h1>Страница не найдена</h1><p class="lead">Возможно, адрес устарел. Вернитесь в каталог и выберите экскурсию.</p><p><a class="btn btn-primary" href="/excursions/">Открыть каталог</a></p></div></section>`;
  return page({ title: `404 | ${site.name}`, description: "Страница не найдена.", path: "/404.html", body, noindex: true });
}


/* ---------- quiz ---------- */

function quizPage() {
  const quiz = readJson("data", "quiz.json");
  const bySlug = new Map(items.map((i) => [i.slug, i]));
  const check = (slug, where) => { if (!bySlug.has(slug)) throw new Error(`quiz.json (${where}): нет позиции со slug "${slug}"`); };
  Object.entries(quiz.nodes).forEach(([id, node]) => node.answers.forEach((a) => {
    (a.result || []).forEach((slug) => check(slug, id));
    if (a.next && !quiz.nodes[a.next]) throw new Error(`quiz.json: нет узла "${a.next}"`);
    if (a.refine && !quiz.nodes[a.refine]) throw new Error(`quiz.json: нет узла "${a.refine}"`);
  }));
  (quiz.rules.fallback || []).forEach((slug) => check(slug, "fallback"));

  // компактный индекс позиций: карточки результатов рисуются на клиенте
  const index = items.map((i) => ({
    s: i.slug, t: i.title, u: i.url, i: image(i), o: i.overview.slice(0, 150), p: i.priceFrom, n: i.priceUnit, d: i.duration,
    g: i.group, l: GROUPS[i.group].label, e: GROUPS[i.group].emoji, tg: i.tags, a: i.minAge, r: i.restrictions, k: i.rank, b: i.badge
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
      <div class="grid quiz-grid" data-quiz-grid></div>
      <div class="quiz-actions"><button class="btn btn-ghost" type="button" data-quiz-restart>Пройти заново</button><a class="btn btn-ghost" href="/excursions/">Весь каталог</a>${chat ? `<span class="quiz-help">Нужна помощь с выбором?</span>${chat}` : ""}</div>
    </div>
    <script type="application/json" id="quiz-data">${JSON.stringify({ quiz, items: index }).replace(/</g, "\\u003c")}</script>
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

function redirectPage(from, to) {
  return `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><title>Страница переехала</title><meta name="robots" content="noindex"><link rel="canonical" href="${SITE_URL}${to}"><meta http-equiv="refresh" content="0; url=${to}"></head><body><p>Страница переехала: <a href="${to}">${to}</a></p></body></html>`;
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
  Object.entries(site.redirects || {}).forEach(([from, to]) => write(from.replace(/^\//, ""), redirectPage(from, to)));

  const urls = ["/", "/excursions/", ...excursionGroups.map((k) => GROUPS[k].href), "/rental/", "/services/", "/quiz/", ...items.map((i) => i.url), "/privacy.html", "/refund-policy.html"];
  write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${SITE_URL}${u}</loc><lastmod>${TODAY}</lastmod></url>`).join("\n")}\n</urlset>\n`);
  write("robots.txt", `User-agent: *\nAllow: /\nDisallow: /cart.html\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);

  console.log(`Собрано: ${urls.length + 3} страниц, позиций в каталоге: ${items.length} -> dist/`);
}

build();
