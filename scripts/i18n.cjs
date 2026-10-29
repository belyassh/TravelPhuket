"use strict";
/**
 * Мультиязычность без зависимостей.
 *
 * Страницы строятся на русском (исходный язык), затем для каждого языка проходят через словарь i18n/<код>.json:
 * «русская строка» -> «перевод». Переводятся текстовые узлы, нужные атрибуты (placeholder, aria-label, alt, title,
 * meta content) и строки внутри JSON (JSON-LD, данные квиза). Строки с {0}, {1} работают как шаблоны:
 * "Взрослый — {0}" -> "Adult — {0}", а подставленные значения переводятся рекурсивно.
 * Чего нет в словаре, остаётся на русском; список таких строк пишется в i18n/missing/<код>.txt.
 */
const fs = require("fs");
const path = require("path");

const LANGS = {
  ru: { code: "RU", name: "Русский", html: "ru", hreflang: "ru", og: "ru_RU" },
  en: { code: "EN", name: "English", html: "en", hreflang: "en", og: "en_US" },
  kk: { code: "KZ", name: "Қазақша", html: "kk", hreflang: "kk", og: "kk_KZ" },
  zh: { code: "中文", name: "中文", html: "zh-Hans", hreflang: "zh-Hans", og: "zh_CN" },
  hi: { code: "HI", name: "हिन्दी", html: "hi", hreflang: "hi", og: "hi_IN" }
};
const DEFAULT_LANG = "ru";

// страницы, которые существуют только на русском (юридические тексты)
const RU_ONLY = new Set(["privacy.html", "refund-policy.html", "404.html"]);
const STATIC_RE = /^\/(assets|img)\/|\.(jpg|jpeg|png|webp|svg|ico|xml|txt|js|css|json|pdf|mp4)$/i;
const CYR = /[Ѐ-ӿ]/;

const decode = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
const encText = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const encAttr = (s) => encText(s).replace(/"/g, "&quot;");
const norm = (s) => String(s).replace(/[  ]/g, " ").replace(/\s+/g, " ").trim();
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function makeTranslator(entries) {
  const exact = new Map();
  const patterns = [];
  for (const [key, value] of Object.entries(entries || {})) {
    if (key.startsWith("_")) continue;
    const nk = norm(key);
    if (/\{\d+\}/.test(nk)) {
      const idx = [];
      let source = "";
      let literal = 0;
      nk.split(/(\{\d+\})/).forEach((part) => {
        const m = part.match(/^\{(\d+)\}$/);
        if (m) { idx.push(Number(m[1])); source += "(.+?)"; } else { source += escapeRe(part); literal += part.length; }
      });
      patterns.push({ re: new RegExp(`^${source}$`), idx, tpl: value, literal });
    } else exact.set(nk, value);
  }
  patterns.sort((a, b) => b.literal - a.literal);

  const tr = (input) => {
    const s = norm(input);
    if (exact.has(s)) return exact.get(s);
    for (const p of patterns) {
      const m = s.match(p.re);
      if (!m) continue;
      const args = [];
      p.idx.forEach((n, i) => { const t = tr(m[i + 1]); args[n] = t === null ? m[i + 1] : t; });
      return p.tpl.replace(/\{(\d+)\}/g, (_, n) => args[n] ?? "");
    }
    if (s.includes(" · ")) {
      const parts = s.split(" · ");
      const out = parts.map(tr);
      if (out.some((o) => o !== null)) return parts.map((part, i) => (out[i] === null ? part : out[i])).join(" · ");
    }
    return null;
  };
  return tr;
}

function loadDictionaries(root, languages) {
  const dict = {};
  for (const lang of languages) {
    if (lang === DEFAULT_LANG) continue;
    const file = path.join(root, "i18n", `${lang}.json`);
    let entries = {};
    try { entries = JSON.parse(fs.readFileSync(file, "utf-8")); } catch { /* нет словаря: всё остаётся на русском */ }
    dict[lang] = { entries, tr: makeTranslator(entries) };
  }
  return dict;
}

const pagePathOf = (rel) => `/${rel.replace(/index\.html$/, "")}`;
const isMulti = (rel) => !RU_ONLY.has(rel);
const localPath = (lang, rel) => {
  if (!isMulti(rel)) return lang === DEFAULT_LANG ? "/" : `/${lang}/`;
  const p = pagePathOf(rel);
  return lang === DEFAULT_LANG ? p : `/${lang}${p}`;
};

function prefixPath(lang, value) {
  const m = value.match(/^([^?#]*)(.*)$/);
  const p = m[1];
  if (!p.startsWith("/") || p.startsWith("//") || STATIC_RE.test(p)) return value;
  if (RU_ONLY.has(p.replace(/^\//, ""))) return value;
  return (p === "/" ? `/${lang}/` : `/${lang}${p}`) + m[2];
}

/**
 * ctx: { lang, rel, languages, siteUrl, dict, missing(Map), langNote }
 */
function localize(html, ctx) {
  const { lang, rel, languages, siteUrl } = ctx;
  const isDefault = lang === DEFAULT_LANG;
  const entry = ctx.dict[lang];
  const tr = entry ? entry.tr : () => null;
  const miss = (s) => {
    if (!ctx.missing || !CYR.test(s)) return;
    ctx.missing.set(s, (ctx.missing.get(s) || 0) + 1);
  };
  const t = (raw, decoded = false) => {
    const s = decoded ? raw : decode(raw);
    if (!CYR.test(s)) return null;
    const out = tr(s);
    if (out === null) { miss(norm(s)); return null; }
    return out;
  };

  const absPrefix = (value) => {
    if (isDefault) return value;
    if (value === siteUrl) return `${siteUrl}/${lang}/`;
    if (!value.startsWith(`${siteUrl}/`)) return value;
    return siteUrl + prefixPath(lang, value.slice(siteUrl.length));
  };

  const mapJson = (node, urls) => {
    if (typeof node === "string") {
      const out = isDefault ? null : t(node, true);
      const base = out === null ? node : out;
      return urls ? absPrefix(base) : base;
    }
    if (Array.isArray(node)) return node.map((x) => mapJson(x, urls));
    if (node && typeof node === "object") return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, mapJson(v, urls)]));
    return node;
  };

  const TEXT_ATTRS = /\s(placeholder|aria-label|title|alt|content|data-title-l|data-price-l|data-program-l|data-label-l)="([^"]*)"/g;
  const LINK_ATTRS = /\s(href|action)="([^"]*)"/g;
  const ABS_ATTRS = /\s(content)="([^"]*)"/g;

  const processTag = (tag) => {
    let out = tag;
    if (!isDefault) {
      out = out.replace(TEXT_ATTRS, (all, name, value) => {
        const r = t(value);
        return r === null ? all : ` ${name}="${encAttr(r)}"`;
      });
      out = out.replace(LINK_ATTRS, (all, name, value) => ` ${name}="${absPrefix(prefixPath(lang, value))}"`);
      out = out.replace(ABS_ATTRS, (all, name, value) => ` ${name}="${absPrefix(value)}"`);
      out = out.replace(/(<html\b[^>]*\blang=")[^"]*"/, `$1${LANGS[lang].html}"`);
      out = out.replace(/(property="og:locale"\s+content=")[^"]*"/, `$1${LANGS[lang].og}"`);
    }
    return out;
  };

  const parts = html.split(/(<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>|<[^>]+>)/);
  const out = parts.map((part) => {
    if (!part) return part;
    if (part.startsWith("<script")) {
      const m = part.match(/^(<script\b[^>]*type="application\/(ld\+json|json)"[^>]*>)([\s\S]*?)(<\/script>)$/);
      if (!m || isDefault) return part;
      try {
        const data = mapJson(JSON.parse(m[3]), m[2] === "ld+json");
        return `${m[1]}${JSON.stringify(data).replace(/</g, "\\u003c")}${m[4]}`;
      } catch { return part; }
    }
    if (part.startsWith("<style")) return part;
    if (part.startsWith("<")) return processTag(part);
    if (isDefault || !CYR.test(part)) return part;
    // текстовый узел: сохраняем окружающие пробелы
    const lead = part.match(/^\s*/)[0];
    const trail = part.match(/\s*$/)[0];
    const r = t(part.trim());
    return r === null ? part : `${lead}${encText(r)}${trail}`;
  }).join("");

  let result = out;

  // переключатель языков: ссылки на ту же страницу в других языках
  result = result.replace(/\{LANG:([a-z]{2})\}/g, (_, code) => localPath(code, rel));

  // hreflang: у каждой языковой версии одинаковый набор альтернатив
  let hreflang = "";
  if (isMulti(rel) && languages.length > 1) {
    hreflang = languages.map((code) => `<link rel="alternate" hreflang="${LANGS[code].hreflang}" href="${siteUrl}${localPath(code, rel)}" />`).join("\n  ")
      + `\n  <link rel="alternate" hreflang="x-default" href="${siteUrl}${localPath(DEFAULT_LANG, rel)}" />`;
  }
  result = result.replace("<!--HREFLANG-->", hreflang);

  // пометка на карточке: подробное описание пока только на русском
  const note = !isDefault && ctx.langNote ? `<p class="lang-note">${encText(ctx.langNote)}</p>` : "";
  result = result.replace("<!--LANGNOTE-->", note);
  return result;
}

module.exports = { LANGS, DEFAULT_LANG, RU_ONLY, loadDictionaries, localize, localPath, norm, CYR };
