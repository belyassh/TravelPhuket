# Приём заявок в Telegram-бота

Сайт статичный, а токен бота нельзя хранить в JS на странице: любой посетитель его увидит и сможет рассылать от имени бота что угодно. Поэтому между сайтом и Telegram стоит маленький Cloudflare Worker (бесплатный тариф покрывает десятки тысяч заявок в месяц). Сайт может оставаться где угодно: GitHub Pages, обычный хостинг, Cloudflare Pages.

## 1. Создать бота (5 минут)

1. В Telegram откройте @BotFather → `/newbot` → задайте имя и username. Сохраните **токен**.
2. Откройте созданного бота и нажмите **Start**, иначе он не сможет вам писать.
3. Узнайте свой **chat_id**: напишите боту @userinfobot, он ответит числом (например `123456789`).
4. Если заявки должны приходить в группу (например, вам и партнёру): создайте группу, добавьте туда бота, затем откройте `https://api.telegram.org/bot<ТОКЕН>/getUpdates` после любого сообщения в группе. `chat.id` группы будет отрицательным числом (`-100…`).

Можно указать несколько получателей через запятую: `123456789,-1001234567890`.

## 2. Развернуть Worker (через браузер, без установки)

1. Зарегистрируйтесь на dash.cloudflare.com → **Workers & Pages** → **Create** → **Create Worker**, имя `niko-orders` → **Deploy**.
2. **Edit code**: удалите всё, вставьте содержимое `order-worker.js` → **Deploy**.
3. **Settings → Variables and Secrets** → добавьте:
   - `TELEGRAM_BOT_TOKEN`: тип **Secret**, токен из шага 1;
   - `TELEGRAM_CHAT_IDS`: тип Text, ваши chat_id через запятую;
   - `ALLOWED_ORIGINS`: тип Text, `https://nikophuket.com,https://www.nikophuket.com` (без слеша в конце).
4. Скопируйте адрес воркера (вида `https://niko-orders.<аккаунт>.workers.dev`).

Через консоль то же самое: `cd worker && npx wrangler deploy`, затем `npx wrangler secret put TELEGRAM_BOT_TOKEN`.

## 3. Подключить к сайту

В `data/excursions.json`:

```json
"orders": {
  "endpoint": "https://niko-orders.<аккаунт>.workers.dev",
  "whatsappNumber": "66812345678"
}
```

- `endpoint` включает кнопку «Отправить менеджеру» (заявка сразу падает в бота).
- `whatsappNumber` в международном формате, только цифры, включает кнопку WhatsApp.
- Пока `endpoint` пустой, кнопки бота нет, а «Написать в Telegram» становится основной. Пока пустой `whatsappNumber`, кнопки WhatsApp нет.
- Username менеджера для кнопки Telegram берётся из `telegram.managerUsername`.

Затем `npm run build` и выкладка как обычно.

## Проверка

```bash
curl -i -X POST https://niko-orders.<аккаунт>.workers.dev \
  -H "Origin: https://nikophuket.com" -H "Content-Type: application/json" \
  -d '{"text":"Тестовая заявка с сайта Niko Phuket: проверка связи"}'
```

Должен прийти `200 {"ok":true,"delivered":N}`, а в Telegram сообщение. Без заголовка `Origin` воркер отвечает 403, это защита от случайных обращений.

## Если начнётся спам

Воркер отсекает чужие домены, пустые и слишком длинные тексты и ловушку для ботов, но заголовок Origin подделывается вне браузера. Если появится спам, добавьте в Cloudflare правило **Security → WAF → Rate limiting** на адрес воркера (например, 5 запросов в минуту с одного IP) или подключите Turnstile.
