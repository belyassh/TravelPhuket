/* Niko Phuket: корзина заявок.
   Один файл без зависимостей. Подключается и на главной (через Vite), и на
   сгенерированных страницах (копия лежит в public/scripts/cart.js).

   Что делает:
   - форма на странице товара добавляет позицию в корзину (localStorage);
   - окно корзины собирает контакты клиента и отправляет заявку одним из способов:
       bot       -> POST на endpoint (Cloudflare Worker), заявка приходит в Telegram-бот
       telegram  -> текст копируется в буфер, открывается личка менеджера
       whatsapp  -> открывается wa.me с готовым текстом
   - window.NikoCart.openSelection() используется формой подбора на главной. */

const CART_KEY = "niko-travel:cart:v1";
const CUSTOMER_KEY = "niko-travel:customer:v1";
const MARKETING_KEY = "niko-travel:marketing-context";
const CONFIG_URL = "/order-config.json";
const MAX_ITEMS = 20;
const WA_URL_SOFT_LIMIT = 1800;

const TYPE_LABELS = { excursion: "Экскурсия", rental: "Аренда", service: "Услуга" };

let config = { endpoint: "", telegramManager: "", whatsappNumber: "" };
let items = sanitizeItems(readJson(CART_KEY, []));
let mode = "cart"; // "cart" | "selection"
let selection = null; // { lines, onSent }
let pendingOrderId = "";
let sending = false;
let dialog = null;
let toastTimer = 0;

const marketing = captureMarketing();
const configReady = loadConfig();

/* ---------- storage helpers ---------- */

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // приватный режим или переполнение: корзина просто не переживёт перезагрузку
  }
}

function sanitizeItems(list) {
  return Array.isArray(list)
    ? list.filter((item) => item && typeof item === "object" && typeof item.title === "string").slice(0, MAX_ITEMS)
    : [];
}

function todayLocal() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
}

function formatDate(iso) {
  const [year, month, day] = String(iso || "").split("-");
  return year && month && day ? `${day}.${month}.${year}` : String(iso || "");
}

/* ---------- config & marketing ---------- */

async function loadConfig() {
  try {
    const response = await fetch(CONFIG_URL, { cache: "no-store" });
    if (response.ok) {
      const data = await response.json();
      config = {
        endpoint: String(data.endpoint || "").trim(),
        telegramManager: String(data.telegramManager || "").replace(/^@+/, "").trim(),
        whatsappNumber: String(data.whatsappNumber || "").replace(/\D/g, "")
      };
    }
  } catch (error) {
    console.error("Не удалось загрузить order-config.json", error);
  }
}

function captureMarketing() {
  let existing = {};
  try {
    existing = JSON.parse(window.sessionStorage.getItem(MARKETING_KEY) || "{}") || {};
  } catch {
    existing = {};
  }

  const params = new URLSearchParams(window.location.search);
  const pick = (param, key) => params.get(param) || existing[key] || "";
  const context = {
    landingPage: existing.landingPage || window.location.href,
    lastPage: window.location.href,
    referrer: existing.referrer || document.referrer || "",
    utmSource: pick("utm_source", "utmSource"),
    utmMedium: pick("utm_medium", "utmMedium"),
    utmCampaign: pick("utm_campaign", "utmCampaign"),
    utmTerm: pick("utm_term", "utmTerm"),
    utmContent: pick("utm_content", "utmContent"),
    gclid: pick("gclid", "gclid"),
    fbclid: pick("fbclid", "fbclid"),
    yclid: pick("yclid", "yclid"),
    msclkid: pick("msclkid", "msclkid")
  };

  try {
    window.sessionStorage.setItem(MARKETING_KEY, JSON.stringify(context));
  } catch {
    // не критично
  }

  return context;
}

function trackEvent(name, params) {
  if (typeof window.gtag === "function") {
    window.gtag("event", name, params);
  }
}

/* ---------- cart operations ---------- */

function persist() {
  writeJson(CART_KEY, items);
  pendingOrderId = "";
  renderBadge();
  if (dialog && dialog.open) {
    renderCart();
  }
}

function addItem(data) {
  if (items.length >= MAX_ITEMS) {
    return false;
  }

  items.push({ id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, ...data });
  persist();
  return true;
}

function removeItem(id) {
  items = items.filter((item) => item.id !== id);
  persist();
}

function clearCart() {
  items = [];
  persist();
}

function renderBadge() {
  document.querySelectorAll("[data-cart-count]").forEach((node) => {
    node.textContent = String(items.length);
  });
}

/* ---------- add-to-cart forms on product pages ---------- */

function readField(form, name) {
  const field = form.elements.namedItem(name);
  return field && "value" in field ? String(field.value).trim() : "";
}

function bindCartForms() {
  document.querySelectorAll("form[data-cart-form]").forEach((form) => {
    const dateField = form.elements.namedItem("travelDate");
    if (dateField) {
      dateField.min = todayLocal();
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();

      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      const programSelect = form.elements.namedItem("selectedProgram");
      const option = programSelect && programSelect.selectedOptions ? programSelect.selectedOptions[0] : null;
      const type = form.dataset.itemType || "excursion";

      const added = addItem({
        type,
        title: form.dataset.itemTitle || "",
        url: form.dataset.itemUrl || "",
        program: option ? option.value : "",
        departure: option ? option.dataset.departure || "" : "",
        priceLabel: (option && option.dataset.price) || form.dataset.itemPrice || "",
        date: readField(form, "travelDate"),
        adults: Number(readField(form, "adultsCount")) || 0,
        children: Number(readField(form, "childrenCount")) || 0,
        duration: readField(form, "rentalDuration"),
        comment: readField(form, "customerComment")
      });

      if (!added) {
        showToast(`В корзине уже ${MAX_ITEMS} позиций. Отправьте заявку, потом добавляйте новые.`, true);
        return;
      }

      trackEvent("add_to_cart", { item_name: form.dataset.itemTitle, item_type: type });
      showToast("Добавлено в корзину", true);
    });
  });
}

function showToast(text, withAction) {
  let toast = document.querySelector(".niko-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "niko-toast";
    toast.setAttribute("role", "status");
    document.body.append(toast);
  }

  toast.replaceChildren();
  const label = document.createElement("span");
  label.textContent = text;
  toast.append(label);

  if (withAction) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Оформить заявку";
    button.addEventListener("click", () => {
      toast.remove();
      openCart();
    });
    toast.append(button);
  }

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.remove(), 7000);
}

/* ---------- message building ---------- */

function newOrderId() {
  if (!pendingOrderId) {
    pendingOrderId = `NP-${Date.now().toString(36).slice(-5)}`.toUpperCase();
  }
  return pendingOrderId;
}

function marketingLines() {
  const lines = [
    marketing.utmSource ? `UTM source: ${marketing.utmSource}` : "",
    marketing.utmMedium ? `UTM medium: ${marketing.utmMedium}` : "",
    marketing.utmCampaign ? `UTM campaign: ${marketing.utmCampaign}` : "",
    marketing.gclid ? `GCLID: ${marketing.gclid}` : "",
    marketing.referrer ? `Referrer: ${marketing.referrer}` : ""
  ].filter(Boolean);

  return lines.length ? ["", ...lines] : [];
}

function describeItem(item, index) {
  const lines = [`${index + 1}) ${TYPE_LABELS[item.type] || "Позиция"}: ${item.title}`];

  if (item.program) {
    lines.push(`   Программа: ${item.program}${item.departure ? ` (выезд ${item.departure})` : ""}`);
  }
  if (item.priceLabel) {
    lines.push(`   Цена на сайте: ${item.priceLabel}`);
  }
  if (item.date) {
    lines.push(`   Дата: ${formatDate(item.date)}`);
  }
  if (item.duration) {
    lines.push(`   Срок аренды: ${item.duration}`);
  }
  if (item.adults || item.children) {
    lines.push(`   Взрослые: ${item.adults}, дети: ${item.children}`);
  }
  if (item.comment) {
    lines.push(`   Комментарий: ${item.comment}`);
  }
  if (item.url) {
    lines.push(`   Страница: ${window.location.origin}${item.url}`);
  }

  return lines;
}

function buildMessage(order) {
  if (order.kind === "selection") {
    return [`Заявка на подбор с сайта Niko Phuket №${order.id}`, ...order.lines, ...marketingLines()].join("\n");
  }

  const { customer } = order;
  const lines = [
    `Заявка с сайта Niko Phuket №${order.id}`,
    "",
    `Имя: ${customer.name}`,
    `Телефон: ${customer.phone}`,
    `Отель (для трансфера): ${customer.hotel}`
  ];

  if (customer.contact) {
    lines.push(`Telegram / WhatsApp: ${customer.contact}`);
  }

  lines.push("", `Позиции (${order.items.length}):`);
  order.items.forEach((item, index) => lines.push(...describeItem(item, index)));

  if (customer.comment) {
    lines.push("", `Комментарий к заявке: ${customer.comment}`);
  }

  lines.push(...marketingLines());
  return lines.join("\n");
}

/* ---------- dialog ---------- */

function ensureDialog() {
  if (dialog) {
    return dialog;
  }

  dialog = document.createElement("dialog");
  dialog.className = "niko-cart";
  dialog.setAttribute("aria-labelledby", "nikoCartTitle");
  dialog.innerHTML = `
    <div class="niko-cart-card">
      <button class="niko-cart-close" type="button" data-cart-close aria-label="Закрыть">×</button>
      <div data-cart-main>
        <h3 id="nikoCartTitle">Корзина</h3>
        <div data-cart-cart-only>
          <ul class="niko-cart-list" data-cart-list></ul>
          <p class="niko-cart-empty" data-cart-empty>Корзина пуста. Добавьте экскурсию, аренду или услугу на странице товара, и мы оформим всё одной заявкой.</p>
          <form class="niko-cart-form" data-cart-form-checkout novalidate>
            <div class="form-grid">
              <label class="field"><span>Имя</span><input name="name" type="text" autocomplete="name" required /></label>
              <label class="field"><span>Телефон</span><input name="phone" type="tel" autocomplete="tel" placeholder="+7..." required /></label>
              <label class="field field-wide"><span>Отель (для трансфера)</span><input name="hotel" type="text" placeholder="Название отеля" required /></label>
              <label class="field field-wide"><span>Ник в Telegram или номер WhatsApp (если отличается от телефона)</span><input name="contact" type="text" placeholder="@nickname" /></label>
              <label class="field field-wide"><span>Комментарий к заявке</span><textarea name="comment" rows="2"></textarea></label>
              <input name="website" type="text" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;opacity:0;pointer-events:none;" />
            </div>
          </form>
        </div>
        <div data-cart-selection-only hidden>
          <pre class="niko-cart-preview" data-cart-preview></pre>
        </div>
        <div data-cart-send>
          <p class="niko-cart-hint">Как отправить заявку:</p>
          <div class="niko-cart-actions">
            <button type="button" class="btn btn-primary" data-channel="bot">Отправить менеджеру</button>
            <button type="button" class="btn btn-ghost" data-channel="telegram">Написать в Telegram</button>
            <button type="button" class="btn btn-ghost" data-channel="whatsapp">Написать в WhatsApp</button>
          </div>
          <p class="form-note" data-cart-note aria-live="polite"></p>
          <button type="button" class="niko-cart-link" data-cart-clear hidden>Заявка отправлена, очистить корзину</button>
        </div>
      </div>
      <div data-cart-done hidden>
        <h3>Заявка отправлена</h3>
        <p data-cart-done-text>Менеджер свяжется с вами в ближайшее время.</p>
        <button type="button" class="btn btn-primary" data-cart-close>Закрыть</button>
      </div>
    </div>`;

  document.body.append(dialog);

  dialog.addEventListener("click", (event) => {
    const target = event.target;
    if (target === dialog || target.closest("[data-cart-close]")) {
      dialog.close();
      return;
    }

    const remove = target.closest("[data-remove-id]");
    if (remove) {
      removeItem(remove.dataset.removeId);
      return;
    }

    if (target.closest("[data-cart-clear]")) {
      clearCart();
      dialog.close();
      return;
    }

    const channelButton = target.closest("[data-channel]");
    if (channelButton) {
      sendOrder(channelButton.dataset.channel);
    }
  });

  const checkout = dialog.querySelector("[data-cart-form-checkout]");
  checkout.addEventListener("input", saveCustomer);
  checkout.addEventListener("submit", (event) => {
    event.preventDefault();
    sendOrder(config.endpoint ? "bot" : config.telegramManager ? "telegram" : "whatsapp");
  });

  const saved = readJson(CUSTOMER_KEY, {});
  ["name", "phone", "hotel", "contact"].forEach((field) => {
    if (saved[field] && checkout.elements.namedItem(field)) {
      checkout.elements.namedItem(field).value = saved[field];
    }
  });

  return dialog;
}

function saveCustomer() {
  const form = dialog.querySelector("[data-cart-form-checkout]");
  writeJson(CUSTOMER_KEY, {
    name: form.elements.namedItem("name").value,
    phone: form.elements.namedItem("phone").value,
    hotel: form.elements.namedItem("hotel").value,
    contact: form.elements.namedItem("contact").value
  });
}

function renderCart() {
  const list = dialog.querySelector("[data-cart-list]");
  const empty = dialog.querySelector("[data-cart-empty]");
  const form = dialog.querySelector("[data-cart-form-checkout]");
  const send = dialog.querySelector("[data-cart-send]");

  list.replaceChildren();

  items.forEach((item) => {
    const row = document.createElement("li");
    row.className = "niko-cart-item";

    const body = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = item.title;
    const meta = document.createElement("p");
    meta.className = "niko-cart-item-meta";
    meta.textContent = [
      item.program,
      item.date ? formatDate(item.date) : "",
      item.duration ? `срок: ${item.duration}` : "",
      item.adults || item.children ? `взрослые ${item.adults}, дети ${item.children}` : ""
    ].filter(Boolean).join(" • ");
    body.append(title, meta);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "niko-cart-link";
    remove.dataset.removeId = item.id;
    remove.textContent = "Удалить";

    row.append(body, remove);
    list.append(row);
  });

  const hasItems = items.length > 0;
  empty.hidden = hasItems;
  form.hidden = !hasItems;
  send.hidden = !hasItems;
}

function applyChannelAvailability() {
  const hasBot = Boolean(config.endpoint);
  const hasTelegram = Boolean(config.telegramManager);
  const hasWhatsApp = Boolean(config.whatsappNumber);

  dialog.querySelector('[data-channel="bot"]').hidden = !hasBot;
  dialog.querySelector('[data-channel="telegram"]').hidden = !hasTelegram;
  dialog.querySelector('[data-channel="whatsapp"]').hidden = !hasWhatsApp;

  // если автоматической отправки нет, мессенджер становится основной кнопкой
  const telegram = dialog.querySelector('[data-channel="telegram"]');
  telegram.classList.toggle("btn-primary", !hasBot);
  telegram.classList.toggle("btn-ghost", hasBot);
}

async function openDialog() {
  await configReady;
  ensureDialog();
  applyChannelAvailability();

  dialog.querySelector("[data-cart-main]").hidden = false;
  dialog.querySelector("[data-cart-done]").hidden = true;
  dialog.querySelector("[data-cart-note]").textContent = "";
  dialog.querySelector("[data-cart-clear]").hidden = true;

  const cartOnly = dialog.querySelector("[data-cart-cart-only]");
  const selectionOnly = dialog.querySelector("[data-cart-selection-only]");
  cartOnly.hidden = mode !== "cart";
  selectionOnly.hidden = mode !== "selection";
  dialog.querySelector("#nikoCartTitle").textContent = mode === "cart" ? "Корзина" : "Отправка заявки на подбор";

  if (mode === "cart") {
    renderCart();
  } else {
    dialog.querySelector("[data-cart-send]").hidden = false;
    dialog.querySelector("[data-cart-preview]").textContent = buildMessage({
      kind: "selection",
      id: newOrderId(),
      lines: selection.lines
    });
  }

  if (!dialog.open) {
    dialog.showModal();
  }
}

function openCart() {
  mode = "cart";
  selection = null;
  return openDialog();
}

function openSelection(options) {
  mode = "selection";
  selection = { lines: options.lines || [], onSent: options.onSent };
  pendingOrderId = "";
  return openDialog();
}

/* ---------- sending ---------- */

function collectOrder() {
  if (mode === "selection") {
    return { kind: "selection", id: newOrderId(), lines: selection.lines };
  }

  const form = dialog.querySelector("[data-cart-form-checkout]");
  if (!form.checkValidity()) {
    form.reportValidity();
    return null;
  }

  const value = (name) => form.elements.namedItem(name).value.trim();
  return {
    kind: "cart",
    id: newOrderId(),
    items: [...items],
    customer: {
      name: value("name"),
      phone: value("phone"),
      hotel: value("hotel"),
      contact: value("contact"),
      comment: value("comment")
    },
    honeypot: value("website")
  };
}

async function copyText(text) {
  if (!navigator.clipboard || !window.isSecureContext) {
    return false;
  }

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function setNote(text) {
  dialog.querySelector("[data-cart-note]").textContent = text;
}

function setSending(value) {
  sending = value;
  dialog.querySelectorAll("[data-channel]").forEach((button) => {
    button.disabled = value;
  });
}

function finishSuccess(order, channel) {
  trackEvent("generate_lead", {
    lead_type: order.kind === "selection" ? "selection_request" : "cart_order",
    send_method: channel,
    items_count: order.items ? order.items.length : 0
  });

  if (order.kind === "cart") {
    clearCart();
  } else if (selection && typeof selection.onSent === "function") {
    selection.onSent();
  }

  pendingOrderId = "";
  dialog.querySelector("[data-cart-main]").hidden = true;
  dialog.querySelector("[data-cart-done]").hidden = false;
}

async function sendOrder(channel) {
  if (sending) {
    return;
  }

  const order = collectOrder();
  if (!order) {
    return;
  }

  const text = buildMessage(order);

  if (channel === "bot") {
    setSending(true);
    setNote("Отправляем...");
    try {
      const response = await fetch(config.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, website: order.honeypot || "" })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      finishSuccess(order, "bot");
    } catch (error) {
      console.error("Отправка через бота не удалась", error);
      setNote("Не удалось отправить автоматически. Попробуйте ещё раз или отправьте заявку через Telegram или WhatsApp.");
    } finally {
      setSending(false);
    }
    return;
  }

  if (channel === "telegram") {
    // open и запись в буфер идут в одном жесте пользователя, иначе браузер заблокирует окно
    const copied = copyText(text);
    window.open(`https://t.me/${config.telegramManager}`, "_blank", "noopener,noreferrer");
    const ok = await copied;
    setNote(ok
      ? "Открыт чат с менеджером. Текст заявки скопирован: вставьте его в сообщение и отправьте."
      : "Открыт чат с менеджером. Скопируйте текст заявки вручную и отправьте в чат.");
    afterMessengerOpen(order, "telegram");
    return;
  }

  if (channel === "whatsapp") {
    const url = `https://wa.me/${config.whatsappNumber}?text=${encodeURIComponent(text)}`;
    const copied = url.length > WA_URL_SOFT_LIMIT ? copyText(text) : Promise.resolve(false);
    window.open(url, "_blank", "noopener,noreferrer");
    const ok = await copied;
    setNote(ok
      ? "Открыт WhatsApp. Заявка длинная, поэтому текст ещё и скопирован: если поле пустое, вставьте его."
      : "Открыт WhatsApp с готовым текстом. Нажмите «Отправить» в чате.");
    afterMessengerOpen(order, "whatsapp");
  }
}

function afterMessengerOpen(order, channel) {
  trackEvent("generate_lead", {
    lead_type: order.kind === "selection" ? "selection_request" : "cart_order",
    send_method: channel,
    items_count: order.items ? order.items.length : 0
  });

  if (order.kind === "cart") {
    dialog.querySelector("[data-cart-clear]").hidden = false;
  }
}

/* ---------- init ---------- */

document.addEventListener("click", (event) => {
  const opener = event.target.closest("[data-cart-open]");
  if (opener) {
    event.preventDefault();
    openCart();
  }
});

window.addEventListener("storage", (event) => {
  if (event.key === CART_KEY) {
    items = sanitizeItems(readJson(CART_KEY, []));
    renderBadge();
    if (dialog && dialog.open && mode === "cart") {
      renderCart();
    }
  }
});

renderBadge();
bindCartForms();

window.NikoCart = { open: openCart, openSelection, add: addItem, count: () => items.length };
