/**
 * Niko Phuket: таблица заявок.
 *
 * Принимает заявки от Cloudflare Worker (doPost), добавляет строку на лист «Заявки»
 * и строки на лист «Позиции». Статус заявки выбирается выпадающим списком в колонке C.
 *
 * Установка: sheets/README.md
 */

const SHEET_ORDERS = "Заявки";
const SHEET_ITEMS = "Позиции";
const SHEET_PARTNERS = "Партнёры";
const TIMEZONE = "Asia/Bangkok";

// порядок и цвета статусов
const STATUSES = [
  { name: "request", bg: "#fff1c2", fg: "#7a5b00" },
  { name: "unpaid", bg: "#fbd5d5", fg: "#8a1c1c" },
  { name: "paid", bg: "#cdeedb", fg: "#14532d" },
  { name: "on hold", bg: "#e4dcf7", fg: "#4c2a85" },
  { name: "complete", bg: "#d6e4ff", fg: "#1e3a8a" }
];

const ORDER_HEADERS = [
  "Дата (Пхукет)", "№ заявки", "Статус", "Имя", "Телефон", "Связь", "Ник Telegram", "Отель",
  "Позиции", "Кол-во", "Ближайшая дата", "Комментарий клиента", "Источник", "Заметки менеджера", "Партнёр (ref)", "Людей"
];
const ITEM_HEADERS = [
  "Дата (Пхукет)", "№ заявки", "Тип", "Категория", "Название", "Программа", "Дата поездки",
  "Взрослые", "Дети", "Срок", "Цена на сайте", "Комментарий", "Ссылка"
];

/** Один раз запустить вручную: создаёт листы, шапки, выпадающий список и цвета статусов. */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const orders = getOrCreateSheet_(ss, SHEET_ORDERS);
  const items = getOrCreateSheet_(ss, SHEET_ITEMS);

  writeHeader_(orders, ORDER_HEADERS);
  writeHeader_(items, ITEM_HEADERS);

  // статус: выпадающий список с чипами для всех строк ниже шапки
  const statusRange = orders.getRange(2, 3, orders.getMaxRows() - 1, 1);
  statusRange.setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(STATUSES.map((s) => s.name), true).setAllowInvalid(false).build()
  );

  // цвета по статусам
  const rules = STATUSES.map((s) =>
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo(s.name)
      .setBackground(s.bg)
      .setFontColor(s.fg)
      .setBold(true)
      .setRanges([statusRange])
      .build()
  );
  orders.setConditionalFormatRules(rules);

  orders.getRange(2, 5, orders.getMaxRows() - 1, 1).setNumberFormat("@"); // телефон как текст
  orders.getRange(2, 9, orders.getMaxRows() - 1, 1).setWrap(true).setVerticalAlignment("top");
  orders.getRange(2, 1, orders.getMaxRows() - 1, ORDER_HEADERS.length).setVerticalAlignment("top");
  [150, 110, 110, 160, 140, 100, 130, 160, 380, 70, 120, 260, 200, 260, 120, 70].forEach((w, i) => orders.setColumnWidth(i + 1, w));
  [150, 110, 110, 160, 280, 220, 110, 80, 80, 100, 160, 240, 300].forEach((w, i) => items.setColumnWidth(i + 1, w));

  setupPartners_(ss);

  SpreadsheetApp.getUi().alert("Готово. Листы «Заявки», «Позиции» и «Партнёры» настроены.\nДальше: Развернуть → Новое развёртывание → Веб-приложение (см. sheets/README.md).");
}

/** Меню «Niko» в таблице: быстрые кнопки статусов для выбранных строк. */
function onOpen() {
  const menu = SpreadsheetApp.getUi().createMenu("Niko");
  STATUSES.forEach((s, i) => menu.addItem("Статус: " + s.name, "setStatus" + i));
  menu.addSeparator().addItem("Настроить таблицу (setup)", "setup").addToUi();
}
function setStatus0() { setStatusForSelection_(STATUSES[0].name); }
function setStatus1() { setStatusForSelection_(STATUSES[1].name); }
function setStatus2() { setStatusForSelection_(STATUSES[2].name); }
function setStatus3() { setStatusForSelection_(STATUSES[3].name); }
function setStatus4() { setStatusForSelection_(STATUSES[4].name); }

function setStatusForSelection_(status) {
  const sheet = SpreadsheetApp.getActiveSheet();
  if (sheet.getName() !== SHEET_ORDERS) {
    SpreadsheetApp.getUi().alert("Откройте лист «" + SHEET_ORDERS + "» и выберите строки заявок.");
    return;
  }
  const range = sheet.getActiveRange();
  const first = Math.max(range.getRow(), 2);
  const last = range.getLastRow();
  for (let row = first; row <= last; row++) sheet.getRange(row, 3).setValue(status);
}

/** Веб-приложение: сюда стучится Cloudflare Worker. */
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const secret = PropertiesService.getScriptProperties().getProperty("SECRET");
    if (!secret || body.secret !== secret) return reply_({ ok: false, error: "forbidden" });

    const order = body.order || {};
    if (!order.id) return reply_({ ok: false, error: "no_id" });

    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const orders = getOrCreateSheet_(ss, SHEET_ORDERS);
      const items = getOrCreateSheet_(ss, SHEET_ITEMS);
      if (orders.getLastRow() === 0) setup();

      // повторная отправка той же заявки не создаёт дубль
      const ids = orders.getLastRow() > 1 ? orders.getRange(2, 2, orders.getLastRow() - 1, 1).getValues().flat() : [];
      if (ids.indexOf(order.id) !== -1) return reply_({ ok: true, duplicate: true });

      const now = Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd HH:mm");
      const customer = order.customer || {};
      const list = Array.isArray(order.items) ? order.items : [];
      const dates = list.map((i) => i.date).filter(Boolean).sort();
      const source = order.source || {};
      const sourceText = Object.keys(source).filter((k) => source[k]).map((k) => k + ": " + source[k]).join("\n");

      const people = list.reduce((sum, i) => sum + (Number(i.adults) || 0) + (Number(i.children) || 0), 0);
      const summary = list.map((i, n) => {
        const people = i.adults || i.children ? " · взр " + i.adults + ", дет " + i.children : "";
        const date = i.date ? " · " + i.date : "";
        return (n + 1) + ") " + i.title + (i.program ? " (" + i.program + ")" : "") + date + people;
      }).join("\n");

      orders.appendRow([
        now, order.id, "request", customer.name || "", customer.phone || "",
        customer.method === "telegram" ? "Telegram" : "WhatsApp", customer.nick || "", customer.hotel || "",
        summary, list.length, dates[0] || "", customer.comment || "", sourceText, "", order.ref || "", people
      ]);
      const newRow = orders.getLastRow();
      orders.getRange(newRow, 5).setNumberFormat("@").setValue(customer.phone || "");
      orders.getRange(newRow, 9).setWrap(true);

      list.forEach((i) => {
        items.appendRow([
          now, order.id, typeLabel_(i.kind), i.group || "", i.title || "", i.program || "", i.date || "",
          i.adults || 0, i.children || 0, i.duration || "", i.priceLabel || "", i.comment || "", i.url || ""
        ]);
      });
    } finally {
      lock.releaseLock();
    }

    return reply_({ ok: true });
  } catch (err) {
    return reply_({ ok: false, error: String(err) });
  }
}

function typeLabel_(kind) {
  return { excursion: "Экскурсия", rental: "Аренда", service: "Услуга" }[kind] || kind || "";
}

function reply_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateSheet_(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function writeHeader_(sheet, headers) {
  sheet.getRange(1, 1, 1, headers.length).setValues([headers])
    .setFontWeight("bold").setBackground("#0f2a33").setFontColor("#ffffff").setVerticalAlignment("middle");
  sheet.setFrozenRows(1);
}

/**
 * Лист «Партнёры»: код партнёра = то, что стоит после ?ref= в его ссылке.
 * Выплата считается только за людей из заявок со статусом «complete».
 */
function setupPartners_(ss) {
  const sheet = getOrCreateSheet_(ss, SHEET_PARTNERS);
  const headers = ["Код (ref)", "Имя", "Контакт", "Ставка, ฿ за человека", "Заявок", "Людей всего", "Людей complete", "К выплате, ฿", "Выплачено, ฿", "Остаток, ฿"];
  writeHeader_(sheet, headers);
  const rows = 200;
  const o = "'" + SHEET_ORDERS + "'!";
  const formulas = [];
  for (let r = 2; r <= rows + 1; r++) {
    formulas.push([
      '=IF($A' + r + '="","",COUNTIF(' + o + '$O:$O,$A' + r + '))',
      '=IF($A' + r + '="","",SUMIF(' + o + '$O:$O,$A' + r + ',' + o + '$P:$P))',
      '=IF($A' + r + '="","",SUMIFS(' + o + '$P:$P,' + o + '$O:$O,$A' + r + ',' + o + '$C:$C,"complete"))',
      '=IF($A' + r + '="","",G' + r + '*D' + r + ')',
    ]);
  }
  sheet.getRange(2, 5, rows, 4).setFormulas(formulas);
  sheet.getRange(2, 10, rows, 1).setFormulas(Array.from({ length: rows }, (_, i) => ['=IF($A' + (i + 2) + '="","",H' + (i + 2) + "-N(I" + (i + 2) + "))"]));
  if (sheet.getRange("A2").isBlank()) {
    sheet.getRange("A2:D2").setValues([["example", "Пример партнёра", "@telegram", 100]]);
  }
  [120, 180, 160, 150, 80, 100, 120, 120, 120, 110].forEach((w, i) => sheet.setColumnWidth(i + 1, w));
}
