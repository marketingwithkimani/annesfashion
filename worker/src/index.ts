import { Env, Product, ProductMedia, ProductVariant, InventoryItem } from './types';
import {
  handleGetUploadUrl,
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
      // PRODUCTS — CREATE (POST /api/products)
      // ----------------------------------------------------
      if (path === '/api/products' && method === 'POST') {
        const body = await request.json() as {
          title: string;
          description?: string;
          price: number;
          category: string;
          sku?: string;
          media_type?: 'image' | 'video';
          media_reference?: string;  // R2 key or URL
          poster_reference?: string;
          // R2 video fields
          video_key?: string;
          video_url?: string;
          video_mime_type?: string;
          video_size_bytes?: number;
          video_duration_seconds?: number;
          video_poster_key?: string;
          // Image fields
          image_url?: string;
          is_featured?: number;
          allow_preorder?: number;
          initial_stock?: number;
          // Per-variant stock (preferred over flat initial_stock)
          variants?: Array<{ size?: string; color?: string; sku?: string; quantity?: number }>;
        };

        if (!body.title || !body.price || !body.category) {
          return errorResponse('title, price, and category are required', 400, request, env);
        }

        const mediaType = body.media_type || (body.video_key ? 'video' : 'image');
        const mediaRef = body.media_reference || body.video_key || body.image_url || null;
        const posterRef = body.poster_reference || body.video_poster_key || null;

        // Resolve public URL from R2 key if needed
        const resolvedVideoUrl = body.video_url || (body.video_key ? getR2MediaUrl(body.video_key, env) : null);
        const resolvedImageUrl = body.image_url || (mediaType === 'image' && mediaRef ? getR2MediaUrl(mediaRef, env) : null);

        const res = await env.DB.prepare(`
          INSERT INTO products (
            title, description, price, category, sku,
            image_url, media_type, media_reference, poster_reference,
            video_key, video_url, video_mime_type, video_size_bytes, video_duration_seconds, video_poster_key,
            is_active, is_archived, is_featured, allow_preorder,
            created_at, updated_at
          ) VALUES (
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?,
            1, 0, ?, ?,
            datetime('now'), datetime('now')
          )
        `).bind(
          body.title,
          body.description || null,
          body.price,
          body.category,
          body.sku || null,
          resolvedImageUrl,
          mediaType,
          mediaRef,
          posterRef,
          body.video_key || null,
          resolvedVideoUrl,
          body.video_mime_type || null,
          body.video_size_bytes || null,
          body.video_duration_seconds || null,
          body.video_poster_key || null,
          body.is_featured ? 1 : 0,
          body.allow_preorder ? 1 : 0,
        ).run();

        const productId = res.meta.last_row_id;

        // ── Seed inventory ──────────────────────────────────────────────────
        if (productId) {
          if (body.variants && Array.isArray(body.variants) && body.variants.length > 0) {
            // Per-variant: insert product_variants row + inventory row for each
            for (const v of body.variants) {
              const varRes = await env.DB.prepare(`
                INSERT INTO product_variants (product_id, size, color, sku, is_active, created_at)
                VALUES (?, ?, ?, ?, 1, datetime('now'))
              `).bind(productId, v.size || null, v.color || null, v.sku || null).run();

              const variantId = varRes.meta.last_row_id;
              const qty = typeof v.quantity === 'number' ? v.quantity : 0;

              await env.DB.prepare(`
                INSERT OR IGNORE INTO inventory (product_id, variant_id, quantity, reserved_quantity, reorder_point, last_updated)
                VALUES (?, ?, ?, 0, 5, datetime('now'))
              `).bind(productId, variantId, qty).run();
            }
          } else {
            // No variants — seed a single flat inventory row
            await env.DB.prepare(`
              INSERT OR IGNORE INTO inventory (product_id, variant_id, quantity, reserved_quantity, reorder_point, last_updated)
              VALUES (?, NULL, ?, 0, 5, datetime('now'))
            `).bind(productId, body.initial_stock || 0).run();
          }
        }

        // Build shareable product URL (for client to copy & share)
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

        const body = await request.json() as Partial<{
          title: string;
          description: string;
          price: number;
          category: string;
          sku: string;
          media_type: 'image' | 'video';
          media_reference: string;
          poster_reference: string;
          video_key: string;
          video_url: string;
          video_mime_type: string;
          video_size_bytes: number;
          video_duration_seconds: number;
          video_poster_key: string;
          image_url: string;
          is_active: number;
          is_featured: number;
          allow_preorder: number;
        }>;

        // Resolve URLs from keys
        if (body.video_key && !body.video_url) {
          body.video_url = getR2MediaUrl(body.video_key, env) || undefined;
        }
        if (body.media_type === 'image' && body.media_reference && !body.image_url) {
          body.image_url = getR2MediaUrl(body.media_reference, env) || undefined;
        }

        const setClauses: string[] = ['updated_at = datetime(\'now\')'];
        const params: any[] = [];

        const fields: (keyof typeof body)[] = [
          'title', 'description', 'price', 'category', 'sku',
          'image_url', 'media_type', 'media_reference', 'poster_reference',
          'video_key', 'video_url', 'video_mime_type', 'video_size_bytes',
          'video_duration_seconds', 'video_poster_key',
          'is_active', 'is_featured', 'allow_preorder',
        ];

        for (const field of fields) {
          if (field in body) {
            setClauses.push(`${field} = ?`);
            params.push((body as any)[field] ?? null);
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
            p.is_active, p.is_archived, p.is_featured, p.allow_preorder,
            p.created_at, p.updated_at,
            COALESCE(SUM(i.quantity), 0) as total_stock
          FROM products p
          LEFT JOIN inventory i ON p.id = i.product_id
          WHERE p.is_active = 1 AND p.is_archived = 0
        `;
        const params: any[] = [];

        if (category && category !== 'all') {
          query += ` AND p.category = ?`;
          params.push(category);
        }

        if (featured === '1' || featured === 'true') {
          query += ` AND p.is_featured = 1`;
        }

        if (search) {
          query += ` AND (p.title LIKE ? OR p.description LIKE ? OR p.sku LIKE ?)`;
          const s = `%${search}%`;
          params.push(s, s, s);
        }

        query += ` GROUP BY p.id ORDER BY p.created_at DESC LIMIT ? OFFSET ?`;
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
          SELECT id, size, color, sku, is_active FROM product_variants WHERE product_id = ? AND is_active = 1
        `).bind(id).all<ProductVariant>();

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
        let sizes = Array.from(new Set((variants.results || []).map(v => v.size).filter(Boolean)));
        let colors = Array.from(new Set((variants.results || []).map(v => v.color).filter(Boolean)));

        // Fallback to description-encoded variants if product_variants table is empty
        const descVariants = parseVariantsFromDescription(product.description);
        if (sizes.length === 0 && descVariants.sizes.length > 0) {
          sizes = descVariants.sizes;
        }
        if (colors.length === 0 && descVariants.colors.length > 0) {
          colors = descVariants.colors;
        }
        let totalStock = totalStockCalculated;
        if (totalStock === 0 && descVariants.qty > 0) {
          totalStock = descVariants.qty;
        }

        // Category-based standard defaults if no sizes were specified
        if (sizes.length === 0) {
          const cat = (product.category || '').toLowerCase();
          if (['dresses', 'casual', 'corporate', 'weekend'].includes(cat)) {
            sizes = ['S', 'M', 'L', 'XL'];
          } else if (cat === 'shoes') {
            sizes = ['37', '38', '39', '40', '41'];
          }
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
      // Admin requests a presigned PUT URL for direct R2 upload.
      // No media bytes pass through the Worker.
      // ----------------------------------------------------
      if (path === '/api/media/upload-url' && method === 'POST') {
        return handleGetUploadUrl(request, env);
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
 * Resolves R2 keys → public URLs. No Stream references.
 */
function formatProductForResponse(p: any, env: Env) {
  const isVideo = p.media_type === 'video';

  // Resolve video URL: prefer explicit video_url, else build from video_key, else look in description
  let videoUrl = p.video_url || getR2MediaUrl(p.video_key, env);
  if (isVideo && !videoUrl && p.description) {
    const m = p.description.match(/\[Media:\s*(https?:\/\/[^\]\s]+)/i);
    if (m && m[1]) videoUrl = m[1].trim();
  }

  // Resolve poster URL: prefer video_poster_key, then poster_reference, then image_url
  const posterUrl = getR2MediaUrl(p.video_poster_key || p.poster_reference, env) || p.image_url || null;

  // Primary display image for catalogue cards:
  // - video product → poster image (NOT the video itself)
  // - image product → image_url or R2 key resolved URL
  const primaryImageUrl = isVideo
    ? (posterUrl || 'assets/Logo%20Black.png')
    : (p.image_url || getR2MediaUrl(p.media_reference, env));

  // Extract variants if present in description
  const descVars = parseVariantsFromDescription(p.description);

  return {
    ...p,
    raw_price: p.price,
    formatted_price: `KSh ${Number(p.price).toLocaleString()}`,
    is_video: isVideo,
    // Video
    video_url: isVideo ? videoUrl : null,
    video_key: p.video_key || null,
    video_duration_seconds: p.video_duration_seconds || null,
    video_mime_type: p.video_mime_type || null,
    // Poster / thumbnail
    poster_url: posterUrl,
    // Primary image for catalogue (always an image, never the raw video URL)
    primary_image_url: primaryImageUrl,
    image_url: primaryImageUrl,
    // Media reference (R2 key or URL)
    media_reference: p.media_reference,
    // Sizes and colors from description if available
    sizes: descVars.sizes,
    colors: descVars.colors,
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
