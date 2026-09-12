# Genialys Peptide Serum — Premium Static Landing Page + Telegram Order API

Премиум статичен sales-optimized landing page с интегрирана количка, която изпраща поръчките директно до вашия Telegram акаунт чрез Cloudflare Pages Functions.

## Структура

```
genialys-site/
├── index.html              # Single-page лендинг с интегриран bundle selector
├── styles.css              # Премиум дизайн (soft-pink, glassmorphism, modern SVG icons)
├── script.js               # Количка, bundle selector, checkout → POST /api/order
├── _headers                # Security headers + CORS за /api/*
├── _routes.json            # Казва на Cloudflare кои пътища са Functions
├── .nojekyll               # За GitHub Pages съвместимост
├── .gitignore              # Игнорира .env, .dev.vars, node_modules
├── wrangler.toml           # Конфиг за локален тест с wrangler
├── .dev.vars.example       # Template за локални env vars (копирай в .dev.vars)
├── assets/                 # 10 креатива от genialys.store
├── functions/
│   └── api/
│       └── order.js        # ⭐ Cloudflare Pages Function — изпраща в Telegram
└── README.md               # Този файл
```

## 🚀 Бърз старт за Cloudflare Pages

### Стъпка 1: Качване на сайта

1. Разархивирайте ZIP-а
2. Влезте в [Cloudflare Dashboard → Pages](https://dash.cloudflare.com/?to=/:account/pages)
3. **Create a project → Upload assets**
4. Качете цялата папка `genialys-site/` (drag & drop)
5. Дайте име на проекта (напр. `genialys`)
6. **Deploy**

След deploy ще получите URL като `https://genialys.pages.dev`.

### Стъпка 2: Намерете вашия Telegram Chat ID

Трябва да знаете вашия личен Chat ID, за да може ботът да ви праща съобщения.

1. Отворете Telegram и потърсете вашия бот: **@Genialys1bot**
2. Натиснете **Start** и изпратете каквото и да е съобщение (напр. "hello")
3. Отворете в браузъра:
   ```
   https://api.telegram.org/bot<TOKEN>/getUpdates
   ```
   (заместете `<TOKEN>` с вашия Bot Token)
4. Търсете в JSON-а `"chat":{"id":XXXXXXXXX,"first_name":"..."}`
5. **XXXXXXXXX** е вашият Chat ID (число, може да е негативно за групи)

### Стъпка 3: Задаване на Environment Variables

1. В Cloudflare Pages → вашия проект → **Settings**
2. **Environment variables** → **Production** → **Add variable**
3. Добавете:

   | Variable name | Value |
   |---------------|-------|
   | `BOT_TOKEN` | `8851015854:AAEl...qMY` (вашия бот токен) |
   | `CHAT_ID` | `123456789` (вашия личен Chat ID) |

4. **Save**
5. **Settings → Functions → Compatibility date** = `2024-09-01` (или по-нов)
6. Задължително: **Redeploy** проекта (Settings → Builds → Retry deployment)

### Стъпка 4: Тестване

1. Отворете сайта: `https://<your-project>.pages.dev/`
2. Добавете продукти в количката
3. Натиснете "Преминаване към плащане"
4. Попълнете формата и изпратете
5. Трябва да получите съобщение в Telegram от вашия бот

### Стъпка 5 (ВАЖНА): Регенерирайте токена

⚠️ Тъй като токенът `8851015854:AAEl...qMY` беше споделен в чат, **веднага**:

1. Отворете **@BotFather** в Telegram
2. Изпратете `/revoke` → изберете вашия бот
3. BotFather ще даде **нов** токен
4. Обновете `BOT_TOKEN` env var в Cloudflare с новия токен

---

## 📡 API Документация

### `POST /api/order`

Приема JSON с данни за поръчка, валидира ги, преизчислява цената на сървъра и изпраща форматирано съобщение до Telegram.

#### Request

```http
POST /api/order
Content-Type: application/json

{
  "ref": "GEN-AB12CD",
  "items": [
    { "id": "genialys-2", "count": 1 },
    { "genialys-3": "genialys-3", "count": 1 }
  ],
  "customer": {
    "name": "Мария Иванова",
    "phone": "0888 123 456",
    "city": "София",
    "address": "ул. Витоша 25, ет. 3, ап. 8",
    "courier": "econt-address",
    "payment": "cod-cash",
    "notes": "Звънне преди доставка"
  },
  "clientTotal": 118.00,
  "placedAt": "2026-09-12T12:00:00.000Z",
  "source": "https://genialys.pages.dev"
}
```

#### Response (успех)

```json
{
  "ok": true,
  "ref": "GEN-AB12CD",
  "total": 118.00,
  "messageId": 42,
  "sentAt": "2026-09-12T12:00:01.234Z"
}
```

#### Response (грешка)

```json
{
  "ok": false,
  "error": "Невалиден телефон"
}
```

HTTP статуси:
- `200` — успех
- `400` — невалидни данни
- `403` — забранен origin
- `405` — методът не е POST
- `413` — payload твърде голям
- `415` — Content-Type не е JSON
- `500` — липсват env vars
- `502` — грешка от Telegram API

---

## 🔒 Сигурност

### Какво защитаваме

1. **Bot Token НИКОГА не се показва в клиентския код** — само в Cloudflare env vars
2. **Origin check** в `order.js` — отхвърля заявки от чужди домейни
3. **CORS headers** в `_headers` — допълнителна защита
4. **Server-side price validation** — клиентът праща само `id` и `count`, сървърът преизчислява цената от собствения каталог
5. **Field length limits** — всички полета са ограничени (name ≤ 80, address ≤ 200, notes ≤ 400)
6. **Payload size limit** — 8KB max
7. **Phone validation** — regex за валиден формат
8. **HTML escaping** — всички данни се escape-ват преди да се изпратят в Telegram (предотвратява injection)

### Какво НЕ пазим в клиента

- ❌ Bot Token (само в `env.BOT_TOKEN`)
- ❌ Chat ID (само в `env.CHAT_ID`)
- ❌ Реални цени (клиентския total се игнорира)

---

## 🧪 Локален тест с Wrangler

```bash
# 1. Инсталирайте wrangler
npm install -g wrangler

# 2. Копирайте env файла и попълнете стойностите
cp .dev.vars.example .dev.vars
# Редактирайте .dev.vars с реалните BOT_TOKEN и CHAT_ID

# 3. Стартирайте локалния dev server
cd genialys-site
wrangler pages dev . --compatibility-date=2024-09-01

# 4. Отворете http://localhost:8788
```

---

## 📦 Деплойване в GitHub + Cloudflare auto-deploy

Вместо ръчно качване, можете да свържете GitHub repo:

1. Качете папката в GitHub repo (БЕЗ `.dev.vars`!)
2. Cloudflare Pages → **Create a project → Connect to Git**
3. Изберете repo-то
4. Build command: (празно) — статичен сайт
5. Build output directory: `.`
6. Задайте env vars (BOT_TOKEN, CHAT_ID) — стъпка 3 по-горе
7. **Save and Deploy**

При всеки `git push` Cloudflare ще redeploy-не автоматично.

---

## 🛒 Bundle цени

| Пакет | Бройки | Цена | Спестяване | Отстъпка |
|-------|--------|------|------------|---------|
| 1 Серум | 1 × 30мл | €29,00 | — | 0% |
| 2 Серума (⭐ Най-популярен) | 2 × 30мл | €49,00 | €9,00 | 15% |
| 3 Серума (🏆 Най-добра стойност) | 3 × 30мл | €69,00 | €18,00 | 21% |

⚠️ **ВАЖНО:** Ако промените цените в `script.js` (BUNDLES), **задължително** променете и същите в `functions/api/order.js` (CATALOG). Сървърът преизчислява total-а от CATALOG, така че несъответствие ще доведе до грешка при поръчка.

---

## 📞 Контакти (от оригиналния сайт)

- Телефон: **0876 966 886**
- Куриери: Еконт и Спиди (безплатна доставка)
- Плащане: наложен платеж
- Гаранция: 30 дни връщане на парите + 14 дни право на връщане

---

© 2026 Genialys · Всички права запазени
