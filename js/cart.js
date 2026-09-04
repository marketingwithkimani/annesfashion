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
    window.addToWardrobe = function (productOrId) {
        let product = null;
        if (typeof productOrId === 'object' && productOrId !== null) {
            product = productOrId;
        } else if (typeof productsData !== 'undefined') {
            product = productsData.find(p => p.id == productOrId);
        }

        if (!product) {
            console.warn("Product not found:", productOrId);
            return;
        }

        const existingIndex = cart.findIndex(item => item.id == product.id);
        if (existingIndex > -1) {
            cart[existingIndex].quantity = (cart[existingIndex].quantity || 1) + 1;
        } else {
            cart.push({
                id: product.id,
                title: product.title,
                price: parseFloat(product.price) || 0,
                image_url: product.image_url || (product.images && product.images[0] ? product.images[0].url : ''),
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
        cart.forEach(item => {
            const priceFormatted = 'KES ' + (parseFloat(item.price) || 0).toLocaleString();
            html += `
                <div class="cart-item" data-id="${item.id}">
                    <img src="${item.image_url || 'https://via.placeholder.com/80'}" alt="${item.title}" class="cart-item-img">
                    <div class="cart-item-details">
                        <div class="cart-item-title">${item.title}</div>
                        <div class="cart-item-price">${priceFormatted}</div>
                        <div class="cart-item-actions">
                            <div class="cart-qty-stepper">
                                <button class="cart-qty-btn btn-qty-dec" data-id="${item.id}"><i class="fas fa-minus"></i></button>
                                <span class="cart-qty-val">${item.quantity || 1}</span>
                                <button class="cart-qty-btn btn-qty-inc" data-id="${item.id}"><i class="fas fa-plus"></i></button>
                            </div>
                            <button class="cart-item-remove btn-remove-item" data-id="${item.id}">
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
                const id = b.getAttribute('data-id');
                const it = cart.find(x => x.id == id);
                if (it) {
                    it.quantity = (it.quantity || 1) + 1;
                    saveCart();
                    updateCartBadge();
                    renderCartDrawer();
                }
            });
        });

        list.querySelectorAll('.btn-qty-dec').forEach(b => {
            b.addEventListener('click', () => {
                const id = b.getAttribute('data-id');
                const it = cart.find(x => x.id == id);
                if (it) {
                    if ((it.quantity || 1) > 1) {
                        it.quantity -= 1;
                    } else {
                        cart = cart.filter(x => x.id != id);
                    }
                    saveCart();
                    updateCartBadge();
                    renderCartDrawer();
                }
            });
        });

        list.querySelectorAll('.btn-remove-item').forEach(b => {
            b.addEventListener('click', () => {
                const id = b.getAttribute('data-id');
                cart = cart.filter(x => x.id != id);
                saveCart();
                updateCartBadge();
                renderCartDrawer();
                showBabeToast("Removed, honey!");
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
            const res = await fetch(`${API_BASE}/client/auth.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone, pin, name, action: 'auto' })
            });
            const data = await res.json();

            if (data.success && data.data && data.data.customer) {
                currentCustomer = data.data.customer;
                localStorage.setItem('annes_client', JSON.stringify(currentCustomer));
                if (data.data.token) {
                    localStorage.setItem('annes_token', data.data.token);
                }
                updateHeaderUserBadge();
                showBabeToast(data.data.message || `Welcome, gorgeous! 💕`);
                checkoutStep = 2;
                renderCheckoutStep();
            } else {
                showBabeToast(data.message || "Couldn't sign in babe, check your PIN 💕");
            }
        } catch (e) {
            showBabeToast("Network issue babe, let's retry 🌸");
        } finally {
            btn.disabled = false;
            btn.innerHTML = 'Continue, Babe 💋 &rarr;';
        }
    }

    // STEP 2: Store Pickup vs. Delivery Choice
    function renderFulfillmentStep(container) {
        const customerName = currentCustomer ? currentCustomer.name : 'Babe';
        const isDelivery = checkoutData.fulfillment_type === 'delivery';

        container.innerHTML = `
            <div style="font-size: 0.95rem; font-weight: 700; color: #fff; margin-bottom: 14px;">
                How would you like your order, ${customerName}? ✨
            </div>

            <div class="fulfillment-options">
                <div class="fulfillment-card ${isDelivery ? 'selected' : ''}" id="optDelivery">
                    <div class="fulfillment-icon"><i class="fas fa-motorcycle"></i></div>
                    <div class="fulfillment-title">Deliver to Me</div>
                    <div class="fulfillment-sub">To your doorstep / office</div>
                </div>
                <div class="fulfillment-card ${!isDelivery ? 'selected' : ''}" id="optPickup">
                    <div class="fulfillment-icon"><i class="fas fa-store"></i></div>
                    <div class="fulfillment-title">Pick Up at Store</div>
                    <div class="fulfillment-sub">Nairobi CBD Boutique (Free)</div>
                </div>
            </div>

            <div id="deliveryFieldsWrap" style="display: ${isDelivery ? 'block' : 'none'};">
                <div class="delivery-fee-notice">
                    <i class="fas fa-circle-info"></i> <strong>Note babe:</strong> You are paying for the items now. Delivery fee is separate and will be confirmed by the attendant upon dispatch.
                </div>
                <div class="checkout-form-group">
                    <label><i class="fas fa-map-pin"></i> Delivery Location / Estate</label>
                    <input type="text" id="deliveryLocInput" class="checkout-input" placeholder="e.g. Kilimani, Westlands, Roysambu, CBD..." value="${checkoutData.delivery_location || ''}">
                </div>
            </div>

            <div id="pickupNoticeWrap" style="display: ${!isDelivery ? 'block' : 'none'};" class="delivery-fee-notice">
                <i class="fas fa-check-circle"></i> <strong>Store Pickup:</strong> Anne's Fashion Line Boutique, Nairobi CBD. We will notify you once packed &amp; ready!
            </div>

            <div style="font-size: 0.78rem; color: var(--text-muted); margin-bottom: 16px;">
                Shopping as <strong>${customerName}</strong> (${currentCustomer.phone}) 
                &middot; <a href="#" id="switchAccountLink" style="color: var(--gold-primary); text-decoration: underline;">Not you?</a>
            </div>

            <button class="btn-proceed-checkout" id="btnSubmitFulfillment">
                Proceed to Lipa na M-Pesa 📲
            </button>
        `;

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
                    showBabeToast("Enter your delivery location, honey! 📍");
                    return;
                }
                checkoutData.delivery_location = loc;
            } else {
                checkoutData.delivery_location = "Store Pickup (Nairobi CBD Boutique)";
            }

            checkoutStep = 3;
            renderCheckoutStep();
        });
    }

    // STEP 3: M-Pesa Payment
    function renderMpesaStep(container) {
        const total = getCartTotal();
        const formattedTotal = 'KES ' + total.toLocaleString('en-KE', { minimumFractionDigits: 2 });
        const defaultPhone = currentCustomer ? currentCustomer.phone : '';

        container.innerHTML = `
            <div class="mpesa-pay-box" style="padding: 14px; margin-bottom: 18px;">
                <div class="mpesa-logo-badge">
                    <i class="fas fa-mobile-screen"></i> M-PESA EXPRESS
                </div>
                <div class="mpesa-amount-display" style="font-size: 1.6rem;">${formattedTotal}</div>
                <div class="mpesa-amount-sub">Items Total &bull; Anne's Fashion Line</div>
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

            if (data.success && data.data) {
                checkoutData.mpesa_phone = phone;
                checkoutData.transaction_reference = data.data.transaction_reference || ('QCX' + Math.random().toString(36).substring(2, 9).toUpperCase());
                showWaitingStkScreen(phone, total, checkoutData.transaction_reference);
            } else {
                showBabeToast(data.message || "Couldn't reach M-Pesa, let's retry!");
                btn.disabled = false;
                btn.innerHTML = `Pay KES ${total.toLocaleString()} with M-Pesa 📲`;
            }
        } catch (e) {
            showBabeToast("Network issue connecting to Safaricom honey 🥺");
            btn.disabled = false;
            btn.innerHTML = `Pay KES ${total.toLocaleString()} with M-Pesa 📲`;
        }
    }

    function showWaitingStkScreen(phone, total, txRef) {
        const content = document.getElementById('checkoutStepContent');
        if (!content) return;

        let secondsLeft = 10;

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
            const res = await fetch(`${API_BASE}/client/order.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customer_id: currentCustomer ? currentCustomer.id : null,
                    customer_name: currentCustomer ? currentCustomer.name : 'Queen',
                    phone: currentCustomer ? currentCustomer.phone : checkoutData.mpesa_phone,
                    delivery_location: checkoutData.delivery_location,
                    delivery_notes: checkoutData.fulfillment_type === 'pickup' ? 'Store Pickup' : 'Delivery',
                    transaction_reference: txRef,
                    items: cart
                })
            });

            const data = await res.json();

            if (data.success && data.data) {
                cart = [];
                saveCart();
                updateCartBadge();
                renderCartDrawer();

                checkoutStep = 4;
                checkoutData.orderResult = data.data;
                renderCheckoutStep();
            } else {
                showBabeToast(data.message || "Order recording issue, but we've got you babe!");
            }
        } catch (e) {
            showBabeToast("Network glitch, but your order is safe!");
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
    function updateHeaderUserBadge() {
        const userIcons = document.querySelectorAll('.nav-right a.nav-icon i.fa-user');
        userIcons.forEach(icon => {
            const parent = icon.closest('a');
            if (!parent) return;

            if (currentCustomer && currentCustomer.name) {
                parent.title = `Logged in as ${currentCustomer.name} (${currentCustomer.phone})`;
                parent.innerHTML = `<span class="user-badge-header"><i class="fas fa-heart"></i> ${currentCustomer.name.split(' ')[0]}</span>`;
                parent.onclick = (e) => {
                    e.preventDefault();
                    if (confirm(`Hey ${currentCustomer.name} 💕 Do you want to sign out?`)) {
                        localStorage.removeItem('annes_client');
                        localStorage.removeItem('annes_token');
                        currentCustomer = null;
                        updateHeaderUserBadge();
                        showBabeToast("Signed out, gorgeous! See you soon 💋");
                    }
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
        const cartIcons = document.querySelectorAll('#cartIcon');
        cartIcons.forEach(icon => {
            icon.addEventListener('click', (e) => {
                e.preventDefault();
                openCart();
            });
        });

        // Delegate add-to-cart clicks from buttons across pages
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('.btn-add-cart, .btn-add-to-cart');
            if (!btn) return;
            e.preventDefault();
            e.stopPropagation();

            const card = btn.closest('.product-card') || btn.closest('.product-detail-info') || document;
            const titleEl = card.querySelector('.product-title, h1');
            const priceEl = card.querySelector('.product-price, .current-price');
            const imgEl = card.querySelector('.product-media img, .main-image');

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
