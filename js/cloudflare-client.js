// =====================================================
// Cloudflare Worker Client — Anne's Fashion Line
// Replaces Supabase JS SDK
// Production Worker: https://client-api.marketingwithkimani.workers.dev
// Database: Cloudflare D1 (client-production)
// Media: Cloudflare Stream (Videos) & R2 (Images/Posters)
// =====================================================

const CF_WORKER_URL = (function () {
    if (typeof localStorage !== 'undefined') {
        const override = localStorage.getItem('CF_WORKER_URL');
        if (override) return override.replace(/\/$/, '');
    }
    // Production Custom Domain
    return 'https://api.annesfashion.co.ke';
})();

// Helper fetch wrapper with cache-busting to ensure real-time product updates
async function cfFetch(path, options = {}) {
    const isGet = !options.method || options.method.toUpperCase() === 'GET';
    const sep = path.includes('?') ? '&' : '?';
    const url = isGet ? `${CF_WORKER_URL}${path}${sep}_t=${Date.now()}` : `${CF_WORKER_URL}${path}`;
    try {
        const res = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...(options.headers || {})
            }
        });
        const data = await res.json();
        return { ok: res.ok, status: res.status, data };
    } catch (err) {
        console.error('[CloudflareClient] Network error:', err);
        return { ok: false, status: 0, data: null, error: err.message };
    }
}

// =====================================================
// Products — Fetch all active products from Cloudflare Worker
// =====================================================
async function fetchCloudflareProducts({ category, search } = {}) {
    const params = new URLSearchParams();
    if (category && category !== 'all') params.set('category', category);
    if (search) params.set('search', search);

    const qs = params.toString() ? `?${params}` : '';
    let products = [];
    const { ok, data } = await cfFetch(`/api/products${qs}`);
    if (ok && data?.success && Array.isArray(data.products)) {
        products = data.products;
    } else {
        console.warn('[CloudflareClient] Worker fetch unavailable or empty, trying fallback sources...', data);
        // Try local backend if accessible
        try {
            const localRes = await fetch(`api/products/list.php${qs}`);
            if (localRes.ok) {
                const localData = await localRes.json();
                if (localData?.success && Array.isArray(localData.data)) {
                    products = localData.data;
                }
            }
        } catch (e) {}

        // If still empty, use localStorage cache
        if (products.length === 0) {
            try {
                const cached = localStorage.getItem('annes_products_cache');
                if (cached) {
                    const parsed = JSON.parse(cached);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        window.productsData = parsed;
                        return parsed;
                    }
                }
            } catch (e) {}
            return [];
        }
    }

    function extractVariantsFromText(desc) {
        const sizeSet = new Set();
        const colorSet = new Set();
        let qty = 0;
        if (!desc || typeof desc !== 'string') return { sizes: [], colors: [], qty: 0 };

        const sizeRegex = /Size\s+([^:,\n\]•]+?)(?::|\s*pcs|\s*,|\s*\])/gi;
        let m;
        while ((m = sizeRegex.exec(desc)) !== null) {
            let s = m[1].trim().replace(/^["']|["']$/g, '');
            if (s) sizeSet.add(s);
        }

        const colorRegex1 = /(?:Variant Stock:|,)\s*([A-Za-z\s]+?)\s*•/gi;
        while ((m = colorRegex1.exec(desc)) !== null) {
            let c = m[1].trim();
            if (c && !c.toLowerCase().startsWith('size') && !c.toLowerCase().startsWith('variant')) colorSet.add(c);
        }

        const colorRegex2 = /Colour\s+([^:,\n\]•]+?)(?::|\s*pcs|\s*,|•|\])/gi;
        while ((m = colorRegex2.exec(desc)) !== null) {
            let c = m[1].trim();
            if (c) colorSet.add(c);
        }

        const qtyRegex = /(\d+)\s*pcs/gi;
        while ((m = qtyRegex.exec(desc)) !== null) {
            qty += parseInt(m[1], 10);
        }

        return { sizes: Array.from(sizeSet), colors: Array.from(colorSet), qty };
    }

    const formatted = products.map(p => {
        const isVideo = p.media_type === 'video' || Boolean(p.is_video);
        const posterUrl = p.poster_url || p.poster_reference || 'assets/Logo%20Black.png';
        
        let videoUrl = isVideo ? (p.video_url || p.media_reference) : null;
        // Don't treat a png/jpg image as a video source
        if (videoUrl && (videoUrl.includes('.png') || videoUrl.includes('.jpg') || videoUrl.includes('.webp') || videoUrl.includes('.jpeg'))) {
            videoUrl = null;
        }
        if (isVideo && !videoUrl && p.description) {
            const m = p.description.match(/\[Media:\s*(https?:\/\/[^\]\s]+(?:\.mp4|\.webm|\.mov)?)/i);
            if (m && m[1]) videoUrl = m[1].trim();
        }

        const mainImg = (!isVideo || !posterUrl || posterUrl.includes('Logo%20Black.png'))
            ? (p.image_url || p.primary_image_url || 'assets/Logo%20Black.png')
            : posterUrl;

        const vParsed = extractVariantsFromText(p.description);
        const sizeSet = new Set();
        const parseAndAdd = (val) => {
            if (!val) return;
            if (typeof val === 'string') {
                const clean = val.trim();
                if (clean === 'null' || clean === 'undefined' || !clean) return;
                try {
                    const parsed = JSON.parse(clean);
                    if (Array.isArray(parsed)) {
                        parsed.forEach(s => s && sizeSet.add(String(s).trim()));
                        return;
                    }
                } catch (e) {}
                clean.split(',').forEach(s => s && sizeSet.add(String(s).trim()));
            } else if (Array.isArray(val)) {
                val.forEach(s => s && sizeSet.add(String(s).trim()));
            }
        };

        parseAndAdd(p.waist_sizes);
        parseAndAdd(p.bust_sizes);
        parseAndAdd(p.shoe_sizes);
        parseAndAdd(p.sizes);
        (vParsed.sizes || []).forEach(s => sizeSet.add(s));

        let sizes = Array.from(sizeSet).filter(Boolean);
        // Normalize category names to match page URL keys
        const catRaw = (p.category || 'general').toLowerCase().trim();
        const catMap = {
            'casualwear': 'casual', 'casual wear': 'casual', 'casual-wear': 'casual', 'clothes': 'casual', 'clothing': 'casual',
            'tops': 'casual', 'top': 'casual', 't-shirts': 'casual', 't-shirt': 'casual',
            'corporatewear': 'corporate', 'corporate wear': 'corporate', 'corporate-wear': 'corporate',
            'officewear': 'corporate', 'office wear': 'corporate', 'office': 'corporate', 'suits': 'corporate', 'suit': 'corporate',
            'weekendwear': 'weekend', 'weekend wear': 'weekend', 'lifestyle': 'weekend',
            'dresswear': 'dresses', 'dress': 'dresses', 'dresses': 'dresses',
            'sweaters & outerwear': 'sweaters', 'sweaters-outerwear': 'sweaters', 'sweaters': 'sweaters', 'sweater': 'sweaters', 'outerwear': 'sweaters',
            'trousers & bottoms': 'trousers', 'trousers-bottoms': 'trousers', 'trousers': 'trousers', 'trouser': 'trousers', 'bottoms': 'trousers', 'bottom': 'trousers', 'pants': 'trousers', 'jeans': 'trousers', 'jean': 'trousers',
            'jumpsuits & sets': 'jumpsuits', 'jumpsuits-sets': 'jumpsuits', 'jumpsuits': 'jumpsuits', 'jumpsuit': 'jumpsuits', 'matching sets': 'jumpsuits', 'sets': 'jumpsuits', 'set': 'jumpsuits', 'co-ord': 'jumpsuits', 'co-ords': 'jumpsuits', 'loungewear': 'jumpsuits',
            'accessories': 'accessories', 'accessory': 'accessories', 'belts': 'accessories', 'sunglasses': 'accessories',
            'innerwear': 'innerwear', 'inner wear': 'innerwear', 'bra': 'innerwear', 'stockings': 'innerwear', 'boob tapes': 'innerwear',
            'beauty products': 'beauty', 'beauty / women\'s wellness': 'beauty', 'women\'s wellness': 'beauty', 'wellness': 'beauty', 'beauty': 'beauty', 'makeup': 'beauty', 'beautymakeup': 'beauty', 'beauty & makeup': 'beauty', 'skincare': 'beauty',
            'hair': 'wigs', 'hairwigs': 'wigs', 'wig': 'wigs', 'wigs & hair': 'wigs', 'wigs': 'wigs',
            'shoe': 'shoes', 'shoes & sneakers': 'shoes', 'footwear': 'shoes', 'heels': 'shoes', 'sneakers': 'shoes', 'shoes': 'shoes'
        };
        const cat = catMap[catRaw] || catRaw;
        const titleLower = (p.title || '').toLowerCase();

        if (sizes.length === 0) {
            if (titleLower.includes('jean') || titleLower.includes('trouser') || titleLower.includes('short') || titleLower.includes('pant')) {
                sizes = ['28"', '30"', '32"', '34"', '36"'];
            } else if (cat === 'shoes' || titleLower.includes('heel') || titleLower.includes('sneaker') || titleLower.includes('shoe')) {
                sizes = ['37', '38', '39', '40', '41'];
            } else if (titleLower.includes('bra') || titleLower.includes('bust') || titleLower.includes('lingerie')) {
                sizes = ['32', '34', '36', '38'];
            } else if (['dresses', 'casual', 'corporate', 'weekend', 'sweaters', 'trousers', 'jumpsuits', 'innerwear'].includes(cat)) {
                sizes = ['S', 'M', 'L', 'XL'];
            }
        }

        let colors = (Array.isArray(p.colors) && p.colors.length > 0) ? p.colors : vParsed.colors;
        let stock = p.total_stock !== undefined ? parseInt(p.total_stock) : 10;
        if (stock === 0 && vParsed.qty > 0) stock = vParsed.qty;

        const priceVal = parseFloat(p.price || p.raw_price || 0);

        return {
            id: p.id,
            title: p.title,
            price: `KSh ${priceVal.toLocaleString()}`,
            raw_price: priceVal,
            image: mainImg,
            image_url: mainImg,
            // Video-First Architecture fields (Cloudflare R2)
            media_type: isVideo ? 'video' : 'image',
            is_video: isVideo,
            video_url: videoUrl,
            video_key: p.video_key || null,
            poster_url: posterUrl,
            video_poster_key: p.video_poster_key || null,
            video_mime_type: p.video_mime_type || null,
            video_duration_seconds: p.video_duration_seconds || null,
            media: p.media || [],
            images: p.images || [],
            category: cat,
            raw_category: p.category || '',
            subcategory: p.subcategory || null,
            type: 'product',
            description: p.description || '',
            clean_description: p.clean_description || (p.description ? p.description.replace(/\[Variant Stock:[^\]]*\]/gi, '').replace(/\[Media:[^\]]*\]/gi, '').trim() : ''),
            sku: p.sku || `AF-${(p.category || 'GE').substring(0, 3).toUpperCase()}-${p.id}`,
            stock,
            total_stock: stock,
            allow_preorder: Boolean(p.allow_preorder),
            is_featured: Boolean(p.is_featured),
            is_flash_sale: Boolean(p.is_flash_sale),
            sizes,
            colors,
            created_at: p.created_at
        };
    });

    // Ensure products are always sorted strictly newest first so new uploads appear first on homepage
    formatted.sort((a, b) => {
        const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
        if (timeB !== timeA) return timeB - timeA;
        return (b.id || 0) - (a.id || 0);
    });

    try {
        localStorage.setItem('annes_products_cache', JSON.stringify(formatted));
    } catch (e) {}

    window.productsData = formatted;
    return formatted;
}

// Global category URL resolver: ensures no product ever links to a 404
window.getCategoryPage = function (cat) {
    if (!cat) return 'casual.html';
    const c = String(cat).toLowerCase().trim();
    if (c.includes('dress')) return 'dresses.html';
    if (c.includes('corp') || c.includes('office') || c.includes('suit')) return 'corporate.html';
    if (c.includes('week') || c.includes('life')) return 'weekend.html';
    if (c.includes('shoe') || c.includes('heel') || c.includes('sneak') || c.includes('boot') || c.includes('sandal') || c.includes('flat')) return 'shoes.html';
    if (c.includes('wig') || c.includes('hair')) return 'wigs.html';
    if (c.includes('beauty') || c.includes('makeup') || c.includes('skin') || c.includes('wellness')) return 'beauty.html';
    if (c.includes('sweater') || c.includes('outer') || c.includes('jacket') || c.includes('coat') || c.includes('blazer') || c.includes('kimono') || c.includes('miyaki')) return 'sweaters.html';
    if (c.includes('trouser') || c.includes('jean') || c.includes('bottom') || c.includes('pant') || c.includes('palazzo') || c.includes('short') || c.includes('legging')) return 'trousers.html';
    if (c.includes('jumpsuit') || c.includes('set') || c.includes('coord') || c.includes('co-ord') || c.includes('lounge')) return 'jumpsuits.html';
    if (c.includes('access') || c.includes('belt') || c.includes('glass') || c.includes('watch') || c.includes('ring') || c.includes('brooch') || c.includes('fedora') || c.includes('chain')) return 'accessories.html';
    if (c.includes('inner') || c.includes('bra') || c.includes('stocking') || c.includes('tape')) return 'innerwear.html';
    return 'casual.html';
};

// =====================================================
// Single Product Detail
// =====================================================
async function fetchCloudflareProduct(id) {
    const { ok, data } = await cfFetch(`/api/products/${id}`);
    if (!ok || !data?.success) {
        console.error('[CloudflareClient] Failed to fetch product detail:', data);
        return null;
    }
    return data.product;
}

// =====================================================
// Listing Detail (Parent Video Showcase with 1-3 Pieces)
// =====================================================
async function fetchCloudflareListing(id) {
    const { ok, data } = await cfFetch(`/api/listings/${id}`);
    if (!ok || !data?.success) {
        console.error('[CloudflareClient] Failed to fetch listing detail:', data);
        return null;
    }
    return data.listing;
}

// =====================================================
// Product Management (Admin CRUD)
// =====================================================

/**
 * Creates a new product on Cloudflare D1
 */
async function cfCreateProduct(productData, adminToken = '') {
    const token = adminToken || localStorage.getItem('admin_token') || '';
    const { ok, data } = await cfFetch('/api/products', {
        method: 'POST',
        headers: {
            'X-Admin-Token': token,
            'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify(productData)
    });
    if (!ok || !data?.success) {
        throw new Error(data?.error || 'Failed to create product');
    }
    return data;
}

/**
 * Updates an existing product on Cloudflare D1
 */
async function cfUpdateProduct(id, productData, adminToken = '') {
    const token = adminToken || localStorage.getItem('admin_token') || '';
    const { ok, data } = await cfFetch(`/api/products/${id}`, {
        method: 'PUT',
        headers: {
            'X-Admin-Token': token,
            'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify(productData)
    });
    if (!ok || !data?.success) {
        throw new Error(data?.error || 'Failed to update product');
    }
    return data;
}

/**
 * Soft-archives a product on Cloudflare D1
 */
async function cfDeleteProduct(id, adminToken = '') {
    const token = adminToken || localStorage.getItem('admin_token') || '';
    const { ok, data } = await cfFetch(`/api/products/${id}`, {
        method: 'DELETE',
        headers: {
            'X-Admin-Token': token,
            'Authorization': token ? `Bearer ${token}` : ''
        }
    });
    if (!ok || !data?.success) {
        throw new Error(data?.error || 'Failed to delete product');
    }
    return data;
}

// =====================================================
// Cloudflare R2 Direct Media Upload (Images & Videos)
// =====================================================

/**
 * Request a presigned PUT URL from Cloudflare Worker for direct R2 upload
 */
async function cfRequestUploadUrl(key, contentType, fileSize, adminToken = '') {
    const token = adminToken || localStorage.getItem('admin_token') || '';
    const { ok, data } = await cfFetch('/api/media/upload-url', {
        method: 'POST',
        headers: {
            'X-Admin-Token': token,
            'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ key, contentType, fileSize })
    });
    if (!ok || !data?.success) {
        throw new Error(data?.error || 'Failed to generate upload URL');
    }
    return data; // { success: true, uploadUrl, key, mediaUrl, expiresAt }
}

/**
 * Directly upload binary data to Cloudflare R2 using the presigned URL
 */
async function cfDirectR2Upload(uploadUrl, file, contentType) {
    const response = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
            'Content-Type': contentType
        },
        body: file
    });
    if (!response.ok) {
        throw new Error(`R2 upload failed: HTTP ${response.status} ${response.statusText}`);
    }
    return true;
}

/**
 * Saves media association in D1
 */
async function cfSaveMedia(mediaData, adminToken = '') {
    const token = adminToken || localStorage.getItem('admin_token') || '';
    const { ok, data } = await cfFetch('/api/media/save', {
        method: 'POST',
        headers: {
            'X-Admin-Token': token,
            'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify(mediaData)
    });
    if (!ok || !data?.success) {
        throw new Error(data?.error || 'Failed to save media metadata');
    }
    return data;
}

// =====================================================
// Settings — Fetch site settings from Cloudflare Worker
// =====================================================
async function fetchCloudflareSettings() {
    const { ok, data } = await cfFetch('/api/settings');
    if (!ok || !data?.success) return {};
    window.siteSettings = data.settings || {};
    return data.settings || {};
}

// =====================================================
// Customer Authentication (Phone + PIN)
// =====================================================
async function cfCustomerAuth(phone, pin = '', name = '') {
    const { ok, data } = await cfFetch('/api/client/auth', {
        method: 'POST',
        body: JSON.stringify({ phone, pin, name })
    });
    if (!ok || !data?.success) {
        throw new Error(data?.error || 'Authentication failed');
    }
    return data;
}

// =====================================================
// Order Placement
// =====================================================
async function cfPlaceOrder(orderData) {
    const { ok, data } = await cfFetch('/api/client/order', {
        method: 'POST',
        body: JSON.stringify(orderData)
    });
    if (!ok || !data?.success) {
        throw new Error(data?.error || 'Order placement failed');
    }
    return data;
}

// =====================================================
// Real-time Poll Listener (Every 30s)
// Replaces Supabase WebSocket Subscriptions
// =====================================================
let pollTimer = null;
let lastPollTimestamp = new Date().toISOString();

function subscribeToCloudflarePoll(onProductsChange, onSettingsChange) {
    if (pollTimer) clearInterval(pollTimer);

    pollTimer = setInterval(async () => {
        try {
            const { ok, data } = await cfFetch(`/api/products/poll?since=${encodeURIComponent(lastPollTimestamp)}`);
            if (ok && data?.has_updates) {
                lastPollTimestamp = data.timestamp;
                if (typeof onProductsChange === 'function') onProductsChange();
                if (typeof onSettingsChange === 'function') onSettingsChange();
            }
        } catch (e) {
            // Silently ignore background polling glitches
        }
    }, 30000);
}

// =====================================================
// Backward Compatibility Shims for Supabase SDK calls
// =====================================================
window.fetchSupabaseProducts = fetchCloudflareProducts;
window.fetchSupabaseSettings = fetchCloudflareSettings;
window.subscribeToSupabaseRealtime = subscribeToCloudflarePoll;
window.cfCustomerAuth = cfCustomerAuth;
window.supabaseClientAuth = cfCustomerAuth;
window.cfPlaceOrder = cfPlaceOrder;
window.fetchCloudflareProduct = fetchCloudflareProduct;
window.fetchCloudflareListing = fetchCloudflareListing;
window.cfCreateProduct = cfCreateProduct;
window.cfUpdateProduct = cfUpdateProduct;
window.cfDeleteProduct = cfDeleteProduct;
window.cfRequestUploadUrl = cfRequestUploadUrl;
window.cfDirectR2Upload = cfDirectR2Upload;
window.cfSaveMedia = cfSaveMedia;
window.CF_WORKER_URL = CF_WORKER_URL;

console.log('⚡ Anne\'s Fashion Cloudflare Client initialized with Worker:', CF_WORKER_URL);

// =====================================================
// Real-Time First-Party Analytics Event Logger
// =====================================================
(function initFirstPartyAnalytics() {
    try {
        const page = window.location.pathname.split('/').pop() || 'index.html';
        const urlParams = new URLSearchParams(window.location.search);
        const productId = urlParams.get('id') || urlParams.get('listing_id') || null;

        const utmSource = urlParams.get('utm_source') || urlParams.get('ref') || null;
        const ref = document.referrer || '';
        let detectedSource = utmSource;
        if (!detectedSource && ref) {
            const refLow = ref.toLowerCase();
            if (refLow.includes('instagram.com')) detectedSource = 'instagram';
            else if (refLow.includes('tiktok.com')) detectedSource = 'tiktok';
            else if (refLow.includes('facebook.com') || refLow.includes('fb.com')) detectedSource = 'facebook';
            else if (refLow.includes('whatsapp.com') || refLow.includes('wa.me')) detectedSource = 'whatsapp';
            else if (refLow.includes('google.com')) detectedSource = 'google';
        }

        let sessionId = localStorage.getItem('af_session_token');
        if (!sessionId) {
            sessionId = 'af_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
            localStorage.setItem('af_session_token', sessionId);
        }

        const payload = {
            event_type: productId ? 'product_view' : 'page_view',
            page: page,
            product_id: productId ? parseInt(productId) : null,
            session_id: sessionId,
            referrer: ref,
            source: detectedSource || 'direct'
        };

        const endpoint = `${CF_WORKER_URL}/api/analytics/event`;
        if (navigator.sendBeacon) {
            navigator.sendBeacon(endpoint, JSON.stringify(payload));
        } else {
            fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                keepalive: true
            }).catch(() => {});
        }
    } catch (e) {
        // Safe fail
    }
})();
