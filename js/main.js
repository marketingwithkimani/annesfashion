// ========================================
// LUXE KENYA - Main JavaScript
// ========================================

// Theme Management
const themeToggle = document.getElementById('themeToggle');
const html = document.documentElement;

const currentTheme = localStorage.getItem('theme') || 'light';
html.setAttribute('data-theme', currentTheme);
if (themeToggle) updateThemeIcon(currentTheme);

if (themeToggle) {
    themeToggle.addEventListener('click', () => {
        const theme = html.getAttribute('data-theme');
        const newTheme = theme === 'light' ? 'dark' : 'light';
        html.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateThemeIcon(newTheme);
    });
}

function updateThemeIcon(theme) {
    const icon = themeToggle.querySelector('i');
    if (icon) icon.className = theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';

    // Logo Swap Logic
    const logoImg = document.getElementById('brandLogo');
    if (logoImg) {
        // Use URL-safe paths for "Logo Black.png" and "Logo White.png"
        // Light Mode -> Black Logo
        // Dark Mode -> White Logo
        logoImg.src = theme === 'light' ? 'assets/Logo%20Black.png' : 'assets/Logo%20White.png';
    }
}

// Navigation Menu Toggle
const menuToggle = document.getElementById('menuToggle');
const sideNav = document.getElementById('sideNav');
const closeNav = document.getElementById('closeNav');

if (menuToggle && sideNav) {
    menuToggle.addEventListener('click', () => {
        sideNav.classList.add('open');
    });
}

if (closeNav && sideNav) {
    closeNav.addEventListener('click', () => {
        sideNav.classList.remove('open');
    });
}

document.addEventListener('click', (e) => {
    if (sideNav && menuToggle && !sideNav.contains(e.target) && !menuToggle.contains(e.target)) {
        sideNav.classList.remove('open');
    }
});

// Hero Carousel
const heroCarousel = document.getElementById('heroCarousel');
const heroSlides = heroCarousel ? heroCarousel.querySelectorAll('.hero-slide') : [];
const dotsContainer = document.getElementById('carouselDots');
let currentSlide = 0;
let carouselInterval;

if (heroCarousel && heroSlides.length > 0 && dotsContainer) {
    heroSlides.forEach((_, index) => {
        const dot = document.createElement('span');
        dot.classList.add('carousel-dot');
        if (index === 0) dot.classList.add('active');
        dot.addEventListener('click', () => goToSlide(index));
        dotsContainer.appendChild(dot);
    });

    const dots = dotsContainer.querySelectorAll('.carousel-dot');

    function goToSlide(n) {
        heroSlides[currentSlide].classList.remove('active');
        dots[currentSlide].classList.remove('active');
        currentSlide = n;
        if (currentSlide >= heroSlides.length) currentSlide = 0;
        if (currentSlide < 0) currentSlide = heroSlides.length - 1;
        heroSlides[currentSlide].classList.add('active');
        dots[currentSlide].classList.add('active');
    }

    function nextSlide() {
        goToSlide(currentSlide + 1);
    }

    function startCarousel() {
        carouselInterval = setInterval(nextSlide, 5000);
    }

    function stopCarousel() {
        clearInterval(carouselInterval);
    }

    startCarousel();
    heroCarousel.addEventListener('mouseenter', stopCarousel);
    heroCarousel.addEventListener('mouseleave', startCarousel);
}

// ========================================
// Product Data & Grid Generation
// ========================================

// Initialize productsData immediately from local catalogue fallback if available
var productsData = (window.productsData || []).map(p => ({
    id: p.id,
    title: p.title,
    price: (typeof p.price === 'string' && p.price.startsWith('KSh')) ? p.price : `KSh ${parseFloat(p.price || 0).toLocaleString()}`,
    image: p.image || p.image_url,
    category: p.category,
    type: 'product',
    description: p.description,
    stock: p.stock || 10,
    allow_preorder: p.allow_preorder || false
}));

async function fetchRealTimeProducts() {
    try {
        const response = await fetch('api/products/list.php?active_only=true');

        if (response.ok) {
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const data = await response.json();
                if (data.success && Array.isArray(data.data) && data.data.length > 0) {
                    productsData = data.data.map(p => ({
                        id: p.id,
                        title: p.title,
                        price: `KSh ${parseFloat(p.price).toLocaleString()}`,
                        image: p.image_url || p.image,
                        category: p.category,
                        type: 'product',
                        description: p.description,
                        stock: parseInt(p.total_stock) || 0,
                        allow_preorder: parseInt(p.allow_preorder) === 1
                    }));
                    window.productsData = productsData;
                }
            }
        }
    } catch (error) {
        console.warn('Network error fetching real-time products, using local catalogue:', error);
    } finally {
        refreshGrids();
    }
}

function refreshGrids() {
    const grid = document.getElementById('productsGrid');
    const rail = document.getElementById('socialRail');

    if (grid && productsData.length > 0) {
        const mixedItems = window.mixContent(productsData, window.socialVideos);
        window.renderProductGrid(grid, mixedItems);
    }
    if (rail) {
        renderSocialRail();
    }

    document.dispatchEvent(new CustomEvent('productsLoaded', { detail: productsData }));
    fetchPreorders();
}

async function fetchPreorders() {
    const section = document.getElementById('preorderSection');
    const grid = document.getElementById('preorderGrid');
    if (!section || !grid) return;

    try {
        const response = await fetch('api/products/list.php?preorder_only=true');

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            throw new Error('Non-JSON response received for pre-orders.');
        }

        const data = await response.json();

        if (data.success && data.data.length > 0) {
            section.style.display = 'block';
            grid.innerHTML = '';

            data.data.forEach(p => {
                const price = `KSh ${parseFloat(p.price).toLocaleString()}`;
                const card = document.createElement('div');
                card.className = 'product-card';
                card.innerHTML = `
                    <div class="product-media">
                        <span class="luxury-badge" style="background: var(--accent-gold); color: #000;">Pre-order</span>
                        <img src="${p.image_url}" alt="${p.title}" loading="lazy">
                    </div>
                    <div class="product-info">
                        <h3 class="product-title">${p.title}</h3>
                        <p class="product-price">${price}</p>
                        <button class="btn-add-cart">
                            <i class="fas fa-clock"></i> Pre-order Now
                        </button>
                    </div>
                `;
                card.addEventListener('click', (e) => {
                    if (!e.target.closest('.btn-add-cart')) {
                        window.location.href = `product-detail.html?id=${p.id}`;
                    }
                });
                grid.appendChild(card);
            });

            startPreorderAutoScroll();
        } else {
            section.style.display = 'none';
        }
    } catch (error) {
        console.error('Error fetching pre-orders:', error);
        section.style.display = 'none';
    }
}

let preorderScrollInterval;
function startPreorderAutoScroll() {
    const grid = document.getElementById('preorderGrid');
    if (!grid) return;

    if (preorderScrollInterval) clearInterval(preorderScrollInterval);

    preorderScrollInterval = setInterval(() => {
        const scrollAmount = grid.clientWidth * 0.8; // Scroll almost a full page
        const isAtEnd = grid.scrollLeft + grid.clientWidth >= grid.scrollWidth - 50;

        if (isAtEnd) {
            grid.scrollTo({ left: 0, behavior: 'smooth' });
        } else {
            grid.scrollBy({ left: scrollAmount, behavior: 'smooth' });
        }
    }, 5000); // 5 seconds pause

    // Pause on hover
    grid.onmouseenter = () => clearInterval(preorderScrollInterval);
    grid.onmouseleave = startPreorderAutoScroll;
}

// 1. Define Social Videos Globally
window.socialVideos = [
    { type: 'social', videoUrl: 'assets/instagram/videos/Lifestyle Casual.mp4', likes: '1.2K', comments: '234' },
    { type: 'social', videoUrl: 'assets/instagram/videos/Weekend Lifestyle.mp4', likes: '890', comments: '156' },
    { type: 'social', videoUrl: 'assets/instagram/videos/Dresses.mp4', likes: '2.1K', comments: '345' },
    { type: 'social', videoUrl: 'assets/instagram/videos/Casual Weekend Club.mp4', likes: '1.5K', comments: '289' },
    { type: 'social', videoUrl: 'assets/instagram/videos/Heels Casual Date Club.mp4', likes: '3.2K', comments: '420' },
    { type: 'social', videoUrl: 'assets/instagram/videos/Jeans Casual Weekend.mp4', likes: '1.8K', comments: '190' }
];

// 2. Global Mixing Function (2 Products : 1 Video)
window.mixContent = function (products, videos) {
    const productsOnly = products.filter(p => p.type === 'product');
    let mixedContent = [];
    let videoIndex = 0;

    for (let i = 0; i < productsOnly.length; i++) {
        mixedContent.push(productsOnly[i]);

        // Insert video after every 2nd product (index 1, 3, 5...)
        if ((i + 1) % 2 === 0) {
            const video = videos[videoIndex % videos.length];
            mixedContent.push(video);
            videoIndex++;
        }
    }
    return mixedContent;
};

// 3. Global Render Function
window.renderProductGrid = function (container, items) {
    if (!container) return;
    container.innerHTML = '';

    if (!items || items.length === 0) {
        container.innerHTML = '<p class="no-results" style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">No products found.</p>';
        return;
    }

    items.forEach(item => {
        const card = document.createElement('div');
        card.style.opacity = '1';
        card.style.transform = 'none';

        if (item.type === 'product') {
            card.className = 'product-card';
            card.innerHTML = `
                <div class="product-media">
                    <img src="${item.image}" alt="${item.title}" loading="lazy">
                </div>
                <div class="product-info">
                    <h3 class="product-title">${item.title}</h3>
                    <p class="product-price">${item.price}</p>
                    <button class="btn-add-cart">
                        <i class="fas fa-shopping-bag"></i> Add to Wardrobe
                    </button>
                </div>
            `;
            // Add click listener to card (but not button)
            card.addEventListener('click', (e) => {
                if (!e.target.closest('.btn-add-cart')) {
                    window.location.href = `product-detail.html?id=${item.id}`;
                }
            });
            // Add click listener to button
            card.querySelector('.btn-add-cart').addEventListener('click', (e) => {
                e.stopPropagation();
                if (window.addToWardrobe) window.addToWardrobe(item.id);
            });

        } else if (item.type === 'social') {
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
        container.appendChild(card);
    });
};

// Declare socialRail before the function definition uses it at call time
const socialRail = document.getElementById('socialRail');

// Initial fetch
fetchRealTimeProducts();

function renderSocialRail() {
    if (!socialRail) return;
    socialRail.innerHTML = '';
    window.socialVideos.slice(0, 8).forEach(item => {
        const card = document.createElement('div');
        card.className = 'social-video-card';
        card.innerHTML = `
            <video autoplay muted loop playsinline>
                <source src="${item.videoUrl}" type="video/mp4">
            </video>
            <div class="social-overlay">
                <div class="social-engagement">
                    <button class="like-btn"><i class="fas fa-heart"></i> ${item.likes || '0'}</button>
                    <button class="comment-btn"><i class="fas fa-comment"></i> ${item.comments || '0'}</button>
                </div>
            </div>
        `;
        socialRail.appendChild(card);
    });
}
renderSocialRail();

// ========================================
// Wardrobe Functionality
// ========================================
let cart = JSON.parse(localStorage.getItem('cart')) || [];

window.addToWardrobe = function addToWardrobe(productId) {
    if (typeof productsData === 'undefined') return;
    const product = productsData.find(p => p.id == productId);
    if (product) {
        cart.push(product);
        localStorage.setItem('cart', JSON.stringify(cart));
        updateCartBadge();
        showNotification('Added to wardrobe!');
    }
};

function updateCartBadge() {
    const badge = document.getElementById('cartBadge');
    if (badge) {
        badge.textContent = cart.length;
    }
}

function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        bottom: 30px;
        right: 30px;
        background: var(--accent-gold);
        color: #000;
        padding: 15px 25px;
        border-radius: 8px;
        font-weight: 600;
        z-index: 10000;
        box-shadow: 0 5px 15px rgba(0,0,0,0.3);
        animation: slideInNotify 0.3s ease;
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}

// ========================================
// Observers & Effects
// ========================================
document.addEventListener('DOMContentLoaded', () => {
    updateCartBadge();
    refreshGrids();

    // Intersection Observer for animations
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.product-card, .category-card, .social-video-card').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });

    // Search logic - filter products by title/category
    const searchInput = document.querySelector('.search-bar input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            if (!query) {
                // Re-render full grid if search cleared
                const grid = document.getElementById('productsGrid');
                if (grid && productsData.length > 0) {
                    const mixedItems = window.mixContent(productsData, window.socialVideos);
                    window.renderProductGrid(grid, mixedItems);
                }
                return;
            }
            const filtered = productsData.filter(p =>
                p.title.toLowerCase().includes(query) ||
                (p.category && p.category.toLowerCase().includes(query))
            );
            const grid = document.getElementById('productsGrid');
            if (grid) {
                window.renderProductGrid(grid, filtered);
            }
        });
    }

    // Add notification animation style
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideInNotify {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
    `;
    document.head.appendChild(style);
});
