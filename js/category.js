// Category Page Logic
// Comprehensive filtering & sorting by size, price, flash sale, and pre-orders

(function () {
    let currentCategory = '';
    let categoryProducts = [];
    let activeSizeFilters = new Set();
    let currentMinPrice = 0;
    let currentMaxPrice = 50000;
    let currentAvailability = 'all'; // 'all', 'in-stock', 'flash-sale', 'pre-order'
    let currentSort = 'featured';
    let activeSubcategory = 'all';

    // Subcategory definitions per main category
    const subcategoryMap = {
        casual: [
            { key: 'tops', label: 'Tops & Blouses', keywords: ['top', 'blouse', 'shirt', 't-shirt', 'crop', 'cami'] },
            { key: 'bottoms', label: 'Bottoms', keywords: ['jean', 'trouser', 'pant', 'short', 'skirt', 'legging'] },
            { key: 'sets', label: 'Sets & Co-ords', keywords: ['set', 'co-ord', 'coord', 'matching', 'two-piece', '2-piece'] },
            { key: 'jumpsuits', label: 'Jumpsuits', keywords: ['jumpsuit', 'playsuit', 'romper'] },
            { key: 'sweaters', label: 'Sweaters & Hoodies', keywords: ['sweater', 'hoodie', 'sweatshirt', 'pullover', 'knit'] },
        ],
        corporate: [
            { key: 'blazers', label: 'Blazers & Suits', keywords: ['blazer', 'suit', 'jacket', 'coat'] },
            { key: 'skirts', label: 'Pencil Skirts', keywords: ['pencil', 'skirt'] },
            { key: 'trousers', label: 'Trousers & Pants', keywords: ['trouser', 'pant', 'slacks'] },
            { key: 'blouses', label: 'Blouses & Shirts', keywords: ['blouse', 'shirt', 'top'] },
            { key: 'dresses', label: 'Office Dresses', keywords: ['dress', 'midi', 'sheath'] },
        ],
        weekend: [
            { key: 'going-out', label: 'Going Out', keywords: ['going out', 'party', 'club', 'night'] },
            { key: 'lounge', label: 'Lounge & Relax', keywords: ['lounge', 'relax', 'comfy', 'lazy'] },
            { key: 'vacation', label: 'Vacation & Beach', keywords: ['vacation', 'beach', 'summer', 'resort'] },
            { key: 'active', label: 'Active & Sports', keywords: ['gym', 'yoga', 'sport', 'active', 'workout', 'exercise'] },
        ],
        dresses: [
            { key: 'midi', label: 'Midi Dresses', keywords: ['midi'] },
            { key: 'maxi', label: 'Maxi Dresses', keywords: ['maxi', 'long'] },
            { key: 'mini', label: 'Mini Dresses', keywords: ['mini', 'short'] },
            { key: 'cocktail', label: 'Cocktail & Party', keywords: ['cocktail', 'party', 'gala', 'evening'] },
            { key: 'casual', label: 'Casual Dresses', keywords: ['casual', 'day', 'floral', 'sundress'] },
            { key: 'bodycon', label: 'Bodycon', keywords: ['bodycon', 'fitted', 'tight', 'figure-hugging'] },
        ],
        shoes: [
            { key: 'heels', label: 'Heels', keywords: ['heel', 'stiletto', 'pump', 'wedge'] },
            { key: 'flats', label: 'Flats & Sandals', keywords: ['flat', 'sandal', 'ballet', 'mule', 'flip'] },
            { key: 'sneakers', label: 'Sneakers', keywords: ['sneaker', 'trainer', 'running', 'sport shoe'] },
            { key: 'boots', label: 'Boots', keywords: ['boot', 'ankle boot', 'knee-high'] },
            { key: 'loafers', label: 'Loafers & Mules', keywords: ['loafer', 'mule', 'slip-on'] },
        ],
        makeup: [
            { key: 'lips', label: 'Lips', keywords: ['lip', 'lipstick', 'gloss', 'liner', 'lip kit'] },
            { key: 'eyes', label: 'Eyes', keywords: ['mascara', 'eyeliner', 'eyeshadow', 'brow', 'lash'] },
            { key: 'face', label: 'Face & Foundation', keywords: ['foundation', 'concealer', 'powder', 'blush', 'contour', 'highlighter'] },
            { key: 'skincare', label: 'Skincare', keywords: ['serum', 'moisturizer', 'cream', 'toner', 'cleanser', 'sunscreen', 'spf'] },
            { key: 'kits', label: 'Beauty Kits', keywords: ['kit', 'set', 'bundle', 'collection'] },
        ],
        wigs: [
            { key: 'straight', label: 'Straight', keywords: ['straight', 'silky', 'sleek'] },
            { key: 'curly', label: 'Curly & Wavy', keywords: ['curly', 'wavy', 'afro', 'coily'] },
            { key: 'short', label: 'Short Styles', keywords: ['bob', 'short', 'pixie'] },
            { key: 'long', label: 'Long Wigs', keywords: ['long', '24inch', '26inch', '28inch', '30inch'] },
            { key: 'braids', label: 'Braids & Locs', keywords: ['braid', 'loc', 'twist', 'dread'] },
            { key: 'coloured', label: 'Coloured Wigs', keywords: ['blonde', 'burgundy', 'ombre', 'coloured', 'colored', 'highlight'] },
        ],
    };

    function getCategoryFromUrl() {
        const currentUrl = window.location.href.toLowerCase();
        const categories = ['dresses', 'casual', 'corporate', 'shoes', 'wigs', 'makeup', 'weekend', 'beauty'];
        for (const cat of categories) {
            if (currentUrl.includes(cat)) {
                return cat;
            }
        }
        return '';
    }

    function extractCategorySizes(products) {
        const sizeSet = new Set();
        products.forEach(p => {
            const sizes = Array.isArray(p.sizes) ? p.sizes : [];
            sizes.forEach(s => {
                if (s) sizeSet.add(String(s).trim());
            });
        });

        // Natural sort (e.g. 28", 30", 32", 34", 36" or numbers, or S, M, L, XL)
        const sizeOrder = ['xs', 's', 'm', 'l', 'xl', '2xl', '3xl'];
        return Array.from(sizeSet).sort((a, b) => {
            const numA = parseFloat(a.replace(/[^0-9.]/g, ''));
            const numB = parseFloat(b.replace(/[^0-9.]/g, ''));
            if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
            const idxA = sizeOrder.indexOf(a.toLowerCase());
            const idxB = sizeOrder.indexOf(b.toLowerCase());
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            return a.localeCompare(b);
        });
    }

    function renderSubcategoryBar() {
        const subcats = subcategoryMap[currentCategory];
        if (!subcats || subcats.length === 0) return;

        // Inject subcategory bar before the products grid section if not already present
        let barEl = document.getElementById('subcategoryBar');
        if (!barEl) {
            barEl = document.createElement('section');
            barEl.id = 'subcategoryBar';
            barEl.className = 'subcategory-bar-section';

            const style = document.createElement('style');
            style.textContent = `
                .subcategory-bar-section {
                    padding: 16px 0 4px;
                    background: var(--secondary-bg);
                    border-bottom: 1px solid var(--border-light);
                }
                .subcategory-pills {
                    display: flex;
                    gap: 10px;
                    overflow-x: auto;
                    padding: 4px 0 10px;
                    -webkit-overflow-scrolling: touch;
                    scrollbar-width: none;
                }
                .subcategory-pills::-webkit-scrollbar { display: none; }
                .subcat-pill {
                    flex-shrink: 0;
                    padding: 8px 18px;
                    border-radius: 50px;
                    border: 1.5px solid var(--border-light);
                    background: var(--card-bg);
                    color: var(--text-main);
                    font-size: 0.82rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    white-space: nowrap;
                }
                .subcat-pill:hover {
                    border-color: var(--accent-gold);
                    color: var(--accent-gold);
                    transform: translateY(-1px);
                }
                .subcat-pill.active {
                    background: var(--accent-gold);
                    color: #000;
                    border-color: var(--accent-gold);
                    box-shadow: 0 4px 12px rgba(201,169,110,0.35);
                }
            `;
            document.head.appendChild(style);

            // Insert before the products section
            const prodSection = document.querySelector('.products-section');
            if (prodSection) {
                prodSection.parentNode.insertBefore(barEl, prodSection);
            }
        }

        barEl.innerHTML = `
            <div class="container">
                <div class="subcategory-pills" id="subcategoryPills">
                    <button class="subcat-pill active" data-subcat="all">All ${currentCategory.charAt(0).toUpperCase() + currentCategory.slice(1)}</button>
                    ${subcats.map(s => `<button class="subcat-pill" data-subcat="${s.key}">${s.label}</button>`).join('')}
                </div>
            </div>
        `;

        barEl.querySelectorAll('.subcat-pill').forEach(btn => {
            btn.addEventListener('click', () => {
                barEl.querySelectorAll('.subcat-pill').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                activeSubcategory = btn.getAttribute('data-subcat');
                applyFilterAndSort();
            });
        });
    }

    function setupFilterPanelUI(sizes) {
        const panel = document.getElementById('filterPanel');
        if (!panel) return;

        // Start hidden
        panel.style.display = 'none';

        // Build dynamic filter groups inside panel
        let sizeFilterHtml = '';
        if (sizes.length > 0) {
            sizeFilterHtml = `
                <div class="filter-group size-group">
                    <h4>Filter by Size</h4>
                    <div class="size-filter-chips" id="sizeFilterChips">
                        ${sizes.map(s => `<button type="button" class="size-chip ${activeSizeFilters.has(s) ? 'active' : ''}" data-size="${s}">${s}</button>`).join('')}
                    </div>
                </div>
            `;
        }

        panel.innerHTML = `
            ${sizeFilterHtml}

            <div class="filter-group">
                <h4>Price Range (KES)</h4>
                <div class="price-inputs">
                    <input type="number" id="minPriceInput" placeholder="Min" value="${currentMinPrice}">
                    <span>-</span>
                    <input type="number" id="maxPriceInput" placeholder="Max" value="${currentMaxPrice}">
                </div>
                <div class="price-presets">
                    <button type="button" class="price-preset-btn" data-min="0" data-max="1500">Under 1,500</button>
                    <button type="button" class="price-preset-btn" data-min="1500" data-max="3000">1,500 - 3,000</button>
                    <button type="button" class="price-preset-btn" data-min="3000" data-max="5000">3,000 - 5,000</button>
                    <button type="button" class="price-preset-btn" data-min="0" data-max="50000">All Prices</button>
                </div>
            </div>

            <div class="filter-group">
                <h4>Collection &amp; Availability</h4>
                <div class="checkbox-group" id="availabilityFilters">
                    <label><input type="radio" name="availFilter" value="all" ${currentAvailability === 'all' ? 'checked' : ''}> All Collections</label>
                    <label><input type="radio" name="availFilter" value="flash-sale" ${currentAvailability === 'flash-sale' ? 'checked' : ''}> <span style="color:#e74c3c; font-weight:700;">⚡ Flash Sale Only</span></label>
                    <label><input type="radio" name="availFilter" value="pre-order" ${currentAvailability === 'pre-order' ? 'checked' : ''}> <span style="color:var(--accent-gold); font-weight:600;">✨ Pre-order Exclusives</span></label>
                    <label><input type="radio" name="availFilter" value="in-stock" ${currentAvailability === 'in-stock' ? 'checked' : ''}> In Stock (Ready to Ship)</label>
                </div>
            </div>

            <div class="filter-actions-row">
                <button type="button" class="btn-apply-filters" id="btnApplyFilters">Apply Filters</button>
                <button type="button" class="btn-reset-filters" id="btnResetFilters">Reset Filters</button>
            </div>
        `;

        // Event: Size chips toggle
        panel.querySelectorAll('.size-chip').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const s = btn.getAttribute('data-size');
                if (activeSizeFilters.has(s)) {
                    activeSizeFilters.delete(s);
                    btn.classList.remove('active');
                } else {
                    activeSizeFilters.add(s);
                    btn.classList.add('active');
                }
                applyFilterAndSort();
            });
        });

        // Event: Price preset buttons
        panel.querySelectorAll('.price-preset-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                panel.querySelectorAll('.price-preset-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const min = parseInt(btn.getAttribute('data-min'), 10);
                const max = parseInt(btn.getAttribute('data-max'), 10);
                const minInput = document.getElementById('minPriceInput');
                const maxInput = document.getElementById('maxPriceInput');
                if (minInput) minInput.value = min;
                if (maxInput) maxInput.value = max;
                currentMinPrice = min;
                currentMaxPrice = max;
                applyFilterAndSort();
            });
        });

        // Event: Price input manual change
        const minIn = document.getElementById('minPriceInput');
        const maxIn = document.getElementById('maxPriceInput');
        if (minIn) {
            minIn.addEventListener('change', () => {
                currentMinPrice = parseFloat(minIn.value) || 0;
            });
        }
        if (maxIn) {
            maxIn.addEventListener('change', () => {
                currentMaxPrice = parseFloat(maxIn.value) || 50000;
            });
        }

        // Event: Availability radio change
        panel.querySelectorAll('input[name="availFilter"]').forEach(radio => {
            radio.addEventListener('change', () => {
                currentAvailability = radio.value;
                applyFilterAndSort();
            });
        });

        // Event: Apply Button
        const applyBtn = document.getElementById('btnApplyFilters');
        if (applyBtn) {
            applyBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (minIn) currentMinPrice = parseFloat(minIn.value) || 0;
                if (maxIn) currentMaxPrice = parseFloat(maxIn.value) || 50000;
                applyFilterAndSort();
                // Close panel on mobile after applying
                if (window.innerWidth < 768) {
                    toggleFilterPanel(false);
                }
            });
        }

        // Event: Reset Button
        const resetBtn = document.getElementById('btnResetFilters');
        if (resetBtn) {
            resetBtn.addEventListener('click', (e) => {
                e.preventDefault();
                activeSizeFilters.clear();
                currentMinPrice = 0;
                currentMaxPrice = 50000;
                currentAvailability = 'all';
                activeSubcategory = 'all';
                panel.querySelectorAll('.size-chip').forEach(b => b.classList.remove('active'));
                panel.querySelectorAll('.price-preset-btn').forEach(b => b.classList.remove('active'));
                if (minIn) minIn.value = 0;
                if (maxIn) maxIn.value = 50000;
                const allRadio = panel.querySelector('input[name="availFilter"][value="all"]');
                if (allRadio) allRadio.checked = true;
                // Reset subcategory pills
                document.querySelectorAll('.subcat-pill').forEach(p => p.classList.remove('active'));
                const allPill = document.querySelector('.subcat-pill[data-subcat="all"]');
                if (allPill) allPill.classList.add('active');
                applyFilterAndSort();
            });
        }
    }

    function toggleFilterPanel(forceState) {
        const panel = document.getElementById('filterPanel');
        const toggleBtn = document.getElementById('filterToggle');
        if (!panel) return;

        const isCurrentlyOpen = panel.style.display !== 'none';
        const willOpen = forceState !== undefined ? forceState : !isCurrentlyOpen;

        if (willOpen) {
            panel.style.display = 'grid';
            if (toggleBtn) {
                toggleBtn.classList.add('active');
                toggleBtn.innerHTML = '<i class="fas fa-times"></i> Close Filters';
            }
        } else {
            panel.style.display = 'none';
            if (toggleBtn) {
                toggleBtn.classList.remove('active');
                toggleBtn.innerHTML = '<i class="fas fa-sliders-h"></i> Filters';
            }
        }
    }

    function applyFilterAndSort() {
        const categoryGrid = document.getElementById('categoryProducts');
        if (!categoryGrid) return;

        let filtered = categoryProducts.filter(item => {
            // 0. Subcategory check
            if (activeSubcategory !== 'all') {
                const subcats = subcategoryMap[currentCategory] || [];
                const subcat = subcats.find(s => s.key === activeSubcategory);
                if (subcat) {
                    const titleLower = (item.title || '').toLowerCase();
                    const descLower = (item.description || '').toLowerCase();
                    const matches = subcat.keywords.some(kw => titleLower.includes(kw) || descLower.includes(kw));
                    if (!matches) return false;
                }
            }

            // 1. Price check
            const price = parseFloat(item.raw_price || (item.price ? String(item.price).replace(/[^0-9.]/g, '') : 0)) || 0;
            if (price < currentMinPrice || price > currentMaxPrice) return false;

            // 2. Size check (if size filters are active)
            if (activeSizeFilters.size > 0) {
                const itemSizes = Array.isArray(item.sizes) ? item.sizes : [];
                // Check if any selected size matches item's sizes
                const hasMatchingSize = Array.from(activeSizeFilters).some(sel => {
                    const normSel = sel.replace(/["'\\]/g, '').toLowerCase().trim();
                    return itemSizes.some(is => is.replace(/["'\\]/g, '').toLowerCase().trim() === normSel);
                });
                if (!hasMatchingSize) return false;
            }

            // 3. Availability check
            if (currentAvailability === 'flash-sale') {
                if (!item.is_flash_sale) return false;
            } else if (currentAvailability === 'pre-order') {
                if (!item.allow_preorder) return false;
            } else if (currentAvailability === 'in-stock') {
                const stock = item.total_stock !== undefined ? item.total_stock : (item.stock || 0);
                if (stock <= 0) return false;
            }

            return true;
        });

        // 4. Sorting logic
        // "Featured" sorts Flash Sale items first, then Pre-orders, then newest
        filtered.sort((a, b) => {
            if (currentSort === 'price-low' || currentSort === 'Price: Low to High') {
                return (a.raw_price || 0) - (b.raw_price || 0);
            }
            if (currentSort === 'price-high' || currentSort === 'Price: High to Low') {
                return (b.raw_price || 0) - (a.raw_price || 0);
            }
            if (currentSort === 'newest' || currentSort === 'Newest First') {
                return new Date(b.created_at || 0) - new Date(a.created_at || 0);
            }

            // Default: "Featured"
            // Rank: Flash Sale = 2, Pre-order = 1, Normal = 0
            const scoreA = (a.is_flash_sale ? 2 : 0) + (a.allow_preorder ? 1 : 0);
            const scoreB = (b.is_flash_sale ? 2 : 0) + (b.allow_preorder ? 1 : 0);
            if (scoreB !== scoreA) {
                return scoreB - scoreA;
            }
            return new Date(b.created_at || 0) - new Date(a.created_at || 0);
        });

        categoryGrid.innerHTML = '';

        if (filtered.length > 0) {
            const contentToRender = window.mixContent && window.socialVideos
                ? window.mixContent(filtered, window.socialVideos)
                : filtered;

            if (window.renderProductGrid) {
                window.renderProductGrid(categoryGrid, contentToRender);
            }

            const countEl = document.querySelector('.results-count');
            if (countEl) {
                countEl.textContent = `Showing ${filtered.length} of ${categoryProducts.length} products`;
            }
        } else {
            categoryGrid.innerHTML = `
                <div class="no-results" style="grid-column: 1/-1; text-align: center; padding: 50px 20px; color: var(--text-muted);">
                    <i class="fas fa-search" style="font-size: 2.5rem; color: var(--accent-gold); margin-bottom: 15px; opacity: 0.7;"></i>
                    <h3 style="color: var(--text-main); margin-bottom: 10px;">No styles match your filters</h3>
                    <p style="margin-bottom: 20px;">Try adjusting your size or price range babe!</p>
                    <button type="button" class="btn-reset-filters" style="display:inline-block;" onclick="document.getElementById('btnResetFilters')?.click();">
                        Reset All Filters
                    </button>
                </div>
            `;
            const countEl = document.querySelector('.results-count');
            if (countEl) countEl.textContent = '0 products found';
        }
    }

    function initCategoryPage() {
        const categoryGrid = document.getElementById('categoryProducts');
        if (!categoryGrid) return;

        currentCategory = getCategoryFromUrl();
        if (!currentCategory) {
            console.warn('Could not determine category from URL');
            return;
        }

        // Get available products from global productsData or fallback
        const sourceData = (window.productsData && window.productsData.length > 0)
            ? window.productsData
            : (typeof productsData !== 'undefined' ? productsData : []);

        categoryProducts = sourceData.filter(item => item.category === currentCategory);

        // Render subcategory bar
        renderSubcategoryBar();

        // Setup filter toggle button
        const toggleBtn = document.getElementById('filterToggle');
        if (toggleBtn) {
            // Remove previous cloned listeners
            const newToggle = toggleBtn.cloneNode(true);
            toggleBtn.parentNode.replaceChild(newToggle, toggleBtn);
            newToggle.addEventListener('click', (e) => {
                e.preventDefault();
                toggleFilterPanel();
            });
        }

        // Setup Sort Dropdown
        const sortSelect = document.querySelector('.sort-select');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                currentSort = e.target.value;
                applyFilterAndSort();
            });
        }

        // Extract sizes and build filter panel
        const availableSizes = extractCategorySizes(categoryProducts);
        setupFilterPanelUI(availableSizes);

        // Initial render with sorting
        applyFilterAndSort();
    }

    document.addEventListener('DOMContentLoaded', () => {
        initCategoryPage();
    });

    document.addEventListener('productsLoaded', () => {
        initCategoryPage();
    });

    window.initCategoryPage = initCategoryPage;
    window.applyCategoryFilterAndSort = applyFilterAndSort;
})();

