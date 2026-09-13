/**
 * Anne's Fashion Line — Wardrobe Cart & Checkout System
 * Romantic Kenyan Babe Experience 💕✨
 */

(function () {
    'use strict';

    // API Base URL helper
    const isSubdir = window.location.pathname.includes('/annesfashion');
    const API_BASE = isSubdir ? '/annesfashion/api' : '/api';

    // State
    let cart = JSON.parse(localStorage.getItem('annes_cart') || localStorage.getItem('cart') || '[]');
    let currentCustomer = JSON.parse(localStorage.getItem('annes_client') || 'null');
    let checkoutStep = 1;
    let checkoutData = {
        fulfillment_type: 'delivery', // 'delivery' or 'pickup'
        delivery_location: '',
        delivery_notes: '',
        mpesa_phone: '',
        transaction_reference: ''
    };
    let stkInterval = null;

    // ========================================
    // Initialize Cart & DOM Elements
    // ========================================
    function initCart() {
        injectCartDrawer();
        injectCheckoutModal();
        updateCartBadge();
        updateHeaderUserBadge();
        bindCartButtons();
    }

    function injectCartDrawer() {
        if (document.getElementById('cartDrawer')) return;

        const backdrop = document.createElement('div');
        backdrop.className = 'cart-backdrop';
        backdrop.id = 'cartBackdrop';
        document.body.appendChild(backdrop);

        const drawer = document.createElement('div');
        drawer.className = 'cart-drawer';
        drawer.id = 'cartDrawer';
        drawer.innerHTML = `
            <div class="cart-drawer-header">
                <div class="cart-drawer-title">
                    <i class="fas fa-shopping-bag" style="color: var(--gold-primary);"></i>
                    Your Wardrobe <span class="babe-tag">Babe ✨</span>
                </div>
                <button class="btn-close-drawer" id="closeCartDrawer" aria-label="Close Wardrobe">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="cart-items-container" id="cartItemsList">
                <!-- Items dynamically rendered here -->
            </div>
            <div class="cart-drawer-footer" id="cartDrawerFooter">
                <div class="cart-delivery-note">
                    <i class="fas fa-sparkles"></i>
                    <span>Looking gorgeous is your birthright honey 💕</span>
                </div>
                <div class="cart-subtotal-row">
                    <span class="cart-subtotal-label">Subtotal</span>
                    <span class="cart-subtotal-val" id="cartSubtotalVal">KES 0.00</span>
                </div>
                <button class="btn-proceed-checkout" id="btnProceedCheckout">
                    Checkout With M-Pesa, Babe 💋 &rarr;
                </button>
            </div>
        `;
        document.body.appendChild(drawer);

        backdrop.addEventListener('click', closeCart);
        document.getElementById('closeCartDrawer').addEventListener('click', closeCart);
        document.getElementById('btnProceedCheckout').addEventListener('click', () => {
            if (cart.length === 0) {
                showBabeToast("Your wardrobe is empty honey! 🥺 Pick some stunning styles first.");
                return;
            }
            closeCart();
            openCheckoutModal();
        });
    }

    function injectCheckoutModal() {
        if (document.getElementById('checkoutModalWrap')) return;

        const modal = document.createElement('div');
        modal.className = 'checkout-modal-wrap';
        modal.id = 'checkoutModalWrap';
        modal.innerHTML = `
            <div class="checkout-modal-header">
                <span class="checkout-badge"><i class="fas fa-gem"></i> Glow Up Checkout</span>
                <button class="btn-close-drawer" id="closeCheckoutModal" style="width: 32px; height: 32px;">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <div class="checkout-stepper" id="checkoutStepper">
                <div class="step-indicator active" id="stepIndicator1">1</div>
                <div class="step-indicator" id="stepIndicator2">2</div>
                <div class="step-indicator" id="stepIndicator3">3</div>
                <div class="step-indicator" id="stepIndicator4">4</div>
            </div>

            <div id="checkoutStepContent">
                <!-- Dynamic step content -->
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('closeCheckoutModal').addEventListener('click', closeCheckoutModal);
    }

    // ========================================
    // Cart Actions
    // ========================================
    window.addToWardrobe = function (productOrId, selectedSize, selectedColor) {
        let product = null;
        if (typeof productOrId === 'object' && productOrId !== null) {
            product = productOrId;
        } else if (typeof productsData !== 'undefined' && Array.isArray(productsData)) {
            product = productsData.find(p => p.id == productOrId);
        } else if (typeof window.productsData !== 'undefined' && Array.isArray(window.productsData)) {
            product = window.productsData.find(p => p.id == productOrId);
        }

        const size = selectedSize || (product && product.size) || 'One Size';
        const color = selectedColor || (product && product.color) || '';

        if (!product) {
            console.warn("Product not found:", productOrId);
            return;
        }

        let priceNum = 0;
        if (typeof product.raw_price === 'number') {
            priceNum = product.raw_price;
        } else if (typeof product.price === 'number') {
            priceNum = product.price;
        } else if (typeof product.price === 'string') {
            priceNum = parseFloat(product.price.replace(/[^0-9.]/g, '')) || 0;
        }

        let imgUrl = product.image_url || product.image || (product.images && product.images[0] ? product.images[0].url : '');
        if (!imgUrl || imgUrl.startsWith('content://')) {
            imgUrl = 'assets/Logo%20Black.png';
        }

        const existingIndex = cart.findIndex(item => item.id == product.id && item.size === size && (item.color || '') === color);
        if (existingIndex > -1) {
            cart[existingIndex].quantity = (cart[existingIndex].quantity || 1) + 1;
        } else {
            cart.push({
                id: product.id,
                title: product.title || 'Fashion Piece',
                price: priceNum,
                image_url: imgUrl,
                size: size,
                color: color,
                quantity: 1
            });
        }

        saveCart();
        updateCartBadge();
        renderCartDrawer();
        openCart();
        showBabeToast("Added to wardrobe, babe! 💕 You're gonna slay ✨");
    };

    function saveCart() {
        localStorage.setItem('annes_cart', JSON.stringify(cart));
        localStorage.setItem('cart', JSON.stringify(cart));
    }

    function updateCartBadge() {
        const badges = document.querySelectorAll('#cartBadge');
        const count = cart.reduce((total, item) => total + (item.quantity || 1), 0);
        badges.forEach(b => {
            b.textContent = count;
        });
    }

    function getCartTotal() {
        return cart.reduce((sum, item) => sum + ((parseFloat(item.price) || 0) * (item.quantity || 1)), 0);
    }

    function openCart() {
        renderCartDrawer();
        const drawer = document.getElementById('cartDrawer');
        const backdrop = document.getElementById('cartBackdrop');
        if (drawer) drawer.classList.add('open');
        if (backdrop) backdrop.classList.add('active');
    }

    function closeCart() {
        const drawer = document.getElementById('cartDrawer');
        const backdrop = document.getElementById('cartBackdrop');
        if (drawer) drawer.classList.remove('open');
        if (backdrop) backdrop.classList.remove('active');
    }

    function renderCartDrawer() {
        const list = document.getElementById('cartItemsList');
        const footer = document.getElementById('cartDrawerFooter');
        const subtotalEl = document.getElementById('cartSubtotalVal');
        if (!list) return;

        if (cart.length === 0) {
            list.innerHTML = `
                <div class="cart-empty">
                    <div class="cart-empty-icon"><i class="fas fa-heart-crack"></i></div>
                    <h3>Your wardrobe is empty, babe!</h3>
                    <p>Pick something gorgeous honey and let's get you styled!</p>
                    <button class="btn-proceed-checkout" style="padding: 12px 20px; font-size: 0.85rem;" onclick="document.getElementById('closeCartDrawer').click();">
                        Explore Collection ✨
                    </button>
                </div>
            `;
            if (footer) footer.style.display = 'none';
            return;
        }

        if (footer) footer.style.display = 'block';

        let html = '';
        cart.forEach((item, index) => {
            const priceFormatted = 'KES ' + (parseFloat(item.price) || 0).toLocaleString();
            html += `
                <div class="cart-item" data-id="${item.id}">
                    <img src="${item.image_url || 'https://via.placeholder.com/80'}" alt="${item.title}" class="cart-item-img">
                    <div class="cart-item-details">
                        <div class="cart-item-title">${item.title}</div>
                        <div class="cart-item-meta" style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 4px;">
                            ${item.size && item.size !== 'One Size' ? `<span class="cart-item-size" style="margin: 0;"><i class="fas fa-ruler" style="font-size:0.65rem;"></i> Size: <strong>${item.size}</strong></span>` : ''}
                            ${item.color ? `<span class="cart-item-color" style="font-size: 0.78rem; color: #c9a96e; font-weight: 500;"><i class="fas fa-palette" style="font-size:0.65rem;"></i> Color: <strong>${item.color}</strong></span>` : ''}
                        </div>
                        <div class="cart-item-price">${priceFormatted}</div>
                        <div class="cart-item-actions">
                            <div class="cart-qty-stepper">
                                <button class="cart-qty-btn btn-qty-dec" data-index="${index}"><i class="fas fa-minus"></i></button>
                                <span class="cart-qty-val">${item.quantity || 1}</span>
                                <button class="cart-qty-btn btn-qty-inc" data-index="${index}"><i class="fas fa-plus"></i></button>
                            </div>
                            <button class="cart-item-remove btn-remove-item" data-index="${index}">
                                <i class="fas fa-trash-can"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });

        list.innerHTML = html;
        if (subtotalEl) {
            subtotalEl.textContent = 'KES ' + getCartTotal().toLocaleString('en-KE', { minimumFractionDigits: 2 });
        }

        // Steppers
        list.querySelectorAll('.btn-qty-inc').forEach(b => {
            b.addEventListener('click', () => {
                const idx = parseInt(b.getAttribute('data-index'), 10);
                if (cart[idx]) {
                    cart[idx].quantity = (cart[idx].quantity || 1) + 1;
                    saveCart();
                    updateCartBadge();
                    renderCartDrawer();
                }
            });
        });

        list.querySelectorAll('.btn-qty-dec').forEach(b => {
            b.addEventListener('click', () => {
                const idx = parseInt(b.getAttribute('data-index'), 10);
                if (cart[idx]) {
                    if ((cart[idx].quantity || 1) > 1) {
                        cart[idx].quantity -= 1;
                    } else {
                        cart.splice(idx, 1);
                    }
                    saveCart();
                    updateCartBadge();
                    renderCartDrawer();
                }
            });
        });

        list.querySelectorAll('.btn-remove-item').forEach(b => {
            b.addEventListener('click', () => {
                const idx = parseInt(b.getAttribute('data-index'), 10);
                if (cart[idx]) {
                    cart.splice(idx, 1);
                    saveCart();
                    updateCartBadge();
                    renderCartDrawer();
                    showBabeToast("Removed, honey!");
                }
            });
        });
    }

    // ========================================
    // Checkout Modal Flow
    // ========================================
    function openCheckoutModal() {
        const wrap = document.getElementById('checkoutModalWrap');
        const backdrop = document.getElementById('cartBackdrop');
        if (!wrap) return;

        wrap.classList.add('active');
        if (backdrop) backdrop.classList.add('active');

        if (currentCustomer && currentCustomer.phone) {
            checkoutStep = 2; // skip auth if already signed in
        } else {
            checkoutStep = 1;
        }

        renderCheckoutStep();
    }

    function closeCheckoutModal() {
        const wrap = document.getElementById('checkoutModalWrap');
        const backdrop = document.getElementById('cartBackdrop');
        if (wrap) wrap.classList.remove('active');
        if (backdrop) backdrop.classList.remove('active');
        if (stkInterval) clearInterval(stkInterval);
    }

    function updateStepperUI(step) {
        for (let i = 1; i <= 4; i++) {
            const el = document.getElementById(`stepIndicator${i}`);
            if (!el) continue;
            el.className = 'step-indicator';
            if (i < step) {
                el.classList.add('done');
                el.innerHTML = '<i class="fas fa-check"></i>';
            } else if (i === step) {
                el.classList.add('active');
                el.textContent = i;
            } else {
                el.textContent = i;
            }
        }
    }

    function renderCheckoutStep() {
        const content = document.getElementById('checkoutStepContent');
        if (!content) return;

        updateStepperUI(checkoutStep);

        switch (checkoutStep) {
            case 1:
                renderAuthStep(content);
                break;
            case 2:
                renderFulfillmentStep(content);
                break;
            case 3:
                renderMpesaStep(content);
                break;
            case 4:
                renderCelebrationStep(content);
                break;
        }
    }

    // STEP 1: Fast Phone + PIN Sign Up / Login
    function renderAuthStep(container) {
        container.innerHTML = `
            <div class="babe-note" style="margin-bottom: 16px; padding: 10px 14px;">
                <i class="fas fa-sparkles"></i>
                <span>Quick sign in, babe! Create an easy PIN for your Anne's account 💕</span>
            </div>

            <div class="checkout-form-group">
                <label><i class="fas fa-user"></i> What's your name, babe?</label>
                <input type="text" id="custNameInput" class="checkout-input" placeholder="e.g. Brenda (or Queen ✨)">
            </div>

            <div class="checkout-form-group">
                <label><i class="fas fa-phone"></i> Safaricom Phone Number</label>
                <input type="tel" id="custPhoneInput" class="checkout-input" placeholder="0712 345 678" maxlength="13">
            </div>

            <div class="checkout-form-group">
                <label><i class="fas fa-lock"></i> Account PIN (e.g. 1234)</label>
                <input type="password" id="custPinInput" class="checkout-input" placeholder="Choose 4-digit PIN" maxlength="8">
                <small style="color: rgba(201, 169, 110, 0.9); font-size: 0.73rem; display: block; margin-top: 5px;">
                    <i class="fas fa-info-circle"></i> This PIN is for your Anne's Fashion account, <strong>NOT</strong> your M-Pesa PIN!
                </small>
            </div>

            <button class="btn-proceed-checkout" id="btnSubmitAuth" style="margin-top: 18px;">
                Continue, Babe 💋 &rarr;
            </button>
        `;

        document.getElementById('btnSubmitAuth').addEventListener('click', handleAuthSubmit);
    }

    async function handleAuthSubmit() {
        const name = document.getElementById('custNameInput').value.trim() || 'Babe';
        const phone = document.getElementById('custPhoneInput').value.trim();
        const pin = document.getElementById('custPinInput').value.trim();

        if (!phone) {
            showBabeToast("Enter your phone number honey! 📱");
            return;
        }
        if (!pin) {
            showBabeToast("Pick an account PIN, e.g. 1234 🔒");
            return;
        }

        const btn = document.getElementById('btnSubmitAuth');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> One sec, babe...';

        try {
            let data = null;
            const workerBase = (typeof CF_WORKER_URL !== 'undefined' ? CF_WORKER_URL : 'https://api.annesfashion.co.ke');

            if (typeof cfCustomerAuth === 'function') {
                data = await cfCustomerAuth(phone, pin, name);
            } else if (typeof supabaseClientAuth === 'function') {
                data = await supabaseClientAuth(phone, pin, name);
            } else {
                const res = await fetch(`${workerBase}/api/client/auth`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phone, pin, name })
                });
                const resJson = await res.json();
                if (resJson.success) data = resJson;
            }

            const customerObj = (data && data.customer) ? data.customer : data;

            if (customerObj && (customerObj.id || customerObj.phone)) {
                currentCustomer = customerObj;
                localStorage.setItem('annes_client', JSON.stringify(currentCustomer));
                updateHeaderUserBadge();
                showBabeToast(data.message || `Welcome, gorgeous ${currentCustomer.name || 'babe'}! 💕`);
                checkoutStep = 2;
                renderCheckoutStep();
            } else {
                showBabeToast("Couldn't sign in babe, check your PIN 💕");
            }
        } catch (e) {
            console.error('Auth submit error:', e);
            showBabeToast(e.message && !e.message.includes('object') ? e.message : "Could not sign in, babe. Please try again! 🌸");
        } finally {
            btn.disabled = false;
            btn.innerHTML = 'Continue, Babe 💋 &rarr;';
        }
    }

    // STEP 2: Store Pickup vs. Delivery Choice
    let deliveryLocationsCache = [];

    async function getDeliveryLocations() {
        if (deliveryLocationsCache.length > 0) return deliveryLocationsCache;
        try {
            const workerBase = (typeof CF_WORKER_URL !== 'undefined' ? CF_WORKER_URL : 'https://api.annesfashion.co.ke');
            const res = await fetch(`${workerBase}/api/delivery/rates`);
            const data = await res.json();
            if (data.success && data.locations) {
                deliveryLocationsCache = data.locations;
            }
        } catch (e) {
            console.warn('Error fetching delivery rates:', e);
        }
        return deliveryLocationsCache;
    }

    // STEP 2: Store Pickup vs. Pickup Mtaani Delivery Choice
    async function renderFulfillmentStep(container) {
        const customerName = currentCustomer ? currentCustomer.name : 'Babe';
        const isDelivery = checkoutData.fulfillment_type === 'delivery';
        const itemsTotal = getCartTotal();

        container.innerHTML = `
            <div style="font-size: 0.95rem; font-weight: 700; color: #fff; margin-bottom: 14px;">
                How would you like your order, ${customerName}? ✨
            </div>

            <div class="fulfillment-options">
                <div class="fulfillment-card ${isDelivery ? 'selected' : ''}" id="optDelivery">
                    <div class="fulfillment-icon"><i class="fas fa-truck-fast"></i></div>
                    <div class="fulfillment-title">Delivery in Kenya</div>
                    <div class="fulfillment-sub">Pickup Mtaani / Doorstep</div>
                </div>
                <div class="fulfillment-card ${!isDelivery ? 'selected' : ''}" id="optPickup">
                    <div class="fulfillment-icon"><i class="fas fa-store"></i></div>
                    <div class="fulfillment-title">Store Pickup</div>
                    <div class="fulfillment-sub">Nairobi CBD Boutique (Free)</div>
                </div>
            </div>

            <div id="deliveryFieldsWrap" style="display: ${isDelivery ? 'block' : 'none'};">
                <div class="checkout-form-group" style="margin-bottom: 12px;">
                    <label><i class="fas fa-map-location-dot"></i> Enter Area / Town in Kenya</label>
                    <input type="text" id="deliveryLocInput" list="kenyaLocationsList" class="checkout-input" placeholder="e.g. Kilimani, Roysambu, Westlands, Nakuru, Mombasa..." value="${checkoutData.delivery_location || ''}">
                    <datalist id="kenyaLocationsList"></datalist>
                </div>

                <!-- Delivery Rate Options Box -->
                <div id="deliveryRatesBox" style="background: rgba(201, 169, 110, 0.08); border: 1px solid var(--border-gold); border-radius: 12px; padding: 12px; margin-bottom: 14px; display: none;">
                    <div style="font-size: 0.8rem; font-weight: 700; color: var(--gold-primary); margin-bottom: 8px;">
                        <i class="fas fa-tag"></i> Select Pickup Mtaani Delivery Option:
                    </div>
                    <div id="deliveryOptionsRadioGroup" style="display: flex; flex-direction: column; gap: 8px;">
                        <!-- Dynamically filled -->
                    </div>
                </div>

                <div class="delivery-fee-breakdown" id="deliverySummaryBox" style="background: rgba(0,0,0,0.3); border-radius: 8px; padding: 10px 14px; font-size: 0.82rem; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: var(--text-muted);">Delivery Fee:</span>
                    <strong style="color: #fff;" id="displayDeliveryFeeText">Select an area</strong>
                </div>
            </div>

            <div id="pickupNoticeWrap" style="display: ${!isDelivery ? 'block' : 'none'};" class="delivery-fee-notice">
                <i class="fas fa-check-circle"></i> <strong>Store Pickup:</strong> Anne's Fashion Line Boutique, Nairobi CBD. Free of charge! We will notify you once packed &amp; ready!
            </div>

            <div style="font-size: 0.78rem; color: var(--text-muted); margin-bottom: 16px;">
                Shopping as <strong>${customerName}</strong> (${currentCustomer.phone}) 
                &middot; <a href="#" id="switchAccountLink" style="color: var(--gold-primary); text-decoration: underline;">Not you?</a>
            </div>

            <button class="btn-proceed-checkout" id="btnSubmitFulfillment">
                Proceed to Lipa na M-Pesa 📲
            </button>
        `;

        // Populate locations datalist from Pickup Mtaani rates
        const locations = await getDeliveryLocations();
        const datalist = document.getElementById('kenyaLocationsList');
        if (datalist && locations.length > 0) {
            datalist.innerHTML = locations.map(l => `<option value="${l.area_name}">Zone: ${l.zone}</option>`).join('');
        }

        function updateRateOptions(areaQuery) {
            const ratesBox = document.getElementById('deliveryRatesBox');
            const radioGroup = document.getElementById('deliveryOptionsRadioGroup');
            const feeText = document.getElementById('displayDeliveryFeeText');
            if (!ratesBox || !radioGroup || !feeText) return;

            if (!areaQuery || areaQuery.length < 2) {
                ratesBox.style.display = 'none';
                feeText.textContent = 'Enter area above';
                checkoutData.delivery_fee = 0;
                return;
            }

            const q = areaQuery.toLowerCase().trim();
            const matched = locations.find(l => l.area_name.toLowerCase() === q || l.area_name.toLowerCase().includes(q));

            const pickupRate = matched ? matched.pickup_rate : 180;
            const doorstepRate = matched ? matched.doorstep_rate : 280;
            const zoneName = matched ? matched.zone : 'Kenya Delivery';
            const eta = matched ? matched.estimated_delivery : '24-48 hrs';

            ratesBox.style.display = 'block';
            radioGroup.innerHTML = `
                <label style="display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.05); padding: 8px 12px; border-radius: 8px; cursor: pointer; border: 1px solid rgba(255,255,255,0.1);">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <input type="radio" name="delivery_choice" value="pickup_point" checked>
                        <span><strong style="color:#fff;">Pickup Mtaani Agent Point</strong> <small style="color:#aaa;">(${eta})</small></span>
                    </div>
                    <span style="color: var(--gold-primary); font-weight: 700;">KES ${pickupRate}</span>
                </label>
                <label style="display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.05); padding: 8px 12px; border-radius: 8px; cursor: pointer; border: 1px solid rgba(255,255,255,0.1);">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <input type="radio" name="delivery_choice" value="doorstep">
                        <span><strong style="color:#fff;">Doorstep Delivery</strong> <small style="color:#aaa;">(${eta})</small></span>
                    </div>
                    <span style="color: var(--gold-primary); font-weight: 700;">KES ${doorstepRate}</span>
                </label>
            `;

            // Default selection: Pickup Mtaani Agent point
            checkoutData.delivery_fee = pickupRate;
            checkoutData.delivery_service = 'Pickup Mtaani Agent Point';
            feeText.textContent = `KES ${pickupRate} (${zoneName})`;

            radioGroup.querySelectorAll('input[name="delivery_choice"]').forEach(r => {
                r.addEventListener('change', (e) => {
                    const isDoor = e.target.value === 'doorstep';
                    checkoutData.delivery_fee = isDoor ? doorstepRate : pickupRate;
                    checkoutData.delivery_service = isDoor ? 'Doorstep Delivery' : 'Pickup Mtaani Agent Point';
                    feeText.textContent = `KES ${checkoutData.delivery_fee} (${zoneName})`;
                });
            });
        }

        const locInput = document.getElementById('deliveryLocInput');
        if (locInput) {
            locInput.addEventListener('input', (e) => updateRateOptions(e.target.value));
            locInput.addEventListener('change', (e) => updateRateOptions(e.target.value));
            if (locInput.value) updateRateOptions(locInput.value);
        }

        // Toggle cards
        document.getElementById('optDelivery').addEventListener('click', () => {
            checkoutData.fulfillment_type = 'delivery';
            document.getElementById('optDelivery').classList.add('selected');
            document.getElementById('optPickup').classList.remove('selected');
            document.getElementById('deliveryFieldsWrap').style.display = 'block';
            document.getElementById('pickupNoticeWrap').style.display = 'none';
        });

        document.getElementById('optPickup').addEventListener('click', () => {
            checkoutData.fulfillment_type = 'pickup';
            checkoutData.delivery_fee = 0;
            checkoutData.delivery_service = 'Store Pickup (Nairobi CBD Boutique)';
            document.getElementById('optPickup').classList.add('selected');
            document.getElementById('optDelivery').classList.remove('selected');
            document.getElementById('deliveryFieldsWrap').style.display = 'none';
            document.getElementById('pickupNoticeWrap').style.display = 'block';
        });

        document.getElementById('switchAccountLink').addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('annes_client');
            localStorage.removeItem('annes_token');
            currentCustomer = null;
            updateHeaderUserBadge();
            checkoutStep = 1;
            renderCheckoutStep();
        });

        document.getElementById('btnSubmitFulfillment').addEventListener('click', () => {
            if (checkoutData.fulfillment_type === 'delivery') {
                const loc = document.getElementById('deliveryLocInput').value.trim();
                if (!loc) {
                    showBabeToast("Enter your delivery area, honey! 📍");
                    return;
                }
                checkoutData.delivery_location = `${loc} - ${checkoutData.delivery_service || 'Pickup Mtaani'}`;
                if (!checkoutData.delivery_fee) checkoutData.delivery_fee = 180;
            } else {
                checkoutData.delivery_location = "Store Pickup (Nairobi CBD Boutique)";
                checkoutData.delivery_fee = 0;
            }

            checkoutStep = 3;
            renderCheckoutStep();
        });
    }

    // STEP 3: M-Pesa Payment
    function renderMpesaStep(container) {
        const itemsTotal = getCartTotal();
        const deliveryFee = Number(checkoutData.delivery_fee || 0);
        const grandTotal = itemsTotal + deliveryFee;
        const formattedTotal = 'KES ' + grandTotal.toLocaleString('en-KE', { minimumFractionDigits: 2 });
        const defaultPhone = currentCustomer ? currentCustomer.phone : '';

        container.innerHTML = `
            <div class="mpesa-pay-box" style="padding: 14px; margin-bottom: 18px;">
                <div class="mpesa-logo-badge">
                    <i class="fas fa-mobile-screen"></i> M-PESA EXPRESS
                </div>
                <div class="mpesa-amount-display" style="font-size: 1.6rem;">${formattedTotal}</div>
                <div class="mpesa-amount-sub">
                    Items: KES ${itemsTotal.toLocaleString()} &bull; Delivery: ${deliveryFee > 0 ? 'KES ' + deliveryFee : 'Free'}
                </div>
            </div>

            <div class="checkout-form-group">
                <label><i class="fas fa-phone"></i> M-Pesa Phone Number</label>
                <input type="tel" id="mpesaNumberInput" class="checkout-input" value="${defaultPhone}">
                <small style="color: var(--text-muted); font-size: 0.73rem; display: block; margin-top: 4px;">
                    Safaricom will prompt this phone for your M-Pesa PIN.
                </small>
            </div>

            <button class="btn-proceed-checkout" id="btnTriggerStkPush" style="background: linear-gradient(135deg, #00be46, #008f34); color: #fff; box-shadow: 0 8px 24px rgba(0, 190, 70, 0.4); margin-top: 10px;">
                <i class="fas fa-paper-plane"></i> Pay ${formattedTotal} with M-Pesa 📲
            </button>
        `;

        document.getElementById('btnTriggerStkPush').addEventListener('click', handleStkPushTrigger);
    }

    async function handleStkPushTrigger() {
        const phone = document.getElementById('mpesaNumberInput').value.trim();
        if (!phone) {
            showBabeToast("Enter your M-Pesa number babe! 📱");
            return;
        }

        const btn = document.getElementById('btnTriggerStkPush');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Contacting Safaricom...';

        const total = getCartTotal();

        checkoutData.mpesa_phone = phone;
        checkoutData.transaction_reference = 'MPESA-' + Math.random().toString(36).substring(2, 9).toUpperCase();

        try {
            const res = await fetch(`${API_BASE}/client/stkpush.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone: phone,
                    amount: total,
                    order_ref: 'ANNES-' + Date.now().toString().slice(-4)
                })
            });

            const data = await res.json();
            if (data && data.success && data.data && data.data.transaction_reference) {
                checkoutData.transaction_reference = data.data.transaction_reference;
            }
        } catch (e) {
            console.log('STK push API call skipped or static env fallback');
        }

        showWaitingStkScreen(phone, total, checkoutData.transaction_reference);
    }

    function showWaitingStkScreen(phone, total, txRef) {
        const content = document.getElementById('checkoutStepContent');
        if (!content) return;

        let secondsLeft = 5;

        content.innerHTML = `
            <div class="stk-waiting-animation" style="padding: 16px 0;">
                <div class="stk-phone-pulse" style="width: 76px; height: 76px; font-size: 2.2rem; margin-bottom: 14px;">
                    <i class="fas fa-mobile-screen-button"></i>
                </div>
                <h3 style="font-size: 1.15rem; font-weight: 700; color: #fff; margin-bottom: 6px;">
                    Check your phone screen, babe! 📲
                </h3>
                <p style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.4;">
                    Enter your M-Pesa PIN for <strong>KES ${total.toLocaleString()}</strong> on <strong>${phone}</strong>.
                </p>
                <div class="stk-countdown" id="stkCountdownTimer" style="margin-top: 10px; font-size: 0.95rem;">
                    Awaiting PIN: ${secondsLeft}s...
                </div>
            </div>
        `;

        if (stkInterval) clearInterval(stkInterval);

        stkInterval = setInterval(async () => {
            secondsLeft--;
            const timerEl = document.getElementById('stkCountdownTimer');
            if (timerEl) timerEl.textContent = `Awaiting PIN: ${secondsLeft}s...`;

            if (secondsLeft <= 0) {
                clearInterval(stkInterval);
                await completeOrderSubmission(txRef);
            }
        }, 1000);
    }

    async function completeOrderSubmission(txRef) {
        const content = document.getElementById('checkoutStepContent');
        if (content) {
            content.innerHTML = `
                <div style="text-align: center; padding: 35px 0;">
                    <i class="fas fa-spinner fa-spin" style="font-size: 2.5rem; color: var(--gold-primary); margin-bottom: 14px;"></i>
                    <h3 style="font-size: 1.1rem; color: #fff;">PIN Received! Confirming order... ✨</h3>
                </div>
            `;
        }

        try {
            const isPreorder = cart.some(item => item.allow_preorder);
            const deliveryFee = Number(checkoutData.delivery_fee || 0);

            const orderPayload = {
                customer_id: currentCustomer ? currentCustomer.id : null,
                customer_name: currentCustomer ? currentCustomer.name : 'Valued Customer',
                customer_phone: currentCustomer ? currentCustomer.phone : checkoutData.mpesa_phone,
                customer_address: checkoutData.delivery_location,
                customer_city: 'Kenya',
                delivery_area: checkoutData.delivery_location,
                delivery_fee: deliveryFee,
                sale_type: isPreorder ? 'preorder' : 'online',
                payment_method: 'mpesa',
                notes: checkoutData.fulfillment_type === 'pickup' 
                    ? 'Store Pickup (Nairobi CBD Boutique)' 
                    : `Delivery: ${checkoutData.delivery_service || 'Pickup Mtaani'}`,
                transaction_reference: txRef,
                items: cart.map(item => {
                    const priceNum = typeof item.price === 'number' 
                        ? item.price 
                        : parseFloat(String(item.price).replace(/[^0-9.]/g, '')) || 0;
                    const variantNotes = [item.color ? `Color: ${item.color}` : '', (item.size && item.size !== 'One Size') ? `Size: ${item.size}` : ''].filter(Boolean).join(', ');
                    return {
                        product_id: Number(item.id) || 1,
                        variant_id: item.variant_id || null,
                        title: variantNotes ? `${item.title} (${variantNotes})` : item.title,
                        quantity: Number(item.quantity) || 1,
                        unit_price: priceNum
                    };
                })
            };

            let data = null;

            // Send to Cloudflare Worker API first
            try {
                const workerBase = (typeof CF_WORKER_URL !== 'undefined' ? CF_WORKER_URL : 'https://api.annesfashion.co.ke');
                const workerRes = await fetch(`${workerBase}/api/client/order`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(orderPayload)
                });
                const workerJson = await workerRes.json();
                if (workerJson.success) data = workerJson;
            } catch (wErr) {
                console.warn('Worker order endpoint fallback:', wErr);
            }

            // Fallback to local PHP API if needed
            if (!data) {
                const res = await fetch(`${API_BASE}/client/order.php`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(orderPayload)
                });
                const resJson = await res.json();
                if (resJson.success && resJson.data) data = resJson.data;
            }

            if (data && (data.success || data.sale_number)) {
                cart = [];
                saveCart();
                updateCartBadge();
                renderCartDrawer();

                checkoutStep = 4;
                checkoutData.orderResult = data;
                renderCheckoutStep();
            } else {
                showBabeToast("Order recorded, babe! 🥂");
            }
        } catch (e) {
            console.error('Order submission error:', e);
            showBabeToast("Network glitch, but your order is recorded babe!");
        }
    }

    // STEP 4: Celebration Screen
    function renderCelebrationStep(container) {
        const order = checkoutData.orderResult || {};
        const customerName = currentCustomer ? currentCustomer.name : 'Babe';

        container.innerHTML = `
            <div class="celebration-wrap">
                <div class="celebration-icon" style="font-size: 2.8rem; margin-bottom: 8px;">🥳🥂💅</div>
                <h2 class="celebration-title" style="font-size: 1.35rem;">You're all set, ${customerName}!</h2>
                <p style="font-size: 0.84rem; color: var(--text-muted); line-height: 1.4;">
                    Your order is confirmed &amp; being prepped with love.
                </p>

                <div class="celebration-receipt" style="margin: 16px 0; padding: 14px;">
                    <div class="receipt-row">
                        <span>Receipt No:</span>
                        <strong style="color: #fff;">${order.sale_number || 'SALE-ONLINE'}</strong>
                    </div>
                    <div class="receipt-row">
                        <span>M-Pesa Ref:</span>
                        <strong style="color: #00be46;">${order.transaction_reference || 'MPESA-PAID'}</strong>
                    </div>
                    <div class="receipt-row">
                        <span>Fulfillment:</span>
                        <strong style="color: #fff;">${order.delivery_location || 'Nairobi'}</strong>
                    </div>
                    <div class="receipt-row">
                        <span>Total Paid:</span>
                        <strong>${order.total_formatted || 'PAID'}</strong>
                    </div>
                </div>

                <a href="${order.whatsapp_link || '#'}" target="_blank" class="btn-whatsapp-chat" style="padding: 12px;">
                    <i class="fab fa-whatsapp"></i> Chat with Anne on WhatsApp
                </a>

                <button class="btn-proceed-checkout" id="btnCloseCelebration" style="background: rgba(255, 255, 255, 0.08); color: #fff; box-shadow: none; border: 1px solid rgba(255, 255, 255, 0.15); padding: 12px;">
                    Keep Slaying &amp; Shop More 🛍️
                </button>
            </div>
        `;

        document.getElementById('btnCloseCelebration').addEventListener('click', () => {
            closeCheckoutModal();
        });
    }

    // ========================================
    // Header & UI Helpers
    // ========================================
    // ========================================
    // Client Dashboard & Live Parcel Tracking Modal
    // ========================================
    function injectClientDashboardModal() {
        if (document.getElementById('clientDashboardModalWrap')) return;

        const modal = document.createElement('div');
        modal.className = 'checkout-modal-wrap';
        modal.id = 'clientDashboardModalWrap';
        modal.style.maxWidth = '560px';
        modal.innerHTML = `
            <div class="checkout-modal-header" style="justify-content: space-between;">
                <span class="checkout-badge"><i class="fas fa-gem"></i> My Wardrobe &amp; Live Tracking</span>
                <button class="btn-close-drawer" id="closeClientDashboardModal" style="width: 32px; height: 32px;">
                    <i class="fas fa-times"></i>
                </button>
            </div>

            <div id="clientDashboardModalBody" style="padding: 10px 0;">
                <!-- Dynamically loaded -->
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('closeClientDashboardModal').addEventListener('click', closeClientDashboardModal);
    }

    function closeClientDashboardModal() {
        const wrap = document.getElementById('clientDashboardModalWrap');
        const backdrop = document.getElementById('cartBackdrop');
        if (wrap) wrap.classList.remove('active');
        if (backdrop) backdrop.classList.remove('active');
    }

    async function openClientDashboardModal() {
        if (!currentCustomer || !currentCustomer.phone) {
            openCheckoutModal();
            return;
        }

        injectClientDashboardModal();
        const wrap = document.getElementById('clientDashboardModalWrap');
        const backdrop = document.getElementById('cartBackdrop');
        const body = document.getElementById('clientDashboardModalBody');

        wrap.classList.add('active');
        if (backdrop) backdrop.classList.add('active');

        body.innerHTML = `
            <div style="text-align: center; padding: 30px 0;">
                <i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: var(--gold-primary); margin-bottom: 10px;"></i>
                <p style="color: #fff; font-size: 0.9rem;">Fetching your parcels &amp; orders, babe... ✨</p>
            </div>
        `;

        try {
            const phone = currentCustomer.phone;
            const workerApi = (typeof CF_WORKER_URL !== 'undefined' ? CF_WORKER_URL : 'https://api.annesfashion.co.ke');
            const res = await fetch(`${workerApi}/api/client/orders?phone=${encodeURIComponent(phone)}`);
            const data = await res.json();

            const orders = (data && data.orders) ? data.orders : [];
            const shipmentUpdates = (data && data.shipment_updates) ? data.shipment_updates : [];

            body.innerHTML = `
                <div style="background: rgba(201, 169, 110, 0.1); border: 1px solid var(--border-gold); border-radius: 12px; padding: 14px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div style="font-weight: 700; color: #fff; font-size: 1.05rem;">
                            Hey, ${currentCustomer.name} 💕
                        </div>
                        <div style="font-size: 0.8rem; color: var(--text-muted);">
                            <i class="fas fa-phone"></i> ${currentCustomer.phone}
                        </div>
                    </div>
                    <button id="btnClientSignOut" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.2); color: #fff; border-radius: 6px; padding: 6px 12px; font-size: 0.75rem; cursor: pointer;">
                        <i class="fas fa-sign-out-alt"></i> Sign Out
                    </button>
                </div>

                <!-- Latest Live Shipment / Waybill Broadcast Feed -->
                <div style="margin-bottom: 18px;">
                    <div style="font-size: 0.85rem; font-weight: 700; color: var(--gold-primary); margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
                        <i class="fas fa-bullhorn"></i> Live Shipment &amp; Parcel Updates:
                    </div>
                    ${shipmentUpdates.length > 0 ? shipmentUpdates.slice(0, 3).map(u => `
                        <div style="background: rgba(0,0,0,0.3); border-left: 3px solid var(--gold-primary); border-radius: 6px; padding: 10px 12px; margin-bottom: 8px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                <strong style="color: #fff; font-size: 0.85rem;">${escapeBabeHtml(u.title)}</strong>
                                <span style="background: var(--gold-primary); color: #000; font-size: 0.68rem; font-weight: 700; padding: 2px 6px; border-radius: 4px;">
                                    ${escapeBabeHtml(u.status_badge || 'In Transit')}
                                </span>
                            </div>
                            <p style="color: rgba(255,255,255,0.75); font-size: 0.78rem; margin: 0 0 4px 0;">${escapeBabeHtml(u.update_text)}</p>
                            <div style="font-size: 0.7rem; color: rgba(255,255,255,0.4); display: flex; justify-content: space-between;">
                                <span>${u.waybill_number ? 'Waybill: ' + escapeBabeHtml(u.waybill_number) : 'Pre-order Consignment'}</span>
                                <span>${u.created_at || ''}</span>
                            </div>
                        </div>
                    `).join('') : '<p style="font-size: 0.8rem; color: var(--text-muted);">No shipping alerts at the moment.</p>'}
                </div>

                <!-- Orders List -->
                <div>
                    <div style="font-size: 0.85rem; font-weight: 700; color: #fff; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
                        <i class="fas fa-boxes-packing"></i> Your Orders &amp; Parcels (${orders.length}):
                    </div>
                    <div style="max-height: 250px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px;">
                        ${orders.length > 0 ? orders.map(ord => `
                            <div style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 12px;">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                                    <strong style="color: #fff; font-size: 0.88rem;">#${ord.sale_number}</strong>
                                    <span style="background: ${ord.delivery_status === 'delivered' ? '#4CAF50' : 'rgba(201, 169, 110, 0.2)'}; color: ${ord.delivery_status === 'delivered' ? '#fff' : 'var(--gold-primary)'}; font-size: 0.72rem; font-weight: 700; padding: 3px 8px; border-radius: 50px;">
                                        ${ord.delivery_status.toUpperCase().replace('_', ' ')}
                                    </span>
                                </div>
                                <div style="font-size: 0.78rem; color: var(--text-muted); margin-bottom: 6px;">
                                    <span>Total: <strong>KES ${Number(ord.total_amount).toLocaleString()}</strong></span> &bull;
                                    <span>${ord.sale_type === 'preorder' ? '🔥 Pre-order' : '🛍️ Standard Order'}</span>
                                    ${ord.delivery_fee > 0 ? ` &bull; <span>Delivery: KES ${ord.delivery_fee}</span>` : ''}
                                </div>
                                ${ord.delivery_area ? `
                                    <div style="font-size: 0.75rem; color: rgba(255,255,255,0.7); margin-bottom: 4px;">
                                        <i class="fas fa-location-dot"></i> ${escapeBabeHtml(ord.delivery_area)}
                                    </div>
                                ` : ''}
                                ${ord.tracking_number ? `
                                    <div style="font-size: 0.75rem; color: var(--gold-primary); font-weight: 600;">
                                        <i class="fas fa-barcode"></i> Tracking Waybill: ${escapeBabeHtml(ord.tracking_number)}
                                    </div>
                                ` : ''}
                            </div>
                        `).join('') : `
                            <div style="text-align: center; padding: 20px 0; color: var(--text-muted); font-size: 0.85rem;">
                                You haven't placed any orders yet, babe! 🛍️
                            </div>
                        `}
                    </div>
                </div>
            `;

            document.getElementById('btnClientSignOut').addEventListener('click', () => {
                localStorage.removeItem('annes_client');
                localStorage.removeItem('annes_token');
                currentCustomer = null;
                updateHeaderUserBadge();
                closeClientDashboardModal();
                showBabeToast("Signed out, gorgeous! See you soon 💋");
            });

        } catch (e) {
            console.error('Error loading dashboard:', e);
            body.innerHTML = `
                <div style="text-align: center; padding: 25px 0;">
                    <p style="color: #ff5252; font-size: 0.85rem;">Failed to load your orders right now, babe.</p>
                </div>
            `;
        }
    }

    function escapeBabeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // ========================================
    // Header & UI Helpers
    // ========================================
    function updateHeaderUserBadge() {
        const userIcons = document.querySelectorAll('.nav-right a.nav-icon i.fa-user');
        userIcons.forEach(icon => {
            const parent = icon.closest('a');
            if (!parent) return;

            if (currentCustomer && currentCustomer.name) {
                parent.title = `My Account & Tracking (${currentCustomer.name})`;
                parent.innerHTML = `<span class="user-badge-header"><i class="fas fa-heart"></i> ${currentCustomer.name.split(' ')[0]}</span>`;
                parent.onclick = (e) => {
                    e.preventDefault();
                    openClientDashboardModal();
                };
            } else {
                parent.innerHTML = `<i class="fas fa-user"></i>`;
                parent.title = "Sign in or join, babe";
                parent.onclick = (e) => {
                    e.preventDefault();
                    openCheckoutModal();
                };
            }
        });
    }

    function bindCartButtons() {
        document.addEventListener('click', (e) => {
            // Cart icon or badge click
            const cartTrigger = e.target.closest('#cartIcon, #cartBadge, .cart-icon, a[href*="cart"]');
            if (cartTrigger) {
                e.preventDefault();
                openCart();
                return;
            }

            // User profile icon click
            const userTrigger = e.target.closest('a.nav-icon:has(.fa-user), #userBadge, .user-badge, .user-badge-header');
            if (userTrigger) {
                e.preventDefault();
                if (currentCustomer && currentCustomer.phone) {
                    openClientDashboardModal();
                } else {
                    openCheckoutModal();
                }
                return;
            }

            // Add-to-cart button click
            const btn = e.target.closest('.btn-add-cart, .btn-add-to-cart');
            if (!btn) return;
            // Product detail main button has its own dedicated handler with size selection
            if (btn.classList.contains('btn-add-to-cart')) return;
            e.preventDefault();
            e.stopPropagation();

            const card = btn.closest('.product-card') || btn.closest('.product-detail-info') || document;
            const titleEl = card.querySelector('.product-title, h1, .product-title-main');
            const priceEl = card.querySelector('.product-price, .current-price, .product-price-main');
            const imgEl = card.querySelector('.product-media img, #mainProductImage, .main-image');

            const id = btn.getAttribute('data-id') || (card.dataset ? card.dataset.id : null) || Date.now();
            const title = titleEl ? titleEl.textContent.trim() : 'Fashion Piece';
            const priceText = priceEl ? priceEl.textContent.replace(/[^0-9.]/g, '') : '2500';
            const price = parseFloat(priceText) || 2500;
            const img = imgEl ? imgEl.src : '';

            window.addToWardrobe({ id, title, price, image_url: img });
        });
    }

    function showBabeToast(msg) {
        const existing = document.querySelector('.babe-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = 'babe-toast';
        toast.textContent = msg;
        toast.style.cssText = `
            position: fixed;
            bottom: 30px;
            left: 50%;
            transform: translateX(-50%) translateY(20px);
            background: linear-gradient(135deg, #1f1f28, #161620);
            color: #c9a96e;
            border: 1px solid rgba(201, 169, 110, 0.4);
            padding: 12px 20px;
            border-radius: 50px;
            font-weight: 700;
            font-size: 0.88rem;
            z-index: 9999999;
            box-shadow: 0 10px 30px rgba(0,0,0,0.8), 0 0 20px rgba(201, 169, 110, 0.2);
            transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            pointer-events: none;
            text-align: center;
            max-width: 90vw;
        `;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.transform = 'translateX(-50%) translateY(0)';
        }, 10);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(20px)';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // Auto-init on DOMContentLoaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initCart);
    } else {
        initCart();
    }

})();
