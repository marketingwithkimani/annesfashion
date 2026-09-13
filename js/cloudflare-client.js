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
        const cat = (p.category || 'general').toLowerCase();
        const titleLower = (p.title || '').toLowerCase();

        if (sizes.length === 0) {
            if (titleLower.includes('jean') || titleLower.includes('trouser') || titleLower.includes('short') || titleLower.includes('pant')) {
                sizes = ['28"', '30"', '32"', '34"', '36"'];
            } else if (cat === 'shoes' || titleLower.includes('heel') || titleLower.includes('sneaker') || titleLower.includes('shoe')) {
                sizes = ['37', '38', '39', '40', '41'];
            } else if (titleLower.includes('bra') || titleLower.includes('bust') || titleLower.includes('lingerie')) {
                sizes = ['32', '34', '36', '38'];
            } else if (['dresses', 'casual', 'corporate', 'weekend'].includes(cat)) {
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
            type: 'product',
            description: p.description || '',
            clean_description: p.clean_description || (p.description ? p.description.replace(/\[Variant Stock:[^\]]*\]/gi, '').replace(/\[Media:[^\]]*\]/gi, '').trim() : ''),
            sku: p.sku || `AF-${(p.category || 'GE').substring(0, 3).toUpperCase()}-${p.id}`,
            stock,
            total_stock: stock,
            allow_preorder: Boolean(p.allow_preorder),
            is_featured: Boolean(p.is_featured),
            sizes,
            colors,
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
window.cfCreateProduct = cfCreateProduct;
window.cfUpdateProduct = cfUpdateProduct;
window.cfDeleteProduct = cfDeleteProduct;
window.cfRequestUploadUrl = cfRequestUploadUrl;
window.cfDirectR2Upload = cfDirectR2Upload;
window.cfSaveMedia = cfSaveMedia;
window.CF_WORKER_URL = CF_WORKER_URL;

console.log('⚡ Anne\'s Fashion Cloudflare Client initialized with Worker:', CF_WORKER_URL);
