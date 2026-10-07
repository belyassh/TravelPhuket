# Niko Travel Phuket

Сайт-витрина туристического агентства на Пхукете с единой каталоговой лентой: экскурсии, аренда и дополнительные услуги в одном интерфейсе.

Проект построен на Vite, контент управляется JSON-данными, а SEO-страницы карточек и разделов генерируются автоматически перед `dev` и `build`.

## Что реализовано

- Единый каталог на главной: экскурсии, аренда, услуги.
- Табы категорий: `Все`, `Морские`, `Наземные`, `Шоу`, `Бордеран и визаран`, `Аренда`, `Другие услуги`.
- Полнотекстовый поиск по каталогу.
- SEO-страницы карточек и разделов (генерация из JSON).
- Форма подбора на главной странице.
- Корзина заявок: экскурсии, аренда и услуги добавляются со страниц карточек (программа, дата, взрослые/дети), корзина общая для всех страниц.
- Оформление: имя, телефон, отель для трансфера, затем выбор канала: Telegram-бот (автоматически), личка в Telegram или WhatsApp.
- Передача UTM и click-id параметров в заявки.
- Событие `generate_lead` для аналитики/рекламы.
- Адаптивная верстка для мобильных устройств и десктопа.

## Технологии

- Vite 5
- Vanilla JS (ES modules)
- HTML + CSS
- Node.js script для генерации статических страниц

## Быстрый старт

```bash
npm install
npm run dev
```

По умолчанию локальный адрес: `http://localhost:5173`.

## Команды

```bash
npm run dev      # predev -> генерация страниц, затем запуск Vite
npm run build    # prebuild -> генерация страниц, затем production build
npm run preview  # локальный просмотр dist
```

## Структура проекта

| Путь | Назначение |
| --- | --- |
| index.html | Главная страница и шаблон карточки каталога |
| styles/main.css | Основные стили и адаптивные брейкпоинты |
| scripts/app.js | Логика каталога, фильтров, формы подбора и аналитики |
| scripts/cart.js | Корзина и отправка заявок (копируется в `public/scripts/`) |
| worker/ | Cloudflare Worker: заявки в Telegram-бота |
| scripts/generate-pages.cjs | Генерация SEO-страниц и sitemap |
| data/excursions.json | Данные экскурсий + конфигурация агентства |
| data/rentals.json | Данные аренды |
| data/services.json | Данные дополнительных услуг |
| excursions/ | Сгенерированные страницы экскурсий (корень для прямых маршрутов) |
| rental/ | Сгенерированные страницы аренды (корень для прямых маршрутов) |
| services/ | Сгенерированные страницы услуг (корень для прямых маршрутов) |
| public/excursions/ | Копии страниц для сборки Vite |
| public/rental/ | Копии страниц для сборки Vite |
| public/services/ | Копии страниц для сборки Vite |
| robots.txt, sitemap.xml, 404.html | Базовый SEO и служебные страницы |

## Как управлять контентом

1. Обновите данные в JSON:
- `data/excursions.json`
- `data/rentals.json`
- `data/services.json`
2. Запустите `npm run dev` или `npm run build`.
3. Генератор пересоберет карточки, разделы и sitemap автоматически.

## Важные поля конфигурации

В `data/excursions.json`:

- `agency.currency` - валюта цен (`USD`, `EUR` и т.д.)
- `telegram.managerUsername` - username менеджера без `@`
- `orders.endpoint` - адрес Cloudflare Worker, который пересылает заявки в Telegram-бота (см. `worker/README.md`)
- `orders.whatsappNumber` - номер WhatsApp менеджера цифрами, например `66812345678`

## Лиды и аналитика

При отправке форм передаются:

- UTM: `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`
- Click IDs: `gclid`, `fbclid`, `yclid`, `msclkid`
- Контекст: `landingPage`, `lastPage`, `referrer`

Заявка собирается в корзине (`scripts/cart.js`) и уходит одним сообщением. Настройка бота и воркера: `worker/README.md`.

## Деплой

Автодеплой на GitHub Pages настроен через workflow:

- `.github/workflows/deploy-pages.yml`

Обычно достаточно push в `main`: pipeline выполняет `npm ci` + `npm run build` и публикует `dist`.

## SEO чек перед запуском на домене

Перед релизом на свой домен проверьте:

1. Canonical и OG URL в `index.html`.
2. URL в `robots.txt` (строка `Sitemap`).
3. URL в `sitemap.xml`.
4. Наличие `CNAME` в `public/` (если используется GitHub Pages custom domain).

## Примечания

- Не открывайте `index.html` напрямую из файловой системы: нужен локальный сервер.
- Генерация страниц выполняется автоматически через `predev`/`prebuild`.
- В проекте предусмотрены fallback-изображения для карточек без валидных URL.