/* ====================================================================
   Genialys Peptide Serum — Sales-Optimized Landing Page
   JavaScript: cart, bundles, checkout, gallery, sticky CTA, UX
   ==================================================================== */

(function () {
    'use strict';

    /* ---------------- CONFIG ---------------- */
    const BUNDLES = {
        1: { id: 'genialys-1', name: 'Genialys Peptide Serum · 1 брой',    units: 1, price: 29.00, image: 'assets/product-main.webp' },
        2: { id: 'genialys-2', name: 'Genialys Peptide Serum · 2 броя',    units: 2, price: 49.00, image: 'assets/product-main.webp' },
        3: { id: 'genialys-3', name: 'Genialys Peptide Serum · 3 броя',    units: 3, price: 69.00, image: 'assets/product-main.webp' },
    };

    /* ---------------- STATE ----------------
       Each cart line: { id, name, units, price, image, count }
       - units  = bottles inside the bundle (1, 2, or 3)
       - price  = TOTAL bundle price (already discounted)
       - count  = how many times this bundle was added (default 1)
       Total bottles = sum(units * count)
       Total amount  = sum(price  * count)
    */
    const STATE = {
        cart: [],
        lastBundle: null,
    };

    /* ---------------- DOM HELPERS ---------------- */
    const $  = (sel, ctx = document) => ctx.querySelector(sel);
    const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
    const money = (n) => '€' + n.toFixed(2).replace('.', ',');

    /* ============================================================
       GALLERY: hero thumbnail switching
       ============================================================ */
    function initGallery() {
        const main = $('#heroMainImg');
        const thumbs = $$('.thumb');
        thumbs.forEach((t) => {
            t.addEventListener('click', () => {
                thumbs.forEach((x) => x.classList.remove('active'));
                t.classList.add('active');
                main.style.opacity = '0';
                setTimeout(() => {
                    main.src = t.dataset.img;
                    main.style.opacity = '1';
                }, 180);
            });
        });
    }

    /* ============================================================
       CART: open / close / render / count
       ============================================================ */
    function openCart() {
        $('#cartDrawer').classList.add('is-open');
        $('#cartOverlay').classList.add('is-open');
        document.body.style.overflow = 'hidden';
    }

    function closeCart() {
        $('#cartDrawer').classList.remove('is-open');
        $('#cartOverlay').classList.remove('is-open');
        document.body.style.overflow = '';
    }

    function addToCart(bundleId) {
        const b = BUNDLES[bundleId];
        if (!b) return;
        const existing = STATE.cart.find((i) => i.id === b.id);
        if (existing) {
            existing.count += 1; // increase line count (one more bundle of same type)
        } else {
            STATE.cart.push({ ...b, count: 1 });
        }
        renderCart();
        updateCartCount();
        toast(`✓ Добавено в количката: ${b.name}`);
        openCart();
        STATE.lastBundle = bundleId;
    }

    function removeFromCart(id) {
        STATE.cart = STATE.cart.filter((i) => i.id !== id);
        renderCart();
        updateCartCount();
    }

    // Total price = sum(price * count) — `price` is already the discounted bundle total
    function cartTotal() {
        return STATE.cart.reduce((sum, i) => sum + i.price * i.count, 0);
    }

    // Total bottles in cart = sum(units * count)
    function cartCount() {
        return STATE.cart.reduce((sum, i) => sum + i.units * i.count, 0);
    }

    function renderCart() {
        const body = $('#cartBody');
        const footer = $('#cartFooter');
        if (STATE.cart.length === 0) {
            body.innerHTML = '<p class="cart-empty">Количката ви е празна.</p>';
            footer.style.display = 'none';
            return;
        }
        footer.style.display = 'block';
        body.innerHTML = STATE.cart.map((i) => {
            const lineTotal = i.price * i.count;
            const bottles = i.units * i.count;
            const countLabel = i.count > 1 ? `${i.count} × ${i.name}` : i.name;
            return `
                <div class="cart-line" data-id="${i.id}">
                    <img src="${i.image}" alt="${escapeHtml(i.name)}">
                    <div class="cart-line-info">
                        <h4>${escapeHtml(countLabel)}</h4>
                        <small>${bottles} серума общо · ${money(i.price)} / пакет</small>
                    </div>
                    <div class="cart-line-actions">
                        <span class="cart-line-price">${money(lineTotal)}</span>
                        <button class="cart-line-remove" data-remove="${i.id}">Премахни</button>
                    </div>
                </div>
            `;
        }).join('');

        // Wire remove buttons
        $$('.cart-line-remove', body).forEach((btn) => {
            btn.addEventListener('click', () => removeFromCart(btn.dataset.remove));
        });

        $('#cartTotal').textContent = money(cartTotal());
    }

    function updateCartCount() {
        const c = cartCount();
        const el = $('#cartCount');
        el.textContent = c;
        if (c > 0) el.classList.add('is-active');
        else el.classList.remove('is-active');
    }

    /* ============================================================
       CHECKOUT MODAL
       ============================================================ */
    function openCheckout() {
        if (STATE.cart.length === 0) {
            toast('Количката ви е празна. Изберете пакет.');
            return;
        }
        renderOrderSummary();
        $('#checkoutModal').classList.add('is-open');
        $('#modalOverlay').classList.add('is-open');
        document.body.style.overflow = 'hidden';
    }

    function closeCheckout() {
        $('#checkoutModal').classList.remove('is-open');
        $('#modalOverlay').classList.remove('is-open');
        document.body.style.overflow = '';
    }

    function renderOrderSummary() {
        const summary = $('#orderSummary');
        if (!summary) return;
        let rows = STATE.cart.map((i) => {
            const lineTotal = i.price * i.count;
            const bottles = i.units * i.count;
            const label = i.count > 1
                ? `${i.count} × ${i.name} (${bottles} серума)`
                : `${i.name} (${bottles} серума)`;
            return `
                <div class="order-summary-row">
                    <span>${escapeHtml(label)}</span>
                    <span>${money(lineTotal)}</span>
                </div>
            `;
        }).join('');
        const totalBottles = STATE.cart.reduce((s, i) => s + i.units * i.count, 0);
        rows += `
            <div class="order-summary-row">
                <span>🚚 Доставка</span>
                <span>Безплатна</span>
            </div>
            <div class="order-summary-row">
                <span>📦 Общо серуми</span>
                <span>${totalBottles} бр.</span>
            </div>
            <div class="order-summary-row total">
                <span>Общо за плащане</span>
                <span>${money(cartTotal())}</span>
            </div>
        `;
        summary.innerHTML = rows;
    }

    /* ============================================================
       SERVER-VALIDATED PRODUCT CATALOG
       The Cloudflare Function uses the SAME catalog to recompute
       the total. Client prices are only used for display — the
       server is the source of truth. NEVER trust client totals.
       ============================================================ */
    const SERVER_CATALOG = {
        'genialys-1': { name: 'Genialys Peptide Serum · 1 брой', units: 1, price: 29.00 },
        'genialys-2': { name: 'Genialys Peptide Serum · 2 броя', units: 2, price: 49.00 },
        'genialys-3': { name: 'Genialys Peptide Serum · 3 броя', units: 3, price: 69.00 },
    };

    /* ============================================================
       SUBMIT CHECKOUT — POST to /api/order (Cloudflare Pages Function)
       ============================================================ */
    async function submitCheckout(e) {
        e.preventDefault();
        const form = e.target;
        const submitBtn = form.querySelector('button[type="submit"]');
        const formData = Object.fromEntries(new FormData(form).entries());

        // Validate cart is not empty
        if (STATE.cart.length === 0) {
            toast('Количката е празна.');
            return;
        }

        // Build the order payload — client sends only the bundle IDs + counts.
        // The server recomputes prices from its own catalog to prevent tampering.
        const items = STATE.cart.map((i) => ({
            id: i.id,        // e.g. "genialys-2"
            count: i.count,  // how many of this bundle
        }));

        const payload = {
            ref: 'GEN-' + Date.now().toString(36).toUpperCase().slice(-6),
            items,
            customer: {
                name:    (formData.name    || '').slice(0, 80),
                phone:   (formData.phone   || '').slice(0, 30),
                city:    (formData.city    || '').slice(0, 60),
                address: (formData.address || '').slice(0, 200),
                courier: formData.courier  || '',
                payment: formData.payment  || '',
                notes:   (formData.notes   || '').slice(0, 400),
            },
            // Client-side total is sent for logging only — server recomputes.
            clientTotal: cartTotal(),
            placedAt: new Date().toISOString(),
            source: location.origin,
        };

        // Disable button + show loading state
        const originalBtnText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="btn-spinner"></span> Изпращане...';

        try {
            const res = await fetch('/api/order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            let data;
            const contentType = res.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
                data = await res.json();
            } else {
                const text = await res.text();
                throw new Error(text || 'Сървърът върна невалиден отговор');
            }

            if (!res.ok) {
                throw new Error(data.error || `Грешка ${res.status}`);
            }

            // Success — Telegram message was sent
            closeCheckout();
            STATE.cart = [];
            renderCart();
            updateCartCount();
            form.reset();

            // Keep a local copy for the user's reference
            try {
                const all = JSON.parse(localStorage.getItem('genialys_orders') || '[]');
                all.push({
                    ref: payload.ref,
                    placedAt: payload.placedAt,
                    status: 'sent',
                    serverTotal: data.total,
                });
                localStorage.setItem('genialys_orders', JSON.stringify(all));
            } catch (_) {}

            toast(`✓ Поръчката е изпратена! Референция: ${payload.ref}. Ще се свържем с вас на ${escapeHtml(formData.phone || '')}.`, 7000);

        } catch (err) {
            console.error('Order submission failed:', err);
            toast('✗ Възникна грешка при изпращане: ' + (err.message || 'Unknown'), 6000);
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
        }
    }

    /* ============================================================
       TOAST
       ============================================================ */
    let toastTimer = null;
    function toast(message, duration = 3500) {
        const el = $('#toast');
        el.textContent = message;
        el.classList.add('is-visible');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => el.classList.remove('is-visible'), duration);
    }

    /* ============================================================
       STICKY MOBILE CTA
       ============================================================ */
    function initStickyCta() {
        const cta = $('#stickyCta');
        const bundlesSection = $('#bundles');
        if (!cta || !bundlesSection) return;
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) cta.classList.remove('is-visible');
                    else if (entry.boundingClientRect.top < 0) cta.classList.add('is-visible');
                });
            },
            { threshold: 0.05 }
        );
        observer.observe(bundlesSection);
    }

    /* ============================================================
       SCROLL FADE-IN: reveal-on-scroll (progressive enhancement)
       Only hide elements once JS is confirmed to be running.
       If JS fails or IntersectionObserver is unavailable,
       elements remain visible (no broken UX).
       ============================================================ */
    function initReveal() {
        // Mark body so CSS knows JS is enabled (used for progressive enhancement)
        document.body.classList.add('js-ready');

        // Bail out if IntersectionObserver isn't supported — keep everything visible.
        if (!('IntersectionObserver' in window)) return;

        const items = $$(
            '.benefit-card, .step-card, .testimonial-card, .bundle-card, .info-card, .faq-item, .ing-item, .ing-stat'
        );
        if (items.length === 0) return;

        const io = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('is-revealed');
                        io.unobserve(entry.target);
                    }
                });
            },
            { threshold: 0.05, rootMargin: '0px 0px -40px 0px' }
        );
        items.forEach((el) => io.observe(el));

        // Safety net: if any item is still pending after 1500ms (e.g., user hasn't scrolled),
        // reveal everything so nothing stays hidden.
        setTimeout(() => {
            items.forEach((el) => el.classList.add('is-revealed'));
        }, 1500);
    }

    /* ============================================================
       HEADER shadow on scroll
       ============================================================ */
    function initHeaderShadow() {
        const header = $('#header');
        let last = window.scrollY;
        function onScroll() {
            const y = window.scrollY;
            if (y > 8) header.style.boxShadow = '0 4px 16px rgba(26, 22, 17, 0.08)';
            else header.style.boxShadow = 'none';
            last = y;
        }
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
    }

    /* ============================================================
       SCROLL PROGRESS BAR (top of page)
       ============================================================ */
    function initScrollProgress() {
        const bar = $('#scrollProgress');
        if (!bar) return;
        function onScroll() {
            const scrollTop = window.scrollY;
            const docHeight = document.documentElement.scrollHeight - window.innerHeight;
            const pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
            bar.style.width = pct + '%';
        }
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
    }

    /* ============================================================
       HERO BUNDLE SELECTOR — interactive radio-style cards
       Lets users pick bundle directly in hero (no scroll needed)
       ============================================================ */
    let selectedBundle = '2'; // default: most popular (matches HTML pre-selected)

    function initBundleSelector() {
        const options = $$('.bs-option');
        const heroTotal = $('#heroTotal');
        const heroBuyBtn = $('#heroBuyBtn');
        if (options.length === 0 || !heroTotal) return;

        // Sync the displayed total on load
        updateHeroTotal();

        options.forEach((opt) => {
            opt.addEventListener('click', () => {
                options.forEach((o) => {
                    o.classList.remove('is-selected');
                    o.setAttribute('aria-checked', 'false');
                });
                opt.classList.add('is-selected');
                opt.setAttribute('aria-checked', 'true');
                selectedBundle = opt.dataset.bundle;
                updateHeroTotal();
            });
        });

        if (heroBuyBtn) {
            heroBuyBtn.addEventListener('click', () => {
                addToCart(selectedBundle);
            });
        }
    }

    function updateHeroTotal() {
        const heroTotal = $('#heroTotal');
        if (!heroTotal) return;
        const b = BUNDLES[selectedBundle];
        if (!b) return;
        heroTotal.textContent = money(b.price);
        // Subtle pulse animation on change
        heroTotal.style.color = 'var(--color-accent-deep)';
        setTimeout(() => { heroTotal.style.color = ''; }, 600);
    }

    /* ============================================================
       SMOOTH SCROLL for hash links + close cart on nav
       ============================================================ */
    function initSmoothScroll() {
        $$('a[href^="#"]').forEach((a) => {
            a.addEventListener('click', (e) => {
                const id = a.getAttribute('href');
                if (id.length > 1) {
                    const target = document.querySelector(id);
                    if (target) {
                        e.preventDefault();
                        const top = target.getBoundingClientRect().top + window.scrollY - 70;
                        window.scrollTo({ top, behavior: 'smooth' });
                    }
                }
            });
        });
    }

    /* ============================================================
       UTIL: escape HTML
       ============================================================ */
    function escapeHtml(s) {
        if (s === null || s === undefined) return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /* ============================================================
       INIT
       ============================================================ */
    function init() {
        initGallery();
        initSmoothScroll();
        initHeaderShadow();
        initScrollProgress();
        initStickyCta();
        initReveal();
        initBundleSelector();

        // Cart open/close
        $('#cartBtn').addEventListener('click', openCart);
        $('#cartClose').addEventListener('click', closeCart);
        $('#cartOverlay').addEventListener('click', closeCart);
        $('#modalClose').addEventListener('click', closeCheckout);
        $('#modalOverlay').addEventListener('click', closeCheckout);
        $('#checkoutBtn').addEventListener('click', openCheckout);
        $('#checkoutForm').addEventListener('submit', submitCheckout);

        // Bundle add-to-cart (the detailed comparison section further down)
        $$('.bundle-add').forEach((btn) => {
            btn.addEventListener('click', () => addToCart(btn.dataset.bundle));
        });

        // ESC closes modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeCart();
                closeCheckout();
            }
        });

        // Initial render
        renderCart();
        updateCartCount();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
