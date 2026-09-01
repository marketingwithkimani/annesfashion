// Category Page Logic
// Relies on productsData from products-data.js / main.js

function initCategoryPage() {
    const categoryGrid = document.getElementById('categoryProducts');
    if (!categoryGrid) return;

    // 1. Determine Category from URL
    const currentUrl = window.location.href.toLowerCase();
    let currentCategory = '';
    const categories = ['dresses', 'casual', 'corporate', 'shoes', 'wigs', 'makeup', 'weekend', 'beauty'];

    for (const cat of categories) {
        if (currentUrl.includes(cat)) {
            currentCategory = cat;
            break;
        }
    }

    if (!currentCategory) {
        console.warn('Could not determine category from URL');
        return;
    }

    // Get available products from global productsData or fallback
    const sourceData = (window.productsData && window.productsData.length > 0)
        ? window.productsData
        : (typeof productsData !== 'undefined' ? productsData : []);

    const filtered = sourceData.filter(item => item.category === currentCategory);
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
            countEl.textContent = `Showing ${filtered.length} products`;
        }
    } else {
        categoryGrid.innerHTML = '<p class="no-results" style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">No products found in this category.</p>';
        const countEl = document.querySelector('.results-count');
        if (countEl) countEl.textContent = '0 products found';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initCategoryPage();
});

document.addEventListener('productsLoaded', (e) => {
    initCategoryPage();
});
