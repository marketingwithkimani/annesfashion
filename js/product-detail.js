// Product Detail Page JavaScript

document.addEventListener('DOMContentLoaded', () => {
    console.log('Product Detail Page Initializing...');

    // 1. Declare required variables
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');
    const listingId = urlParams.get('listing_id');
    const detailSection = document.getElementById('productInfoDetail');
    const errorSection = document.getElementById('productNotFoundError');

    if (!productId && !listingId) {
        showError();
        return;
    }

    // 2. Show error state
    function showError() {
        console.error(`Product ID ${productId || listingId} NOT found in catalog.`);
        if (errorSection) errorSection.style.display = 'block';
        if (detailSection) detailSection.style.visibility = 'visible';
    }

    // 3. Load related products
    function loadRelatedProducts(currentId) {
        const relatedProducts = document.getElementById('relatedProducts');
        if (!relatedProducts) return;
        relatedProducts.innerHTML = '';

        const socialVideos = [
            { type: 'social', videoUrl: 'assets/instagram/videos/Lifestyle Casual.mp4', likes: '1.2K', comments: '234' },
            { type: 'social', videoUrl: 'assets/instagram/videos/Weekend Lifestyle.mp4', likes: '890', comments: '156' },
            { type: 'social', videoUrl: 'assets/instagram/videos/Dresses.mp4', likes: '2.1K', comments: '345' },
            { type: 'social', videoUrl: 'assets/instagram/videos/Casual Weekend Club.mp4', likes: '1.5K', comments: '289' },
            { type: 'social', videoUrl: 'assets/instagram/videos/Heels Casual Date Club.mp4', likes: '3.2K', comments: '420' },
            { type: 'social', videoUrl: 'assets/instagram/videos/Jeans Casual Weekend.mp4', likes: '1.8K', comments: '190' }
        ];

        const availableProducts = (window.productsData || []).filter(p =>
            p.type === 'product' && p.id != currentId
        );

        const shuffledProducts = availableProducts.sort(() => 0.5 - Math.random());
        const selectedProducts = shuffledProducts.slice(0, 2);
        const randomVideo = socialVideos[Math.floor(Math.random() * socialVideos.length)];
        const mix = [...selectedProducts, randomVideo];

        mix.forEach(item => {
            const card = document.createElement('div');
            if (item.type === 'product') {
                card.className = 'product-card';
                card.innerHTML = `
                <div class="product-media">
                    <img src="${item.image}" alt="${item.title}" loading="lazy">
                </div>
                <div class="product-info">
                    <h3 class="product-title">${item.title}</h3>
                    <p class="product-price">${item.price}</p>
                    <button class="btn-add-cart" onclick="window.addToWardrobe && window.addToWardrobe(${item.id})">
                        <i class="fas fa-shopping-bag"></i> Add to Wardrobe
                    </button>
                </div>
            `;
                card.addEventListener('click', (e) => {
                    if (!e.target.closest('.btn-add-cart')) {
                        window.location.href = `product-detail.html?id=${item.id}`;
                    }
                });
            } else {
                card.className = 'product-card social-insert';
                card.style.gridRow = 'span 1';
                card.innerHTML = `
                <div class="product-media" style="height: 100%;">
                    <video autoplay muted loop playsinline style="width: 100%; height: 100%; object-fit: cover;">
                        <source src="${item.videoUrl}" type="video/mp4">
                    </video>
                    <div class="social-overlay" style="position: absolute; bottom: 10px; left: 10px; z-index: 2;">
                        <div class="social-engagement" style="color: white; text-shadow: 0 1px 3px rgba(0,0,0,0.5);">
                            <span style="margin-right: 15px;"><i class="fas fa-heart"></i> ${item.likes}</span>
                            <span><i class="fas fa-comment"></i> ${item.comments}</span>
                        </div>
                    </div>
                </div>
            `;
            }
            relatedProducts.appendChild(card);
        });
    }

    // Helper to extract variants from description
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

    function extractAllExactSizes(p) {
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

        // Check exact size fields from DB or API payload
        parseAndAdd(p.waist_sizes);
        parseAndAdd(p.bust_sizes);
        parseAndAdd(p.shoe_sizes);
        parseAndAdd(p.sizes);

        if (Array.isArray(p.variants)) {
            p.variants.forEach(v => {
                if (v?.size) sizeSet.add(String(v.size).trim());
                if (v?.waist_size) sizeSet.add(String(v.waist_size).trim());
                if (v?.bust_size) sizeSet.add(String(v.bust_size).trim());
                if (v?.shoe_size) sizeSet.add(String(v.shoe_size).trim());
            });
        }

        // Only fall back to description parsing if no DB sizes found
        if (sizeSet.size === 0 && p.description && typeof p.description === 'string' && p.description.includes('Variant Stock:')) {
            const vParsed = extractVariantsFromText(p.description);
            vParsed.sizes.forEach(s => sizeSet.add(s));
        }

        // Deduplicate: if we have '30"' and '30', keep '30"' (the more specific version)
        const res = Array.from(sizeSet).filter(Boolean);
        if (res.length > 0) {
            const seen = new Map();
            for (const s of res) {
                const base = s.replace(/["'″]/g, '').trim();
                const existing = seen.get(base);
                if (!existing || s.length > existing.length) {
                    seen.set(base, s);
                }
            }
            return Array.from(seen.values());
        }

        // Contextual fallback based on product item title / category
        const titleLower = (p.title || '').toLowerCase();
        const cat = (p.category || '').toLowerCase();

        if (titleLower.includes('jean') || titleLower.includes('trouser') || titleLower.includes('short') || titleLower.includes('pant')) {
            return ['28"', '30"', '32"', '34"', '36"'];
        }
        if (cat === 'shoes' || titleLower.includes('heel') || titleLower.includes('sneaker') || titleLower.includes('boot') || titleLower.includes('shoe')) {
            return ['37', '38', '39', '40', '41'];
        }
        if (titleLower.includes('bra') || titleLower.includes('bust') || titleLower.includes('lingerie') || titleLower.includes('corset')) {
            return ['32', '34', '36', '38'];
        }
        if (['dresses', 'casual', 'corporate', 'weekend', 'sweaters', 'trousers', 'jumpsuits', 'innerwear'].includes(cat)) {
            return ['S', 'M', 'L', 'XL'];
        }
        return [];
    }

    function extractAllExactColors(p) {
        const colorSet = new Set();
        const parseAndAdd = (val) => {
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
                } catch (e) {}
                clean.split(',').forEach(c => c && colorSet.add(String(c).trim()));
            } else if (Array.isArray(val)) {
                val.forEach(c => c && colorSet.add(String(c).trim()));
            }
        };

        parseAndAdd(p.colors);

        if (Array.isArray(p.variants)) {
            p.variants.forEach(v => {
                if (v?.color && String(v.color).toLowerCase() !== 'default') {
                    colorSet.add(String(v.color).trim());
                }
            });
        }

        if (p.description && typeof p.description === 'string' && p.description.includes('Variant Stock:')) {
            const vParsed = extractVariantsFromText(p.description);
            vParsed.colors.forEach(c => colorSet.add(c));
        }

        return Array.from(colorSet).filter(Boolean);
    }

    function cleanCustomerDescription(desc) {
        if (!desc) return '';
        return desc
            .replace(/\[Variant Stock:[^\]]*\]/gi, '')
            .replace(/\[Media:[^\]]*\]/gi, '')
            .trim();
    }

    // Comprehensive fashion color resolver for true swatches
    function resolveFashionColor(colorName) {
        if (!colorName || typeof colorName !== 'string') return { background: '#888888', isLight: false };
        const raw = colorName.trim();
        const c = raw.toLowerCase().replace(/[_-]/g, ' ').replace(/\s+/g, ' ');

        // 1. Check for compound / split colors (e.g. "White with Orange", "Brown and Green", "Black & Gold")
        const splitMatch = c.match(/^(.+?)\s*(?:and|with|&)\s*(.+)$/);
        if (splitMatch) {
            const c1 = resolveFashionColor(splitMatch[1]);
            const c2 = resolveFashionColor(splitMatch[2]);
            return {
                background: `linear-gradient(135deg, ${c1.background} 50%, ${c2.background} 50%)`,
                isLight: c1.isLight && c2.isLight
            };
        }

        // 2. Comprehensive Fashion Dictionary
        const map = {
            // True Browns & Chocolates (NOT Maroon!)
            'brown': { hex: '#6B4423', isLight: false },
            'chocolate': { hex: '#4A2C11', isLight: false },
            'chocolate brown': { hex: '#4A2C11', isLight: false },
            'coffee': { hex: '#4A3525', isLight: false },
            'mocha': { hex: '#7A5A40', isLight: false },
            'tan': { hex: '#D2B48C', isLight: true },
            'camel': { hex: '#C19A6B', isLight: true },
            'khaki': { hex: '#C3B091', isLight: true },

            // Greens (Emerald, Mint, Luminous, Sage, Olive)
            'emerald': { hex: '#097969', isLight: false },
            'emerald green': { hex: '#097969', isLight: false },
            'mint': { hex: '#98FF98', isLight: true },
            'mint green': { hex: '#98FF98', isLight: true },
            'luminous green': { hex: '#39FF14', isLight: true },
            'neon green': { hex: '#39FF14', isLight: true },
            'lime': { hex: '#32CD32', isLight: true },
            'lime green': { hex: '#32CD32', isLight: true },
            'olive': { hex: '#808000', isLight: false },
            'olive green': { hex: '#556B2F', isLight: false },
            'sage': { hex: '#9CAF88', isLight: true },
            'sage green': { hex: '#9CAF88', isLight: true },
            'forest green': { hex: '#228B22', isLight: false },
            'dark green': { hex: '#1B4D3E', isLight: false },
            'green': { hex: '#2E8B57', isLight: false },
            'teal': { hex: '#008080', isLight: false },
            'turquoise': { hex: '#40E0D0', isLight: true },

            // Peaches, Corals & Oranges
            'peach': { hex: '#FFCBA4', isLight: true },
            'peach puff': { hex: '#FFDAB9', isLight: true },
            'apricot': { hex: '#FBCEB1', isLight: true },
            'coral': { hex: '#FF7F50', isLight: false },
            'salmon': { hex: '#FA8072', isLight: true },
            'orange': { hex: '#FFA500', isLight: false },
            'burnt orange': { hex: '#CC5500', isLight: false },
            'rust': { hex: '#B7410E', isLight: false },
            'terracotta': { hex: '#E2725B', isLight: false },

            // Maroons, Reds & Burgundies
            'maroon': { hex: '#800000', isLight: false },
            'burgundy': { hex: '#800020', isLight: false },
            'wine': { hex: '#722F37', isLight: false },
            'red': { hex: '#E50914', isLight: false },
            'crimson': { hex: '#DC143C', isLight: false },
            'ruby': { hex: '#E0115F', isLight: false },

            // Nudes, Neutrals, Whites & Creams
            'nude': { hex: '#E3BC9A', isLight: true },
            'beige': { hex: '#F5F5DC', isLight: true },
            'cream': { hex: '#FFFDD0', isLight: true },
            'off white': { hex: '#FAF9F6', isLight: true },
            'ivory': { hex: '#FFFFF0', isLight: true },
            'white': { hex: '#FFFFFF', isLight: true },
            'champagne': { hex: '#F7E7CE', isLight: true },

            // Pinks & Purples
            'pink': { hex: '#FFC0CB', isLight: true },
            'dusty pink': { hex: '#DCAE96', isLight: true },
            'dusty rose': { hex: '#DCAE96', isLight: true },
            'baby pink': { hex: '#F4C2C2', isLight: true },
            'hot pink': { hex: '#FF69B4', isLight: false },
            'magenta': { hex: '#FF00FF', isLight: false },
            'fuchsia': { hex: '#FF00FF', isLight: false },
            'lavender': { hex: '#E6E6FA', isLight: true },
            'lilac': { hex: '#C8A2C8', isLight: true },
            'purple': { hex: '#800080', isLight: false },
            'plum': { hex: '#8E4585', isLight: false },
            'mauve': { hex: '#E0B0FF', isLight: true },
            'violet': { hex: '#8F00FF', isLight: false },

            // Blues
            'navy': { hex: '#001f3f', isLight: false },
            'navy blue': { hex: '#001f3f', isLight: false },
            'royal blue': { hex: '#4169E1', isLight: false },
            'sky blue': { hex: '#87CEEB', isLight: true },
            'baby blue': { hex: '#89CFF0', isLight: true },
            'powder blue': { hex: '#B0E0E6', isLight: true },
            'blue': { hex: '#1E90FF', isLight: false },

            // Yellows & Golds
            'yellow': { hex: '#FFD700', isLight: true },
            'mustard': { hex: '#E1AD01', isLight: false },
            'mustard yellow': { hex: '#E1AD01', isLight: false },
            'gold': { hex: '#D4AF37', isLight: false },
            'rose gold': { hex: '#B76E79', isLight: false },
            'bronze': { hex: '#CD7F32', isLight: false },
            'copper': { hex: '#B87333', isLight: false },
            'silver': { hex: '#C0C0C0', isLight: true },

            // Darks & Greys
            'black': { hex: '#111111', isLight: false },
            'grey': { hex: '#808080', isLight: false },
            'gray': { hex: '#808080', isLight: false },
            'charcoal': { hex: '#36454F', isLight: false },

            // Prints & Multi
            'floral': { hex: 'linear-gradient(135deg, #FF9A8B 0%, #FF6A88 55%, #FF99AC 100%)', isLight: false },
            'multi': { hex: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', isLight: false },
            'multicolour': { hex: 'linear-gradient(135deg, #f093fb 0%, #f5576c 50%, #4facfe 100%)', isLight: false },
            'multicolored': { hex: 'linear-gradient(135deg, #f093fb 0%, #f5576c 50%, #4facfe 100%)', isLight: false },
            'multicolor': { hex: 'linear-gradient(135deg, #f093fb 0%, #f5576c 50%, #4facfe 100%)', isLight: false },
            'print': { hex: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', isLight: false }
        };

        if (map[c]) {
            return { background: map[c].hex, isLight: map[c].isLight };
        }

        // 3. Keyword matching for multi-word or custom variant names
        if (c.includes('emerald')) return { background: '#097969', isLight: false };
        if (c.includes('mint')) return { background: '#98FF98', isLight: true };
        if (c.includes('peach')) return { background: '#FFCBA4', isLight: true };
        if (c.includes('luminous') || c.includes('neon')) return { background: '#39FF14', isLight: true };
        if (c.includes('chocolate')) return { background: '#4A2C11', isLight: false };
        if (c.includes('brown')) return { background: '#6B4423', isLight: false };
        if (c.includes('burgundy') || c.includes('wine')) return { background: '#800020', isLight: false };
        if (c.includes('maroon')) return { background: '#800000', isLight: false };
        if (c.includes('mustard')) return { background: '#E1AD01', isLight: false };
        if (c.includes('rust')) return { background: '#B7410E', isLight: false };
        if (c.includes('olive')) return { background: '#556B2F', isLight: false };
        if (c.includes('sage')) return { background: '#9CAF88', isLight: true };
        if (c.includes('navy')) return { background: '#001f3f', isLight: false };
        if (c.includes('royal')) return { background: '#4169E1', isLight: false };
        if (c.includes('gold')) return { background: '#D4AF37', isLight: false };
        if (c.includes('silver')) return { background: '#C0C0C0', isLight: true };
        if (c.includes('floral')) return { background: 'linear-gradient(135deg, #FF9A8B 0%, #FF6A88 55%, #FF99AC 100%)', isLight: false };
        if (c.includes('multi')) return { background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', isLight: false };
        if (c.includes('green')) return { background: '#2E8B57', isLight: false };
        if (c.includes('blue')) return { background: '#1E90FF', isLight: false };
        if (c.includes('pink') || c.includes('rose')) return { background: '#FFC0CB', isLight: true };
        if (c.includes('red')) return { background: '#E50914', isLight: false };
        if (c.includes('purple')) return { background: '#800080', isLight: false };
        if (c.includes('orange')) return { background: '#FFA500', isLight: false };
        if (c.includes('yellow')) return { background: '#FFD700', isLight: true };
        if (c.includes('nude') || c.includes('beige')) return { background: '#E3BC9A', isLight: true };
        if (c.includes('white')) return { background: '#FFFFFF', isLight: true };
        if (c.includes('black')) return { background: '#111111', isLight: false };

        // 4. Fallback: Generate a pleasing distinct HSL color based on string hash (NEVER WHITE!)
        let hash = 0;
        for (let i = 0; i < c.length; i++) {
            hash = c.charCodeAt(i) + ((hash << 5) - hash);
        }
        const hue = Math.abs(hash) % 360;
        return { background: `hsl(${hue}, 65%, 45%)`, isLight: false };
    }

    // Multi-Item Showcase State (1 Video -> 1 to 3 Pieces)
    let currentLookItems = [];
    let currentListingData = null;
    let activePieceIndex = 0;
    let pieceSelections = {};
    let currentMediaSrc = null;

    // 4. Render product or multi-piece look into the page
    function renderLook(items, defaultActiveIndex = 0, listing = null) {
        if (!items || items.length === 0) {
            showError();
            return;
        }

        currentLookItems = items;
        currentListingData = listing;
        activePieceIndex = defaultActiveIndex >= 0 && defaultActiveIndex < items.length ? defaultActiveIndex : 0;

        const mainItem = currentLookItems[0];
        const showcaseEl = document.getElementById('multiPieceShowcase');
        const countEl = document.getElementById('showcaseCount');
        const tabsContainer = document.getElementById('piecesTabsContainer');
        const bundleCard = document.getElementById('bundleBuyCard');
        const bundlePriceEl = document.getElementById('bundleTotalPrice');
        const buyFullLookBtn = document.getElementById('btnBuyFullLook');

        // Setup Video / Media Once for the Entire Showcase Look
        setupShowcaseMedia(currentLookItems[activePieceIndex] || mainItem);

        // Multi-Piece Showcase Tabs & Bundle Buying
        if (currentLookItems.length > 1) {
            if (showcaseEl) showcaseEl.style.display = 'block';
            
            const badgeEl = showcaseEl ? showcaseEl.querySelector('.showcase-badge') : null;
            if (badgeEl) {
                const lookName = (currentListingData && currentListingData.title) ? currentListingData.title : 'Coordinated Video Look';
                badgeEl.innerHTML = `<i class="fas fa-video"></i> ${lookName}`;
            }

            if (countEl) {
                countEl.textContent = `${currentLookItems.length} Pieces in this Video`;
            }

            if (tabsContainer) {
                tabsContainer.innerHTML = currentLookItems.map((item, idx) => {
                    const priceVal = parseFloat(item.price || item.raw_price || 0);
                    const slotNum = item.item_slot || (idx + 1);
                    const isPieceActive = idx === activePieceIndex;
                    const stockNum = item.stock || item.total_stock || 10;
                    return `
                        <div class="piece-tab-card ${isPieceActive ? 'active' : ''}" data-index="${idx}">
                            <div class="piece-slot-badge">
                                <span>Piece ${slotNum} of ${currentLookItems.length}</span>
                                <i class="fas fa-check-circle piece-active-check"></i>
                            </div>
                            <div class="piece-tab-title" title="${item.title}">${item.title}</div>
                            <div class="piece-tab-price">KSh ${priceVal.toLocaleString()}</div>
                            <div class="piece-tab-meta">${stockNum > 0 ? `In Stock (${stockNum})` : (item.allow_preorder ? 'Pre-order' : 'Out of Stock')}</div>
                        </div>
                    `;
                }).join('');

                tabsContainer.querySelectorAll('.piece-tab-card').forEach(card => {
                    card.addEventListener('click', () => {
                        const newIdx = parseInt(card.dataset.index, 10);
                        if (!isNaN(newIdx) && newIdx !== activePieceIndex) {
                            activePieceIndex = newIdx;
                            tabsContainer.querySelectorAll('.piece-tab-card').forEach((c, i) => {
                                c.classList.toggle('active', i === activePieceIndex);
                            });
                            renderActivePiece(activePieceIndex);
                        }
                    });
                });
            }

            // Shop Full Look (Bundle) Card
            if (bundleCard && bundlePriceEl) {
                bundleCard.style.display = 'block';
                const totalBundlePrice = currentLookItems.reduce((acc, it) => {
                    return acc + (parseFloat(it.price || it.raw_price || 0) || 0);
                }, 0);
                bundlePriceEl.textContent = `KES ${totalBundlePrice.toLocaleString()}`;

                if (buyFullLookBtn) {
                    const newBuyBtn = buyFullLookBtn.cloneNode(true);
                    buyFullLookBtn.parentNode.replaceChild(newBuyBtn, buyFullLookBtn);
                    newBuyBtn.innerHTML = `<i class="fas fa-magic"></i> Add Complete Look (${currentLookItems.length} Pieces • KES ${totalBundlePrice.toLocaleString()})`;

                    newBuyBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        if (typeof window.addToWardrobe !== 'function') return;

                        currentLookItems.forEach((piece, pIdx) => {
                            const sel = pieceSelections[pIdx];
                            const exactSizes = extractAllExactSizes(piece);
                            const exactColors = extractAllExactColors(piece);
                            const defSize = (sel && sel.selectedSize) || exactSizes[0] || piece.size || 'One Size';
                            const defColor = (sel && sel.selectedColor) || exactColors[0] || piece.color || '';
                            const defVariant = (sel && sel.matchedVariant) || null;
                            const defStock = (sel && typeof sel.stock === 'number') ? sel.stock : (piece.stock || piece.total_stock || 10);
                            window.addToWardrobe(piece, defSize, defColor, defVariant, defStock);
                        });

                        if (typeof showBabeToast === 'function') {
                            showBabeToast(`Added all ${currentLookItems.length} pieces of this look to your wardrobe, babe! 💕✨`);
                        }
                        if (typeof window.openCart === 'function') {
                            window.openCart();
                        } else {
                            const cartIcon = document.getElementById('cartIcon');
                            if (cartIcon) cartIcon.click();
                        }
                    });
                }
            }
        } else {
            if (showcaseEl) showcaseEl.style.display = 'none';
            if (bundleCard) bundleCard.style.display = 'none';
        }

        // Render Active Piece Options (Sizes, Colors, Stock, Add to Cart)
        renderActivePiece(activePieceIndex);
    }

    function setupShowcaseMedia(productData) {
        const isVideo = productData.media_type === 'video' || Boolean(productData.is_video);
        const mainImageContainer = document.querySelector('.main-image');

        let videoSrc = isVideo ? (productData.video_url || productData.media_reference) : null;
        if (videoSrc && (videoSrc.includes('.png') || videoSrc.includes('.jpg') || videoSrc.includes('.webp') || videoSrc.includes('.jpeg'))) {
            videoSrc = null;
        }
        if (isVideo && !videoSrc && productData.description) {
            const mMatch = productData.description.match(/\[Media:\s*(https?:\/\/[^\]\s]+(?:\.mp4|\.webm|\.mov)?)/i);
            if (mMatch && mMatch[1]) {
                videoSrc = mMatch[1].trim();
            }
        }

        const posterSrc = productData.poster_url || productData.poster_reference || 'assets/Logo%20Black.png';
        const safeMainImg = (productData.image_url && !productData.image_url.startsWith('content://') && !productData.image_url.includes('.mp4')) 
            ? productData.image_url 
            : (productData.image || posterSrc);

        function showVideoInMain(vSrc, pSrc) {
            if (!mainImageContainer) return;
            mainImageContainer.classList.add('has-video');
            mainImageContainer.innerHTML = `
                <div class="product-video-wrapper" style="position: relative; width: 100%; display: flex; align-items: center; justify-content: center; background: #000; border-radius: 16px; overflow: hidden;">
                    <video id="mainProductVideo" controls autoplay playsinline preload="metadata" poster="${pSrc}" style="width: 100%; max-height: 65vh; object-fit: contain; display: block; border-radius: 16px;">
                        <source src="${vSrc}" type="video/mp4">
                        Your browser does not support HTML5 video.
                    </video>
                </div>
            `;
        }

        function showImageInMain(iSrc) {
            if (!mainImageContainer) return;
            mainImageContainer.classList.remove('has-video');
            mainImageContainer.innerHTML = `
                <img id="mainProductImage" src="${iSrc}" alt="${productData.title || 'Product'}" onerror="this.onerror=null; this.src='assets/Logo%20Black.png';">
            `;
        }

        if (isVideo && videoSrc) {
            showVideoInMain(videoSrc, posterSrc);
        } else {
            showImageInMain(safeMainImg);
        }

        // Thumbnails Gallery
        const thumbContainer = document.getElementById('thumbnailContainer');
        if (thumbContainer) {
            thumbContainer.innerHTML = '';
            const mediaList = [];
            if (isVideo && videoSrc) {
                mediaList.push({ type: 'video', url: videoSrc, poster: posterSrc, is_main: true });
            }
            const images = (productData.images && productData.images.length > 0)
                ? productData.images.map(img => typeof img === 'string' ? img : img.url)
                : (safeMainImg ? [safeMainImg] : []);
            images.forEach(imgUrl => {
                if (imgUrl && !mediaList.some(m => m.url === imgUrl)) {
                    mediaList.push({ type: 'image', url: imgUrl, poster: null, is_main: false });
                }
            });

            mediaList.forEach((mediaItem, index) => {
                const thumbWrapper = document.createElement('div');
                thumbWrapper.className = `thumbnail-wrapper ${index === 0 ? 'active' : ''}`;
                thumbWrapper.style.cssText = 'position: relative; cursor: pointer; display: inline-block; margin: 4px; border-radius: 8px; overflow: hidden; border: 2px solid transparent;';
                if (index === 0) thumbWrapper.style.borderColor = 'var(--accent-gold)';

                const thumbImg = document.createElement('img');
                const isItemVideo = mediaItem.type === 'video';
                thumbImg.src = isItemVideo ? (mediaItem.poster || 'assets/Logo%20Black.png') : (mediaItem.url || 'assets/Logo%20Black.png');
                thumbImg.style.cssText = 'width: 70px; height: 70px; object-fit: cover; display: block; border-radius: 6px;';
                thumbImg.onerror = function() { this.onerror = null; this.src = 'assets/Logo%20Black.png'; };
                thumbWrapper.appendChild(thumbImg);

                if (isItemVideo) {
                    const playBadge = document.createElement('div');
                    playBadge.innerHTML = '<i class="fas fa-play" style="font-size: 10px; color: #fff;"></i>';
                    playBadge.style.cssText = 'position: absolute; bottom: 4px; right: 4px; background: rgba(201, 169, 110, 0.9); width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center;';
                    thumbWrapper.appendChild(playBadge);
                }

                thumbWrapper.addEventListener('click', () => {
                    document.querySelectorAll('.thumbnail-wrapper').forEach(t => {
                        t.classList.remove('active');
                        t.style.borderColor = 'transparent';
                    });
                    thumbWrapper.classList.add('active');
                    thumbWrapper.style.borderColor = 'var(--accent-gold)';

                    if (isItemVideo) {
                        showVideoInMain(mediaItem.url, mediaItem.poster || posterSrc);
                    } else {
                        showImageInMain(mediaItem.url);
                    }
                });

                thumbContainer.appendChild(thumbWrapper);
            });
        }
    }

    function renderActivePiece(index) {
        try {
            const productData = currentLookItems[index];
            if (!productData) return;

            const vParsed = extractVariantsFromText(productData.description);
            const exactSizes = extractAllExactSizes(productData);
            let extractedSizes = exactSizes.length > 0 ? exactSizes : vParsed.sizes;
            let extractedColors = extractAllExactColors(productData);
            let stockNum = parseInt(productData.total_stock) || 0;
            if (stockNum === 0 && vParsed.qty > 0) stockNum = vParsed.qty;

            const categoryName = (productData.category || 'general').toLowerCase();
            const cleanedDesc = cleanCustomerDescription(productData.description);

            const product = {
                id: productData.id,
                title: productData.title,
                price: `KSh ${parseFloat(productData.price || productData.raw_price || 0).toLocaleString()}`,
                raw_price: productData.raw_price || parseFloat(productData.price || 0),
                image: productData.image_url || productData.image,
                category: categoryName,
                description: cleanedDesc || `Experience the exclusive ${productData.title} from our ${categoryName} collection. Premium luxury and style, curated just for you.`,
                stock: stockNum,
                allow_preorder: parseInt(productData.allow_preorder) === 1 || Boolean(productData.allow_preorder),
                sizes: extractedSizes,
                colors: extractedColors,
                variants: productData.variants || []
            };

            document.title = `${product.title} | Anne's Fashion Line`;

            const titleEl = document.querySelector('.product-title-main');
            if (titleEl) titleEl.textContent = product.title;

            const priceEl = document.querySelector('.product-price-main');
            if (priceEl) priceEl.textContent = product.price;

            const descEl = document.querySelector('.product-description');
            if (descEl) descEl.textContent = product.description;

            // Helper to get selected variant and its real-time stock
            function getSelectedVariant() {
                const activeSizeBtn = document.querySelector('#sizeSelector .size-btn.active');
                const selectedSize = activeSizeBtn ? (activeSizeBtn.getAttribute('data-size') || activeSizeBtn.textContent.trim()) : null;

                const activeColorBtn = document.querySelector('#colorSelector .color-btn.active');
                const selectedColor = activeColorBtn ? (activeColorBtn.getAttribute('data-color') || activeColorBtn.title || activeColorBtn.textContent.trim()) : null;

                if (!product || !Array.isArray(product.variants) || product.variants.length === 0) {
                    const fallbackStock = (product && product.stock !== undefined) ? product.stock : (product && product.total_stock !== undefined ? product.total_stock : 10);
                    return { selectedSize, selectedColor, matchedVariant: null, stock: fallbackStock };
                }

                const cleanS = selectedSize ? String(selectedSize).replace(/["'\\]/g, '').trim().toLowerCase() : null;
                const cleanC = selectedColor ? String(selectedColor).trim().toLowerCase() : null;

                let matched = product.variants.find(v => {
                    const vS = v.size ? String(v.size).replace(/["'\\]/g, '').trim().toLowerCase() : null;
                    const vC = v.color ? String(v.color).trim().toLowerCase() : null;
                    if (cleanS && cleanC) return vS === cleanS && vC === cleanC;
                    if (cleanS) return vS === cleanS;
                    if (cleanC) return vC === cleanC;
                    return false;
                });

                if (!matched && cleanS) {
                    matched = product.variants.find(v => {
                        const vS = v.size ? String(v.size).replace(/["'\\]/g, '').trim().toLowerCase() : null;
                        return vS === cleanS;
                    });
                }

                const stock = matched && typeof matched.stock === 'number'
                    ? matched.stock 
                    : ((product && product.stock !== undefined) ? product.stock : 10);

                const currentSelection = { selectedSize, selectedColor, matchedVariant: matched, stock };
                pieceSelections[index] = currentSelection;

                return currentSelection;
            }

            function updateVariantStockUI() {
                const { selectedSize, selectedColor, stock } = getSelectedVariant();
                const stockStatusEl = document.getElementById('variantStockStatus');
                const addBtn = document.querySelector('.btn-add-to-cart');

                let statusHtml = '';
                const variantLabel = [selectedColor, selectedSize].filter(Boolean).join(' / ');

                if (stock > 0) {
                    if (stock <= 3) {
                        statusHtml = `<span style="color: #e67e22; font-weight: 700;"><i class="fas fa-fire"></i> Only ${stock} left in stock ${variantLabel ? `for ${variantLabel}` : ''}!</span>`;
                    } else {
                        statusHtml = `<span style="color: #4CAF50; font-weight: 600;"><i class="fas fa-check-circle"></i> In Stock (${stock} available)</span>`;
                    }
                } else {
                    if (product.allow_preorder) {
                        statusHtml = `<span style="color: var(--accent-gold); font-weight: 700;"><i class="fas fa-clock"></i> Available for Pre-order</span>`;
                    } else {
                        statusHtml = `<span style="color: #f44336; font-weight: 700;"><i class="fas fa-times-circle"></i> Out of Stock ${variantLabel ? `in ${variantLabel}` : ''}</span>`;
                    }
                }

                if (stockStatusEl) stockStatusEl.innerHTML = statusHtml;

                if (addBtn) {
                    const buttonActionLabel = currentLookItems.length > 1 ? `Add ${product.title} to Wardrobe • ${product.price}` : `Add to Wardrobe • ${product.price}`;
                    if (stock <= 0 && !product.allow_preorder) {
                        addBtn.innerHTML = '<i class="fas fa-times-circle"></i> Out of Stock';
                        addBtn.disabled = true;
                        addBtn.style.opacity = '0.5';
                        addBtn.style.cursor = 'not-allowed';
                    } else if (stock <= 0 && product.allow_preorder) {
                        addBtn.innerHTML = `<i class="fas fa-clock"></i> Pre-order ${product.title}`;
                        addBtn.disabled = false;
                        addBtn.style.opacity = '1';
                        addBtn.style.cursor = 'pointer';
                    } else {
                        addBtn.innerHTML = `<i class="fas fa-shopping-bag"></i> ${buttonActionLabel}`;
                        addBtn.disabled = false;
                        addBtn.style.opacity = '1';
                        addBtn.style.cursor = 'pointer';
                    }
                }
            }

            // Sizes
            const sizeContainer = document.getElementById('sizeSelector');
            const sizeOptionGroup = sizeContainer ? sizeContainer.closest('.option-group') : null;
            if (sizeOptionGroup) {
                const label = sizeOptionGroup.querySelector('label');
                if (label) {
                    const titleLower = (product.title || '').toLowerCase();
                    const catLower = (product.category || '').toLowerCase();
                    const hasBust = productData.bust_sizes && (typeof productData.bust_sizes === 'string' ? JSON.parse(productData.bust_sizes || '[]') : productData.bust_sizes).length > 0;
                    const hasWaist = productData.waist_sizes && (typeof productData.waist_sizes === 'string' ? JSON.parse(productData.waist_sizes || '[]') : productData.waist_sizes).length > 0;

                    if (hasBust || titleLower.includes('top') || titleLower.includes('bra') || titleLower.includes('corset') || titleLower.includes('bust')) {
                        label.textContent = 'Bust Size:';
                    } else if (hasWaist || titleLower.includes('jean') || titleLower.includes('skirt') || titleLower.includes('trouser') || titleLower.includes('pant') || titleLower.includes('short')) {
                        label.textContent = 'Waist Size:';
                    } else if (catLower === 'shoes' || titleLower.includes('shoe') || titleLower.includes('heel') || titleLower.includes('sneaker')) {
                        label.textContent = 'Shoe Size:';
                    } else {
                        label.textContent = 'Size:';
                    }
                }
            }

            if (sizeContainer) {
                sizeContainer.innerHTML = '';
                const validSizes = (product.sizes || []).filter(Boolean);
                if (validSizes.length > 0) {
                    if (sizeOptionGroup) sizeOptionGroup.style.display = 'block';
                    const activeSavedSize = pieceSelections[index]?.selectedSize;
                    validSizes.forEach((size, sIdx) => {
                        const isSizeActive = activeSavedSize ? activeSavedSize === size : sIdx === 0;
                        const btn = document.createElement('button');
                        btn.className = `size-btn ${isSizeActive ? 'active' : ''}`;
                        btn.textContent = size;
                        btn.setAttribute('data-size', size);
                        btn.addEventListener('click', () => {
                            sizeContainer.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
                            btn.classList.add('active');
                            updateVariantStockUI();
                        });
                        sizeContainer.appendChild(btn);
                    });
                } else {
                    if (sizeOptionGroup) sizeOptionGroup.style.display = 'none';
                }
            }

            // Colors
            const colorContainer = document.getElementById('colorSelector');
            const colorOptionGroup = colorContainer ? colorContainer.closest('.option-group') : null;
            if (colorContainer) {
                colorContainer.innerHTML = '';
                const validColors = (product.colors || []).filter(c => c && c.toLowerCase() !== 'default');
                if (validColors.length > 0) {
                    if (colorOptionGroup) colorOptionGroup.style.display = 'block';
                    const activeSavedColor = pieceSelections[index]?.selectedColor;
                    validColors.forEach((color, cIdx) => {
                        const isColorActive = activeSavedColor ? activeSavedColor === color : cIdx === 0;
                        const btn = document.createElement('button');
                        btn.setAttribute('data-color', color);
                        btn.title = color;

                        const resolved = resolveFashionColor(color);
                        btn.style.background = resolved.background;
                        btn.className = `color-btn ${isColorActive ? 'active' : ''} ${resolved.isLight ? 'check-dark' : ''}`;

                        if (resolved.isLight) {
                            btn.style.borderColor = 'rgba(0, 0, 0, 0.25)';
                        }

                        btn.addEventListener('click', () => {
                            colorContainer.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
                            btn.classList.add('active');
                            updateVariantStockUI();
                        });
                        colorContainer.appendChild(btn);
                    });
                } else {
                    if (colorOptionGroup) colorOptionGroup.style.display = 'none';
                }
            }

            // Breadcrumbs
            const breadcrumbEl = document.getElementById('productBreadcrumb');
            if (breadcrumbEl) {
                const catCap = product.category.charAt(0).toUpperCase() + product.category.slice(1);
                const targetPage = (typeof window.getCategoryPage === 'function')
                    ? window.getCategoryPage(product.category)
                    : `${product.category}.html`;
                let crumbHtml = `<a href="index.html">Home</a> / <a href="${targetPage}">${catCap}</a>`;
                if (currentListingData && currentListingData.title) {
                    crumbHtml += ` / <span>${currentListingData.title}</span>`;
                }
                crumbHtml += ` / <span style="color: var(--accent-gold);">${product.title}</span>`;
                breadcrumbEl.innerHTML = crumbHtml;
            }

            // Meta
            const metaContainer = document.getElementById('productMeta');
            if (metaContainer) {
                const subcatHtml = product.subcategory ? `<p><strong>Subcategory:</strong> ${product.subcategory}</p>` : '';
                metaContainer.innerHTML = `
                    <p><strong>SKU:</strong> ${productData.sku || `AF-${product.category.substring(0, 3).toUpperCase()}-${product.id}`}</p>
                    <p><strong>Category:</strong> ${product.category.charAt(0).toUpperCase() + product.category.slice(1)}</p>
                    ${subcatHtml}
                    <p><strong>Stock Status:</strong> <span id="variantStockStatus">Loading stock...</span></p>
                `;
            }

            // Initial stock status render
            updateVariantStockUI();

            // Add to Wardrobe button for THIS piece
            const addBtn = document.querySelector('.btn-add-to-cart');
            if (addBtn) {
                const newBtn = addBtn.cloneNode(true);
                addBtn.parentNode.replaceChild(newBtn, addBtn);

                newBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const { selectedSize, selectedColor, matchedVariant, stock } = getSelectedVariant();

                    if (stock <= 0 && !product.allow_preorder) {
                        if (typeof showBabeToast === 'function') {
                            showBabeToast("Sorry babe, this piece is currently out of stock! ✨");
                        }
                        return;
                    }

                    if (typeof window.addToWardrobe === 'function') {
                        window.addToWardrobe(product, selectedSize, selectedColor, matchedVariant, stock);
                    }
                });

                updateVariantStockUI();
            }
        } catch (err) {
            console.error('Error in renderActivePiece:', err);
        } finally {
            if (detailSection) detailSection.style.visibility = 'visible';
        }
    }


    // 5. Fetch product or showcase listing
    async function fetchProductDetails(id, listingIdParam) {
        let mainProduct = null;
        let lookItems = [];
        let listingData = null;

        try {
            // 1. If listing_id is specified in URL
            if (listingIdParam && typeof window.fetchCloudflareListing === 'function') {
                const listing = await window.fetchCloudflareListing(listingIdParam);
                if (listing && Array.isArray(listing.items) && listing.items.length > 0) {
                    lookItems = listing.items;
                    mainProduct = listing.items[0];
                    listingData = listing;
                    if (listing.video_url) {
                        mainProduct.video_url = listing.video_url;
                        mainProduct.media_type = 'video';
                        mainProduct.poster_url = listing.poster_url;
                    }
                }
            }

            // 2. If id is specified in URL
            if (!mainProduct && id) {
                if (typeof window.fetchCloudflareProduct === 'function') {
                    const cp = await window.fetchCloudflareProduct(id);
                    if (cp) mainProduct = cp;
                }

                if (!mainProduct && typeof window.fetchSupabaseProducts === 'function') {
                    const products = await window.fetchSupabaseProducts();
                    if (products && products.length > 0) {
                        mainProduct = products.find(prod => prod.id == id);
                    }
                }
            }

            if (!mainProduct) {
                showError();
                return;
            }

            // 3. If mainProduct has listing_id, pull all items belonging to that video showcase
            if (lookItems.length === 0 && mainProduct.listing_id && typeof window.fetchCloudflareListing === 'function') {
                try {
                    const listing = await window.fetchCloudflareListing(mainProduct.listing_id);
                    if (listing && Array.isArray(listing.items) && listing.items.length > 0) {
                        lookItems = listing.items;
                        listingData = listing;
                    }
                } catch (lErr) {
                    console.warn('Listing fetch notice:', lErr);
                }
            }

            // 4. Fallback: Group sibling products sharing the same video showcase
            if (lookItems.length <= 1) {
                const vKey = mainProduct.video_key || mainProduct.video_url;
                if (vKey) {
                    const allProds = window.productsData || [];
                    const siblings = allProds.filter(p => (p.video_key === vKey || p.video_url === vKey) && p.video_url);
                    if (siblings.length > 1) {
                        lookItems = siblings;
                    }
                }
            }

            // Default: single product look
            if (lookItems.length === 0) {
                lookItems = [mainProduct];
            }

            const initialIdx = id ? lookItems.findIndex(it => it.id == id) : 0;
            renderLook(lookItems, initialIdx >= 0 ? initialIdx : 0, listingData);
            loadRelatedProducts(mainProduct.id);

        } catch (error) {
            console.error('Error fetching product/listing details:', error);
            showError();
        }
    }

    // 6. Call initial fetch and enable Realtime sync
    fetchProductDetails(productId, listingId);
    if (typeof subscribeToSupabaseRealtime === 'function') {
        subscribeToSupabaseRealtime(() => {
            fetchProductDetails(productId, listingId);
        });
    }
});

// UI Interactions (Thumbnail, Size, Color, etc.)
// ==============================================

// Thumbnail Image Switching
const thumbnails = document.querySelectorAll('.thumbnail');
const mainImage = document.getElementById('mainProductImage');

thumbnails.forEach(thumb => {
    thumb.addEventListener('click', () => {
        thumbnails.forEach(t => t.classList.remove('active'));
        thumb.classList.add('active');
        if (mainImage) mainImage.src = thumb.src;
    });
});

// Size Selection
document.querySelectorAll('.size-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    });
});

// Color Selection
document.querySelectorAll('.color-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    });
});

// Tone Selection
document.querySelectorAll('.tone-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tone-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        // NO AUTO-UPDATE: Wait for Generate click
    });
});

// Body Type Selection
document.querySelectorAll('.body-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.body-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        // NO AUTO-UPDATE: Wait for Generate click
    });
});

// Putter.js + NanoBanana Integration
function updateTryOnPreview() {
    const previewArea = document.getElementById('previewArea');
    const generateBtn = document.getElementById('generateBtn');

    const activeTone = document.querySelector('.tone-btn.active')?.dataset.tone || 'light';
    const activeBodyType = document.querySelector('.body-btn.active')?.dataset.type || 'B';
    const productName = document.querySelector('.product-title-main')?.textContent || 'Product';
    const productImg = document.getElementById('mainProductImage')?.src || '';

    if (!previewArea || !generateBtn) return;

    // Show loading state
    generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
    generateBtn.disabled = true;
    previewArea.classList.add('loading');

    // Simulate NanoBanana generation (Putter.js wrap)
    // In a real environment, this would call:
    // Putter.nanoBanana.generate({ prompt: prompt, ... })

    // Body Type Constraints (Prevent Collapsing)
    let bodyDescription = "";
    switch (activeBodyType) {
        case 'A':
            bodyDescription = "Body Type: PEAR SHAPE. Distinctly wide hips and thighs, significantly wider than the bust. Smaller bust, defined waist.";
            break;
        case 'B':
            bodyDescription = "Body Type: HOURGLASS. Balanced bust and hips, with a very defined, narrow waist. Classic curvy silhouette.";
            break;
        case 'C':
            bodyDescription = "Body Type: RECTANGLE / SOFT E. Fuller midsection/tummy area. Hips and bust are balanced but waist is less defined. Realistic average body.";
            break;
        case 'D':
            bodyDescription = "Body Type: PLUS SIZE / APPLE. Full figure, significantly larger bust and midsection. Thick curves, voluptuous silhouette. NOT thin.";
            break;
        default:
            bodyDescription = "Body Type: AVERAGE. Balanced proportions.";
    }

    const prompt = `PHOTOREALISTIC FASHION PHOTOGRAPHY. 8k resolution, raw photo, hyperrealistic.

SUBJECT: 
A confident African woman modeling clothing in a high-end professional studio.
- Skin Tone: [${activeTone}] matching the requested skin tone.
- ${bodyDescription} (STRICTLY adhere to this body shape).

ATTIRE:
Wearing the EXACT product shown in this image: [${productImg}].
- The clothing must fit the body type naturally and realistically.
- IF THE PRODUCT IS A DRESS/TOP, SHE MUST BE FULLY CLOTHED.
- MODEST FASHION.

SETTING:
Professional fashion studio, neutral beige/grey background, soft cinematic lighting. High fashion editorial look.

NEGATIVE PROMPT (DO NOT GENERATE):
Cartoon, illustration, anime, drawing, painting, cgi, 3d render, sketch, nudity, naked, topless, sheer, see-through, swimwear, bikini, lingerie, distorted body, bad anatomy, extra limbs, collapsing body types, thin (if Type D requested), skinny (if Type D requested).
`;

    console.log("Generating with NanoBanana Prompt:", prompt);

    // Call Putter.js (NanoBanana wrapper)
    Putter.nanoBanana.generate({
        prompt: prompt,
        imageElement: document.getElementById('mainProductImage') // Pass the image element for Base64 conversion
    })
        .then(result => {
            if (result.success && result.url) {
                // Success: Update preview with generated image
                previewArea.innerHTML = `
                <div class="generated-wrapper" style="position: relative; width: 100%; height: 100%;">
                    <img src="${result.url}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 12px;">
                    <div style="position: absolute; inset: 0; background: rgba(0,0,0,0.2); border-radius: 12px; display: flex; align-items: flex-end; padding: 20px;">
                        <div style="background: rgba(255,255,255,0.9); padding: 10px; border-radius: 6px; font-size: 0.8rem; color: #333; width: 100%;">
                            <strong>AI Try-On Active</strong><br>
                            Tone: ${activeTone} | Body: ${activeBodyType}<br>
                            Product: ${productName}
                        </div>
                    </div>
                </div>
            `;

                const previewActions = document.getElementById('previewActions');
                if (previewActions) previewActions.style.display = 'flex';

                // Trigger AI Chatbot (Anne's Assistant)
                if (window.fashionBot) {
                    window.fashionBot.open('try_on_complete', {
                        productName: productName,
                        activeBodyType: activeBodyType,
                        activeTone: activeTone
                    });
                }
            } else {
                // Fallback or error in success path
                throw new Error("Generation returned no URL");
            }
        })
        .catch(error => {
            console.error("AI Generation Error:", error);

            let errorMsg = error.message;
            let hint = "";

            // Customize message for common local development errors
            if (errorMsg.includes("Tainted") || errorMsg.includes("toDataURL")) {
                errorMsg = "Security Block (CORS)";
                hint = "<br><small><strong>Tip:</strong> If testing locally, open this via <code>http://localhost/Boutique/...</code> (XAMPP) instead of double-clicking the file.</small>";
            } else if (errorMsg.includes("Failed to fetch")) {
                errorMsg = "Connection Failed";
                hint = "<br><small>Check your internet connection or library status.</small>";
            }

            // Use Fallback Simulation
            previewArea.innerHTML = `
            <div class="generated-wrapper" style="position: relative; width: 100%; height: 100%;">
                <img src="assets/${activeBodyType}.png" style="width: 100%; height: 100%; object-fit: cover; border-radius: 12px; filter: sepia(0.2) saturate(1.2);">
                <div style="position: absolute; inset: 0; background: rgba(0,0,0,0.2); border-radius: 12px; display: flex; align-items: flex-end; padding: 20px;">
                    <div style="background: rgba(255,255,255,0.9); padding: 10px; border-radius: 6px; font-size: 0.8rem; color: #333; width: 100%;">
                         <strong>Preview (Simulation)</strong><br>
                         <p style="color:var(--accent-gold); font-weight:bold; font-size: 0.8em; margin: 5px 0;">Generation Issue: ${errorMsg}</p>
                         ${hint}
                         <div style="margin-top:5px; font-size: 0.75em; opacity: 0.8;">Tone: ${activeTone} | Body: ${activeBodyType}</div>
                    </div>
                </div>
            </div>
        `;
            const previewActions = document.getElementById('previewActions');
            if (previewActions) previewActions.style.display = 'flex';
        })
        .finally(() => {
            generateBtn.innerHTML = '<i class="fas fa-magic"></i> Generate Preview';
            generateBtn.disabled = false;
            previewArea.classList.remove('loading');
        });
}

// Initial preview on load
document.addEventListener('DOMContentLoaded', () => {
    // Wait for product data to be populated first
    // NO AUTO-GENERATION: User must click "Generate Preview"

    // Attach click listener to Generate Button
    const generateBtn = document.getElementById('generateBtn');
    if (generateBtn) {
        generateBtn.addEventListener('click', updateTryOnPreview);
    }
});

// Preview Action Buttons
document.querySelector('.btn-reset')?.addEventListener('click', () => {
    updateTryOnPreview();
});

// Social Share
document.querySelector('.btn-share')?.addEventListener('click', () => {
    if (navigator.share) {
        navigator.share({
            title: document.title,
            text: "Check out this style from Anne's Fashion Line!",
            url: window.location.href
        });
    } else {
        alert('Share this link: ' + window.location.href);
    }
});

// Wishlist Toggle
document.querySelector('.btn-wishlist')?.addEventListener('click', function () {
    const icon = this.querySelector('i');
    if (icon.classList.contains('far')) {
        icon.classList.replace('far', 'fas');
        this.style.color = 'var(--accent-gold)';
    } else {
        icon.classList.replace('fas', 'far');
        this.style.color = '';
    }
});
