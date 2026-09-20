import { Env, Product, ProductMedia, ProductVariant, InventoryItem } from './types';
import {
  handleGetUploadUrl,
  handleDirectUpload,
  handleServeMedia,
  handleDeleteMedia,
  getR2MediaUrl,
} from './r2-media-handlers';
import { performBackup } from './backup-handler';

// Helper for standardized CORS headers
function corsHeaders(request: Request, env?: Env): HeadersInit {
  const origin = request.headers.get('Origin') || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, X-Admin-Token',
    'Access-Control-Max-Age': '86400',
  };
}

function jsonResponse(data: any, status = 200, request?: Request, env?: Env): Response {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(request ? corsHeaders(request, env) : { 'Access-Control-Allow-Origin': '*' }),
  };
  return new Response(JSON.stringify(data), { status, headers });
}

function errorResponse(message: string, status = 400, request?: Request, env?: Env): Response {
  return jsonResponse({ success: false, error: message }, status, request, env);
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(request, env),
      });
    }

    try {
      // ----------------------------------------------------
      // HEALTH CHECK
      // ----------------------------------------------------
      if (path === '/' || path === '/health') {
        return jsonResponse({
          status: 'ok',
          service: "Anne's Fashion Line Cloudflare Worker API",
          environment: env.ENVIRONMENT || 'production',
          timestamp: new Date().toISOString(),
        }, 200, request, env);
      }

      // ----------------------------------------------------
      // R2 MEDIA PROXY (GET /media/{key})
      // Serves R2 objects with immutable cache headers.
      // Future: replace with R2 custom domain on images.annesfashion.co.ke
      // ----------------------------------------------------
      if (path.startsWith('/media/') && method === 'GET') {
        const key = decodeURIComponent(path.slice('/media/'.length));
        return handleServeMedia(request, env, key);
      }

      // ----------------------------------------------------
      // SETTINGS ENDPOINTS
      // ----------------------------------------------------
      if (path === '/api/settings') {
        if (method === 'GET') {
          const { results } = await env.DB.prepare('SELECT setting_key, setting_value FROM settings').all();
          const settingsMap: Record<string, string> = {};
          (results || []).forEach((row: any) => {
            settingsMap[row.setting_key] = row.setting_value;
          });
          return jsonResponse({ success: true, settings: settingsMap }, 200, request, env);
        }

        if (method === 'POST') {
          const body = await request.json() as { key: string; value: string };
          if (!body.key) return errorResponse('Missing setting key', 400, request, env);

          await env.DB.prepare(`
            INSERT INTO settings (setting_key, setting_value, updated_at) 
            VALUES (?, ?, datetime('now'))
            ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = datetime('now')
          `).bind(body.key, String(body.value)).run();

          return jsonResponse({ success: true, message: 'Setting saved' }, 200, request, env);
        }
      }

      // ----------------------------------------------------
      // LISTINGS (PARENT VIDEO SHOWCASE) — CREATE (POST /api/listings)
      // ----------------------------------------------------
      if ((path === '/api/listings' && method === 'POST') ||
          (path === '/api/products' && method === 'POST' && (await request.clone().json().catch(() => ({})) as any)?.items?.length > 0)) {
        const body = await request.json() as any;
        if (!body.title) return errorResponse('Listing title is required', 400, request, env);

        const cleanStr = (val?: any) => (typeof val === 'string' && val !== 'null' && val !== 'undefined' && val.trim() !== '' ? val.trim() : null);
        const videoKey = cleanStr(body.video_key);
        const videoUrl = cleanStr(body.video_url) || (videoKey ? getR2MediaUrl(videoKey, env) : null);
        const posterRef = cleanStr(body.video_poster_key) || cleanStr(body.poster_reference);
        const posterUrl = cleanStr(body.poster_url) || (posterRef ? getR2MediaUrl(posterRef, env) : null);

        const insListing = await env.DB.prepare(`
          INSERT INTO listings (
            title, description, media_type, video_key, video_url, video_poster_key, poster_url,
            video_duration_seconds, video_size_bytes, is_featured, allow_preorder,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
          RETURNING id
        `).bind(
          body.title,
          cleanStr(body.description),
          body.media_type || 'video',
          videoKey,
          videoUrl,
          cleanStr(body.video_poster_key),
          posterUrl,
          body.video_duration_seconds || null,
          body.video_size_bytes || null,
          body.is_featured ? 1 : 0,
          body.allow_preorder ? 1 : 0
        ).first<{ id: number }>();

        const listingId = insListing?.id;
        if (!listingId) return errorResponse('Failed to create listing', 500, request, env);

        const createdItemIds: number[] = [];
        const items = Array.isArray(body.items) ? body.items : [];
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const itemPayload = {
            ...item,
            video_key: item.video_key || videoKey,
            video_url: item.video_url || videoUrl,
            video_poster_key: item.video_poster_key || body.video_poster_key,
            poster_reference: item.poster_reference || posterRef,
            image_url: item.image_url || posterUrl,
            media_type: item.media_type || body.media_type || 'video',
          };
          const slot = item.item_slot || (i + 1);
          const pId = await insertProductRecord(itemPayload, env, listingId, slot);
          createdItemIds.push(pId);
        }

        const siteBase = 'https://www.annesfashion.co.ke';
        const primaryProductId = createdItemIds[0] || null;
        const productUrl = primaryProductId ? `${siteBase}/product-detail.html?id=${primaryProductId}` : `${siteBase}/product-detail.html?listing_id=${listingId}`;

        return jsonResponse({
          success: true,
          listing_id: listingId,
          product_id: primaryProductId,
          product_url: productUrl,
          item_ids: createdItemIds,
          message: 'Showcase listing and items created successfully',
        }, 201, request, env);
      }

      // ----------------------------------------------------
      // LISTINGS — GET ALL (GET /api/listings)
      // ----------------------------------------------------
      if (path === '/api/listings' && method === 'GET') {
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
        const offset = Math.max(parseInt(url.searchParams.get('offset') || '0'), 0);

        const { results: listings } = await env.DB.prepare(`
          SELECT * FROM listings ORDER BY created_at DESC LIMIT ? OFFSET ?
        `).bind(limit, offset).all();

        const enriched = await Promise.all((listings || []).map(async (l: any) => {
          const { results: items } = await env.DB.prepare(`
            SELECT * FROM products WHERE listing_id = ? AND is_archived = 0 ORDER BY item_slot ASC
          `).bind(l.id).all();

          return {
            ...l,
            items: (items || []).map(item => formatProductForResponse(item, env)),
          };
        }));

        return jsonResponse({ success: true, count: enriched.length, listings: enriched }, 200, request, env);
      }

      // ----------------------------------------------------
      // LISTINGS — GET SINGLE (GET /api/listings/:id)
      // ----------------------------------------------------
      if (path.match(/^\/api\/listings\/\d+$/) && method === 'GET') {
        const id = parseInt(path.split('/')[3]);
        if (isNaN(id)) return errorResponse('Invalid listing ID', 400, request, env);

        const listing = await env.DB.prepare(`SELECT * FROM listings WHERE id = ?`).bind(id).first<any>();
        if (!listing) return errorResponse('Listing not found', 404, request, env);

        const { results: items } = await env.DB.prepare(`
          SELECT * FROM products WHERE listing_id = ? AND is_archived = 0 ORDER BY item_slot ASC
        `).bind(id).all();

        const formattedItems = await Promise.all((items || []).map(async (item: any) => {
          const variants = await env.DB.prepare(`
            SELECT pv.id, pv.product_id, pv.size, pv.color, pv.sku, pv.is_active,
                   COALESCE(i.quantity - i.reserved_quantity, 0) as stock,
                   COALESCE(i.quantity, 0) as quantity
            FROM product_variants pv
            LEFT JOIN inventory i ON pv.id = i.variant_id
            WHERE pv.product_id = ? AND pv.is_active = 1
          `).bind(item.id).all<any>();

          return {
            ...formatProductForResponse(item, env),
            variants: variants.results || [],
          };
        }));

        return jsonResponse({
          success: true,
          listing: {
            ...listing,
            items: formattedItems,
          }
        }, 200, request, env);
      }

      // ----------------------------------------------------
      // PRODUCTS — CREATE (POST /api/products)
      // ----------------------------------------------------
      if (path === '/api/products' && method === 'POST') {
        const body = await request.json() as any;
        const productId = await insertProductRecord(body, env, body.listing_id || null, body.item_slot || 1);

        const siteBase = 'https://www.annesfashion.co.ke';
        const productUrl = `${siteBase}/product-detail.html?id=${productId}`;

        return jsonResponse({
          success: true,
          product_id: productId,
          product_url: productUrl,
          message: 'Product created successfully',
        }, 201, request, env);
      }

      // ----------------------------------------------------
      // PRODUCTS — UPDATE (PUT /api/products/:id)
      // ----------------------------------------------------
      if (path.match(/^\/api\/products\/\d+$/) && method === 'PUT') {
        const id = parseInt(path.split('/')[3]);
        if (isNaN(id)) return errorResponse('Invalid product ID', 400, request, env);

        const body = await request.json() as any;

        const cleanStr = (val?: any) => (typeof val === 'string' && val !== 'null' && val !== 'undefined' && val.trim() !== '' ? val.trim() : null);

        if ('video_key' in body) body.video_key = cleanStr(body.video_key);
        if ('video_url' in body) body.video_url = cleanStr(body.video_url);
        if ('video_mime_type' in body) body.video_mime_type = cleanStr(body.video_mime_type);
        if ('video_poster_key' in body) body.video_poster_key = cleanStr(body.video_poster_key);

        // Resolve URLs from keys
        if (body.video_key && !body.video_url) {
          body.video_url = getR2MediaUrl(body.video_key, env) || undefined;
        }
        if (body.media_type === 'image' && body.media_reference && !body.image_url) {
          body.image_url = getR2MediaUrl(body.media_reference, env) || undefined;
        }

        const serializeField = (val: any) => {
          if (!val) return null;
          if (typeof val === 'string') return val.trim();
          if (Array.isArray(val)) return JSON.stringify(val);
          return String(val);
        };

        if ('sizes' in body) body.sizes = serializeField(body.sizes);
        if ('colors' in body) body.colors = serializeField(body.colors);
        if ('waist_sizes' in body) body.waist_sizes = serializeField(body.waist_sizes);
        if ('bust_sizes' in body) body.bust_sizes = serializeField(body.bust_sizes);
        if ('shoe_sizes' in body) body.shoe_sizes = serializeField(body.shoe_sizes);

        const setClauses: string[] = ['updated_at = datetime(\'now\')'];
        const params: any[] = [];

        const fields = [
          'title', 'description', 'price', 'category', 'sku',
          'image_url', 'media_type', 'media_reference', 'poster_reference',
          'video_key', 'video_url', 'video_mime_type', 'video_size_bytes',
          'video_duration_seconds', 'video_poster_key',
          'sizes', 'colors', 'waist_sizes', 'bust_sizes', 'shoe_sizes', 'total_stock',
          'is_active', 'is_featured', 'allow_preorder',
        ];

        for (const field of fields) {
          if (field in body) {
            setClauses.push(`${field} = ?`);
            let val = (body as any)[field] ?? null;
            if (field === 'category' && val) val = normalizeCategory(val);
            params.push(val);
          }
        }

        if (setClauses.length === 1) {
          return errorResponse('No fields to update', 400, request, env);
        }

        params.push(id);
        await env.DB.prepare(`
          UPDATE products SET ${setClauses.join(', ')} WHERE id = ?
        `).bind(...params).run();

        return jsonResponse({ success: true, message: 'Product updated successfully' }, 200, request, env);
      }

      // ----------------------------------------------------
      // PRODUCTS — SOFT DELETE (DELETE /api/products/:id)
      // ----------------------------------------------------
      if (path.match(/^\/api\/products\/\d+$/) && method === 'DELETE') {
        const id = parseInt(path.split('/')[3]);
        if (isNaN(id)) return errorResponse('Invalid product ID', 400, request, env);

        await env.DB.prepare(`
          UPDATE products SET is_archived = 1, is_active = 0, updated_at = datetime('now') WHERE id = ?
        `).bind(id).run();

        return jsonResponse({ success: true, message: 'Product archived successfully' }, 200, request, env);
      }

      // ----------------------------------------------------
      // PRODUCTS CATALOG (GET /api/products)
      // ----------------------------------------------------
      if (path === '/api/products' && method === 'GET') {
        const category = url.searchParams.get('category');
        const featured = url.searchParams.get('featured');
        const search = url.searchParams.get('search');
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
        const offset = Math.max(parseInt(url.searchParams.get('offset') || '0'), 0);

        let query = `
          SELECT 
            p.id, p.title, p.description, p.price, p.category, p.sku,
            p.image_url, p.media_type, p.media_reference, p.poster_reference,
            p.video_key, p.video_url, p.video_mime_type, p.video_size_bytes,
            p.video_duration_seconds, p.video_poster_key,
            p.is_active, p.is_archived, p.is_featured, p.allow_preorder, p.is_flash_sale,
            p.sizes, p.colors, p.waist_sizes, p.bust_sizes, p.shoe_sizes, p.total_stock,
            p.created_at, p.updated_at,
            COALESCE(SUM(i.quantity), 0) as computed_stock
          FROM products p
          LEFT JOIN inventory i ON p.id = i.product_id
          WHERE p.is_active = 1 AND p.is_archived = 0
        `;
        const params: any[] = [];

        if (category && category !== 'all') {
          const aliases = getCategoryAliases(category);
          const placeholders = aliases.map(() => '?').join(', ');
          query += ` AND (LOWER(TRIM(p.category)) IN (${placeholders}))`;
          params.push(...aliases.map(a => a.toLowerCase().trim()));
        }

        if (featured === '1' || featured === 'true') {
          query += ` AND p.is_featured = 1`;
        }

        if (search) {
          query += ` AND (p.title LIKE ? OR p.description LIKE ? OR p.sku LIKE ?)`;
          const s = `%${search}%`;
          params.push(s, s, s);
        }

        const sortParam = url.searchParams.get('sort');
        let orderClause = 'ORDER BY p.is_flash_sale DESC, p.allow_preorder DESC, p.created_at DESC';
        if (sortParam === 'price_asc' || sortParam === 'price-low') {
          orderClause = 'ORDER BY p.price ASC';
        } else if (sortParam === 'price_desc' || sortParam === 'price-high') {
          orderClause = 'ORDER BY p.price DESC';
        } else if (sortParam === 'newest') {
          orderClause = 'ORDER BY p.created_at DESC';
        }

        query += ` GROUP BY p.id ${orderClause} LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        const { results } = await env.DB.prepare(query).bind(...params).all();

        const formatted = (results || []).map((p: any) => formatProductForResponse(p, env));

        return jsonResponse({ success: true, count: formatted.length, products: formatted }, 200, request, env);
      }

      // ----------------------------------------------------
      // SINGLE PRODUCT DETAIL (GET /api/products/:id)
      // ----------------------------------------------------
      if (path.match(/^\/api\/products\/\d+$/) && method === 'GET') {
        const id = parseInt(path.split('/')[3]);
        if (isNaN(id)) return errorResponse('Invalid product ID', 400, request, env);

        const product = await env.DB.prepare(`
          SELECT * FROM products WHERE id = ? AND is_archived = 0 LIMIT 1
        `).bind(id).first<Product>();

        if (!product) return errorResponse('Product not found', 404, request, env);

        const variants = await env.DB.prepare(`
          SELECT pv.id, pv.product_id, pv.size, pv.color, pv.sku, pv.is_active,
                 COALESCE(i.quantity - i.reserved_quantity, 0) as stock,
                 COALESCE(i.quantity, 0) as quantity
          FROM product_variants pv
          LEFT JOIN inventory i ON pv.id = i.variant_id
          WHERE pv.product_id = ? AND pv.is_active = 1
        `).bind(id).all<any>();

        const inventory = await env.DB.prepare(`
          SELECT id, variant_id, quantity, reserved_quantity, reorder_point FROM inventory WHERE product_id = ?
        `).bind(id).all<InventoryItem>();

        const media = await env.DB.prepare(`
          SELECT id, media_type, media_reference, poster_reference, is_main, sort_order 
          FROM product_media 
          WHERE product_id = ? 
          ORDER BY is_main DESC, sort_order ASC
        `).bind(id).all<ProductMedia>();

        const totalStockCalculated = (inventory.results || []).reduce((sum, item) => sum + (item.quantity - item.reserved_quantity), 0);
        let sizes = extractExactProductSizes({
          ...product,
          variants: variants.results || [],
        });
        let colors = extractExactProductColors({
          ...product,
          variants: variants.results || [],
        });

        const descVariants = parseVariantsFromDescription(product.description);
        let totalStock = totalStockCalculated;
        if (totalStock === 0 && (product.total_stock || 0) > 0) {
          totalStock = product.total_stock || 0;
        } else if (totalStock === 0 && descVariants.qty > 0) {
          totalStock = descVariants.qty;
        }

        const formattedMedia = (media.results || []).map(m => ({
          id: m.id,
          type: m.media_type,
          url: getR2MediaUrl(m.media_reference, env),
          poster: m.poster_reference ? getR2MediaUrl(m.poster_reference, env) : null,
          is_main: m.is_main === 1,
        }));

        const base = formatProductForResponse(product, env);

        const responseData = {
          ...base,
          total_stock: totalStock,
          sizes,
          colors,
          clean_description: cleanCustomerDescription(product.description),
          variants: variants.results || [],
          media: formattedMedia.length > 0 ? formattedMedia : buildDefaultMedia(product, env),
        };

        return jsonResponse({ success: true, product: responseData }, 200, request, env);
      }

      // ----------------------------------------------------
      // REALTIME EFFICIENT POLLING
      // ----------------------------------------------------
      if (path === '/api/products/poll' && method === 'GET') {
        const since = url.searchParams.get('since') || '1970-01-01T00:00:00Z';
        const changed = await env.DB.prepare(`
          SELECT id, updated_at FROM products 
          WHERE updated_at > ? AND is_active = 1 AND is_archived = 0
          ORDER BY updated_at DESC LIMIT 10
        `).bind(since).all();

        return jsonResponse({
          success: true,
          has_updates: (changed.results || []).length > 0,
          timestamp: new Date().toISOString(),
          changed_ids: (changed.results || []).map((r: any) => r.id),
        }, 200, request, env);
      }

      // ----------------------------------------------------
      // CUSTOMER AUTH & PIN VERIFICATION
      // ----------------------------------------------------
      if (path === '/api/client/auth' && method === 'POST') {
        const body = await request.json() as { phone: string; pin?: string; name?: string };
        if (!body.phone) return errorResponse('Phone number required', 400, request, env);

        const cleanPhone = body.phone.trim().replace(/\s+/g, '');
        let customer = await env.DB.prepare(`
          SELECT * FROM customers WHERE phone = ? LIMIT 1
        `).bind(cleanPhone).first<any>();

        if (!customer) {
          const insertRes = await env.DB.prepare(`
            INSERT INTO customers (name, phone, pin_hash, created_at, updated_at)
            VALUES (?, ?, ?, datetime('now'), datetime('now'))
          `).bind(body.name || 'Guest Customer', cleanPhone, body.pin ? await hashPin(body.pin) : null).run();

          customer = await env.DB.prepare(`SELECT * FROM customers WHERE id = ?`).bind(insertRes.meta.last_row_id).first<any>();
        }

        return jsonResponse({
          success: true,
          customer: {
            id: customer.id,
            name: customer.name,
            phone: customer.phone,
            email: customer.email,
            address: customer.address,
            city: customer.city,
            total_orders: customer.total_orders,
          }
        }, 200, request, env);
      }

      // ----------------------------------------------------
      // ORDER CREATION
      // ----------------------------------------------------
      if (path === '/api/client/order' && method === 'POST') {
        const body = await request.json() as {
          customer_name: string;
          customer_phone: string;
          customer_address?: string;
          customer_city?: string;
          delivery_area?: string;
          delivery_fee?: number;
          sale_type?: 'online' | 'preorder';
          items: Array<{ product_id: number; variant_id?: number; title: string; quantity: number; unit_price: number }>;
          payment_method?: string;
          notes?: string;
        };

        if (!body.customer_phone || !body.items || body.items.length === 0) {
          return errorResponse('Customer phone and at least one item required', 400, request, env);
        }

        // ── 1. Stock Validation Check ─────────────────────────────────────
        for (const item of body.items) {
          const prod = await env.DB.prepare(`
            SELECT id, title, total_stock, allow_preorder FROM products WHERE id = ?
          `).bind(item.product_id).first<any>();

          if (!prod) {
            return errorResponse(`Product not found (ID: ${item.product_id})`, 400, request, env);
          }

          if (prod.allow_preorder === 1) {
            // Pre-orders bypass normal in-stock limits
            continue;
          }

          let availableStock = prod.total_stock !== undefined ? prod.total_stock : 10;
          if (item.variant_id) {
            const inv = await env.DB.prepare(`
              SELECT (quantity - reserved_quantity) as available FROM inventory 
              WHERE product_id = ? AND variant_id = ?
            `).bind(item.product_id, item.variant_id).first<any>();

            if (inv && typeof inv.available === 'number') {
              availableStock = inv.available;
            }
          }

          if (item.quantity > availableStock) {
            return errorResponse(
              `Sorry babe! Only ${availableStock} left in stock for "${item.title}". Please adjust your quantity to complete your order.`,
              400, request, env
            );
          }
        }

        const itemsTotal = body.items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
        const deliveryFee = Number(body.delivery_fee || 0);
        const totalAmount = itemsTotal + deliveryFee;
        const saleNumber = 'ORD-' + Date.now().toString(36).toUpperCase();
        const saleType = body.sale_type || 'online';

        let customer = await env.DB.prepare(`SELECT id FROM customers WHERE phone = ? LIMIT 1`).bind(body.customer_phone).first<any>();
        let customerId = customer ? customer.id : null;
        if (!customerId) {
          const cRes = await env.DB.prepare(`
            INSERT INTO customers (name, phone, address, city, created_at, updated_at)
            VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
          `).bind(body.customer_name || 'Valued Customer', body.customer_phone, body.customer_address || '', body.customer_city || 'Nairobi').run();
          customerId = cRes.meta.last_row_id;
        }

        const saleRes = await env.DB.prepare(`
          INSERT INTO sales (
            sale_number, sale_type, customer_id, customer_name, customer_phone,
            customer_address, customer_city, delivery_area, delivery_fee, delivery_status,
            total_amount, payment_method, payment_status, notes, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'processing', ?, ?, 'pending', ?, datetime('now'))
        `).bind(
          saleNumber, saleType, customerId, body.customer_name, body.customer_phone,
          body.customer_address || '', body.customer_city || 'Nairobi',
          body.delivery_area || body.customer_address || '', deliveryFee,
          totalAmount, body.payment_method || 'mpesa', body.notes || ''
        ).run();

        const saleId = saleRes.meta.last_row_id;
        const batchStatements = [];

        for (const item of body.items) {
          const itemTotal = item.quantity * item.unit_price;
          batchStatements.push(
            env.DB.prepare(`
              INSERT INTO sale_items (sale_id, product_id, variant_id, product_title, quantity, unit_price, total_price)
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `).bind(saleId, item.product_id, item.variant_id || null, item.title, item.quantity, item.unit_price, itemTotal)
          );

          batchStatements.push(
            env.DB.prepare(`
              UPDATE inventory 
              SET quantity = MAX(0, quantity - ?), last_updated = datetime('now')
              WHERE product_id = ? ${item.variant_id ? 'AND variant_id = ?' : ''}
            `).bind(...(item.variant_id ? [item.quantity, item.product_id, item.variant_id] : [item.quantity, item.product_id]))
          );

          batchStatements.push(
            env.DB.prepare(`
              UPDATE products 
              SET total_stock = MAX(0, total_stock - ?), updated_at = datetime('now')
              WHERE id = ?
            `).bind(item.quantity, item.product_id)
          );

          batchStatements.push(
            env.DB.prepare(`
              INSERT INTO inventory_logs (product_id, variant_id, quantity_change, action_type, sale_id, reason, created_at)
              VALUES (?, ?, ?, 'sale', ?, 'Online customer checkout', datetime('now'))
            `).bind(item.product_id, item.variant_id || null, -item.quantity, saleId)
          );
        }

        await env.DB.batch(batchStatements);

        await env.DB.prepare(`
          UPDATE customers 
          SET total_orders = total_orders + 1, total_spent = total_spent + ?, updated_at = datetime('now')
          WHERE id = ?
        `).bind(totalAmount, customerId).run();

        return jsonResponse({
          success: true,
          order_id: saleId,
          sale_number: saleNumber,
          total_amount: totalAmount,
          delivery_fee: deliveryFee,
          items_total: itemsTotal,
          delivery_status: 'processing',
          message: 'Order created successfully'
        }, 201, request, env);
      }

      // ----------------------------------------------------
      // CLIENT ORDERS & LIVE TRACKING
      // ----------------------------------------------------
      if (path === '/api/client/orders' && method === 'GET') {
        const phone = url.searchParams.get('phone');
        if (!phone) return errorResponse('Customer phone is required', 400, request, env);

        const cleanPhone = phone.trim().replace(/\s+/g, '');

        const { results: sales } = await env.DB.prepare(`
          SELECT 
            id, sale_number, sale_type, customer_name, customer_phone,
            customer_address, customer_city, delivery_area, delivery_fee,
            delivery_status, tracking_number, total_amount, payment_method,
            payment_status, notes, created_at
          FROM sales
          WHERE customer_phone = ? OR customer_phone = ?
          ORDER BY id DESC LIMIT 20
        `).bind(cleanPhone, cleanPhone.replace(/^\+254/, '0')).all();

        const orderIds = (sales || []).map((s: any) => s.id);
        let itemsBySale: Record<number, any[]> = {};

        if (orderIds.length > 0) {
          const placeholders = orderIds.map(() => '?').join(',');
          const { results: items } = await env.DB.prepare(`
            SELECT sale_id, product_id, variant_id, product_title, quantity, unit_price, total_price
            FROM sale_items
            WHERE sale_id IN (${placeholders})
          `).bind(...orderIds).all();

          (items || []).forEach((item: any) => {
            if (!itemsBySale[item.sale_id]) itemsBySale[item.sale_id] = [];
            itemsBySale[item.sale_id].push(item);
          });
        }

        const { results: shipmentUpdates } = await env.DB.prepare(`
          SELECT id, title, update_text, status_badge, waybill_number, created_at
          FROM shipment_updates
          ORDER BY id DESC LIMIT 10
        `).all();

        const formattedOrders = (sales || []).map((s: any) => ({
          ...s,
          items: itemsBySale[s.id] || [],
          delivery_status: s.delivery_status || 'processing',
          tracking_number: s.tracking_number || null,
        }));

        return jsonResponse({
          success: true,
          orders: formattedOrders,
          shipment_updates: shipmentUpdates || []
        }, 200, request, env);
      }

      // ----------------------------------------------------
      // PICKUP MTAANI DELIVERY RATES & LOCATIONS
      // ----------------------------------------------------
      if (path === '/api/delivery/rates' && method === 'GET') {
        const search = url.searchParams.get('search');
        let query = `SELECT id, zone, area_name, pickup_rate, doorstep_rate, estimated_delivery FROM delivery_locations`;
        const params: any[] = [];

        if (search) {
          query += ` WHERE area_name LIKE ? OR zone LIKE ?`;
          const s = `%${search.trim()}%`;
          params.push(s, s);
        }

        query += ` ORDER BY zone ASC, area_name ASC`;
        const { results } = await env.DB.prepare(query).bind(...params).all();

        return jsonResponse({
          success: true,
          count: (results || []).length,
          locations: results || []
        }, 200, request, env);
      }

      // ----------------------------------------------------
      // SHIPMENT TRACKING UPDATES (GET PUBLIC / POST ADMIN)
      // ----------------------------------------------------
      if (path === '/api/tracking/updates') {
        if (method === 'GET') {
          const { results } = await env.DB.prepare(`
            SELECT id, title, update_text, status_badge, waybill_number, created_at
            FROM shipment_updates
            ORDER BY id DESC LIMIT 20
          `).all();

          return jsonResponse({ success: true, updates: results || [] }, 200, request, env);
        }

        if (method === 'POST') {
          const body = await request.json() as {
            title: string;
            update_text: string;
            status_badge?: string;
            waybill_number?: string;
          };

          if (!body.title || !body.update_text) {
            return errorResponse('Title and update text are required', 400, request, env);
          }

          const res = await env.DB.prepare(`
            INSERT INTO shipment_updates (title, update_text, status_badge, waybill_number, created_at)
            VALUES (?, ?, ?, ?, datetime('now'))
          `).bind(
            body.title,
            body.update_text,
            body.status_badge || 'In Transit',
            body.waybill_number || null
          ).run();

          return jsonResponse({
            success: true,
            id: res.meta.last_row_id,
            message: 'Shipment update posted successfully'
          }, 201, request, env);
        }
      }

      // Admin update tracking info for a specific order
      if (path === '/api/admin/order/tracking' && method === 'POST') {
        const body = await request.json() as {
          sale_id: number;
          tracking_number?: string;
          delivery_status?: string;
        };

        if (!body.sale_id) return errorResponse('Sale ID is required', 400, request, env);

        await env.DB.prepare(`
          UPDATE sales
          SET 
            tracking_number = COALESCE(?, tracking_number),
            delivery_status = COALESCE(?, delivery_status)
          WHERE id = ?
        `).bind(body.tracking_number || null, body.delivery_status || null, body.sale_id).run();

        return jsonResponse({ success: true, message: 'Order tracking updated' }, 200, request, env);
      }

      // ----------------------------------------------------
      // R2 MEDIA UPLOAD URL (POST /api/media/upload-url)
      // Returns direct presigned or direct-upload URL for video & image uploads
      if (path === '/api/media/upload-url' && method === 'POST') {
        return handleGetUploadUrl(request, env);
      }

      // R2 DIRECT STREAMING UPLOAD (PUT/POST /api/media/direct-upload)
      // Streams large video files directly into R2 IMAGES bucket
      if (path === '/api/media/direct-upload' && (method === 'PUT' || method === 'POST')) {
        return handleDirectUpload(request, env);
      }

      // ----------------------------------------------------
      // R2 MEDIA DELETE (DELETE /api/media)
      // ----------------------------------------------------
      if (path === '/api/media' && method === 'DELETE') {
        return handleDeleteMedia(request, env);
      }

      // Save uploaded media metadata to D1
      if (path === '/api/media/save' && method === 'POST') {
        const body = await request.json() as {
          product_id: number;
          media_type: 'image' | 'video';
          media_reference: string;    // R2 key
          poster_reference?: string;  // R2 poster key
          sort_order?: number;
          is_main?: boolean;
        };

        if (!body.product_id || !body.media_reference) {
          return errorResponse('Product ID and media reference are required', 400, request, env);
        }

        const isMain = body.is_main ? 1 : 0;
        const mediaUrl = getR2MediaUrl(body.media_reference, env);
        const posterUrl = body.poster_reference ? getR2MediaUrl(body.poster_reference, env) : null;

        if (isMain === 1) {
          await env.DB.prepare(`UPDATE product_media SET is_main = 0 WHERE product_id = ?`).bind(body.product_id).run();
          await env.DB.prepare(`
            UPDATE products 
            SET media_type = ?, media_reference = ?, poster_reference = ?,
                video_key = ?, video_url = ?, video_poster_key = ?,
                image_url = ?,
                updated_at = datetime('now')
            WHERE id = ?
          `).bind(
            body.media_type || 'image',
            body.media_reference,
            body.poster_reference || null,
            body.media_type === 'video' ? body.media_reference : null,
            body.media_type === 'video' ? mediaUrl : null,
            body.media_type === 'video' ? (body.poster_reference || null) : null,
            body.media_type === 'image' ? mediaUrl : null,
            body.product_id
          ).run();
        }

        const res = await env.DB.prepare(`
          INSERT INTO product_media (product_id, media_type, media_reference, poster_reference, is_main, sort_order, created_at)
          VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
        `).bind(body.product_id, body.media_type || 'image', body.media_reference, body.poster_reference || null, isMain, body.sort_order || 0).run();

        return jsonResponse({
          success: true,
          media_id: res.meta.last_row_id,
          media_url: mediaUrl,
          poster_url: posterUrl,
          message: 'Media reference registered successfully'
        }, 201, request, env);
      }

      // ----------------------------------------------------
      // MANUAL BACKUP TRIGGER (ADMIN PROTECTED)
      // ----------------------------------------------------
      if (path === '/api/admin/backup' && method === 'POST') {
        const adminToken = request.headers.get('X-Admin-Token') || request.headers.get('Authorization')?.replace('Bearer ', '');
        if (env.ADMIN_AUTH_TOKEN && adminToken !== env.ADMIN_AUTH_TOKEN) {
          return errorResponse('Unauthorized: Invalid admin token', 401, request, env);
        }

        const backupResult = await performBackup(env);
        return jsonResponse({ success: true, ...backupResult }, 200, request, env);
      }

      // 404
      return errorResponse(`Endpoint not found: ${method} ${path}`, 404, request, env);

    } catch (err: any) {
      console.error('Worker API error:', err);
      return errorResponse(err.message || 'Internal server error', 500, request, env);
    }
  },

  // ----------------------------------------------------
  // AUTOMATED DAILY D1 BACKUP CRON TRIGGER
  // Runs daily at 2:00 AM UTC (triggers.crons)
  // ----------------------------------------------------
  async scheduled(controller: any, env: Env, ctx: ExecutionContext) {
    console.log(`Cron triggered: ${controller?.cron} at ${new Date().toISOString()}`);
    ctx.waitUntil(performBackup(env));
  }
};

// ========================================================
// HELPER UTILITIES
// ========================================================

function normalizeCategory(raw?: string | null): string {
  if (!raw) return 'general';
  const clean = raw.toLowerCase().trim().replace(/[-_]/g, ' ');
  const map: Record<string, string> = {
    'casualwear': 'casual',
    'casual wear': 'casual',
    'casual-wear': 'casual',
    'clothes': 'casual',
    'clothing': 'casual',
    'jackets': 'casual',
    'jacket': 'casual',
    'tops': 'casual',
    'top': 'casual',
    'trousers': 'casual',
    'trouser': 'casual',
    'pants': 'casual',
    'jeans': 'casual',
    'corporatewear': 'corporate',
    'corporate wear': 'corporate',
    'corporate-wear': 'corporate',
    'officewear': 'corporate',
    'office wear': 'corporate',
    'office': 'corporate',
    'weekendwear': 'weekend',
    'weekend wear': 'weekend',
    'lifestyle': 'weekend',
    'dresswear': 'dresses',
    'dress': 'dresses',
    'dresses': 'dresses',
    'beauty': 'makeup',
    'beautymakeup': 'makeup',
    'beauty & makeup': 'makeup',
    'skincare': 'makeup',
    'hair': 'wigs',
    'hairwigs': 'wigs',
    'wig': 'wigs',
    'wigs': 'wigs',
    'wigs & hair': 'wigs',
    'shoe': 'shoes',
    'shoes': 'shoes',
    'shoes & sneakers': 'shoes',
    'footwear': 'shoes',
    'heels': 'shoes',
    'sneakers': 'shoes',
  };
  return map[clean] || clean;
}

function getCategoryAliases(cat: string): string[] {
  const norm = normalizeCategory(cat);
  const aliasMap: Record<string, string[]> = {
    'casual': ['casual', 'casualwear', 'casual wear', 'casual-wear', 'clothes', 'clothing', 'jackets', 'tops', 'trousers', 'pants', 'jeans'],
    'corporate': ['corporate', 'corporatewear', 'corporate wear', 'corporate-wear', 'officewear', 'office wear', 'office'],
    'weekend': ['weekend', 'weekendwear', 'weekend wear', 'lifestyle'],
    'dresses': ['dresses', 'dress', 'dresswear'],
    'makeup': ['makeup', 'beauty', 'beautymakeup', 'beauty & makeup', 'skincare'],
    'wigs': ['wigs', 'wig', 'hair', 'hairwigs', 'wigs & hair'],
    'shoes': ['shoes', 'shoe', 'shoes & sneakers', 'footwear', 'heels', 'sneakers'],
  };
  const list = aliasMap[norm] || [norm, cat];
  return Array.from(new Set([norm, cat.toLowerCase().trim(), ...list]));
}

function extractExactProductSizes(p: any): string[] {
  const sizeSet = new Set<string>();

  const parseAndAdd = (val: any) => {
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
      } catch {}
      clean.split(',').forEach(s => s && sizeSet.add(String(s).trim()));
    } else if (Array.isArray(val)) {
      val.forEach(s => s && sizeSet.add(String(s).trim()));
    }
  };

  parseAndAdd(p.waist_sizes);
  parseAndAdd(p.bust_sizes);
  parseAndAdd(p.shoe_sizes);
  parseAndAdd(p.sizes);

  if (Array.isArray(p.variants)) {
    p.variants.forEach((v: any) => {
      if (v?.size) sizeSet.add(String(v.size).trim());
      if (v?.waist_size) sizeSet.add(String(v.waist_size).trim());
      if (v?.bust_size) sizeSet.add(String(v.bust_size).trim());
      if (v?.shoe_size) sizeSet.add(String(v.shoe_size).trim());
    });
  }

  // Only fall back to description parsing if no exact sizes found from DB columns
  if (sizeSet.size === 0 && p.description && typeof p.description === 'string' && p.description.includes('Variant Stock:')) {
    const descVars = parseVariantsFromDescription(p.description);
    descVars.sizes.forEach(s => sizeSet.add(s));
  }

  // Deduplicate: if we have '30"' and '30', keep only '30"' (the more specific version)
  const result = Array.from(sizeSet).filter(Boolean);
  const seen = new Map<string, string>();
  for (const s of result) {
    const base = s.replace(/["'″]/g, '').trim();
    const existing = seen.get(base);
    if (!existing || s.length > existing.length) {
      seen.set(base, s);
    }
  }
  return Array.from(seen.values());
}

function extractExactProductColors(p: any): string[] {
  const colorSet = new Set<string>();

  const parseAndAdd = (val: any) => {
    if (!val) return;
    if (typeof val === 'string') {
      const clean = val.trim();
      if (clean === 'null' || clean === 'undefined' || !clean) return;
      try {
        const parsed = JSON.parse(clean);
        if (Array.isArray(parsed)) {
          parsed.forEach(c => c && colorSet.add(String(c).trim()));
          return;
        }
      } catch {}
      clean.split(',').forEach(c => c && colorSet.add(String(c).trim()));
    } else if (Array.isArray(val)) {
      val.forEach(c => c && colorSet.add(String(c).trim()));
    }
  };

  parseAndAdd(p.colors);

  if (Array.isArray(p.variants)) {
    p.variants.forEach((v: any) => {
      if (v?.color && String(v.color).toLowerCase() !== 'default') {
        colorSet.add(String(v.color).trim());
      }
    });
  }

  if (p.description && typeof p.description === 'string' && p.description.includes('Variant Stock:')) {
    const descVars = parseVariantsFromDescription(p.description);
    descVars.colors.forEach(c => colorSet.add(c));
  }

  return Array.from(colorSet).filter(Boolean);
}

function parseVariantsFromDescription(desc?: string | null) {
  const sizes = new Set<string>();
  const colors = new Set<string>();
  let qty = 0;

  if (!desc) return { sizes: [] as string[], colors: [] as string[], qty: 0 };

  const sizeRegex = /Size\s+([^:,\n\]•]+?)(?::|\s*pcs|\s*,|\s*\])/gi;
  let m: RegExpExecArray | null;
  while ((m = sizeRegex.exec(desc)) !== null) {
    const s = m[1].trim().replace(/^["']|["']$/g, '');
    if (s) sizes.add(s);
  }

  const colorRegex1 = /(?:Variant Stock:|,)\s*([A-Za-z\s]+?)\s*•/gi;
  while ((m = colorRegex1.exec(desc)) !== null) {
    const c = m[1].trim();
    if (c && !c.toLowerCase().startsWith('size') && !c.toLowerCase().startsWith('variant')) colors.add(c);
  }

  const colorRegex2 = /Colour\s+([^:,\n\]•]+?)(?::|\s*pcs|\s*,|•|\])/gi;
  while ((m = colorRegex2.exec(desc)) !== null) {
    const c = m[1].trim();
    if (c) colors.add(c);
  }

  const qtyRegex = /(\d+)\s*pcs/gi;
  while ((m = qtyRegex.exec(desc)) !== null) {
    qty += parseInt(m[1], 10);
  }

  return { sizes: Array.from(sizes), colors: Array.from(colors), qty };
}

function cleanCustomerDescription(desc?: string | null): string {
  if (!desc) return '';
  return desc
    .replace(/\[Variant Stock:[^\]]*\]/gi, '')
    .replace(/\[Media:[^\]]*\]/gi, '')
    .trim();
}

/**
 * Format a product row from D1 into the standard API response shape.
 * Resolves R2 keys → public URLs. Sanitizes "null" string literals.
 */
function formatProductForResponse(p: any, env: Env) {
  const cleanStr = (val?: any) => (typeof val === 'string' && val !== 'null' && val !== 'undefined' && val.trim() !== '' ? val.trim() : null);

  const isVideo = p.media_type === 'video';
  const videoKey = cleanStr(p.video_key);
  let videoUrl = cleanStr(p.video_url) || (videoKey ? getR2MediaUrl(videoKey, env) : null);

  if (isVideo && !videoUrl && p.description) {
    const m = p.description.match(/\[Media:\s*(https?:\/\/[^\]\s]+)/i);
    if (m && m[1]) videoUrl = cleanStr(m[1]);
  }

  const posterRef = cleanStr(p.video_poster_key) || cleanStr(p.poster_reference);
  const posterUrl = (posterRef ? getR2MediaUrl(posterRef, env) : null) || cleanStr(p.image_url);

  const primaryImageUrl = isVideo
    ? (posterUrl || 'assets/Logo%20Black.png')
    : (cleanStr(p.image_url) || (cleanStr(p.media_reference) ? getR2MediaUrl(p.media_reference, env) : 'assets/Logo%20Black.png'));

  const exactSizes = extractExactProductSizes(p);
  const exactColors = extractExactProductColors(p);

  return {
    ...p,
    category: normalizeCategory(p.category),
    raw_price: p.price,
    formatted_price: `KSh ${Number(p.price).toLocaleString()}`,
    is_flash_sale: p.is_flash_sale ? 1 : 0,
    allow_preorder: p.allow_preorder ? 1 : 0,
    total_stock: p.total_stock !== undefined ? p.total_stock : (p.computed_stock || 0),
    is_video: isVideo && Boolean(videoUrl),
    video_url: isVideo ? videoUrl : null,
    video_key: videoKey,
    video_duration_seconds: p.video_duration_seconds || null,
    video_mime_type: cleanStr(p.video_mime_type),
    poster_url: posterUrl,
    primary_image_url: primaryImageUrl,
    image_url: primaryImageUrl,
    media_reference: cleanStr(p.media_reference),
    sizes: exactSizes,
    colors: exactColors,
    waist_sizes: p.waist_sizes || null,
    bust_sizes: p.bust_sizes || null,
    shoe_sizes: p.shoe_sizes || null,
    clean_description: cleanCustomerDescription(p.description),
  };
}

function buildDefaultMedia(product: any, env: Env) {
  const isVideo = product.media_type === 'video';
  let videoUrl = product.video_url || getR2MediaUrl(product.video_key, env);
  if (isVideo && !videoUrl && product.description) {
    const m = product.description.match(/\[Media:\s*(https?:\/\/[^\]\s]+)/i);
    if (m && m[1]) videoUrl = m[1].trim();
  }
  const posterUrl = getR2MediaUrl(product.video_poster_key || product.poster_reference, env) || product.image_url;

  return [{
    id: 0,
    type: product.media_type || 'image',
    url: isVideo ? videoUrl : getR2MediaUrl(product.media_reference, env),
    poster: posterUrl,
    is_main: true,
  }];
}

async function hashPin(pin: string): Promise<string> {
  const enc = new TextEncoder();
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(pin));
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function insertProductRecord(body: any, env: Env, listingId: number | null = null, itemSlot: number = 1): Promise<number> {
  if (!body.title || !body.price || !body.category) {
    throw new Error('title, price, and category are required');
  }

  const cleanStr = (val?: any) => (typeof val === 'string' && val !== 'null' && val !== 'undefined' && val.trim() !== '' ? val.trim() : null);

  const videoKey = cleanStr(body.video_key);
  const videoUrl = cleanStr(body.video_url) || (videoKey ? getR2MediaUrl(videoKey, env) : null);
  const mediaType = body.media_type || (videoKey || videoUrl ? 'video' : 'image');
  const mediaRef = cleanStr(body.media_reference) || videoKey || cleanStr(body.image_url);
  const posterRef = cleanStr(body.poster_reference) || cleanStr(body.video_poster_key);

  const resolvedImageUrl = cleanStr(body.image_url) || (mediaType === 'image' && mediaRef ? getR2MediaUrl(mediaRef, env) : null);

  const serializeField = (val: any) => {
    if (!val) return null;
    if (typeof val === 'string') return val.trim();
    if (Array.isArray(val)) return JSON.stringify(val);
    return String(val);
  };

  const sizesJson = serializeField(body.sizes);
  const colorsJson = serializeField(body.colors);
  const waistSizesJson = serializeField(body.waist_sizes);
  const bustSizesJson = serializeField(body.bust_sizes);
  const shoeSizesJson = serializeField(body.shoe_sizes);

  const allExactSizes = extractExactProductSizes(body);
  const allExactColors = extractExactProductColors(body);
  const isFlashSale = body.is_flash_sale ? 1 : 0;
  const totalStockInput = typeof body.total_stock === 'number' ? body.total_stock : (typeof body.initial_stock === 'number' ? body.initial_stock : 10);

  const finalListingId = listingId !== undefined && listingId !== null ? listingId : (body.listing_id || null);
  const finalItemSlot = itemSlot !== undefined && itemSlot !== null ? itemSlot : (body.item_slot || 1);

  const inserted = await env.DB.prepare(`
    INSERT INTO products (
      title, description, price, category, sku,
      image_url, media_type, media_reference, poster_reference,
      video_key, video_url, video_mime_type, video_size_bytes, video_duration_seconds, video_poster_key,
      sizes, colors, waist_sizes, bust_sizes, shoe_sizes, total_stock,
      is_active, is_archived, is_featured, allow_preorder, is_flash_sale,
      listing_id, item_slot,
      created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      1, 0, ?, ?, ?,
      ?, ?,
      datetime('now'), datetime('now')
    ) RETURNING id
  `).bind(
    body.title,
    cleanStr(body.description),
    body.price,
    normalizeCategory(body.category),
    body.sku || null,
    resolvedImageUrl,
    mediaType,
    mediaRef,
    posterRef,
    videoKey,
    videoUrl,
    cleanStr(body.video_mime_type),
    body.video_size_bytes || null,
    body.video_duration_seconds || null,
    cleanStr(body.video_poster_key),
    sizesJson,
    colorsJson,
    waistSizesJson,
    bustSizesJson,
    shoeSizesJson,
    totalStockInput,
    body.is_featured ? 1 : 0,
    body.allow_preorder ? 1 : 0,
    isFlashSale,
    finalListingId,
    finalItemSlot
  ).first<{ id: number }>();

  const productId = inserted?.id;
  if (!productId) throw new Error('Failed to create product record in database');

  // Seed variants & inventory
  if (body.variants && Array.isArray(body.variants) && body.variants.length > 0) {
    for (const v of body.variants) {
      const vSize = v.size || v.waist_size || v.bust_size || v.shoe_size || null;
      const vColor = v.color || null;
      const varRes = await env.DB.prepare(`
        INSERT INTO product_variants (product_id, size, color, sku, is_active, created_at)
        VALUES (?, ?, ?, ?, 1, datetime('now'))
        RETURNING id
      `).bind(productId, vSize, vColor, v.sku || null).first<{ id: number }>();

      const variantId = varRes?.id;
      const qty = typeof v.quantity === 'number' ? v.quantity : (typeof v.stock === 'number' ? v.stock : 0);

      if (variantId) {
        await env.DB.prepare(`
          INSERT OR REPLACE INTO inventory (product_id, variant_id, quantity, reserved_quantity, reorder_point, last_updated)
          VALUES (?, ?, ?, 0, 5, datetime('now'))
        `).bind(productId, variantId, qty).run();
      }
    }
  } else if (allExactSizes.length > 0 || allExactColors.length > 0) {
    const sizesToUse = allExactSizes.length > 0 ? allExactSizes : [null];
    const colorsToUse = allExactColors.length > 0 ? allExactColors : [null];
    const totalCombos = sizesToUse.length * colorsToUse.length;
    const perVariantStock = Math.max(1, Math.floor(totalStockInput / totalCombos));

    for (const s of sizesToUse) {
      for (const c of colorsToUse) {
        let specificQty = perVariantStock;
        if (body.variant_stock && typeof body.variant_stock === 'object') {
          const key1 = `${c}_${s}`;
          const key2 = `${s}_${c}`;
          const key3 = `${s}`;
          if (typeof body.variant_stock[key1] === 'number') specificQty = body.variant_stock[key1];
          else if (typeof body.variant_stock[key2] === 'number') specificQty = body.variant_stock[key2];
          else if (typeof body.variant_stock[key3] === 'number') specificQty = body.variant_stock[key3];
        }

        const varRes = await env.DB.prepare(`
          INSERT INTO product_variants (product_id, size, color, sku, is_active, created_at)
          VALUES (?, ?, ?, NULL, 1, datetime('now'))
          RETURNING id
        `).bind(productId, s, c).first<{ id: number }>();

        const variantId = varRes?.id;
        if (variantId) {
          await env.DB.prepare(`
            INSERT OR REPLACE INTO inventory (product_id, variant_id, quantity, reserved_quantity, reorder_point, last_updated)
            VALUES (?, ?, ?, 0, 5, datetime('now'))
          `).bind(productId, variantId, specificQty).run();
        }
      }
    }
  } else {
    await env.DB.prepare(`
      INSERT OR REPLACE INTO inventory (product_id, variant_id, quantity, reserved_quantity, reorder_point, last_updated)
      VALUES (?, NULL, ?, 0, 5, datetime('now'))
    `).bind(productId, totalStockInput).run();
  }

  return productId;
}

