// ===== Admin Portal JavaScript =====

const API_BASE = '../api';
let authToken = null;
let currentUser = null;
let allProducts = [];
let dashboardData = null;

// ===== Initialize =====
document.addEventListener('DOMContentLoaded', () => {
    // Check if already logged in
    authToken = localStorage.getItem('admin_token');
    if (authToken) {
        verifyToken();
    } else {
        window.location.href = '../login.html?role=admin';
    }

    // Event Listeners
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    document.getElementById('refreshDashboard').addEventListener('click', loadDashboard);
    document.getElementById('addProductBtn').addEventListener('click', () => openProductModal());
    document.getElementById('productForm').addEventListener('submit', handleProductSubmit);
    document.getElementById('stockForm').addEventListener('submit', handleStockSubmit);
    document.getElementById('productImageInput').addEventListener('change', handleImageSelect);

    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const view = item.dataset.view;
            switchView(view);
        });
    });

    // Pre-order toggles
    document.getElementById('globalPreOrderToggle').addEventListener('change', handleGlobalPreOrderToggle);

    // Search and filters
    document.getElementById('productSearch').addEventListener('input', loadProducts);
    document.getElementById('saleTypeFilter').addEventListener('change', loadSales);
    document.getElementById('saleDateFilter').addEventListener('change', loadSales);

    // Inventory filters
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            loadInventory(tab.dataset.filter);
        });
    });
});

// ===== Authentication =====
async function handleLogin(e) {
    e.preventDefault();

    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    showLoading(true);
    hideError();

    try {
        const response = await fetch(`${API_BASE}/auth/login.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (data.success) {
            authToken = data.data.token;
            currentUser = data.data.user;

            // Only allow admin role
            if (currentUser.role !== 'admin') {
                showError('Admin access required. Please use staff portal.');
                showLoading(false);
                return;
            }

            localStorage.setItem('admin_token', authToken);
            localStorage.setItem('admin_user', JSON.stringify(currentUser));

            showScreen('mainScreen');
            loadDashboard();
            showToast(`Welcome back, ${currentUser.first_name}!`);
        } else {
            showError(data.message || 'Login failed');
        }
    } catch (error) {
        showError('Connection error. Please try again.');
    } finally {
        showLoading(false);
    }
}

async function verifyToken() {
    try {
        const response = await fetch(`${API_BASE}/auth/verify.php`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();

        if (data.success) {
            currentUser = JSON.parse(localStorage.getItem('admin_user'));
            showScreen('mainScreen');
            loadDashboard();
        } else {
            localStorage.removeItem('admin_token');
            localStorage.removeItem('admin_user');
            window.location.href = '../login.html?role=admin';
        }
    } catch (error) {
        console.error('Token verification error:', error);
        window.location.href = '../login.html?role=admin';
    }
}

function handleLogout() {
    if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user');
        authToken = null;
        currentUser = null;
        window.location.href = '../login.html?role=admin';
    }
}

// ===== View Management =====
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

function switchView(viewName) {
    // Update nav
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    document.querySelector(`[data-view="${viewName}"]`).classList.add('active');

    // Update views
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(`${viewName}View`).classList.add('active');

    // Load data
    if (viewName === 'dashboard') {
        loadDashboard();
    } else if (viewName === 'products') {
        loadProducts();
    } else if (viewName === 'sales') {
        loadSales();
    } else if (viewName === 'inventory') {
        loadInventory('all');
    } else if (viewName === 'preorder') {
        loadPreorders();
    } else if (viewName === 'chat') {
        loadAdminChatOverview();
    }
}

// ===== Dashboard =====
async function loadDashboard() {
    showLoading(true);

    try {
        const response = await fetch(`${API_BASE}/analytics/dashboard.php`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();

        if (data.success) {
            dashboardData = data.data;
            displayDashboard();
        }
    } catch (error) {
        showToast('Error loading dashboard');
    } finally {
        showLoading(false);
    }
}

function displayDashboard() {
    const d = dashboardData;

    // Stats
    document.getElementById('todayRevenue').textContent = `KSh ${formatPrice(d.today.revenue)}`;
    document.getElementById('todaySales').textContent = d.today.sales_count;
    document.getElementById('monthRevenue').textContent = `KSh ${formatPrice(d.this_month.revenue)}`;
    document.getElementById('lowStockCount').textContent = d.low_stock_count;

    // Top Products
    const topProductsHtml = d.top_products.length > 0
        ? d.top_products.map(p => `
            <div class="top-product-item">
                <div class="top-product-info">
                    <h4>${p.title}</h4>
                    <div class="top-product-stats">${p.total_sold} sold</div>
                </div>
                <div class="top-product-revenue">KSh ${formatPrice(p.total_revenue)}</div>
            </div>
        `).join('')
        : '<div class="empty-state"><p>No sales data yet</p></div>';

    document.getElementById('topProducts').innerHTML = topProductsHtml;

    // Recent Sales
    const recentSalesHtml = d.recent_sales.length > 0
        ? d.recent_sales.map(s => `
            <div class="recent-sale-item">
                <div class="recent-sale-info">
                    <div class="recent-sale-number">${s.sale_number}</div>
                    <div class="recent-sale-details">${s.payment_method.toUpperCase()} • ${formatTime(s.created_at)}</div>
                </div>
                <div class="recent-sale-amount">KSh ${formatPrice(s.total_amount)}</div>
            </div>
        `).join('')
        : '<div class="empty-state"><p>No recent sales</p></div>';

    document.getElementById('recentSales').innerHTML = recentSalesHtml;
}

// ===== Products Management =====
async function loadProducts() {
    const search = document.getElementById('productSearch').value;
    showLoading(true);

    try {
        const url = search
            ? `${API_BASE}/products/list.php?search=${encodeURIComponent(search)}`
            : `${API_BASE}/products/list.php?active_only=false`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.success) {
            allProducts = data.data;
            displayProducts();
        }
    } catch (error) {
        showToast('Error loading products');
    } finally {
        showLoading(false);
    }
}

function displayProducts() {
    const container = document.getElementById('productsList');

    if (allProducts.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-box"></i><p>No products found</p></div>';
        return;
    }

    container.innerHTML = allProducts.map(p => `
        <div class="product-list-item">
            <img src="${p.image_url || 'https://via.placeholder.com/70'}" class="product-list-img" alt="${p.title}">
            <div class="product-list-info">
                <div class="product-list-title">${p.title}</div>
                <div class="product-list-meta">${p.category} • ${p.sku || 'No SKU'}</div>
                <div class="product-list-price">KSh ${formatPrice(p.price)}</div>
                <div class="product-stock ${p.total_stock <= 5 ? 'low' : ''}">Stock: ${p.total_stock || 0}</div>
            </div>
            <div class="product-list-actions">
                <button class="action-btn action-btn-edit" onclick="editProduct(${p.id})">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="action-btn action-btn-stock" onclick="updateStock(${p.id})">
                    <i class="fas fa-warehouse"></i> Stock
                </button>
            </div>
        </div>
    `).join('');
}

function openProductModal(productId = null) {
    const modal = document.getElementById('productModal');
    const form = document.getElementById('productForm');

    form.reset();

    if (productId) {
        // Edit mode
        const product = allProducts.find(p => p.id == productId);
        if (!product) return;

        document.getElementById('modalTitle').textContent = 'Edit Product';
        document.getElementById('productId').value = product.id;
        document.getElementById('productTitle').value = product.title;
        document.getElementById('productDescription').value = product.description || '';
        document.getElementById('productPrice').value = product.price;
        document.getElementById('productCategory').value = product.category;

        // Handle images
        const images = product.images || [];
        const previewContainer = document.getElementById('imagePreviewContainer');
        previewContainer.innerHTML = '';

        if (images.length > 0) {
            images.forEach((img, index) => {
                addImagePreview(img.url, index === 0);
            });
            document.getElementById('noImageText').style.display = 'none';
        } else if (product.image_url) {
            addImagePreview(product.image_url, true);
            document.getElementById('noImageText').style.display = 'none';
        } else {
            previewContainer.innerHTML = '<p id="noImageText">No image selected</p>';
        }

        document.getElementById('productFeatured').checked = product.is_featured == 1;
        document.getElementById('productAllowPreOrder').checked = product.allow_preorder == 1;
        document.getElementById('productStock').disabled = true;
    } else {
        // Add mode
        document.getElementById('modalTitle').textContent = 'Add New Product';
        document.getElementById('productStock').disabled = false;
    }

    modal.classList.add('active');
}

function closeProductModal() {
    document.getElementById('productModal').classList.remove('active');
}

function editProduct(id) {
    openProductModal(id);
}

async function handleProductSubmit(e) {
    e.preventDefault();

    const productId = document.getElementById('productId').value;
    const isEdit = !!productId;

    const images = Array.from(document.querySelectorAll('.image-preview-item')).map(item => item.dataset.url);

    const productData = {
        title: document.getElementById('productTitle').value,
        description: document.getElementById('productDescription').value,
        price: document.getElementById('productPrice').value,
        category: document.getElementById('productCategory').value,
        images: images,
        is_featured: document.getElementById('productFeatured').checked ? 1 : 0,
        allow_preorder: document.getElementById('productAllowPreOrder').checked ? 1 : 0
    };

    if (!isEdit) {
        productData.initial_stock = document.getElementById('productStock').value || 0;
    }

    showLoading(true);

    try {
        const url = isEdit
            ? `${API_BASE}/products/update.php?id=${productId}`
            : `${API_BASE}/products/create.php`;

        const method = isEdit ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(productData)
        });

        const data = await response.json();

        if (data.success) {
            showToast(isEdit ? 'Product updated successfully' : 'Product created successfully');
            closeProductModal();
            loadProducts();
        } else {
            showToast(`Error: ${data.message}`);
        }
    } catch (error) {
        showToast('Connection error');
    } finally {
        showLoading(false);
    }
}

// ===== Stock Management =====
function updateStock(productId) {
    const product = allProducts.find(p => p.id === productId);
    if (!product) return;

    document.getElementById('stockProductId').value = productId;
    document.getElementById('stockInfo').innerHTML = `
        <div class="stock-info-row">
            <span class="stock-info-label">Product:</span>
            <span class="stock-info-value">${product.title}</span>
        </div>
        <div class="stock-info-row">
            <span class="stock-info-label">Current Stock:</span>
            <span class="stock-info-value">${product.total_stock || 0}</span>
        </div>
    `;

    document.getElementById('stockModal').classList.add('active');
}

function closeStockModal() {
    document.getElementById('stockModal').classList.remove('active');
    document.getElementById('stockForm').reset();
}

async function handleStockSubmit(e) {
    e.preventDefault();

    const productId = document.getElementById('stockProductId').value;
    const action = document.getElementById('stockAction').value;
    let quantity = parseInt(document.getElementById('stockQuantity').value);
    const reason = document.getElementById('stockReason').value;

    // If removing stock, make quantity negative
    if (action === 'adjustment') {
        quantity = -quantity;
    }

    const stockData = {
        product_id: parseInt(productId),
        quantity_change: quantity,
        action_type: action,
        reason: reason || null
    };

    showLoading(true);

    try {
        const response = await fetch(`${API_BASE}/inventory/update.php`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(stockData)
        });

        const data = await response.json();

        if (data.success) {
            showToast('Stock updated successfully');
            closeStockModal();
            loadProducts();
        } else {
            showToast(`Error: ${data.message}`);
        }
    } catch (error) {
        showToast('Connection error');
    } finally {
        showLoading(false);
    }
}

// ===== Sales =====
async function loadSales() {
    const type = document.getElementById('saleTypeFilter').value;
    const date = document.getElementById('saleDateFilter').value;

    showLoading(true);

    try {
        let url = `${API_BASE}/sales/list.php?`;
        if (type) url += `type=${type}&`;
        if (date) url += `from_date=${date}&to_date=${date}&`;

        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();

        if (data.success) {
            displaySales(data.data.sales);
        }
    } catch (error) {
        showToast('Error loading sales');
    } finally {
        showLoading(false);
    }
}

function displaySales(sales) {
    const container = document.getElementById('salesList');

    if (sales.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-receipt"></i><p>No sales found</p></div>';
        return;
    }

    container.innerHTML = sales.map(s => `
        <div class="sale-list-item">
            <div class="sale-list-header">
                <div class="sale-list-number">${s.sale_number}</div>
                <div class="sale-list-amount">KSh ${formatPrice(s.total_amount)}</div>
            </div>
            <div class="sale-list-details">
                <div><i class="fas fa-user"></i> ${s.customer_name || 'Walk-in'}</div>
                <div><i class="fas fa-credit-card"></i> ${s.payment_method.toUpperCase()}</div>
                <div><i class="fas fa-clock"></i> ${formatDateTime(s.created_at)}</div>
                <div><i class="fas fa-user-tie"></i> ${s.staff_first_name || 'N/A'}</div>
            </div>
            <span class="sale-type-badge sale-type-${s.sale_type === 'online' ? 'online' : 'instore'}">
                ${s.sale_type === 'online' ? 'Online' : 'In-Store'}
            </span>
        </div>
    `).join('');
}

// ===== Inventory =====
async function loadInventory(filter) {
    showLoading(true);

    try {
        const url = filter === 'low'
            ? `${API_BASE}/inventory/list.php?low_stock=true`
            : `${API_BASE}/inventory/list.php`;

        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();

        if (data.success) {
            displayInventory(data.data);
        }
    } catch (error) {
        showToast('Error loading inventory');
    } finally {
        showLoading(false);
    }
}

function displayInventory(items) {
    const container = document.getElementById('inventoryList');

    if (items.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-warehouse"></i><p>No items found</p></div>';
        return;
    }

    container.innerHTML = items.map(item => {
        let stockClass = 'high';
        if (item.stock === 0) stockClass = 'low';
        else if (item.is_low_stock) stockClass = 'medium';

        return `
            <div class="inventory-item" onclick="updateStock(${item.id})">
                <div class="inventory-info">
                    <h4>${item.title}</h4>
                    <div class="inventory-meta">${item.category} • KSh ${formatPrice(item.price)}</div>
                </div>
                <div class="inventory-stock ${stockClass}">${item.stock || 0}</div>
            </div>
        `;
    }).join('');
}

// ===== Utilities =====
function formatPrice(price) {
    return parseFloat(price).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });
}

function formatDateTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-KE', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function showLoading(show) {
    document.getElementById('loadingOverlay').style.display = show ? 'flex' : 'none';
}

function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function showError(message) {
    const errorEl = document.getElementById('loginError');
    errorEl.textContent = message;
    errorEl.style.display = 'block';
}

function hideError() {
    const errorEl = document.getElementById('loginError');
    if (errorEl) errorEl.style.display = 'none';
}

// ===== Pre-order Management =====
async function loadPreorders() {
    showLoading(true);
    try {
        const response = await fetch(`${API_BASE}/products/list.php?preorder_only=true`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const data = await response.json();
        if (data.success) {
            displayPreorders(data.data);
        }

        // Also load global toggle state
        loadGlobalSettings();
    } catch (error) {
        showToast('Error loading pre-orders');
    } finally {
        showLoading(false);
    }
}

function displayPreorders(products) {
    const container = document.getElementById('preorderList');
    if (products.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-clock"></i><p>No items set for pre-order</p></div>';
        return;
    }
    container.innerHTML = products.map(p => `
        <div class="product-list-item">
            <img src="${p.image_url || 'https://via.placeholder.com/70'}" class="product-list-img" alt="${p.title}">
            <div class="product-list-info">
                <div class="product-list-title">${p.title}</div>
                <div class="product-list-meta">${p.category} • SKU: ${p.sku || 'N/A'}</div>
                <div class="product-stock low">Stock: ${p.total_stock || 0}</div>
            </div>
            <div class="product-list-actions">
                <button class="action-btn action-btn-edit" onclick="editProduct(${p.id})">
                    <i class="fas fa-edit"></i> Edit
                </button>
            </div>
        </div>
    `).join('');
}

async function loadGlobalSettings() {
    try {
        const response = await fetch(`${API_BASE}/settings/get.php?key=pre_order_mode`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const data = await response.json();
        if (data.success) {
            const toggle = document.getElementById('globalPreOrderToggle');
            if (toggle) toggle.checked = data.data.value === 'on';
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

async function handleGlobalPreOrderToggle(e) {
    const isOn = e.target.checked;
    try {
        const response = await fetch(`${API_BASE}/settings/update.php`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                key: 'pre_order_mode',
                value: isOn ? 'on' : 'off'
            })
        });
        const data = await response.json();
        if (data.success) {
            showToast(`Pre-order Mode turned ${isOn ? 'ON' : 'OFF'}`);
        } else {
            showToast('Failed to update setting');
            e.target.checked = !isOn;
        }
    } catch (error) {
        showToast('Error updating setting');
        e.target.checked = !isOn;
    }
}

// ===== Image Handling =====
function addImagePreview(url, isMain = false) {
    const container = document.getElementById('imagePreviewContainer');
    const noImageText = document.getElementById('noImageText');
    if (noImageText) noImageText.style.display = 'none';

    const div = document.createElement('div');
    div.className = `image-preview-item ${isMain ? 'main' : ''}`;
    div.dataset.url = url;

    const displayUrl = url.startsWith('http') ? url : `../${url}`;

    div.innerHTML = `
        <img src="${displayUrl}" alt="Preview">
        <button type="button" class="remove-img" onclick="removeImage(this)">
            <i class="fas fa-times"></i>
        </button>
        ${isMain ? '<span class="main-badge">Main</span>' : ''}
    `;

    container.appendChild(div);
}

function removeImage(btn) {
    const item = btn.closest('.image-preview-item');
    item.remove();

    const container = document.getElementById('imagePreviewContainer');
    if (container.children.length === 0) {
        container.innerHTML = '<p id="noImageText">No image selected</p>';
    } else {
        // If we removed the main image, make the first one the new main
        const first = container.querySelector('.image-preview-item');
        if (!container.querySelector('.image-preview-item.main')) {
            first.classList.add('main');
            if (!first.querySelector('.main-badge')) {
                const badge = document.createElement('span');
                badge.className = 'main-badge';
                badge.textContent = 'Main';
                first.appendChild(badge);
            }
        }
    }
}

async function handleImageSelect(e) {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    showLoading(true);

    for (const file of files) {
        const formData = new FormData();
        formData.append('image', file);

        try {
            const response = await fetch(`${API_BASE}/uploads/image.php`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${authToken}` },
                body: formData
            });
            const data = await response.json();
            if (data.success) {
                const isFirst = document.querySelectorAll('.image-preview-item').length === 0;
                addImagePreview(data.data.url, isFirst);
                showToast('Image uploaded successfully');
            } else {
                showToast(data.message || 'Image upload failed');
            }
        } catch (error) {
            showToast('Error uploading image');
        }
    }

    showLoading(false);
    e.target.value = ''; // Reset input
}

// ===== Live Chat Oversight =====
document.addEventListener('DOMContentLoaded', () => {
    const refreshBtn = document.getElementById('refreshAdminChat');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadAdminChatOverview);
    }
});

async function loadAdminChatOverview() {
    showLoading(true);
    try {
        const response = await fetch(`${API_BASE}/chat/staff_list.php?status=all`);
        const data = await response.json();
        const container = document.getElementById('adminChatList');
        if (!container) return;

        if (data.success && data.data) {
            const pending = data.data.filter(c => c.status === 'HUMAN_REQUESTED');
            const active = data.data.filter(c => c.status === 'HUMAN_ACTIVE' || c.status === 'HUMAN_ASSIGNED');

            const pendingCountEl = document.getElementById('adminPendingChatCount');
            const activeCountEl = document.getElementById('adminActiveChatCount');
            if (pendingCountEl) pendingCountEl.textContent = pending.length;
            if (activeCountEl) activeCountEl.textContent = active.length;

            if (data.data.length > 0) {
                container.innerHTML = data.data.map(conv => `
                    <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 10px 14px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-weight: bold; color: var(--text-gold);">${conv.customer_name || 'Customer'}</div>
                            <div style="font-size: 0.8rem; color: #ccc;">State: <strong>${conv.status}</strong> ${conv.assigned_staff_name ? ' | Assigned: ' + conv.assigned_staff_name : ''}</div>
                            <div style="font-size: 0.78rem; color: #999;">Last Msg: ${conv.last_message || 'None'}</div>
                        </div>
                        <div style="font-size: 0.75rem; color: #888;">${formatTime(conv.last_message_at || conv.created_at)}</div>
                    </div>
                `).join('');
            } else {
                container.innerHTML = '<div class="empty-state"><p>No customer chats logged yet.</p></div>';
            }
        }
    } catch (e) {
        showToast('Failed to load live chat overview');
    } finally {
        showLoading(false);
    }
}

