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

// Helper fetch wrapper
async function cfFetch(path, options = {}) {
    const url = `${CF_WORKER_URL}${path}`;
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
    const { ok, data } = await cfFetch(`/api/products${qs}`);
    if (!ok || !data?.success) {
        console.error('[CloudflareClient] Failed to fetch products:', data);
        return [];
    }

    const products = data.products || [];

    const formatted = products.map(p => {
        const isVideo = p.media_type === 'video' || Boolean(p.is_video);
        const posterUrl = p.poster_url || p.poster_reference || 'assets/Logo%20Black.png';
        const videoUrl = isVideo ? (p.video_url || p.media_reference || p.image_url) : null;
        const mainImg = !isVideo ? (p.image_url || p.media_reference || 'assets/Logo%20Black.png') : posterUrl;

        const stock = p.total_stock !== undefined ? parseInt(p.total_stock) : 10;
        const priceVal = parseFloat(p.price || p.raw_price || 0);

        return {
            id: p.id,
            title: p.title,
            price: `KSh ${priceVal.toLocaleString()}`,
            raw_price: priceVal,
            image: mainImg,
            image_url: mainImg,
            // Video-First Architecture fields
            media_type: isVideo ? 'video' : 'image',
            is_video: isVideo,
            video_url: videoUrl,
            poster_url: posterUrl,
            category: (p.category || 'general').toLowerCase(),
            type: 'product',
            description: p.description || '',
            sku: p.sku || `AF-${(p.category || 'GE').substring(0, 3).toUpperCase()}-${p.id}`,
            stock,
            total_stock: stock,
            allow_preorder: Boolean(p.allow_preorder),
            is_featured: Boolean(p.is_featured),
            created_at: p.created_at
        };
    });

    window.productsData = formatted;
    return formatted;
}

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
    return data.customer;
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
window.cfPlaceOrder = cfPlaceOrder;
window.fetchCloudflareProduct = fetchCloudflareProduct;
window.CF_WORKER_URL = CF_WORKER_URL;

console.log('⚡ Anne\'s Fashion Cloudflare Client initialized with Worker:', CF_WORKER_URL);
