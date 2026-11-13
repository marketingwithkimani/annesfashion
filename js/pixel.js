/**
 * Anne's Fashion Line — Meta (Facebook) Pixel Engine
 * E-commerce & FB Ads Conversion Tracking
 * Tracks: PageView, ViewContent, AddToCart, InitiateCheckout, Purchase, Contact (WhatsApp)
 */
(function () {
    'use strict';

    // Standard Meta Pixel base snippet
    !function(f,b,e,v,n,t,s)
    {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
    n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s)}(window, document,'script',
    'https://connect.facebook.net/en_US/fbevents.js');

    function getPixelId() {
        return window.FB_PIXEL_ID || localStorage.getItem('fb_pixel_id') || '';
    }

    function initMetaPixel(id) {
        if (!id) return;
        try {
            fbq('init', String(id).trim());
            fbq('track', 'PageView');
            console.log('[Meta Pixel] Initialized with ID:', id);
        } catch (err) {
            console.warn('[Meta Pixel] Init error:', err);
        }
    }

    // Global tracking functions for FB Ads conversions
    window.trackFBPixel = function(eventName, params = {}) {
        if (typeof window.fbq === 'function') {
            window.fbq('track', eventName, params);
            console.log(`[Meta Pixel] Tracked '${eventName}':`, params);
        }
    };

    window.trackFBAddToCart = function(item) {
        if (!item) return;
        const price = typeof item.price === 'number'
            ? item.price
            : parseFloat(String(item.price || 0).replace(/[^0-9.]/g, '')) || 0;
        window.trackFBPixel('AddToCart', {
            content_ids: [String(item.id || item.product_id || '')],
            content_name: item.title || item.name || 'Fashion Item',
            content_type: 'product',
            value: price,
            currency: 'KES'
        });
    };

    window.trackFBInitiateCheckout = function(items, totalValue) {
        const ids = (items || []).map(i => String(i.id || i.product_id || ''));
        window.trackFBPixel('InitiateCheckout', {
            content_ids: ids,
            content_type: 'product',
            value: totalValue || 0,
            currency: 'KES',
            num_items: (items || []).length
        });
    };

    window.trackFBPurchase = function(orderResult, payload) {
        let value = 0;
        if (payload && Array.isArray(payload.items)) {
            value = payload.items.reduce((sum, i) => sum + (Number(i.unit_price || 0) * Number(i.quantity || 1)), 0);
        }
        const orderId = (orderResult && (orderResult.sale_number || orderResult.id)) || 'ORD_' + Date.now();
        window.trackFBPixel('Purchase', {
            content_type: 'product',
            value: value,
            currency: 'KES',
            order_id: String(orderId)
        });
    };

    window.trackFBContact = function(channel = 'WhatsApp') {
        window.trackFBPixel('Contact', {
            content_name: channel,
            source: window.location.pathname
        });
    };

    window.setFBPixelId = function(newId) {
        if (!newId) return;
        const trimmed = String(newId).trim();
        localStorage.setItem('fb_pixel_id', trimmed);
        initMetaPixel(trimmed);
    };

    // Auto-initialize if pixel ID is stored or passed via config
    const currentId = getPixelId();
    if (currentId) {
        initMetaPixel(currentId);
    } else {
        // Attempt to fetch from API settings
        const apiBase = (typeof CF_WORKER_URL !== 'undefined' ? CF_WORKER_URL : 'https://api.annesfashion.co.ke');
        fetch(`${apiBase}/api/settings`).then(r => r.json()).then(data => {
            if (data && data.fb_pixel_id) {
                localStorage.setItem('fb_pixel_id', data.fb_pixel_id);
                initMetaPixel(data.fb_pixel_id);
            }
        }).catch(() => {});
    }

    // Auto-attach listeners on DOM ready
    document.addEventListener('DOMContentLoaded', function () {
        // 1. WhatsApp click tracking
        document.querySelectorAll('a[href*="wa.me"], a[href*="whatsapp.com"]').forEach(el => {
            el.addEventListener('click', function () {
                window.trackFBContact('WhatsApp');
            });
        });

        // 2. ViewContent tracking on product-detail page
        if (window.location.pathname.includes('product-detail')) {
            let tracked = false;
            const checkProduct = setInterval(() => {
                const titleEl = document.querySelector('.product-title, #productTitle, h1');
                const priceEl = document.querySelector('.current-price, .product-price, #productPrice');
                if (titleEl && priceEl && !tracked) {
                    tracked = true;
                    clearInterval(checkProduct);
                    const urlParams = new URLSearchParams(window.location.search);
                    const pid = urlParams.get('id') || urlParams.get('listing_id') || '';
                    const priceVal = parseFloat(priceEl.textContent.replace(/[^0-9.]/g, '')) || 0;
                    window.trackFBPixel('ViewContent', {
                        content_ids: [pid],
                        content_name: titleEl.textContent.trim(),
                        content_type: 'product',
                        value: priceVal,
                        currency: 'KES'
                    });
                }
            }, 400);
            setTimeout(() => clearInterval(checkProduct), 8000);
        }
    });
})();

