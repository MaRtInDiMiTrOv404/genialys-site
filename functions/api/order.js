/**
 * Cloudflare Pages Function — /api/order
 * ---------------------------------------------------------------
 * Receives a cart order from the static Genialys site, validates it,
 * recomputes the total server-side (NEVER trusts client prices),
 * and forwards the order to a Telegram chat via Bot API.
 *
 * Required environment variables (Cloudflare Pages → Settings → Environment variables):
 *   BOT_TOKEN  — Telegram bot token from @BotFather (e.g. "8851015854:AAEl...")
 *   CHAT_ID    — Your personal Telegram chat ID (numeric, e.g. "123456789")
 *
 * Security:
 *   - Origin / Referer check (only allows requests from your own site)
 *   - Method MUST be POST
 *   - Payload size limited to ~8KB
 *   - Field length limits enforced
 *   - All prices recomputed from this server-side catalog (client totals ignored)
 *   - Bot token NEVER exposed to the client
 *
 * Deploy: just push this file — Cloudflare Pages auto-detects /functions/api/order.js
 *         and exposes it at https://<your-site>.pages.dev/api/order
 */

// ============================================================
// SERVER-SOURCE-OF-TRUTH CATALOG
// Keep in sync with the client catalog in script.js.
// The client prices are ONLY for display — the server recomputes
// the total from these values to prevent price tampering.
// ============================================================
const CATALOG = {
    'genialys-1': { name: 'Genialys Peptide Serum · 1 брой', units: 1, price: 29.00 },
    'genialys-2': { name: 'Genialys Peptide Serum · 2 броя', units: 2, price: 49.00 },
    'genialys-3': { name: 'Genialys Peptide Serum · 3 броя', units: 3, price: 69.00 },
};

const SHIPPING_COST = 0; // free shipping

// ============================================================
// ALLOWED ORIGINS — only your deployed site(s) can call this API
// Add your Cloudflare Pages domain + any custom domains here.
// Local development (localhost) is also allowed.
// ============================================================
const ALLOWED_ORIGINS = [
    'https://genialys.pages.dev',          // default Cloudflare Pages subdomain
    'https://genialys-site.pages.dev',     // alternative name
    // 'https://genialys.store',           // uncomment when you wire up a custom domain
    // 'https://www.genialys.store',
];

// Telegram message size limit is 4096 chars — keep us well under that.
const MAX_TELEGRAM_MESSAGE = 4000;
const MAX_PAYLOAD_BYTES = 8192;
const MAX_ITEMS = 20;

// ============================================================
// HELPERS
// ============================================================

/** JSON response helper — sets CORS headers + JSON content type */
function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
        },
    });
}

/** Check whether the request origin matches our allowed list */
function isOriginAllowed(request) {
    const origin = request.headers.get('Origin') || '';
    const referer = request.headers.get('Referer') || '';
    // Always allow same-origin requests (Origin empty on same-origin in some browsers).
    if (!origin && !referer) return false;
    // Allow localhost during development
    if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) return true;
    if (referer.startsWith('http://localhost:') || referer.startsWith('http://127.0.0.1:')) return true;
    // Allow listed production origins
    if (origin && ALLOWED_ORIGINS.includes(origin)) return true;
    // If origin is empty but referer matches an allowed origin, allow it
    for (const allowed of ALLOWED_ORIGINS) {
        if (referer.startsWith(allowed + '/') || referer.startsWith(allowed)) return true;
    }
    return false;
}

/** Escape HTML special characters for safe Telegram HTML formatting */
function esc(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/** Validate and clamp input strings */
function clean(str, maxLen) {
    if (str === null || str === undefined) return '';
    return String(str).trim().slice(0, maxLen);
}

/** Validate the customer phone number (Bulgarian-friendly, lenient) */
function isValidPhone(phone) {
    if (!phone) return false;
    // Allow digits, spaces, dashes, parentheses, leading +
    const cleaned = phone.replace(/[\s\-()]/g, '');
    return /^\+?\d{6,15}$/.test(cleaned);
}

/** Build the Telegram message body (HTML formatting) */
function buildTelegramMessage(order) {
    const lines = [];
    lines.push('🔔 <b>Нова поръчка — Genialys</b>');
    lines.push(`📋 <b>Реф:</b> <code>${esc(order.ref)}</code>`);
    lines.push(`🕐 <b>Дата:</b> ${esc(new Date(order.placedAt).toLocaleString('bg-BG', { timeZone: 'Europe/Sofia' }))}`);
    lines.push('');
    lines.push('🛒 <b>Продукти:</b>');
    let totalBottles = 0;
    for (const item of order.items) {
        const p = CATALOG[item.id];
        const lineTotal = (p.price * item.count).toFixed(2);
        const bottles = p.units * item.count;
        totalBottles += bottles;
        const label = item.count > 1
            ? `${item.count} × ${p.name}`
            : p.name;
        lines.push(`   • ${esc(label)} — <b>€${lineTotal}</b> <i>(${bottles} серума)</i>`);
    }
    lines.push('');
    lines.push(`📦 <b>Общо серуми:</b> ${totalBottles} бр.`);
    lines.push(`🚚 <b>Доставка:</b> ${SHIPPING_COST === 0 ? 'Безплатна' : '€' + SHIPPING_COST.toFixed(2)}`);
    lines.push(`💰 <b>ОБЩО ЗА ПЛАЩАНЕ:</b> <b>€${order.total.toFixed(2)}</b>`);
    lines.push('');
    lines.push('👤 <b>Клиент:</b>');
    lines.push(`   <b>Име:</b> ${esc(order.customer.name)}`);
    lines.push(`   <b>Телефон:</b> ${esc(order.customer.phone)}`);
    lines.push(`   <b>Град:</b> ${esc(order.customer.city)}`);
    lines.push(`   <b>Адрес:</b> ${esc(order.customer.address)}`);
    lines.push(`   <b>Куриер:</b> ${esc(order.customer.courier)}`);
    lines.push(`   <b>Плащане:</b> ${esc(order.customer.payment)}`);
    if (order.customer.notes) {
        lines.push(`   <b>Бележка:</b> <i>${esc(order.customer.notes)}</i>`);
    }
    lines.push('');
    lines.push(`🌐 <i>Изпратено от: ${esc(order.source || 'unknown')}</i>`);

    let message = lines.join('\n');
    // Hard cap to Telegram's 4096-char limit
    if (message.length > MAX_TELEGRAM_MESSAGE) {
        message = message.slice(0, MAX_TELEGRAM_MESSAGE - 20) + '\n…<i>(отрязано)</i>';
    }
    return message;
}

/** Send the message to Telegram via Bot API */
async function sendToTelegram(botToken, chatId, text) {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const body = JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
    });
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
        throw new Error(`Telegram API error: ${data.description || res.statusText}`);
    }
    return data;
}

// ============================================================
// MAIN HANDLER
// ============================================================
export async function onRequestPost({ request, env }) {
    // 1. Origin check — reject foreign origins
    if (!isOriginAllowed(request)) {
        return json({ ok: false, error: 'Forbidden origin' }, 403);
    }

    // 2. Method check
    if (request.method !== 'POST') {
        return json({ ok: false, error: 'Method not allowed' }, 405);
    }

    // 3. Content-Type check
    const ct = request.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
        return json({ ok: false, error: 'Content-Type must be application/json' }, 415);
    }

    // 4. Payload size limit
    const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
    if (contentLength > MAX_PAYLOAD_BYTES) {
        return json({ ok: false, error: 'Payload too large' }, 413);
    }

    // 5. Parse JSON
    let body;
    try {
        body = await request.json();
    } catch (_) {
        return json({ ok: false, error: 'Invalid JSON' }, 400);
    }

    // 6. Required env vars
    const BOT_TOKEN = env && env.BOT_TOKEN;
    const CHAT_ID = env && env.CHAT_ID;
    if (!BOT_TOKEN || !CHAT_ID) {
        console.error('Missing BOT_TOKEN or CHAT_ID environment variables');
        return json({ ok: false, error: 'Server not configured' }, 500);
    }

    // 7. Validate items array
    const items = body && body.items;
    if (!Array.isArray(items) || items.length === 0) {
        return json({ ok: false, error: 'Количката е празна' }, 400);
    }
    if (items.length > MAX_ITEMS) {
        return json({ ok: false, error: 'Твърде много артикули' }, 400);
    }

    // 8. Recompute total SERVER-SIDE — ignore client-sent prices
    let total = 0;
    const sanitizedItems = [];
    for (const item of items) {
        const id = clean(item.id, 40);
        const count = parseInt(item.count, 10);
        if (!CATALOG[id]) {
            return json({ ok: false, error: `Невалиден продукт: ${id}` }, 400);
        }
        if (!Number.isInteger(count) || count < 1 || count > 99) {
            return json({ ok: false, error: `Невалидно количество за ${id}` }, 400);
        }
        total += CATALOG[id].price * count;
        sanitizedItems.push({ id, count });
    }
    total += SHIPPING_COST;

    // 9. Validate customer fields
    const customer = body.customer || {};
    const name    = clean(customer.name, 80);
    const phone   = clean(customer.phone, 30);
    const city    = clean(customer.city, 60);
    const address = clean(customer.address, 200);
    const courier = clean(customer.courier, 40);
    const payment = clean(customer.payment, 40);
    const notes   = clean(customer.notes, 400);

    if (name.length < 2)    return json({ ok: false, error: 'Името е задължително' }, 400);
    if (!isValidPhone(phone)) return json({ ok: false, error: 'Невалиден телефон' }, 400);
    if (city.length < 2)    return json({ ok: false, error: 'Градът е задължителен' }, 400);
    if (address.length < 5) return json({ ok: false, error: 'Адресът е задължителен' }, 400);
    if (!courier)           return json({ ok: false, error: 'Изберете куриер' }, 400);
    if (!payment)           return json({ ok: false, error: 'Изберете начин на плащане' }, 400);

    // 10. Build the order object
    const order = {
        ref:      clean(body.ref, 30) || ('GEN-' + Date.now().toString(36).toUpperCase().slice(-6)),
        items:    sanitizedItems,
        total,
        customer: { name, phone, city, address, courier, payment, notes },
        placedAt: clean(body.placedAt, 40) || new Date().toISOString(),
        source:   clean(body.source, 200),
    };

    // 11. Build Telegram message
    const message = buildTelegramMessage(order);

    // 12. Send to Telegram
    try {
        const tgResult = await sendToTelegram(BOT_TOKEN, CHAT_ID, message);
        return json({
            ok: true,
            ref: order.ref,
            total: order.total,
            messageId: tgResult.result && tgResult.result.message_id,
            sentAt: new Date().toISOString(),
        });
    } catch (err) {
        console.error('Telegram send failed:', err);
        return json({ ok: false, error: 'Грешка при изпращане до Telegram' }, 502);
    }
}

// Optional: handle GET for health check
export async function onRequestGet() {
    return json({
        ok: true,
        service: 'Genialys order API',
        methods: ['POST'],
        version: '1.0',
    });
}
