/* Niko Phuket: клиентский код. Без зависимостей, один файл на все страницы.
   Блоки: утилиты, шапка, каталог (фильтр и поиск), форма бронирования, корзина, оформление. */
(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const CART_KEY = "niko:cart:v2";
  const CUSTOMER_KEY = "niko:customer:v2";
  const CATALOG_KEY = "niko:last-catalog";
  const MARKETING_KEY = "niko:marketing";
  const MAX_ITEMS = 20;

  const config = (() => {
    try {
      return JSON.parse($("#niko-config").textContent);
    } catch {
      return {};
    }
  })();

  /* ---------- утилиты ---------- */

  const store = {
    get(storage, key, fallback) {
      try {
        const raw = storage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch {
        return fallback;
      }
    },
    set(storage, key, value) {
      try {
        storage.setItem(key, JSON.stringify(value));
      } catch {
        /* приватный режим: данные не переживут перезагрузку */
      }
    }
  };

  const normalize = (text) => String(text || "").toLowerCase().replace(/ё/g, "е").trim();
  const formatDate = (iso) => {
    const [y, m, d] = String(iso || "").split("-");
    return y && m && d ? `${d}.${m}.${y}` : "";
  };
  const todayLocal = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 10);
  };
  const track = (name, params) => {
    if (typeof window.gtag === "function") window.gtag("event", name, params);
  };
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  /* ---------- маркетинговый контекст (UTM) ---------- */

  const marketing = (() => {
    const saved = store.get(sessionStorage, MARKETING_KEY, {});
    const params = new URLSearchParams(location.search);
    const keys = ["utm_source", "utm_medium", "utm_campaign", "gclid", "fbclid", "yclid"];
    const external = document.referrer && new URL(document.referrer).host !== location.host ? document.referrer : "";
    const context = { ...saved, referrer: saved.referrer || external };
    keys.forEach((key) => {
      if (params.get(key)) context[key] = params.get(key);
    });
    store.set(sessionStorage, MARKETING_KEY, context);
    return context;
  })();

  /* ---------- корзина: состояние ---------- */

  let cart = (() => {
    const saved = store.get(localStorage, CART_KEY, []);
    return Array.isArray(saved) ? saved.filter((i) => i && i.title).slice(0, MAX_ITEMS) : [];
  })();

  const saveCart = () => {
    store.set(localStorage, CART_KEY, cart);
    renderBadge();
  };

  function renderBadge() {
    $$("[data-cart-count]").forEach((node) => {
      node.textContent = String(cart.length);
      node.hidden = cart.length === 0;
    });
  }

  window.addEventListener("storage", (event) => {
    if (event.key === CART_KEY) {
      cart = store.get(localStorage, CART_KEY, []);
      renderBadge();
      if ($("[data-cart-root]")) renderCart();
    }
  });

  /* ---------- шапка ---------- */

  const header = $("[data-header]");
  const burger = $("[data-burger]");

  if (burger && header) {
    burger.addEventListener("click", () => {
      const open = header.classList.toggle("is-open");
      burger.setAttribute("aria-expanded", String(open));
      document.body.classList.toggle("nav-open", open);
    });
    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && header.classList.contains("is-open")) burger.click();
    });
  }

  const onScroll = () => header && header.classList.toggle("is-scrolled", window.scrollY > 8);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- «вернуться к экскурсиям» ---------- */

  const catalogRoot = $("[data-catalog]");

  function rememberCatalog() {
    store.set(sessionStorage, CATALOG_KEY, location.pathname + location.search);
  }

  function wireBackLinks() {
    const last = store.get(sessionStorage, CATALOG_KEY, "");
    if (!last) return;
    $$("[data-back-to-catalog]").forEach((link) => link.setAttribute("href", last));
  }

  /* ---------- каталог: категории и поиск ---------- */

  if (catalogRoot) {
    const scope = catalogRoot.dataset.scope;
    const cards = $$("[data-card]", catalogRoot);
    const chips = $$("[data-chip]", catalogRoot);
    const input = $("[data-search-input]", catalogRoot);
    const empty = $("[data-empty]", catalogRoot);
    const state = { chip: "all", query: "" };

    const params = new URLSearchParams(location.search);
    if (scope === "all") {
      const wanted = params.get("c");
      if (wanted && chips.some((chip) => chip.dataset.chip === wanted)) state.chip = wanted;
    }
    state.query = params.get("q") || "";
    if (input) input.value = state.query;

    const apply = () => {
      const tokens = normalize(state.query).split(/\s+/).filter(Boolean);
      let visible = 0;

      cards.forEach((card) => {
        const inChip = scope !== "all" || state.chip === "all" || card.dataset.group === state.chip;
        const haystack = card.dataset.search || "";
        const inQuery = tokens.every((token) => haystack.includes(token));
        const show = inChip && inQuery;
        card.hidden = !show;
        if (show) visible += 1;
      });

      if (scope === "all") {
        chips.forEach((chip) => {
          const active = chip.dataset.chip === state.chip;
          chip.classList.toggle("is-active", active);
          if (active) chip.setAttribute("aria-current", "true");
          else chip.removeAttribute("aria-current");
        });
      }

      if (empty) empty.hidden = visible > 0;

      const next = new URLSearchParams();
      if (scope === "all" && state.chip !== "all") next.set("c", state.chip);
      if (state.query) next.set("q", state.query);
      const query = next.toString();
      history.replaceState(null, "", location.pathname + (query ? `?${query}` : ""));
      rememberCatalog();
    };

    chips.forEach((chip) => {
      chip.addEventListener("click", (event) => {
        if (scope !== "all") return; // на странице категории чипы ведут на другие страницы
        event.preventDefault();
        state.chip = chip.dataset.chip;
        apply();
      });
    });

    if (input) {
      input.addEventListener("input", () => {
        state.query = input.value;
        apply();
      });
    }

    const jumpToCatalog = () => catalogRoot.scrollIntoView({ behavior: "smooth", block: "start" });

    const heroForm = $("[data-hero-search]");
    if (heroForm) {
      heroForm.addEventListener("submit", (event) => {
        event.preventDefault();
        state.query = heroForm.elements.q.value;
        state.chip = "all";
        if (input) input.value = state.query;
        apply();
        jumpToCatalog();
      });
    }

    $$("[data-quick]").forEach((link) => {
      link.addEventListener("click", (event) => {
        if (scope !== "all") return;
        event.preventDefault();
        state.chip = link.dataset.quick;
        apply();
        jumpToCatalog();
      });
    });

    apply();
  }

  /* ---------- форма бронирования на странице карточки ---------- */

  const booking = $("[data-booking]");

  if (booking) {
    const wrap = $("[data-booking-wrap]");
    const formWrap = $("[data-booking-form-wrap]", wrap);
    const done = $("[data-booking-done]", wrap);
    const priceOut = $("[data-price-out]", wrap);
    const program = $("[data-program]", booking);
    const date = booking.elements.date;

    if (date) date.min = todayLocal();

    if (program) {
      program.addEventListener("change", () => {
        const option = program.selectedOptions[0];
        if (option && priceOut) priceOut.textContent = option.dataset.price || "";
      });
    }

    booking.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!booking.checkValidity()) {
        booking.reportValidity();
        return;
      }
      if (cart.length >= MAX_ITEMS) {
        alert(`В корзине уже ${MAX_ITEMS} позиций. Отправьте заявку, потом добавляйте новые.`);
        return;
      }

      const field = (name) => (booking.elements[name] ? String(booking.elements[name].value).trim() : "");
      const option = program ? program.selectedOptions[0] : null;

      cart.push({
        uid: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        kind: booking.dataset.kind,
        id: booking.dataset.id,
        title: booking.dataset.title,
        url: booking.dataset.url,
        image: booking.dataset.image,
        program: option ? option.value : "",
        departure: option ? option.dataset.departure || "" : "",
        priceLabel: option ? option.dataset.price || "" : booking.dataset.price || "",
        date: field("date"),
        adults: Number(field("adults")) || 0,
        children: Number(field("children")) || 0,
        duration: field("duration"),
        comment: field("comment")
      });
      saveCart();
      track("add_to_cart", { item_name: booking.dataset.title, item_type: booking.dataset.kind });

      $("[data-done-count]", done).textContent = cart.length === 1 ? "В корзине 1 позиция." : `В корзине позиций: ${cart.length}.`;
      formWrap.hidden = true;
      done.hidden = false;
      wrap.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });

    $("[data-add-another]", wrap).addEventListener("click", () => {
      done.hidden = true;
      formWrap.hidden = false;
      if (date) date.focus();
    });
  }

  /* ---------- страница корзины ---------- */

  const cartRoot = $("[data-cart-root]");
  const checkout = $("[data-checkout]");
  let pendingOrderId = "";
  let sending = false;

  function renderCart() {
    const list = $("[data-cart-list]", cartRoot);
    const empty = $("[data-cart-empty]", cartRoot);
    const itemsBlock = $("[data-cart-items]", cartRoot);
    const hasItems = cart.length > 0;

    empty.hidden = hasItems;
    itemsBlock.hidden = !hasItems;
    checkout.hidden = !hasItems;
    cartRoot.classList.toggle("is-empty", !hasItems);
    list.replaceChildren();

    cart.forEach((item) => {
      const row = el("li", "cart-item");

      const img = el("img");
      img.src = item.image || "/placeholder.svg";
      img.alt = "";
      img.width = 160;
      img.height = 120;
      img.loading = "lazy";
      img.onerror = () => {
        img.onerror = null;
        img.src = "/placeholder.svg";
      };

      const body = el("div", "cart-item-body");
      const title = el("a", "cart-item-title", item.title);
      title.href = item.url;
      const meta = el("p", "cart-item-meta", [
        item.program,
        item.date ? formatDate(item.date) : "",
        item.duration ? `срок: ${item.duration}` : "",
        item.adults || item.children ? `взрослые ${item.adults}, дети ${item.children}` : ""
      ].filter(Boolean).join(" · "));
      body.append(title, meta);
      if (item.priceLabel) body.append(el("p", "cart-item-price", item.priceLabel));
      if (item.comment) body.append(el("p", "cart-item-comment", item.comment));

      const remove = el("button", "icon-remove", "Удалить");
      remove.type = "button";
      remove.addEventListener("click", () => {
        cart = cart.filter((entry) => entry.uid !== item.uid);
        pendingOrderId = "";
        saveCart();
        renderCart();
      });

      row.append(img, body, remove);
      list.append(row);
    });
  }

  function buildMessage(orderId, customer) {
    const lines = [
      `Заявка с сайта Niko Phuket №${orderId}`,
      "",
      `Клиент: ${customer.name}`,
      `Телефон: ${customer.phone}`,
      `Связь: ${customer.method === "telegram" ? `Telegram${customer.nick ? ` (${customer.nick})` : ""}` : "WhatsApp"}`
    ];
    if (customer.hotel) lines.push(`Отель: ${customer.hotel}`);
    if (customer.comment) lines.push(`Комментарий: ${customer.comment}`);

    lines.push("", `Позиции (${cart.length}):`);
    cart.forEach((item, index) => {
      const kind = { excursion: "Экскурсия", rental: "Аренда", service: "Услуга" }[item.kind] || "Позиция";
      lines.push(`${index + 1}) ${kind}: ${item.title}`);
      if (item.program) lines.push(`   Программа: ${item.program}${item.departure ? ` (выезд ${item.departure})` : ""}`);
      if (item.priceLabel) lines.push(`   Цена на сайте: ${item.priceLabel}`);
      if (item.date) lines.push(`   Дата: ${formatDate(item.date)}`);
      if (item.duration) lines.push(`   Срок: ${item.duration}`);
      if (item.adults || item.children) lines.push(`   Взрослые: ${item.adults}, дети: ${item.children}`);
      if (item.comment) lines.push(`   Комментарий: ${item.comment}`);
      lines.push(`   Страница: ${location.origin}${item.url}`);
    });

    const extra = [
      marketing.utm_source && `UTM source: ${marketing.utm_source}`,
      marketing.utm_medium && `UTM medium: ${marketing.utm_medium}`,
      marketing.utm_campaign && `UTM campaign: ${marketing.utm_campaign}`,
      marketing.gclid && `GCLID: ${marketing.gclid}`,
      marketing.referrer && `Referrer: ${marketing.referrer}`
    ].filter(Boolean);
    if (extra.length) lines.push("", ...extra);

    return lines.join("\n");
  }

  function showFailure(note) {
    note.replaceChildren(document.createTextNode("Не удалось отправить заявку. Попробуйте ещё раз или напишите нам напрямую: "));
    const links = [
      config.whatsapp && ["WhatsApp", `https://wa.me/${config.whatsapp}`],
      config.telegram && ["Telegram", `https://t.me/${config.telegram}`]
    ].filter(Boolean);
    links.forEach(([label, href], index) => {
      if (index) note.append(" или ");
      const link = el("a", "", label);
      link.href = href;
      link.target = "_blank";
      link.rel = "noopener";
      note.append(link);
    });
    note.classList.add("is-error");
  }

  if (cartRoot && checkout) {
    const note = $("[data-note]", checkout);
    const submit = $("[data-submit]", checkout);
    const nickField = $("[data-nick-field]", checkout);
    const dialog = $("[data-done-dialog]");
    const saved = store.get(localStorage, CUSTOMER_KEY, {});

    ["name", "phone", "nick", "hotel"].forEach((name) => {
      if (saved[name]) checkout.elements[name].value = saved[name];
    });
    if (saved.method) {
      const radio = $(`input[name="method"][value="${saved.method}"]`, checkout);
      if (radio) radio.checked = true;
    }

    const currentMethod = () => (checkout.elements.method.value === "telegram" ? "telegram" : "whatsapp");
    const syncMethod = () => {
      nickField.hidden = currentMethod() !== "telegram";
    };
    syncMethod();

    checkout.addEventListener("change", (event) => {
      if (event.target.name === "method") syncMethod();
    });
    checkout.addEventListener("input", () => {
      store.set(localStorage, CUSTOMER_KEY, {
        name: checkout.elements.name.value,
        phone: checkout.elements.phone.value,
        nick: checkout.elements.nick.value,
        hotel: checkout.elements.hotel.value,
        method: currentMethod()
      });
      note.textContent = "";
      note.classList.remove("is-error");
    });

    checkout.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (sending || !cart.length) return;

      const phone = checkout.elements.phone;
      phone.setCustomValidity(phone.value.replace(/\D/g, "").length >= 7 ? "" : "Укажите номер телефона с кодом страны");
      if (!checkout.checkValidity()) {
        checkout.reportValidity();
        return;
      }

      const value = (name) => checkout.elements[name].value.trim();
      const method = currentMethod();
      const nickRaw = value("nick");
      const customer = {
        name: value("name"),
        phone: value("phone"),
        method,
        nick: method === "telegram" && nickRaw ? `@${nickRaw.replace(/^@+/, "")}` : "",
        hotel: value("hotel"),
        comment: value("comment")
      };

      if (!pendingOrderId) pendingOrderId = `NP-${Date.now().toString(36).slice(-5)}`.toUpperCase();

      sending = true;
      submit.disabled = true;
      submit.textContent = "Отправляем…";
      note.textContent = "";
      note.classList.remove("is-error");

      try {
        if (!config.endpoint) throw new Error("endpoint is not configured");

        const response = await fetch(config.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: buildMessage(pendingOrderId, customer),
            website: value("website"),
            contact: { method: customer.method, phone: customer.phone, nick: customer.nick }
          })
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        track("generate_lead", { lead_type: "cart_order", send_method: "bot", contact_method: method, items_count: cart.length });
        cart = [];
        pendingOrderId = "";
        saveCart();
        renderCart();
        $("[data-done-method]", dialog).textContent = method === "telegram" ? "Telegram" : "WhatsApp";
        dialog.showModal();
      } catch (error) {
        console.error("Отправка заявки не удалась", error);
        showFailure(note);
      } finally {
        sending = false;
        submit.disabled = false;
        submit.textContent = "Отправить заявку";
      }
    });

    renderCart();
  }

  /* ---------- старт ---------- */

  renderBadge();
  wireBackLinks();
})();
