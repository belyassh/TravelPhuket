# Niko Phuket

Витрина экскурсий, аренды и услуг на Пхукете: каталог, карточки, корзина и отправка заявок в Telegram-бота.
Статический сайт без зависимостей: сборка одним Node-скриптом, деплой на GitHub Pages.

## Воронка

каталог / поиск / меню → карточка → дата, гости → «Добавить в корзину» → «Выбрать ещё» (возврат в тот же каталог с тем же поиском) → корзина → имя, телефон, WhatsApp или Telegram → заявка в бота → окно «Менеджер свяжется с вами в рабочие часы».

## Команды

```bash
npm run build     # собирает сайт в dist/
npm run preview   # сборка + локальный сервер на http://localhost:5173
```

Node.js 18+. Устанавливать пакеты не нужно.

## Структура

| Путь | Назначение |
| --- | --- |
| `data/site.json` | Контакты, часы работы, адрес воркера, ID аналитики |
| `data/excursions.json`, `rentals.json`, `services.json` | Каталог. После правки достаточно `npm run build` |
| `scripts/build.cjs` | Генератор всех страниц, sitemap и robots |
| `src/styles/main.css` | Единый файл стилей |
| `src/scripts/site.js` | Фильтр и поиск, форма бронирования, корзина, отправка |
| `data/quiz.json` | Дерево квиза: вопросы, ответы, ссылки на экскурсии по `slug`, правила для детей и здоровья. Описание ниже |
| `content/` | Тексты политик (HTML-фрагменты) |
| `static/` | Копируется в корень сайта: логотип, favicon, CNAME, og-картинка |
| `worker/` | Cloudflare Worker: заявки в Telegram-бота. Настройка в `worker/README.md` |

## Что нужно заполнить перед запуском

1. В `data/site.json`: `contacts.whatsapp` (номер цифрами) и `orders.endpoint` (адрес воркера).
2. Создать бота и воркер: `worker/README.md`.

Пока `orders.endpoint` пуст, форма корзины покажет ошибку отправки и предложит написать напрямую в WhatsApp или Telegram.

## Как править каталог

Поля экскурсии в `data/excursions.json`: `slug`, `category` (`sea`, `land`, `show`), `topRank` (порядок на главной), `title`, `overview`, `description`, `programs[]` (`title`, `departure`, `price`, `priceLabel`, `pickupZones`, `notes`), `itinerary`, `included`, `bring`, `requirements`, `images`, `tags`.
`priceLabel` показывается как есть, если в нём есть сумма в THB; иначе цена строится из поля `price`.
Новые страницы, пункты меню и sitemap появляются автоматически.

## SEO

Для каждой страницы: уникальные title и description, canonical, Open Graph, хлебные крошки с микроразметкой, JSON-LD (TravelAgency, FAQPage, TouristTrip, Product, Service, ItemList). Корзина закрыта от индексации. Адреса карточек (`/excursions/<slug>.html`) сохранены.

## Квиз

Страница `/quiz/`, точки входа: кнопка в шапке героя, пункт «Подобрать тур» в меню, баннер на главной.
Всё дерево лежит в `data/quiz.json`: узел (`nodes`) содержит вопрос и ответы, ответ ведёт либо в следующий узел (`next`), либо к результату (`result`: список `slug` позиций каталога). Ответ может ставить флаг (`flag`), а `rules` по флагу скрывает позиции (`exclude`). Если после фильтра ничего не осталось, показывается `fallback`. Опечатка в `slug` ломает сборку с понятным сообщением.
