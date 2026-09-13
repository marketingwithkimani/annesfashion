// Product Detail Page JavaScript

document.addEventListener('DOMContentLoaded', () => {
    console.log('Product Detail Page Initializing...');

    // 1. Declare required variables
    const productId = new URLSearchParams(window.location.search).get('id');
    const detailSection = document.getElementById('productInfoDetail');
    const errorSection = document.getElementById('productNotFoundError');

    if (!productId) {
        showError();
        return;
    }

    // 2. Show error state
    function showError() {
        console.error(`Product ID ${productId} NOT found in catalog.`);
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

    function cleanCustomerDescription(desc) {
        if (!desc) return '';
        return desc
            .replace(/\[Variant Stock:[^\]]*\]/gi, '')
            .replace(/\[Media:[^\]]*\]/gi, '')
            .trim();
    }

    // 4. Render product data into the page
    function renderProduct(productData) {
        try {
            const vParsed = extractVariantsFromText(productData.description);
            let extractedSizes = Array.isArray(productData.sizes) && productData.sizes.length > 0 ? productData.sizes : vParsed.sizes;
            let extractedColors = Array.isArray(productData.colors) && productData.colors.length > 0 ? productData.colors : vParsed.colors;
            let stockNum = parseInt(productData.total_stock) || 0;
            if (stockNum === 0 && vParsed.qty > 0) stockNum = vParsed.qty;

            const categoryName = (productData.category || 'general').toLowerCase();
            if (extractedSizes.length === 0) {
                if (['dresses', 'casual', 'corporate', 'weekend'].includes(categoryName)) {
                    extractedSizes = ['S', 'M', 'L', 'XL'];
                } else if (categoryName === 'shoes') {
                    extractedSizes = ['37', '38', '39', '40', '41'];
                }
            }

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
                colors: extractedColors
            };

            console.log('Rendering Product:', product);
            document.title = `${product.title} | Anne's Fashion Line`;

            const isVideo = productData.media_type === 'video' || Boolean(productData.is_video);
            const mainImageContainer = document.querySelector('.main-image');

            // Find true video URL (avoiding images falsely passed as video)
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
            const safeMainImg = (product.image && !product.image.startsWith('content://') && !product.image.includes('.mp4')) ? product.image : posterSrc;

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
                    <img id="mainProductImage" src="${iSrc}" alt="${product.title}" onerror="this.onerror=null; this.src='assets/Logo%20Black.png';">
                `;
            }

            if (isVideo && videoSrc) {
                showVideoInMain(videoSrc, posterSrc);
            } else {
                showImageInMain(safeMainImg);
            }

            // Thumbnails & Media Gallery
            const thumbContainer = document.getElementById('thumbnailContainer');
            if (thumbContainer) {
                thumbContainer.innerHTML = '';
                const mediaList = [];
                if (productData.media && Array.isArray(productData.media) && productData.media.length > 0) {
                    productData.media.forEach(m => mediaList.push(m));
                } else {
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
                }

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

            const titleEl = document.querySelector('.product-title-main');
            if (titleEl) titleEl.textContent = product.title;

            const priceEl = document.querySelector('.product-price-main');
            if (priceEl) priceEl.textContent = product.price;

            const descEl = document.querySelector('.product-description');
            if (descEl) {
                descEl.textContent = product.description;
            }

            // Sizes
            const sizeContainer = document.getElementById('sizeSelector');
            const sizeOptionGroup = sizeContainer ? sizeContainer.closest('.option-group') : null;
            if (sizeContainer) {
                sizeContainer.innerHTML = '';
                const validSizes = (product.sizes || []).filter(Boolean);
                if (validSizes.length > 0) {
                    if (sizeOptionGroup) sizeOptionGroup.style.display = 'block';
                    validSizes.forEach((size, index) => {
                        const btn = document.createElement('button');
                        btn.className = `size-btn ${index === 0 ? 'active' : ''}`;
                        btn.textContent = size;
                        btn.setAttribute('data-size', size);
                        btn.addEventListener('click', () => {
                            sizeContainer.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
                            btn.classList.add('active');
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
                    validColors.forEach((color, index) => {
                        const btn = document.createElement('button');
                        btn.className = `color-btn ${index === 0 ? 'active' : ''}`;
                        btn.setAttribute('data-color', color);
                        btn.title = color;

                        const cLower = color.toLowerCase().trim();
                        const colorMap = {
                            'burgundy': '#800020',
                            'nude': '#e0ac69',
                            'beige': '#f5f5dc',
                            'navy': '#001f3f',
                            'navy blue': '#001f3f',
                            'royal blue': '#4169e1',
                            'gold': '#c9a96e',
                            'rose gold': '#b76e79',
                            'silver': '#c0c0c0',
                            'charcoal': '#36454f',
                            'white': '#ffffff',
                            'black': '#111111'
                        };
                        const bg = colorMap[cLower] || cLower;
                        btn.style.backgroundColor = bg;

                        if (cLower === 'white' || cLower === '#fff' || cLower === '#ffffff' || cLower === 'cream') {
                            btn.style.border = '2px solid #ccc';
                        }

                        btn.addEventListener('click', () => {
                            colorContainer.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
                            btn.classList.add('active');
                        });
                        colorContainer.appendChild(btn);
                    });
                } else {
                    if (colorOptionGroup) colorOptionGroup.style.display = 'none';
                }
            }

            // Breadcrumbs
            const breadcrumbCategory = document.querySelector('#productBreadcrumb a:nth-child(2)');
            const breadcrumbTitle = document.querySelector('#productBreadcrumb span');
            if (breadcrumbCategory) {
                breadcrumbCategory.textContent = product.category.charAt(0).toUpperCase() + product.category.slice(1);
                breadcrumbCategory.href = `${product.category}.html`;
            }
            if (breadcrumbTitle) breadcrumbTitle.textContent = product.title;

            // Meta
            const metaContainer = document.getElementById('productMeta');
            if (metaContainer) {
                metaContainer.innerHTML = `
                <p><strong>SKU:</strong> ${productData.sku || `AF-${product.category.substring(0, 3).toUpperCase()}-${product.id}`}</p>
                <p><strong>Category:</strong> ${product.category.charAt(0).toUpperCase() + product.category.slice(1)}</p>
                <p><strong>Stock Status:</strong> ${product.stock > 0 ? `<span style="color:#4CAF50">${product.stock} in stock</span>` : (product.allow_preorder ? '<span style="color:var(--accent-gold)">Available for Pre-order</span>' : '<span style="color:#f44336">Out of Stock</span>')}</p>
            `;
            }

            // Add to Wardrobe button
            const addBtn = document.querySelector('.btn-add-to-cart');
            if (addBtn) {
                const newBtn = addBtn.cloneNode(true);
                addBtn.parentNode.replaceChild(newBtn, addBtn);

                if (product.stock <= 0 && !product.allow_preorder) {
                    newBtn.innerHTML = '<i class="fas fa-times-circle"></i> Out of Stock';
                    newBtn.disabled = true;
                    newBtn.style.opacity = '0.5';
                    newBtn.style.cursor = 'not-allowed';
                } else {
                    if (product.stock <= 0 && product.allow_preorder) {
                        newBtn.innerHTML = '<i class="fas fa-clock"></i> Pre-order Now';
                    }
                    newBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const activeSizeBtn = document.querySelector('#sizeSelector .size-btn.active');
                        const selectedSize = activeSizeBtn ? (activeSizeBtn.getAttribute('data-size') || activeSizeBtn.textContent.trim()) : null;

                        const activeColorBtn = document.querySelector('#colorSelector .color-btn.active');
                        const selectedColor = activeColorBtn ? (activeColorBtn.getAttribute('data-color') || activeColorBtn.title || activeColorBtn.textContent.trim()) : null;

                        if (typeof window.addToWardrobe === 'function') {
                            window.addToWardrobe(product, selectedSize, selectedColor);
                        }
                    });
                }
            }
        } catch (err) {
            console.error('Error in renderProduct:', err);
        } finally {
            // Always ensure product details are visible
            if (detailSection) detailSection.style.visibility = 'visible';
        }
    }


    // 5. Fetch product directly from Cloudflare Worker
    async function fetchProductDetails(id) {
        let product = null;

        try {
            if (typeof fetchCloudflareProduct === 'function') {
                const cp = await fetchCloudflareProduct(id);
                if (cp) {
                    product = cp;
                }
            }

            if (!product && typeof fetchSupabaseProducts === 'function') {
                const products = await fetchSupabaseProducts();
                if (products && products.length > 0) {
                    const p = products.find(prod => prod.id == id);
                    if (p) {
                        product = p;
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching product details from Cloudflare:', error);
        }

        if (product) {
            renderProduct(product);
            loadRelatedProducts(id);
        } else {
            showError();
        }
    }

    // 6. Call initial fetch and enable Realtime sync
    fetchProductDetails(productId);
    if (typeof subscribeToSupabaseRealtime === 'function') {
        subscribeToSupabaseRealtime(() => {
            fetchProductDetails(productId);
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
