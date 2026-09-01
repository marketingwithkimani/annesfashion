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

    // 4. Render product data into the page
    function renderProduct(productData) {
        const product = {
            id: productData.id,
            title: productData.title,
            price: `KSh ${parseFloat(productData.price).toLocaleString()}`,
            image: productData.image_url,
            category: productData.category,
            description: productData.description,
            stock: parseInt(productData.total_stock) || 0,
            allow_preorder: parseInt(productData.allow_preorder) === 1,
            sizes: ["S", "M", "L", "XL"],
            colors: productData.colors || []
        };

        console.log('Rendering Product:', product);

        document.title = `${product.title} | Anne's Fashion Line`;

        const mainImage = document.getElementById('mainProductImage');
        if (mainImage) {
            mainImage.src = product.image;
            mainImage.alt = product.title;
        }

        // Thumbnails — use additional images from API if available
        const thumbContainer = document.getElementById('thumbnailContainer');
        if (thumbContainer) {
            thumbContainer.innerHTML = '';
            const images = (productData.images && productData.images.length > 0)
                ? productData.images.map(img => img.url)
                : [product.image];

            images.forEach((imgSrc, index) => {
                const img = document.createElement('img');
                img.src = imgSrc;
                img.alt = `View ${index + 1}`;
                img.className = `thumbnail ${index === 0 ? 'active' : ''}`;
                img.addEventListener('click', () => {
                    document.querySelectorAll('.thumbnail').forEach(t => t.classList.remove('active'));
                    img.classList.add('active');
                    if (mainImage) mainImage.src = imgSrc;
                });
                thumbContainer.appendChild(img);
            });
        }

        const titleEl = document.querySelector('.product-title-main');
        if (titleEl) titleEl.textContent = product.title;

        const priceEl = document.querySelector('.product-price-main');
        if (priceEl) priceEl.textContent = product.price;

        const descEl = document.querySelector('.product-description');
        if (descEl) {
            descEl.textContent = product.description || `Shop the exclusive ${product.title} from our ${product.category} collection. Premium quality and style, curated just for you.`;
        }

        // Dynamic Sizes
        const sizeContainer = document.getElementById('sizeSelector');
        if (sizeContainer && product.sizes) {
            sizeContainer.innerHTML = '';
            product.sizes.forEach((size, index) => {
                const btn = document.createElement('button');
                btn.className = `size-btn ${index === 0 ? 'active' : ''}`;
                btn.textContent = size;
                btn.addEventListener('click', () => {
                    sizeContainer.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                });
                sizeContainer.appendChild(btn);
            });
        }

        // Dynamic Colors — only render if valid colors exist
        const colorContainer = document.getElementById('colorSelector');
        if (colorContainer) {
            colorContainer.innerHTML = '';
            const validColors = product.colors.filter(c => c && c.toLowerCase() !== 'default');
            if (validColors.length > 0) {
                validColors.forEach((color, index) => {
                    const btn = document.createElement('button');
                    btn.className = `color-btn ${index === 0 ? 'active' : ''}`;
                    btn.style.backgroundColor = color.toLowerCase();
                    btn.title = color;
                    btn.addEventListener('click', () => {
                        colorContainer.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
                        btn.classList.add('active');
                    });
                    colorContainer.appendChild(btn);
                });
            } else {
                colorContainer.innerHTML = '<span style="font-size:0.85rem; opacity:0.6;">Various</span>';
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
            <p><strong>SKU:</strong> ${productData.sku || `LK-${product.category.substring(0, 2).toUpperCase()}-${product.id}`}</p>
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
                newBtn.addEventListener('click', () => {
                    if (typeof window.addToWardrobe === 'function') {
                        window.addToWardrobe(product.id);
                    } else {
                        console.log('Add to Wardrobe: ', product.title);
                    }
                });
            }
        }

        // Reveal content
        if (detailSection) detailSection.style.visibility = 'visible';
    }

    // 5. Fetch product from API or local fallback
    async function fetchProductDetails(id) {
        let product = null;

        try {
            const response = await fetch(`api/products/list.php?active_only=true`);
            if (response.ok) {
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    const data = await response.json();
                    if (data.success && Array.isArray(data.data)) {
                        product = data.data.find(p => p.id == id);
                        window.productsData = data.data.map(p => ({
                            id: p.id,
                            title: p.title,
                            price: `KSh ${parseFloat(p.price).toLocaleString()}`,
                            image: p.image_url || p.image,
                            category: p.category,
                            type: 'product',
                            description: p.description
                        }));
                    }
                }
            }
        } catch (error) {
            console.warn('Network issue fetching product API, falling back to products-data.js:', error);
        }

        // Fallback to local productsData array if not found via API
        if (!product && typeof productsData !== 'undefined' && Array.isArray(productsData)) {
            const fallbackItem = productsData.find(p => p.id == id);
            if (fallbackItem) {
                product = {
                    id: fallbackItem.id,
                    title: fallbackItem.title,
                    price: fallbackItem.price.startsWith('KSh') ? fallbackItem.price.replace('KSh ', '') : fallbackItem.price,
                    image_url: fallbackItem.image || fallbackItem.image_url,
                    category: fallbackItem.category,
                    description: fallbackItem.description,
                    total_stock: fallbackItem.stock || 10,
                    allow_preorder: fallbackItem.allow_preorder || false
                };
            }
        }

        if (product) {
            renderProduct(product);
            loadRelatedProducts(id);
        } else {
            showError();
        }
    }

    // 6. Call initial fetch
    fetchProductDetails(productId);
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
