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

var productsData = window.productsData || [];

async function fetchRealTimeProducts() {
    try {
        if (typeof fetchSupabaseProducts === 'function') {
            const data = await fetchSupabaseProducts();
            if (data && data.length > 0) {
                productsData = data;
                window.productsData = productsData;
            }
        }
    } catch (error) {
        console.error('Error fetching real-time products from Supabase:', error);
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
        // Check pre_order_mode and flash_sale_mode settings
        const settings = (typeof fetchSupabaseSettings === 'function') 
            ? await fetchSupabaseSettings() 
            : (window.siteSettings || {});

        const isFlashSaleModeOn = (settings['flash_sale_mode'] || 'off').toLowerCase() === 'on';
        const isPreorderModeOn = (settings['pre_order_mode'] || 'off').toLowerCase() === 'on';

        if (!isPreorderModeOn && !isFlashSaleModeOn) {
            section.style.display = 'none';
            return;
        }

        // Configure labels based on active mode (Flash Sale takes precedence if active)
        const isFlash = isFlashSaleModeOn;
        const modeBadge = isFlash ? '<i class="fas fa-bolt"></i> Flash Sale' : 'Pre-order';
        const modeTitle = isFlash ? 'Flash Sale Exclusives' : 'Pre-order Exclusives';
        const modeSubtitle = isFlash ? 'Limited time flash deals — grab yours before they sell out!' : 'Secure these styles before they\'re gone';
        const btnIcon = isFlash ? 'fa-bolt' : 'fa-clock';
        const btnText = isFlash ? 'Grab Flash Deal' : 'Pre-order Now';
        const badgeColor = isFlash ? '#ff3b30' : 'var(--accent-gold)';
        const badgeTextColor = isFlash ? '#fff' : '#000';

        // Update section headers dynamically
        const topBadge = section.querySelector('.section-header .luxury-badge');
        const secTitle = section.querySelector('.section-header .section-title');
        const secSubtitle = section.querySelector('.section-header .section-subtitle');
        if (topBadge) topBadge.innerHTML = isFlash ? '<i class="fas fa-bolt"></i> Limited Time Flash' : 'Limited Time';
        if (secTitle) secTitle.textContent = modeTitle;
        if (secSubtitle) secSubtitle.textContent = modeSubtitle;

        // Get pre-order products
        const preorders = productsData.filter(p => p.allow_preorder);

        if (preorders.length > 0) {
            section.style.display = 'block';
            grid.innerHTML = '';

            preorders.forEach(p => {
                const wrapper = document.createElement('div');
                wrapper.className = 'preorder-card-wrapper';
                wrapper.style.cssText = 'display: flex; flex-direction: column; gap: 8px; flex-shrink: 0;';

                wrapper.innerHTML = `
                    <div class="preorder-badge-above" style="text-align: center; display: flex; justify-content: center;">
                        <span class="luxury-badge-above" style="display: inline-flex; align-items: center; gap: 5px; background: ${badgeColor}; color: ${badgeTextColor}; padding: 4px 10px; border-radius: 50px; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.6px; text-transform: uppercase; box-shadow: 0 4px 10px rgba(0,0,0,0.15);">
                            ${modeBadge}
                        </span>
                    </div>
                    <div class="product-card" style="border-radius: 18px; overflow: hidden; position: relative;">
                        <div class="product-media" style="border-radius: 18px 18px 0 0; overflow: hidden;">
                            <img src="${p.image}" alt="${p.title}" loading="lazy" onerror="this.onerror=null; this.src='assets/Logo%20Black.png';">
                        </div>
                        <div class="product-info">
                            <h3 class="product-title">${p.title}</h3>
                            <p class="product-price">${p.price}</p>
                            <button class="btn-add-cart">
                                <i class="fas ${btnIcon}"></i> ${btnText}
                            </button>
                        </div>
                    </div>
                `;

                const card = wrapper.querySelector('.product-card');
                card.addEventListener('click', (e) => {
                    if (!e.target.closest('.btn-add-cart')) {
                        window.location.href = `product-detail.html?id=${p.id}`;
                    }
                });
                card.querySelector('.btn-add-cart').addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (window.addToWardrobe) window.addToWardrobe(p.id);
                });
                grid.appendChild(wrapper);
            });

            startPreorderAutoScroll();
        } else {
            section.style.display = 'none';
        }
    } catch (error) {
        console.error('Error handling pre-orders:', error);
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
            const hasRealVideo = (item.media_type === 'video' || Boolean(item.is_video)) && Boolean(item.video_url);
            const isVideo = hasRealVideo;
            let mediaHtml = '';

            if (isVideo) {
                const posterSrc = item.poster_url || (item.image && !item.image.includes('.mp4') ? item.image : 'assets/Logo%20Black.png');
                const videoSrc = item.video_url;
                
                mediaHtml = `
                    <div class="product-media video-container" style="position: relative; overflow: hidden; width: 100%; height: 100%;">
                        <img src="${posterSrc}" alt="${item.title}" class="product-poster" loading="lazy" style="width: 100%; height: 100%; object-fit: cover; display: block;" onerror="this.onerror=null; this.src='assets/Logo%20Black.png';">
                        <span class="video-indicator-badge" style="position: absolute; top: 12px; left: 12px; background: rgba(0,0,0,0.7); color: #fff; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; display: flex; align-items: center; gap: 5px; z-index: 2; pointer-events: none; backdrop-filter: blur(4px);">
                            <i class="fas fa-play" style="font-size: 9px; color: var(--accent-gold);"></i> VIDEO
                        </span>
                        <video class="lazy-product-video" loop muted playsinline preload="none" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0; transition: opacity 0.3s ease; pointer-events: none;">
                            <source src="${videoSrc}" type="video/mp4">
                        </video>
                    </div>
                `;
            } else {
                const imgUrl = (item.image && !item.image.startsWith('content://') && !item.image.includes('.mp4')) ? item.image : (item.poster_url || 'assets/Logo%20Black.png');
                mediaHtml = `
                    <div class="product-media">
                        <img src="${imgUrl}" alt="${item.title}" loading="lazy" onerror="this.onerror=null; this.src='assets/Logo%20Black.png';">
                    </div>
                `;
            }

            card.innerHTML = `
                ${mediaHtml}
                <div class="product-info">
                    <h3 class="product-title">${item.title}</h3>
                    <p class="product-price">${item.price}</p>
                    <button class="btn-add-cart">
                        <i class="fas fa-shopping-bag"></i> Add to Wardrobe
                    </button>
                </div>
            `;

            // Hover preview for video products
            if (isVideo) {
                const vid = card.querySelector('video.lazy-product-video');
                if (vid) {
                    card.addEventListener('mouseenter', () => {
                        vid.style.opacity = '1';
                        vid.play().catch(() => {});
                    });
                    card.addEventListener('mouseleave', () => {
                        vid.pause();
                        vid.currentTime = 0;
                        vid.style.opacity = '0';
                    });
                }
            }

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

// Initial fetch & Realtime Listener
fetchRealTimeProducts().then(() => {
    if (typeof subscribeToSupabaseRealtime === 'function') {
        subscribeToSupabaseRealtime(
            () => refreshGrids(),
            () => fetchPreorders()
        );
    }
});

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

// Wardrobe functionality handled via js/cart.js

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
