// =====================================================
// Supabase Frontend Client & Realtime Manager
// Anne's Fashion Line
// =====================================================

const SUPABASE_URL = 'https://yteejssnesajnuibfacx.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_l-fKjBTzFUvE__qQrQEZRw_V2_2LAmv';

// Initialize Supabase Client
if (typeof supabase !== 'undefined' && supabase.createClient) {
    window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('Supabase JS Client Initialized 🚀');
} else {
    console.warn('Supabase SDK not loaded yet. Will initialize when ready.');
}

function getSupabase() {
    if (!window.supabaseClient && typeof supabase !== 'undefined' && supabase.createClient) {
        window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    return window.supabaseClient;
}

/**
 * Fetch all active products live from Supabase
 */
async function fetchSupabaseProducts() {
    const client = getSupabase();
    if (!client) {
        console.error('Supabase client missing');
        return [];
    }

    try {
        // Query products with inventory and images
        const { data: products, error } = await client
            .from('products')
            .select('*')
            .eq('is_active', true)
            .order('id', { ascending: true });

        if (error) {
            console.error('Error fetching products from Supabase:', error);
            return [];
        }

        // Fetch image gallery for products
        const { data: images } = await client.from('product_images').select('*');
        const imagesByProduct = {};
        if (images) {
            images.forEach(img => {
                if (!imagesByProduct[img.product_id]) imagesByProduct[img.product_id] = [];
                imagesByProduct[img.product_id].push(img.image_url);
            });
        }

        // Fetch inventory stock
        const { data: inv } = await client.from('inventory').select('*');
        const stockByProduct = {};
        if (inv) {
            inv.forEach(i => {
                stockByProduct[i.product_id] = (stockByProduct[i.product_id] || 0) + (i.quantity || 0);
            });
        }

        // Fetch product variants
        let variantsByProduct = {};
        try {
            const { data: variants } = await client.from('product_variants').select('*').eq('is_active', true);
            if (variants && Array.isArray(variants)) {
                variants.forEach(v => {
                    if (!variantsByProduct[v.product_id]) variantsByProduct[v.product_id] = [];
                    variantsByProduct[v.product_id].push(v);
                });
            }
        } catch (vErr) {
            console.warn('Notice: product_variants table check:', vErr.message);
        }

        // Helper to extract clean array of sizes from all Supabase fields & variants
        function extractProductSizes(p, pVariants = []) {
            const sizeSet = new Set();

            const parseAndAdd = (val) => {
                if (!val) return;
                if (typeof val === 'string') {
                    try {
                        const parsed = JSON.parse(val);
                        if (Array.isArray(parsed)) {
                            parsed.forEach(s => s && sizeSet.add(String(s).trim()));
                            return;
                        }
                    } catch (e) {}
                    val.split(',').forEach(s => s && sizeSet.add(String(s).trim()));
                } else if (Array.isArray(val)) {
                    val.forEach(s => s && sizeSet.add(String(s).trim()));
                }
            };

            // 1. Check all Supabase size columns
            parseAndAdd(p.sizes);
            parseAndAdd(p.shoe_sizes);
            parseAndAdd(p.waist_sizes);
            parseAndAdd(p.bust_sizes);

            // 2. Check product_variants table
            pVariants.forEach(v => {
                if (v && v.size && String(v.size).trim()) {
                    sizeSet.add(String(v.size).trim());
                }
            });

            // 3. Check variant stock notes in description e.g. "[Variant Stock: Black • Size 38: 1 pcs...]"
            if (p.description && typeof p.description === 'string' && p.description.includes('Variant Stock:')) {
                const regex = /Size\s+([^:,\n\]•]+):/gi;
                let match;
                while ((match = regex.exec(p.description)) !== null) {
                    if (match[1] && match[1].trim()) sizeSet.add(match[1].trim());
                }
            }

            const extracted = Array.from(sizeSet).filter(Boolean);
            if (extracted.length > 0) return extracted;

            // Fallback: only for standard apparel categories if no sizes were specified
            const category = (p.category || '').toLowerCase();
            if (['dresses', 'casual', 'corporate', 'weekend'].includes(category)) {
                return ["S", "M", "L", "XL"];
            }
            return [];
        }

        // Helper to extract clean array of colors from Supabase fields & variants
        function extractProductColors(p, pVariants = []) {
            const colorSet = new Set();

            const parseAndAdd = (val) => {
                if (!val) return;
                if (typeof val === 'string') {
                    try {
                        const parsed = JSON.parse(val);
                        if (Array.isArray(parsed)) {
                            parsed.forEach(c => c && colorSet.add(String(c).trim()));
                            return;
                        }
                    } catch (e) {}
                    val.split(',').forEach(c => c && colorSet.add(String(c).trim()));
                } else if (Array.isArray(val)) {
                    val.forEach(c => c && colorSet.add(String(c).trim()));
                }
            };

            // 1. Check colors column
            parseAndAdd(p.colors);

            // 2. Check product_variants table
            pVariants.forEach(v => {
                if (v && v.color && String(v.color).trim()) {
                    colorSet.add(String(v.color).trim());
                }
            });

            // 3. Check description for variant stock notation
            if (p.description && typeof p.description === 'string' && p.description.includes('Variant Stock:')) {
                const regex = /(?:Variant Stock:|,)\s*([A-Za-z0-9\s]+)\s*•/gi;
                let match;
                while ((match = regex.exec(p.description)) !== null) {
                    if (match[1] && match[1].trim()) colorSet.add(match[1].trim());
                }
            }

            return Array.from(colorSet).filter(Boolean);
        }

        // Format products for site consumption
        const formatted = products.map(p => {
            const extraImgs = imagesByProduct[p.id] || [];
            let mainImg = p.image_url || (extraImgs.length > 0 ? extraImgs[0] : '');

            // Fallback for content:// URIs from Android app photo picker or missing images
            if (!mainImg || mainImg.startsWith('content://')) {
                const validGalleryImg = extraImgs.find(url => url && !url.startsWith('content://') && (url.startsWith('http://') || url.startsWith('https://')));
                if (validGalleryImg) {
                    mainImg = validGalleryImg;
                } else {
                    mainImg = 'assets/Logo%20Black.png';
                }
            }

            const stock = p.total_stock !== undefined && p.total_stock !== null ? parseInt(p.total_stock) : (stockByProduct[p.id] !== undefined ? stockByProduct[p.id] : 10);
            const priceVal = parseFloat(p.price || 0);
            const pVariants = variantsByProduct[p.id] || [];
            const realSizes = extractProductSizes(p, pVariants);
            const realColors = extractProductColors(p, pVariants);

            return {
                id: p.id,
                title: p.title,
                price: `KSh ${priceVal.toLocaleString()}`,
                raw_price: priceVal,
                image: mainImg,
                image_url: mainImg,
                category: (p.category || 'general').toLowerCase(),
                type: 'product',
                description: p.description || '',
                sku: p.sku || `LK-${(p.category || 'GE').substring(0, 2).toUpperCase()}-${p.id}`,
                stock: stock,
                total_stock: stock,
                allow_preorder: Boolean(p.allow_preorder),
                is_featured: Boolean(p.is_featured),
                sizes: realSizes,
                colors: realColors,
                shoe_sizes: p.shoe_sizes || [],
                waist_sizes: p.waist_sizes || [],
                bust_sizes: p.bust_sizes || [],
                variants: pVariants,
                gallery: extraImgs
            };
        });

        window.productsData = formatted;
        return formatted;
    } catch (err) {
        console.error('Failed to query Supabase products:', err);
        return [];
    }
}

/**
 * Fetch site settings live from Supabase
 */
async function fetchSupabaseSettings() {
    const client = getSupabase();
    if (!client) return {};

    try {
        const { data, error } = await client.from('settings').select('*');
        if (error || !data) return {};

        const settingsMap = {};
        data.forEach(item => {
            settingsMap[item.setting_key] = item.setting_value;
        });

        window.siteSettings = settingsMap;
        return settingsMap;
    } catch (err) {
        console.error('Error fetching settings:', err);
        return {};
    }
}

/**
 * Real-time Subscription Listener for Supabase
 */
function subscribeToSupabaseRealtime(onProductChange, onSettingChange) {
    const client = getSupabase();
    if (!client) return;

    console.log('Subscribing to Supabase Realtime Channels ⚡');

    client
        .channel('public-site-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, async (payload) => {
            console.log('⚡ Realtime update: products', payload);
            await fetchSupabaseProducts();
            if (typeof onProductChange === 'function') onProductChange(payload);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, async (payload) => {
            console.log('⚡ Realtime update: inventory', payload);
            await fetchSupabaseProducts();
            if (typeof onProductChange === 'function') onProductChange(payload);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, async (payload) => {
            console.log('⚡ Realtime update: settings', payload);
            const settings = await fetchSupabaseSettings();
            if (typeof onSettingChange === 'function') onSettingChange(settings, payload);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'preorders' }, async (payload) => {
            console.log('⚡ Realtime update: preorders', payload);
            if (typeof onProductChange === 'function') onProductChange(payload);
        })
        .subscribe((status) => {
            console.log('Supabase Realtime status:', status);
        });
}

/**
 * Customer Authentication & Auto-Registration directly via Supabase
 */
async function supabaseClientAuth(phone, pin, name = 'Babe', location = 'Nairobi') {
    const client = getSupabase();
    if (!client) throw new Error('Supabase client unavailable');

    // Normalize phone number
    let cleanPhone = phone.replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('254') && cleanPhone.length === 12) {
        cleanPhone = '0' + cleanPhone.substring(3);
    } else if (cleanPhone.length === 9) {
        cleanPhone = '0' + cleanPhone;
    }
    const intPhone = '254' + cleanPhone.substring(1);

    // Look up customer by phone
    const { data: existing, error: searchError } = await client
        .from('customers')
        .select('*')
        .or(`phone.eq.${cleanPhone},phone.eq.${intPhone}`)
        .limit(1);

    if (searchError) {
        console.error('Supabase customer search error:', searchError);
    }

    if (existing && existing.length > 0) {
        const cust = existing[0];
        // Logged in customer
        return {
            success: true,
            customer: {
                id: cust.id,
                name: cust.name || name,
                phone: cleanPhone,
                city: cust.city || location
            },
            message: `Welcome back, gorgeous ${cust.name || name}! 💕`
        };
    }

    // New Customer Registration
    const { data: newCust, error: insertError } = await client
        .from('customers')
        .insert([{
            name: name || 'Queen',
            phone: cleanPhone,
            city: location || 'Nairobi',
            customer_type: 'online',
            address: JSON.stringify({ delivery_location: location, pin: pin })
        }])
        .select();

    if (insertError) {
        console.error('Customer registration error:', insertError);
        throw new Error(insertError.message || 'Could not register customer');
    }

    const created = newCust && newCust[0] ? newCust[0] : { id: Date.now(), name: name, phone: cleanPhone, city: location };
    return {
        success: true,
        customer: {
            id: created.id,
            name: created.name,
            phone: cleanPhone,
            city: created.city
        },
        message: "Welcome to Anne's Fashion, babe! ✨ You look stunning."
    };
}

/**
 * Submit Customer Order directly to Supabase sales & sale_items
 */
async function supabaseCreateOrder(orderData) {
    const client = getSupabase();
    if (!client) throw new Error('Supabase client unavailable');

    const saleNumber = 'SALE-' + new Date().toISOString().slice(0,10).replace(/-/g,'') + '-' + Math.random().toString(36).substring(2, 7).toUpperCase();
    const txRef = orderData.transaction_reference || ('MPESA-' + Math.random().toString(36).substring(2, 10).toUpperCase());
    const notes = `Online Order | Location: ${orderData.delivery_location || 'Nairobi'} | Notes: ${orderData.delivery_notes || 'None'}`;

    let totalAmount = 0;
    const itemsToInsert = [];

    (orderData.items || []).forEach(item => {
        const qty = item.quantity || 1;
        const price = parseFloat(item.raw_price || item.price || 0);
        const itemTotal = price * qty;
        totalAmount += itemTotal;

        itemsToInsert.push({
            product_id: item.id || null,
            product_title: item.title || 'Fashion Item',
            quantity: qty,
            unit_price: price,
            total_price: itemTotal
        });
    });

    // 1. Insert into sales table
    const { data: sale, error: saleError } = await client
        .from('sales')
        .insert([{
            sale_number: saleNumber,
            sale_type: 'online',
            customer_id: orderData.customer_id || null,
            customer_name: orderData.customer_name || 'Queen',
            total_amount: totalAmount,
            payment_method: 'mpesa',
            payment_status: 'paid',
            transaction_reference: txRef,
            notes: notes
        }])
        .select();

    if (saleError) {
        console.error('Error saving sale to Supabase:', saleError);
        throw new Error(saleError.message || 'Failed to place order');
    }

    const saleId = sale && sale[0] ? sale[0].id : null;

    // 2. Insert items into sale_items table
    if (saleId && itemsToInsert.length > 0) {
        const fullItems = itemsToInsert.map(it => ({ ...it, sale_id: saleId }));
        const { error: itemsError } = await client.from('sale_items').insert(fullItems);
        if (itemsError) {
            console.error('Error inserting sale items to Supabase:', itemsError);
        }
    }

    // Prepare WhatsApp Confirmation Link
    let itemsList = '';
    itemsToInsert.forEach(it => {
        itemsList += `- ${it.product_title} (x${it.quantity})\n`;
    });
    const waText = encodeURIComponent(`Hey Anne! 💕 I just placed order ${saleNumber} on the site for KES ${totalAmount.toLocaleString()}.\n\nItems:\n${itemsList}\nDelivery to: ${orderData.delivery_location || 'Nairobi'}\nM-Pesa Ref: ${txRef}`);
    const waLink = `https://wa.me/254798840085?text=${waText}`;

    return {
        success: true,
        sale_number: saleNumber,
        customer_name: orderData.customer_name || 'Queen',
        total_amount: totalAmount,
        total_formatted: `KES ${totalAmount.toLocaleString()}`,
        transaction_reference: txRef,
        whatsapp_link: waLink,
        message: "Order placed successfully, babe! 🥂✨ Your fit is being prepped with love!"
    };
}
