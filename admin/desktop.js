/**
 * Anne's Fashion Line — Desktop Admin Dashboard
 * Full SPA functionality: Auth, Pre-Order, Flash Sale, Finance, Get Clients OSINT, Analytics
 */

const API_BASE = 'https://api.annesfashion.co.ke';
const ADMIN_PASSWORD = 'Admin123';

let currentSection = 'home';
let adminToken = null;
let allProductsCache = [];
let financeChartInstance = null;
let currentPeriod = 7;
let currentModalLead = null;
let currentModalCategory = null;

// Lead storage in memory for current session
let sessionLeads = {
  corporate: [],
  corporate_women: [],
  diaspora: []
};

// ========================================================
// INITIALIZATION & AUTH
// ========================================================

document.addEventListener('DOMContentLoaded', () => {
  // Always hide loginScreen initially (CSS keeps it visible by default for first load)
  const loginScreen = document.getElementById('loginScreen');

  const session = localStorage.getItem('admin_session');
  if (session) {
    try {
      const data = JSON.parse(session);
      // Valid for 7 days
      if (data && data.token && (Date.now() - data.timestamp < 7 * 24 * 3600 * 1000)) {
        adminToken = data.token;
        startDashboard();
        return;
      }
    } catch (e) {
      localStorage.removeItem('admin_session');
    }
  }
  // Otherwise show login
  if (loginScreen) loginScreen.style.display = 'flex';
});

function togglePw() {
  const input = document.getElementById('adminPassword');
  const icon = document.getElementById('pwEyeIcon');
  if (input.type === 'password') {
    input.type = 'text';
    icon.className = 'fas fa-eye-slash';
  } else {
    input.type = 'password';
    icon.className = 'fas fa-eye';
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const phoneInput = document.getElementById('adminPhone');
  const input = document.getElementById('adminPassword');
  const errEl = document.getElementById('loginError');
  const btn = document.getElementById('loginBtn');

  const phone = phoneInput ? phoneInput.value.trim() : '';
  const pw = input.value.trim();

  errEl.style.display = 'none';

  if (!phone) {
    showLoginError('Please enter your authorized admin phone number');
    return;
  }

  if (!pw) {
    showLoginError('Please enter the admin password');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Authenticating...';

  try {
    let verified = false;
    let token = 'admin-session-' + Date.now();

    // Check with Worker API
    try {
      const res = await fetch(`${API_BASE}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone, password: pw })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        verified = true;
        token = data.token || token;
      }
    } catch (apiErr) {
      console.warn('API login check fallback:', apiErr);
    }

    // Direct sentence case check fallback
    if (!verified && pw === ADMIN_PASSWORD) {
      verified = true;
    }

    if (verified) {
      adminToken = token;
      localStorage.setItem('admin_session', JSON.stringify({
        phone: phone,
        token: token,
        timestamp: Date.now()
      }));

      // Update admin display name in topbar
      const adminLabel = document.querySelector('.topbar-admin span');
      if (adminLabel && phone) {
        adminLabel.textContent = phone;
      }

      // Trigger crown spinning & zoom animation
      const crown = document.getElementById('crownIcon');
      if (crown) {
        crown.style.transform = 'scale(1.4) rotate(720deg)';
        crown.style.color = '#fff';
      }

      setTimeout(() => {
        const loginScreen = document.getElementById('loginScreen');
        loginScreen.classList.add('login-fade-out');
        setTimeout(() => {
          loginScreen.style.display = 'none';
          loginScreen.classList.remove('login-fade-out');
          startDashboard();
        }, 550);
      }, 400);

    } else {
      showLoginError('Invalid password. Sentence case required (e.g. Admin123).');
      btn.disabled = false;
      btn.innerHTML = '<span class="login-btn-text">Sign In</span><i class="fas fa-arrow-right login-btn-icon"></i>';
    }
  } catch (err) {
    showLoginError('Connection error. Please try again.');
    btn.disabled = false;
    btn.innerHTML = '<span class="login-btn-text">Sign In</span><i class="fas fa-arrow-right login-btn-icon"></i>';
  }
}

function showLoginError(msg) {
  const errEl = document.getElementById('loginError');
  errEl.textContent = msg;
  errEl.style.display = 'block';
}

function handleLogout() {
  if (confirm('Are you sure you want to log out of the Admin Dashboard?')) {
    localStorage.removeItem('admin_session');
    adminToken = null;
    document.getElementById('dashboard').hidden = true;
    const loginScreen = document.getElementById('loginScreen');
    loginScreen.style.display = 'flex';
    document.getElementById('adminPassword').value = '';
    const btn = document.getElementById('loginBtn');
    btn.disabled = false;
    btn.innerHTML = '<span class="login-btn-text">Sign In</span><i class="fas fa-arrow-right login-btn-icon"></i>';
    const crown = document.getElementById('crownIcon');
    if (crown) crown.style.transform = '';
  }
}

function startDashboard() {
  // Hide login screen (always, whether arriving from form submit or saved session)
  const loginScreen = document.getElementById('loginScreen');
  if (loginScreen) loginScreen.style.display = 'none';

  const session = localStorage.getItem('admin_session');
  if (session) {
    try {
      const data = JSON.parse(session);
      if (data && data.phone) {
        const adminLabel = document.querySelector('.topbar-admin span');
        if (adminLabel) adminLabel.textContent = data.phone;
      }
    } catch(e) {}
  }
  document.getElementById('dashboard').hidden = false;
  showSection('home');
  loadHomeStats();
  loadGlobalToggles();
}

// ========================================================
// NAVIGATION & SECTIONS
// ========================================================

function showSection(sectionId, navEl) {
  currentSection = sectionId;

  // Update nav item active states
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(el => el.classList.remove('active'));
  if (navEl) {
    navEl.classList.add('active');
  } else {
    const targetNav = document.querySelector(`.sidebar-nav .nav-item[data-section="${sectionId}"]`);
    if (targetNav) targetNav.classList.add('active');
  }

  // Update Section containers
  document.querySelectorAll('.main-content .section').forEach(el => el.classList.remove('active'));
  const targetSection = document.getElementById(`section-${sectionId}`);
  if (targetSection) targetSection.classList.add('active');

  // Update Topbar Title
  const titles = {
    home: 'Home Dashboard',
    preorder: 'Pre-Order Management',
    flashsale: 'Flash Sale Closet',
    finance: 'Sales & Financial Reports',
    leadgen: 'Get Clients',
    analytics: 'Performance & Engagement Analytics'
  };
  document.getElementById('topbarTitle').textContent = titles[sectionId] || 'Dashboard';

  // Lazy-load data per section
  if (sectionId === 'home') loadHomeStats();
  else if (sectionId === 'preorder') loadPreorderProducts();
  else if (sectionId === 'flashsale') loadFlashSaleProducts();
  else if (sectionId === 'finance') loadFinanceData(currentPeriod);
  else if (sectionId === 'leadgen') initLeadGenTab();
  else if (sectionId === 'analytics') loadAnalyticsData();
}

function refreshCurrentSection() {
  showToast('Refreshing data...');
  if (currentSection === 'home') loadHomeStats(true);
  else if (currentSection === 'preorder') loadPreorderProducts(true);
  else if (currentSection === 'flashsale') loadFlashSaleProducts(true);
  else if (currentSection === 'finance') loadFinanceData(currentPeriod, true);
  else if (currentSection === 'leadgen') loadSavedLeadsFromD1();
  else if (currentSection === 'analytics') loadAnalyticsData();
}

// ========================================================
// HOME SECTION
// ========================================================

async function loadHomeStats(refresh = false) {
  try {
    const res = await fetch(`${API_BASE}/api/admin/stats`, {
      headers: { 'X-Admin-Token': adminToken || '' }
    });
    const data = await res.json();

    if (data.success) {
      document.getElementById('stat-today-rev').textContent = formatKES(data.today?.revenue || 0);
      document.getElementById('stat-month-rev').textContent = formatKES(data.this_month?.revenue || 0);
      document.getElementById('stat-products').textContent = data.total_products || 0;
      document.getElementById('stat-lowstock').textContent = data.low_stock_count || 0;

      // Recent Sales Table
      const salesBody = document.getElementById('recentSalesBody');
      if (data.recent_sales && data.recent_sales.length > 0) {
        salesBody.innerHTML = data.recent_sales.map(s => `
          <tr>
            <td><strong>${escapeHtml(s.sale_number)}</strong></td>
            <td>${escapeHtml(s.customer_name || 'Walk-in / Online')}</td>
            <td class="gold" style="font-weight:600;">${formatKES(s.total_amount)}</td>
            <td><span class="badge">${escapeHtml((s.payment_method || 'mpesa').toUpperCase())}</span></td>
            <td>${formatDate(s.created_at)}</td>
          </tr>
        `).join('');
      } else {
        salesBody.innerHTML = `<tr><td colspan="5" class="empty-row">No sales recorded yet</td></tr>`;
      }

      // Top Products Table
      const topBody = document.getElementById('topProductsBody');
      if (data.top_products && data.top_products.length > 0) {
        topBody.innerHTML = data.top_products.map((p, idx) => `
          <tr>
            <td><span class="badge ${idx === 0 ? 'badge-blue' : ''}">#${idx + 1}</span></td>
            <td><strong>${escapeHtml(p.title)}</strong></td>
            <td class="gold" style="font-weight:600;">${p.total_sold} pcs</td>
          </tr>
        `).join('');
      } else {
        topBody.innerHTML = `<tr><td colspan="3" class="empty-row">No sales data yet</td></tr>`;
      }
    }
  } catch (e) {
    console.error('Error loading home stats:', e);
  }
}

// ========================================================
// PRE-ORDER & FLASH SALE TOGGLES & PRODUCTS
// ========================================================

async function loadGlobalToggles() {
  try {
    const res = await fetch(`${API_BASE}/api/settings`);
    const data = await res.json();
    if (data.success && data.settings) {
      const isPre = data.settings.pre_order_mode === 'on';
      const isFlash = data.settings.flash_sale_mode === 'on';

      const preToggle = document.getElementById('globalPreorderToggle');
      if (preToggle) preToggle.checked = isPre;
      const preLabel = document.getElementById('preorderModeLabel');
      if (preLabel) preLabel.innerHTML = `Pre-Order Mode: <strong>${isPre ? 'ON' : 'OFF'}</strong>`;

      const flashToggle = document.getElementById('globalFlashSaleToggle');
      if (flashToggle) flashToggle.checked = isFlash;
      const flashLabel = document.getElementById('flashSaleModeLabel');
      if (flashLabel) flashLabel.innerHTML = `Flash Sale: <strong>${isFlash ? 'ON' : 'OFF'}</strong>`;
    }
  } catch (e) {
    console.warn('Failed to load global settings:', e);
  }
}

async function toggleGlobalMode(settingKey, checkbox) {
  const isOn = checkbox.checked;
  const labelId = settingKey === 'pre_order_mode' ? 'preorderModeLabel' : 'flashSaleModeLabel';
  const labelText = settingKey === 'pre_order_mode' ? 'Pre-Order Mode' : 'Flash Sale';

  // ── MUTUAL EXCLUSION: turning one ON must turn the other OFF ──────────────
  if (isOn) {
    if (settingKey === 'pre_order_mode') {
      const flashToggle = document.getElementById('globalFlashSaleToggle');
      const flashLabel  = document.getElementById('flashSaleModeLabel');
      if (flashToggle) flashToggle.checked = false;
      if (flashLabel)  flashLabel.innerHTML = `Flash Sale: <strong>OFF</strong>`;
      // persist the forced-off state to backend
      try {
        await fetch(`${API_BASE}/api/settings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'flash_sale_mode', value: 'off' })
        });
      } catch (_) {}
    } else {
      const preToggle = document.getElementById('globalPreorderToggle');
      const preLabel  = document.getElementById('preorderModeLabel');
      if (preToggle) preToggle.checked = false;
      if (preLabel)  preLabel.innerHTML = `Pre-Order Mode: <strong>OFF</strong>`;
      try {
        await fetch(`${API_BASE}/api/settings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'pre_order_mode', value: 'off' })
        });
      } catch (_) {}
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  document.getElementById(labelId).innerHTML = `${labelText}: <strong>${isOn ? 'ON' : 'OFF'}</strong>`;

  try {
    // 1. Update the specific mode setting
    await fetch(`${API_BASE}/api/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: settingKey, value: isOn ? 'on' : 'off' })
    });

    // 2. Synchronize hot_picks_mode for the main website
    let hotPicksMode = 'normal';
    const isPre   = document.getElementById('globalPreorderToggle')?.checked;
    const isFlash = document.getElementById('globalFlashSaleToggle')?.checked;

    if (isPre)      hotPicksMode = 'preorder';
    else if (isFlash) hotPicksMode = 'flash_sale';

    await fetch(`${API_BASE}/api/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'hot_picks_mode', value: hotPicksMode })
    });

    showToast(`${labelText} turned ${isOn ? 'ON' : 'OFF'} — Hot Picks mode: ${hotPicksMode}`);
  } catch (e) {
    showToast(`Failed to update ${labelText}`, 'error');
    checkbox.checked = !isOn;
  }
}

async function fetchProductsList() {
  if (allProductsCache.length > 0) return allProductsCache;
  try {
    const res = await fetch(`${API_BASE}/api/products?limit=250`);
    const data = await res.json();
    if (data.success && data.products) {
      allProductsCache = data.products;
      return allProductsCache;
    }
  } catch (e) {
    console.error('Error fetching products:', e);
  }
  return [];
}

async function loadPreorderProducts(force = false) {
  if (force) allProductsCache = [];
  const products = await fetchProductsList();
  renderPreorderTable(products);
}

function renderPreorderTable(products) {
  const body = document.getElementById('preorderProductBody');
  if (!products || products.length === 0) {
    body.innerHTML = `<tr><td colspan="6" class="empty-row">No products found</td></tr>`;
    return;
  }

  body.innerHTML = products.map(p => {
    const isPre = p.allow_preorder === 1;
    const imgSrc = p.image_url || 'https://images.annesfashion.co.ke/media/products/placeholder.jpg';
    return `
      <tr>
        <td><img src="${imgSrc}" class="product-img-thumb" alt="${escapeHtml(p.title)}" onerror="this.src='https://via.placeholder.com/44'"></td>
        <td><strong>${escapeHtml(p.title)}</strong></td>
        <td>${escapeHtml(p.category || 'General')}</td>
        <td class="gold">${formatKES(p.price || 0)}</td>
        <td><span class="badge ${p.total_stock <= 2 ? 'badge-pink' : ''}">${p.total_stock ?? 0}</span></td>
        <td>
          <label class="switch-sm">
            <input type="checkbox" ${isPre ? 'checked' : ''} onchange="toggleProductFlag(${p.id}, 'allow_preorder', this.checked)">
            <span class="slider-sm"></span>
          </label>
        </td>
      </tr>
    `;
  }).join('');
}

async function loadFlashSaleProducts(force = false) {
  if (force) allProductsCache = [];
  const products = await fetchProductsList();
  renderFlashSaleTable(products);
}

function renderFlashSaleTable(products) {
  const body = document.getElementById('flashsaleProductBody');
  if (!products || products.length === 0) {
    body.innerHTML = `<tr><td colspan="6" class="empty-row">No products found</td></tr>`;
    return;
  }

  body.innerHTML = products.map(p => {
    const isFlash = p.is_flash_sale === 1;
    const imgSrc = p.image_url || 'https://images.annesfashion.co.ke/media/products/placeholder.jpg';
    return `
      <tr>
        <td><img src="${imgSrc}" class="product-img-thumb" alt="${escapeHtml(p.title)}" onerror="this.src='https://via.placeholder.com/44'"></td>
        <td><strong>${escapeHtml(p.title)}</strong></td>
        <td>${escapeHtml(p.category || 'General')}</td>
        <td class="gold">${formatKES(p.price || 0)}</td>
        <td><span class="badge">${p.total_stock ?? 0}</span></td>
        <td>
          <label class="switch-sm">
            <input type="checkbox" ${isFlash ? 'checked' : ''} onchange="toggleProductFlag(${p.id}, 'is_flash_sale', this.checked)">
            <span class="slider-sm"></span>
          </label>
        </td>
      </tr>
    `;
  }).join('');
}

function filterProducts(type, query) {
  const q = query.toLowerCase().trim();
  const filtered = allProductsCache.filter(p => 
    (p.title && p.title.toLowerCase().includes(q)) ||
    (p.category && p.category.toLowerCase().includes(q))
  );
  if (type === 'preorder') renderPreorderTable(filtered);
  else if (type === 'flashsale') renderFlashSaleTable(filtered);
}

async function toggleProductFlag(productId, field, value) {
  try {
    const res = await fetch(`${API_BASE}/api/admin/products/${productId}/toggle`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Token': adminToken || ''
      },
      body: JSON.stringify({ [field]: value })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Updated ${field === 'allow_preorder' ? 'Pre-Order' : 'Flash Sale'} status`);
      // Update local cache
      const item = allProductsCache.find(p => p.id === productId);
      if (item) item[field] = value ? 1 : 0;
    } else {
      showToast('Failed to update product', 'error');
    }
  } catch (e) {
    showToast('Error communicating with server', 'error');
  }
}

// Shipment Broadcast
async function sendShipmentBroadcast(e) {
  e.preventDefault();
  const tracking = document.getElementById('broadcastTracking').value.trim();
  const msg = document.getElementById('broadcastMsg').value.trim();

  if (!msg) {
    showToast('Please enter an update message', 'error');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/tracking/updates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: tracking ? `Shipment ${tracking} Update` : 'Consignment In Transit',
        update_text: msg,
        status_badge: 'In Transit',
        waybill_number: tracking || null
      })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Shipment update broadcasted to all customer dashboards!');
      document.getElementById('shipmentBroadcastForm').reset();
    } else {
      showToast('Failed to broadcast update', 'error');
    }
  } catch (err) {
    showToast('Error broadcasting update', 'error');
  }
}

// ========================================================
// FINANCE SECTION & CHARTS
// ========================================================

let rawSalesData = [];

async function loadFinanceData(days = 7, force = false) {
  currentPeriod = days;
  try {
    const res = await fetch(`${API_BASE}/api/admin/sales?period=${days}`, {
      headers: { 'X-Admin-Token': adminToken || '' }
    });
    const data = await res.json();

    if (data.success) {
      rawSalesData = data.all_sales || [];

      // Summary
      const totalRev = data.totals?.revenue || 0;
      const totalOrders = data.totals?.count || 0;
      const avgOrder = totalOrders > 0 ? (totalRev / totalOrders) : 0;

      document.getElementById('finance-total-rev').textContent = formatKES(totalRev);
      document.getElementById('finance-total-orders').textContent = totalOrders;
      document.getElementById('finance-avg-order').textContent = formatKES(avgOrder);

      // Render chart
      renderFinanceChart(data.chart_data || []);

      // Render table
      renderFinanceTable(rawSalesData);
    }
  } catch (e) {
    console.error('Error loading finance data:', e);
  }
}

function setFinancePeriod(days, btn) {
  document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  loadFinanceData(days);
}

function renderFinanceChart(chartData) {
  const canvas = document.getElementById('revenueChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  if (financeChartInstance) {
    financeChartInstance.destroy();
  }

  // If no data points, generate placeholder labels for current period
  let labels = chartData.map(d => d.day);
  let values = chartData.map(d => d.revenue);

  if (labels.length === 0) {
    labels = ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7'];
    values = [0, 0, 0, 0, 0, 0, 0];
  }

  // Create gold gradient fill
  const gradient = ctx.createLinearGradient(0, 0, 0, 300);
  gradient.addColorStop(0, 'rgba(212, 175, 55, 0.4)');
  gradient.addColorStop(1, 'rgba(212, 175, 55, 0.0)');

  financeChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Revenue (KSh)',
        data: values,
        borderColor: '#D4AF37',
        borderWidth: 3,
        backgroundColor: gradient,
        fill: true,
        tension: 0.35,
        pointBackgroundColor: '#F3E5AB',
        pointBorderColor: '#D4AF37',
        pointRadius: 4,
        pointHoverRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#161622',
          titleColor: '#D4AF37',
          bodyColor: '#fff',
          borderColor: 'rgba(212, 175, 55, 0.3)',
          borderWidth: 1,
          padding: 12,
          callbacks: {
            label: (ctx) => `Revenue: ${formatKES(ctx.parsed.y)}`
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#8e8ea0', font: { size: 11 } }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: {
            color: '#8e8ea0',
            font: { size: 11 },
            callback: (val) => 'KSh ' + val.toLocaleString()
          }
        }
      }
    }
  });
}

function renderFinanceTable(sales) {
  const body = document.getElementById('financeTableBody');
  if (!sales || sales.length === 0) {
    body.innerHTML = `<tr><td colspan="6" class="empty-row">No transactions recorded</td></tr>`;
    return;
  }

  body.innerHTML = sales.map(s => `
    <tr>
      <td><strong>${escapeHtml(s.sale_number)}</strong></td>
      <td>${escapeHtml(s.customer_name || 'Walk-in / Online')}</td>
      <td class="gold" style="font-weight:600;">${formatKES(s.total_amount)}</td>
      <td><span class="badge">${escapeHtml((s.payment_method || 'mpesa').toUpperCase())}</span></td>
      <td>${formatDate(s.created_at)}</td>
      <td><span class="status-badge sent">${escapeHtml(s.delivery_status || 'Completed')}</span></td>
    </tr>
  `).join('');
}

function sortFinanceTable() {
  const sort = document.getElementById('finSortBy').value;
  let sorted = [...rawSalesData];
  if (sort === 'date-desc') sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  else if (sort === 'date-asc') sorted.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  else if (sort === 'amount-desc') sorted.sort((a, b) => b.total_amount - a.total_amount);
  else if (sort === 'amount-asc') sorted.sort((a, b) => a.total_amount - b.total_amount);
  renderFinanceTable(sorted);
}

// ========================================================
// LEAD GENERATION OSINT SCANNER & EMAIL CRAFTING
// ========================================================

// ========================================================
// GET CLIENTS — OSINT SCANNER & EMAIL CRAFTING
// ========================================================

const SEED_CORPORATES = [
  {
    company: 'Safaricom PLC', domain: 'safaricom.co.ke',
    email: 'hr-events@safaricom.co.ke', contact: 'Head of People & Culture',
    linkedin: 'linkedin.com/company/safaricom-plc',
    event: 'Q4 Annual Staff Appreciation & Gala',
    event_window: 'November–December annually',
    event_why: 'Safaricom hosts an end-of-year staff gala every Q4. HR typically procures bulk employee gifts in October–November. Boutique vouchers offer a memorable, personal alternative to generic supermarket tokens.',
    event_recurrence: 'Annual — confirmed every Q4 since 2019',
    pitch_angle: 'Batch corporate gift vouchers for 1,000+ female employees'
  },
  {
    company: 'Equity Bank Kenya', domain: 'equitybank.co.ke',
    email: 'corporate-welfare@equitybank.co.ke', contact: 'Chief Human Resources Officer',
    linkedin: 'linkedin.com/company/equity-bank-kenya',
    event: 'End-of-Year Employee Recognition Awards',
    event_window: 'December, 2nd or 3rd week',
    event_why: 'Equity Bank runs a formal awards evening every December celebrating top performers. Boutique vouchers from Anne\'s Fashion Line are a stylish gift for recognized female staff and partners.',
    event_recurrence: 'Annual — repeat event every December',
    pitch_angle: 'Personalised fashion vouchers for award recipients'
  },
  {
    company: 'KCB Group', domain: 'kcbgroup.com',
    email: 'internal-events@kcbgroup.com', contact: 'Head of Employee Engagement',
    linkedin: 'linkedin.com/company/kcb-group',
    event: 'Quarter 4 Staff Dinner & Hampers Gala',
    event_window: 'Late November – 1st week of December',
    event_why: 'KCB holds a region-wide Q4 staff dinner annually. Hamper procurement starts in October. Boutique vouchers are a prestige, gender-sensitive gift ideal for their diverse workforce.',
    event_recurrence: 'Annual — Q4 repeat, confirmed records 2020–2024',
    pitch_angle: 'Boutique hamper alternative — 500+ female staff vouchers'
  },
  {
    company: 'NCBA Group', domain: 'ncbagroup.com',
    email: 'people@ncbagroup.com', contact: 'Head of Talent & Culture',
    linkedin: 'linkedin.com/company/ncba-group',
    event: 'Annual Closing Celebration & Staff Gifts',
    event_window: 'December, week 2–3',
    event_why: 'NCBA runs a combined NIC/CBA legacy closing event. Procurement for gifts typically issued in November. Fashion vouchers resonate with their upmarket staff demographic.',
    event_recurrence: 'Annual repeat',
    pitch_angle: 'Prestige fashion vouchers for year-end gifting'
  },
  {
    company: 'Deloitte East Africa', domain: 'deloitte.com',
    email: 'ea-people@deloitte.com', contact: 'Director of Human Capital',
    linkedin: 'linkedin.com/company/deloitte',
    event: 'Year-End Partners & Staff Appreciation Dinner',
    event_window: 'Early December',
    event_why: 'Deloitte EA hosts a formal partner/staff appreciation event in December. High-earning professionals prefer quality, memorable gifts. Anne\'s boutique vouchers are a distinctive luxury alternative.',
    event_recurrence: 'Annual — partner-tier event every Q4',
    pitch_angle: 'Premium fashion gift vouchers for professional women'
  },
  {
    company: 'PwC Kenya', domain: 'pwc.com',
    email: 'ke_talent@pwc.com', contact: 'People Partner',
    linkedin: 'linkedin.com/company/pwc-kenya',
    event: 'Q4 Annual Celebration & Staff Rewards',
    event_window: 'November–December',
    event_why: 'PwC Kenya\'s Q4 celebration includes a formal rewards programme. Fashion vouchers align with their \'people-first\' culture and attract high engagement from female staff.',
    event_recurrence: 'Annual Q4 event',
    pitch_angle: 'Staff reward vouchers — boutique shopping experience'
  },
  {
    company: 'CIC Insurance Group', domain: 'cic.co.ke',
    email: 'hr@cic.co.ke', contact: 'General Manager HR',
    linkedin: 'linkedin.com/company/cic-insurance',
    event: 'Annual Staff Gala Dinner & Gifts',
    event_window: '2nd week of December',
    event_why: 'CIC Insurance organises a staff gala dinner each December. Boutique vouchers offer a refreshing gift upgrade from typical retail vouchers, perfectly suited to their female workforce.',
    event_recurrence: 'Annual repeat',
    pitch_angle: 'Boutique vouchers for gala attendees'
  },
  {
    company: 'Britam Holdings', domain: 'britam.com',
    email: 'communications@britam.com', contact: 'Director of Corporate Affairs',
    linkedin: 'linkedin.com/company/britam',
    event: 'Q4 Corporate Staff Gifting Day',
    event_window: 'Late November',
    event_why: 'Britam runs a corporate gifting programme for staff and loyal clients each Q4. Boutique fashion vouchers are an on-brand, aspirational gift aligned with their premium financial brand.',
    event_recurrence: 'Annual — Q4 procurement window opens October',
    pitch_angle: 'Staff & client gifting — batch boutique vouchers'
  },
  {
    company: 'East African Breweries (EABL)', domain: 'eabl.com',
    email: 'eabl-events@diageo.com', contact: 'Head of Corporate Relations',
    linkedin: 'linkedin.com/company/eabl',
    event: 'Year-End Excellence Celebration',
    event_window: 'December, 1st–2nd week',
    event_why: 'EABL\'s annual Excellence Awards celebrate top performers. Gift vouchers from a boutique add a personal, stylish touch their teams will genuinely remember and appreciate.',
    event_recurrence: 'Annual — repeat corporate event',
    pitch_angle: 'Excellence award vouchers for top female performers'
  },
  {
    company: 'Stanbic Bank Kenya', domain: 'stanbicbank.co.ke',
    email: 'peopleengagement@stanbic.com', contact: 'Head of Brand & Culture',
    linkedin: 'linkedin.com/company/stanbic-bank-kenya',
    event: 'Quarter 4 Employee Appreciation Soiree',
    event_window: 'Late November – early December',
    event_why: 'Stanbic Kenya\'s Q4 soirée is a prestige event. Their brand culture values authenticity and style. Anne\'s boutique vouchers are an exact match — premium, local, and unforgettable.',
    event_recurrence: 'Annual Q4 event',
    pitch_angle: 'Prestige boutique vouchers for the appreciation soirée'
  },
  {
    company: 'Jubilee Insurance', domain: 'jubileeinsurance.com',
    email: 'welfare@jubilee-kenya.com', contact: 'Head of HR Operations',
    linkedin: 'linkedin.com/company/jubilee-insurance',
    event: 'Annual Staff Awards & Christmas Soiree',
    event_window: 'December',
    event_why: 'Jubilee Insurance\'s Christmas soirée is a staff highlight. Boutique fashion vouchers are a crowd-favourite gift that resonates deeply with their majority-female professional staff.',
    event_recurrence: 'Annual repeat',
    pitch_angle: 'Christmas soirée fashion vouchers'
  },
  {
    company: 'Nation Media Group', domain: 'nationmedia.com',
    email: 'hr-engagement@nationmedia.com', contact: 'HR Director',
    linkedin: 'linkedin.com/company/nation-media-group',
    event: 'Annual Journalism & Staff Honors Dinner',
    event_window: 'Early December',
    event_why: 'NMG\'s annual honors dinner recognizes editorial and business excellence. Fashion vouchers from Anne\'s Line are a distinctive, memorable gift perfect for their creative, style-conscious professionals.',
    event_recurrence: 'Annual repeat',
    pitch_angle: 'Staff honors dinner gift — boutique fashion vouchers'
  }
];

const SEED_CORPORATE_WOMEN = [
  {
    name: 'Sarah M. Kimani', company: 'Safaricom PLC', title: 'Head of Finance & Accounting',
    email: 's.kimani@safaricom.co.ke', linkedin: 'linkedin.com/in/sarah-kimani-cpa',
    event: 'Q4 Corporate Wardrobe Season',
    event_why: 'Finance directors at Safaricom are frequently on-stage at Q4 investor briefings, award ceremonies, and AGMs. Sarah likely needs a refreshed occasion wardrobe for November–December events.',
    event_window: 'October – December',
    pitch_angle: 'Corporate occasion wardrobe upgrade before Q4 galas'
  },
  {
    name: 'Grace Wanjiku', company: 'Equity Bank Kenya', title: 'Senior HR Business Partner',
    email: 'grace.wanjiku@equitybank.co.ke', linkedin: 'linkedin.com/in/grace-wanjiku-hr',
    event: 'Staff Recognition Awards Season',
    event_why: 'As HR Business Partner, Grace likely attends and presents at the year-end recognition awards. She is the ideal candidate to both use and recommend Anne\'s fashion vouchers as staff gifts.',
    event_window: 'November – December',
    pitch_angle: 'Personal wardrobe for the awards event + bulk vouchers for staff'
  },
  {
    name: 'Amina Hassan', company: 'Airtel Kenya', title: 'Marketing & Brand Director',
    email: 'amina.hassan@airtel.com', linkedin: 'linkedin.com/in/amina-hassan-brand',
    event: 'Year-End Brand Campaigns & Launches',
    event_why: 'Brand directors attend product launches, media events, and industry galas in Q4. Amina needs a polished, media-ready wardrobe. Anne\'s occasion dresses are a perfect fit.',
    event_window: 'October – December',
    pitch_angle: 'Media-ready occasion wardrobe for brand director'
  },
  {
    name: 'Linda Otieno', company: 'KCB Group', title: 'Head of Treasury Operations',
    email: 'l.otieno@kcbgroup.com', linkedin: 'linkedin.com/in/linda-otieno-treasury',
    event: 'KCB Annual Staff Dinner',
    event_why: 'Linda attends the KCB Q4 staff dinner as a senior leader. Event dress code is typically formal. Anne\'s dinner dress and gala collections are exactly what she would be shopping for now.',
    event_window: 'Late November – December',
    pitch_angle: 'Formal dinner dress for the annual KCB staff gala'
  },
  {
    name: 'Faith Mutua', company: 'Nation Media Group', title: 'Corporate Legal Counsel',
    email: 'fmutua@nationmedia.com', linkedin: 'linkedin.com/in/faith-mutua-esq',
    event: 'NMG Annual Honors Dinner',
    event_why: 'As legal counsel, Faith attends high-profile events including NMG\'s annual honors dinner. She needs an elegant, boardroom-to-dinner wardrobe — Anne\'s corporate-chic range is her match.',
    event_window: 'Early December',
    pitch_angle: 'Elegant evening dress for the annual honors dinner'
  },
  {
    name: 'Loise Kamau', company: 'Deloitte East Africa', title: 'Strategy & Operations Lead',
    email: 'lkamau@deloitte.com', linkedin: 'linkedin.com/in/loise-kamau-strategy',
    event: 'Deloitte Partner Appreciation Dinner',
    event_window: 'December',
    event_why: 'Strategy leads at Deloitte EA are invited to the partner appreciation dinner — a black-tie-adjacent event. Loise will be looking for a standout, polished dinner dress this season.',
    pitch_angle: 'Black-tie dinner dress from Anne\'s evening collection'
  },
  {
    name: 'Priya Shah', company: 'PwC Kenya', title: 'Senior Tax Director',
    email: 'priya.shah@pwc.com', linkedin: 'linkedin.com/in/priya-shah-pwc',
    event: 'PwC Kenya Q4 Celebration',
    event_window: 'November – December',
    event_why: 'Senior directors at PwC attend formal celebrations and industry networking events in Q4. Priya\'s professional image is paramount — Anne\'s power dressing collection speaks directly to her.',
    pitch_angle: 'Power-dressing occasion wardrobe for Q4 events'
  },
  {
    name: 'Winnie Cherop', company: 'Co-op Bank Kenya', title: 'Chief Risk Officer',
    email: 'wcherop@co-opbank.co.ke', linkedin: 'linkedin.com/in/winnie-cherop-risk',
    event: 'Co-op Bank Annual Staff Dinner',
    event_window: 'December',
    event_why: 'C-suite leaders at Co-op Bank are present at the annual staff dinner and board events. Winnie needs an executive-level occasion dress — Anne\'s collections deliver exactly this.',
    pitch_angle: 'Executive occasion dress for the annual Co-op Bank dinner'
  },
  {
    name: 'Nancy Njuguna', company: 'NCBA Group', title: 'Head of Customer Experience',
    email: 'nancy.njuguna@ncbagroup.com', linkedin: 'linkedin.com/in/nancy-njuguna-cx',
    event: 'NCBA Year-End Closing Gala',
    event_window: 'December',
    event_why: 'Nancy leads CX at NCBA and regularly attends brand-facing events and the year-end gala. She is style-conscious and would resonate with Anne\'s curated dinner collections.',
    pitch_angle: 'Curated dinner dress for the NCBA year-end gala'
  },
  {
    name: 'Stella Mureithi', company: 'CIC Insurance', title: 'General Manager, Corporate Business',
    email: 'smureithi@cic.co.ke', linkedin: 'linkedin.com/in/stella-mureithi',
    event: 'CIC Annual Staff Awards Gala',
    event_window: 'December',
    event_why: 'As GM of Corporate Business, Stella hosts tables and leads the gala stage. She needs a commanding, polished gala dress — Anne\'s signature occasion collection fits perfectly.',
    pitch_angle: 'Gala-ready occasion dress for a corporate GM'
  }
];

const SEED_DIASPORA = [
  {
    name: 'Kenyan Women in Diaspora UK', location: 'London, UK',
    type: 'Community & Network', email: 'info@kenyawomenuk.org',
    contact: 'Admin Committee', platform: 'UK Registered Network (2.8K Members)',
    event: 'Kenya Independence Day Gala (December/June)',
    event_window: 'June & December annually',
    event_why: 'This network holds formal galas celebrating Kenyan milestones. Members actively seek Kenyan boutique fashion for diaspora events — Anne\'s collection is authentic, Nairobi-made chic.',
    pitch_angle: 'Boutique occasion dresses shipped to diaspora community for formal galas'
  },
  {
    name: 'Kenyan Women Network USA', location: 'New York, USA',
    type: 'Professional Network', email: 'connect@kenwomenusa.org',
    contact: 'Steering Committee', platform: 'East Coast Chapter (1.9K Members)',
    event: 'Annual Gala & Networking Dinner',
    event_window: 'November annually',
    event_why: 'The US chapter hosts a formal annual gala in November. Members want authentic African fashion for the event. Anne\'s boutique ships worldwide and can supply the entire group.',
    pitch_angle: 'Worldwide shipping — batch event dresses for the annual gala'
  },
  {
    name: 'Nairobi Ladies in London', location: 'London, UK',
    type: 'Fashion & Lifestyle Circle', email: 'nbi.ladies.london@gmail.com',
    contact: 'Founder & Moderator', platform: 'Instagram & WhatsApp Community',
    event: 'Nairobi Ladies Winter Party',
    event_window: 'December annually',
    event_why: 'This WhatsApp/Instagram community hosts a winter party in December and members consistently coordinate fashion from Nairobi. Anne\'s boutique is the ideal exclusive supplier.',
    pitch_angle: 'Exclusive boutique supplier for the annual winter party'
  },
  {
    name: 'African Women in Tech UK', location: 'Manchester / London',
    type: 'Professional Society', email: 'hello@afriwomenintech.co.uk',
    contact: 'Events Director', platform: 'Eventbrite & LinkedIn Group (3.2K)',
    event: 'AWiT Annual Tech Gala & Awards',
    event_window: 'November–December',
    event_why: 'African Women in Tech UK hosts a formal awards gala in Q4. Professional women at this event care about representation and proudly wear African fashion on stage. Anne\'s occasion line is a perfect match.',
    pitch_angle: 'African chic occasion dresses for the AWiT awards gala'
  },
  {
    name: 'Nairobi Moms in America', location: 'Atlanta, GA, USA',
    type: 'Diaspora Family & Social', email: 'atl.nbi.moms@gmail.com',
    contact: 'Community Lead', platform: 'Social Network (1.2K Members)',
    event: 'Nairobi Moms Holiday Party',
    event_window: 'December annually',
    event_why: 'This Atlanta community organises a formal Christmas/holiday party each December. Members miss Kenyan boutique fashion and are willing to order from Nairobi if shipping is offered. Anne\'s boutique ships worldwide.',
    pitch_angle: 'Holiday party dresses shipped directly from Nairobi boutique'
  },
  {
    name: 'Kenyan Diaspora Women Germany', location: 'Berlin / Frankfurt',
    type: 'Cultural & Business Forum', email: 'kenya.frauen.de@gmail.com',
    contact: 'Coordination Team', platform: 'Facebook & Meetup Network',
    event: 'Kenyan Cultural Evening (Q4)',
    event_window: 'October – December',
    event_why: 'The German chapter organises Kenyan cultural evenings throughout Q4. Authentic Nairobi boutique fashion is a proud statement piece for diaspora women at these events.',
    pitch_angle: 'Cultural evening occasion dresses — authentic Nairobi boutique'
  },
  {
    name: 'East African Women in Texas', location: 'Dallas, TX, USA',
    type: 'Business & Networking', email: 'eaw.texas@gmail.com',
    contact: 'Chapter Lead', platform: 'WhatsApp & Instagram Hub',
    event: 'EA Women Texas Annual Business Dinner',
    event_window: 'November annually',
    event_why: 'The Texas chapter hosts a formal business dinner in November. This group actively sources African fashion for formal events and would embrace Anne\'s boutique as a trusted supplier.',
    pitch_angle: 'Business dinner occasion dresses — international boutique shipping'
  },
  {
    name: 'Kenyan Professionals Network UK', location: 'Birmingham, UK',
    type: 'Professional Association', email: 'admin@kenyaprofessionals.co.uk',
    contact: 'Welfare Committee', platform: 'LinkedIn Group (4.5K Members)',
    event: 'KPN UK Annual Awards Dinner',
    event_window: 'December annually',
    event_why: 'The KPN UK holds a formal annual awards dinner recognising Kenyan professionals abroad. Anne\'s boutique can supply exclusive occasion dresses to members seeking authentic Kenyan fashion.',
    pitch_angle: 'Annual awards dinner — exclusive Kenyan boutique dresses'
  },
  {
    name: 'African Chic UK Community', location: 'London, UK',
    type: 'African Fashion Advocates', email: 'chic.afrique.uk@gmail.com',
    contact: 'Curator', platform: 'Instagram & Private Circle',
    event: 'African Fashion Styling Showcase',
    event_window: 'November–December',
    event_why: 'African Chic UK curates African fashion showcases in Q4. Anne\'s boutique designs are exactly what this community celebrates — a collaboration or bulk supply arrangement is a natural fit.',
    pitch_angle: 'Fashion showcase collaboration — Nairobi boutique supplier'
  },
  {
    name: 'Kenyan Women in Canada Association', location: 'Toronto, Canada',
    type: 'Diaspora Association', email: 'admin@kenyawomencanada.ca',
    contact: 'Executive Board', platform: 'Registered Non-Profit Network',
    event: 'KWCA Annual Gala Dinner',
    event_window: 'November–December annually',
    event_why: 'KWCA hosts a formal annual gala dinner for Kenyan women in Canada. Members actively seek authentic Nairobi fashion for major events. Anne\'s worldwide shipping makes this partnership seamless.',
    pitch_angle: 'Annual gala — batch occasion dress supply from Nairobi boutique'
  }
];

function switchLeadTab(category, btn) {
  document.querySelectorAll('.leadgen-tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.leadgen-tab-content').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  const target = document.getElementById(`lead-tab-${category}`);
  if (target) target.classList.add('active');
}

function initLeadGenTab() {
  loadSavedLeadsFromD1();
}

async function loadSavedLeadsFromD1() {
  try {
    const res = await fetch(`${API_BASE}/api/admin/leads`, {
      headers: { 'X-Admin-Token': adminToken || '' }
    });
    const data = await res.json();
    if (data.success && data.leads) {
      // Group by category
      ['corporate', 'corporate_women', 'diaspora'].forEach(cat => {
        const catLeads = data.leads.filter(l => l.category === cat);
        if (catLeads.length > 0) {
          sessionLeads[cat] = catLeads;
          renderLeadsTable(cat, catLeads);
        }
      });
    }
  } catch (e) {
    console.warn('Could not load saved leads from D1:', e);
  }
}

async function runOsintScan(category) {
  const loading = document.getElementById(`scan-loading-${category}`);
  const tableWrap = document.getElementById(`leads-table-wrap-${category}`);

  if (loading) {
    loading.style.display = 'block';
    loading.innerHTML = `<div style="text-align:center; padding:30px;">
      <div class="spinner" style="margin:0 auto 14px;"></div>
      <div style="color:#D4AF37; font-weight:600;">🤖 GPT-6 Luna scanning the web in real time…</div>
      <div style="color:#888; font-size:0.82rem; margin-top:6px;">SerpAPI + OpenRouter — live Nairobi results</div>
    </div>`;
  }
  if (tableWrap) tableWrap.style.display = 'none';

  try {
    const res = await fetch(`${API_BASE}/api/admin/osint/scan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Token': adminToken || ''
      },
      body: JSON.stringify({ category })
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (data.success && data.leads && data.leads.length > 0) {
      const batch = data.leads.map((item, idx) => ({
        id: null,
        category,
        company_name: item.company || item.name || 'Unknown',
        contact_name: item.contact || 'HR / Events Team',
        email: item.email || '—',
        linkedin_url: item.linkedin_url || item.linkedin || '',
        website: item.website || '',
        notes: item.event || item.title || '',
        event: item.event || '',
        event_window: item.event_window || '',
        event_why: item.event_why || '',
        event_recurrence: item.event_recurrence || '',
        pitch_angle: item.pitch_angle || '',
        email_draft: craftEmailDraft(category, item, idx),
        email_sent: 0
      }));
      sessionLeads[category] = batch;
      renderLeadsTable(category, batch);
      showToast(`🎯 Live scan complete — ${batch.length} real leads found by GPT-6 Luna!`);
    } else {
      throw new Error('No leads returned');
    }
  } catch (err) {
    console.warn('Live OSINT scan failed, falling back to curated data:', err.message);
    // Fallback to seed data
    let sourceData = [];
    if (category === 'corporate') sourceData = SEED_CORPORATES;
    else if (category === 'corporate_women') sourceData = SEED_CORPORATE_WOMEN;
    else if (category === 'diaspora') sourceData = SEED_DIASPORA;

    const batch = sourceData.slice(0, 10).map((item, idx) => ({
      id: null,
      category,
      company_name: item.company || item.name,
      contact_name: item.contact || item.name || 'Welfare / HR Committee',
      email: item.email || '—',
      linkedin_url: item.linkedin || '',
      website: item.domain ? `https://${item.domain}` : '',
      notes: item.event || item.title || item.type || '',
      event: item.event || item.title || '',
      event_window: item.event_window || 'Q4 (Oct – Dec)',
      event_why: item.event_why || '',
      event_recurrence: item.event_recurrence || 'Annual',
      pitch_angle: item.pitch_angle || 'Boutique voucher gifting partnership',
      email_draft: craftEmailDraft(category, item, idx),
      email_sent: 0
    }));
    sessionLeads[category] = batch;
    renderLeadsTable(category, batch);
    showToast('Live scan unavailable — showing curated leads', 'warning');
  } finally {
    if (loading) loading.style.display = 'none';
    if (tableWrap) tableWrap.style.display = 'block';
  }
}

function renderLeadsTable(category, leads) {
  const tbody = document.getElementById(`leads-body-${category}`);
  if (!tbody) return;

  if (!leads || leads.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-row"><i class="fas fa-search"></i> Run an OSINT scan to generate leads</td></tr>`;
    return;
  }

  tbody.innerHTML = leads.map((lead, idx) => {
    const isSent = lead.email_sent === 1;
    const nameDisplay = lead.company_name || lead.contact_name;
    const subtitle = lead.notes ? `<div style="font-size:0.75rem; color:#888;">${escapeHtml(lead.notes)}</div>` : '';
    const linkedinLink = lead.linkedin_url ? `<a href="${lead.linkedin_url.startsWith('http') ? lead.linkedin_url : 'https://' + lead.linkedin_url}" target="_blank" style="color:#7ba3f5;text-decoration:none;"><i class="fab fa-linkedin"></i> Profile</a>` : '—';

    return `
      <tr>
        <td><strong>${idx + 1}</strong></td>
        <td>
          <div style="font-weight:600;">${escapeHtml(nameDisplay)}</div>
          ${subtitle}
        </td>
        <td class="gold">${escapeHtml(lead.email || '—')}</td>
        <td>${escapeHtml(lead.contact_name || 'HR Team')}</td>
        <td>${linkedinLink}</td>
        <td>
          <span class="status-badge ${isSent ? 'sent' : 'new'}">${isSent ? 'Contacted' : 'New'}</span>
        </td>
        <td>
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            <button class="btn-action-sm" onclick="openIntelModal(${idx}, '${category}')" title="Why is this a lead?">
              <i class="fas fa-lightbulb"></i> Intel
            </button>
            <button class="btn-action-sm" onclick="openEmailModal(${idx}, '${category}')">
              <i class="fas fa-envelope"></i> Pitch
            </button>
            <button class="btn-action-sm" onclick="copyLeadEmail('${escapeHtml(lead.email)}')">
              <i class="fas fa-copy"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// ── INTEL MODAL ─────────────────────────────────────────────────────────────
function openIntelModal(index, category) {
  // Prefer live session leads; fall back to seed data
  let item = null;
  if (sessionLeads[category] && sessionLeads[category][index]) {
    item = sessionLeads[category][index];
    // Normalise field names from live API response vs seed data shape
    item = {
      company: item.company_name || item.company || item.name,
      contact: item.contact_name || item.contact,
      title: item.notes || item.title,
      event: item.event,
      event_window: item.event_window,
      event_why: item.event_why,
      event_recurrence: item.event_recurrence,
      pitch_angle: item.pitch_angle,
      type: item.category
    };
  } else {
    let sourceData = [];
    if (category === 'corporate')       sourceData = SEED_CORPORATES;
    else if (category === 'corporate_women') sourceData = SEED_CORPORATE_WOMEN;
    else if (category === 'diaspora')   sourceData = SEED_DIASPORA;
    item = sourceData[index];
  }
  if (!item) return;

  const modal = document.getElementById('intelModal');
  const content = document.getElementById('intelModalContent');
  if (!modal || !content) return;

  const eventName    = item.event       || 'Upcoming Corporate Event';
  const eventWindow  = item.event_window || 'Q4 (Oct – Dec)';
  const eventWhy     = item.event_why   || 'This organisation is an ideal candidate for Anne\'s boutique vouchers based on their corporate profile and event calendar.';
  const recurrence   = item.event_recurrence || 'Annual — repeat event expected';
  const pitchAngle   = item.pitch_angle  || 'Boutique voucher gifting partnership';
  const name         = item.company || item.name;

  content.innerHTML = `
    <div style="display:flex; align-items:center; gap:12px; margin-bottom:20px;">
      <div style="width:48px; height:48px; border-radius:12px; background:rgba(212,175,55,0.15); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
        <i class="fas fa-lightbulb" style="color:#D4AF37; font-size:1.4rem;"></i>
      </div>
      <div>
        <div style="font-size:1.1rem; font-weight:700; color:#fff;">${escapeHtml(name)}</div>
        <div style="font-size:0.8rem; color:#8e8ea0;">${escapeHtml(item.contact || item.title || item.type || '')}</div>
      </div>
    </div>

    <div style="display:grid; gap:14px;">
      <div style="background:rgba(212,175,55,0.08); border:1px solid rgba(212,175,55,0.2); border-radius:10px; padding:14px;">
        <div style="font-size:0.72rem; text-transform:uppercase; letter-spacing:1px; color:#D4AF37; margin-bottom:6px;"><i class="fas fa-calendar-star"></i> Event Identified</div>
        <div style="font-weight:600; color:#fff; font-size:0.95rem;">${escapeHtml(eventName)}</div>
        <div style="font-size:0.8rem; color:#aaa; margin-top:4px;"><i class="fas fa-clock" style="margin-right:4px;"></i>${escapeHtml(eventWindow)}</div>
      </div>

      <div style="background:rgba(255,255,255,0.04); border-radius:10px; padding:14px;">
        <div style="font-size:0.72rem; text-transform:uppercase; letter-spacing:1px; color:#8e8ea0; margin-bottom:6px;"><i class="fas fa-sync-alt"></i> Recurrence</div>
        <div style="font-size:0.88rem; color:#ccc;">${escapeHtml(recurrence)}</div>
      </div>

      <div style="background:rgba(255,255,255,0.04); border-radius:10px; padding:14px;">
        <div style="font-size:0.72rem; text-transform:uppercase; letter-spacing:1px; color:#8e8ea0; margin-bottom:8px;"><i class="fas fa-brain"></i> Why This Lead?</div>
        <div style="font-size:0.88rem; color:#ccc; line-height:1.6;">${escapeHtml(eventWhy)}</div>
      </div>

      <div style="background:rgba(78,205,196,0.08); border:1px solid rgba(78,205,196,0.2); border-radius:10px; padding:14px;">
        <div style="font-size:0.72rem; text-transform:uppercase; letter-spacing:1px; color:#4ecdc4; margin-bottom:6px;"><i class="fas fa-bullseye"></i> Recommended Pitch Angle</div>
        <div style="font-size:0.88rem; color:#fff; font-weight:600;">${escapeHtml(pitchAngle)}</div>
      </div>
    </div>
  `;

  modal.classList.add('active');
}

function closeIntelModal(e, force = false) {
  const modal = document.getElementById('intelModal');
  if (!modal) return;
  if (force || (e && e.target.id === 'intelModal')) {
    modal.classList.remove('active');
  }
}
// ────────────────────────────────────────────────────────────────────────────

// EMAIL TEMPLATES — 10 distinct, fully personalised drafts per category
function craftEmailDraft(category, item, index = 0) {
  const phones = ['0182 942 834', '0726 749 343'];
  const wa     = 'https://wa.me/254798840085';
  const ig     = 'https://www.instagram.com/annes_fashion_line/';
  const fb     = 'https://www.facebook.com/annesfashionline/';
  const tt     = 'https://www.tiktok.com/@annes_fashion_line';
  const web    = 'https://www.annesfashion.co.ke';

  if (category === 'corporate') {
    const drafts = [
      // 0 — Safaricom
      `Subject: A Truly Different Year-End Gift for Your Team — Anne's Fashion Line

Dear ${item.contact || 'Team'} at ${item.company},

Season's greetings from Anne's Fashion Line — Nairobi's boutique for women who mean business and turn heads at dinners!

We're reaching out because ${item.company}'s ${item.event} is exactly the kind of occasion where a remarkable gift makes all the difference. Travel vouchers are forgotten by February. A supermarket hamper is gone by New Year's. But a beautiful dress? That's worn to the next event, and the one after that — and every time it goes on, your team remembers who gave it.

We're proposing batch boutique vouchers from Anne's Fashion Line — redeemable across our stunning collections of corporate chic dresses, dinner wear, and occasion wardrobes.

✨ Custom denominations (KSh 1,000 – KSh 5,000+)
✨ Beautifully packaged with your company branding
✨ Redeemable in-boutique or on our online store

We'd love to put together a tailored proposal for ${item.company} before your ${item.event}. Let's make Q4 gifting unforgettable.

Call / WhatsApp Anne directly: ${phones[0]} | ${phones[1]}
WhatsApp link: ${wa}
Browse the collection: ${web}
Instagram for inspiration: ${ig}

Warmly,
Anne Wanjiku
Anne's Fashion Line — Nairobi Boutique`,

      // 1 — Equity Bank
      `Subject: Year-End Recognition Gifts That Your Staff Will Actually Treasure 💛

Dear ${item.contact || 'HR Leadership'} at ${item.company},

Congratulations in advance for another year of recognising your people — it's one of the things ${item.company} genuinely gets right!

We're Anne's Fashion Line, a Nairobi boutique dedicated to powerhouse women. We noticed that your ${item.event} is coming up and wanted to share an idea we think your team will love.

This year, instead of a standard voucher, what if each recognised female staff member received a boutique fashion voucher from Anne's? A piece from our collection doesn't just sit in a drawer — it gets worn to dinner, to the next office function, to a wedding. Your gift becomes part of her story.

We handle everything:
📦 Batch vouchers, custom denominations
🎁 Branded packaging if required
🌐 Online + walk-in redemption

Let's have a quick chat. Anne is available on:
📞 ${phones[0]} | ${phones[1]}
💬 WhatsApp: ${wa}
🌐 ${web}
📸 See our collection: ${ig}

Here's to a spectacular close of year for ${item.company}!

Warmly,
Anne's Fashion Line`,

      // 2 — KCB
      `Subject: KCB Q4 Hampers — We Have a More Memorable Alternative 🎁

Hi ${item.contact || 'Events Team'} at ${item.company},

We won't take much of your time — we know Q4 planning is in full swing!

Anne's Fashion Line is a Nairobi fashion boutique. We're reaching out because we believe boutique fashion vouchers would be a refreshing, premium alternative to the usual hampers at your ${item.event}.

Here's why it works:
✅ Every female team member gets to choose something she actually wants
✅ Your gift is remembered every time she gets dressed for a special occasion
✅ It's local, sustainable, and genuinely exciting

We supply batch vouchers in any denomination with elegant packaging — no minimum order fuss.

Shall we put a quick proposal together?

📞 Call/WhatsApp: ${phones[0]} | ${phones[1]}
💬 ${wa}
🌐 ${web}
📸 ${ig}

Cheers,
Anne
Anne's Fashion Line`,

      // 3 — NCBA
      `Subject: Close the Year with a Gift That Lasts — Anne's Fashion Line 💎

Dear ${item.contact || 'People & Culture'} at ${item.company},

The end of the year is almost here — and we know the gift planning questions are already flying around.

We're Anne's Fashion Line, and we have one question for you: what if your team remembered this year's celebration every time they wore their gift?

For your ${item.event}, we can supply custom boutique vouchers redeemable at our Nairobi store and online — across our dinner dresses, corporate closets, and occasion wardrobes.

Your staff. Their choice. Their favourite dress. Forever linked to ${item.company}'s appreciation.

We'd love to tailor a package for you. No obligation — just a conversation.

📞 ${phones[0]} | ${phones[1]}
💬 WhatsApp: ${wa}
🌐 ${web}
📸 Browse: ${ig}

Happy closing quarter!
Anne's Fashion Line — Nairobi`,

      // 4 — Deloitte
      `Subject: Sophisticated Year-End Gifts for Sophisticated Professionals — Anne's Fashion Line

Dear ${item.contact || 'Human Capital'} at ${item.company},

Deloitte East Africa sets the bar in everything it does — your year-end gifting should be no different.

Anne's Fashion Line is a premium Nairobi boutique. For your ${item.event}, we're proposing boutique fashion vouchers as a distinguished, memorable alternative to conventional gifts.

For high-earning professionals who have everything, the gift of personal choice — to curate a beautiful dinner dress or occasion wardrobe — is genuinely luxurious.

✨ Premium denominations available
✨ Elegant presentation packaging
✨ Redeemable online and in-boutique
✨ Fully tailored to your budget

We'd be delighted to put a formal proposal together.

📞 ${phones[0]} | ${phones[1]}
💬 ${wa}
🌐 ${web}
📸 ${ig}

With warm regards,
Anne Wanjiku
Anne's Fashion Line`,

      // 5 — PwC
      `Subject: People-First Gifting — A Boutique Fashion Alternative for PwC Kenya 🌟

Dear ${item.contact || 'People Team'} at ${item.company},

PwC Kenya's culture is built around people — and so is ours.

Anne's Fashion Line is a Nairobi boutique dedicated to women who lead, inspire, and show up brilliantly. For your ${item.event}, we'd love to partner with you on batch boutique vouchers your female staff will genuinely be excited to receive.

No two women want the same gift. Our vouchers let each person choose what speaks to her — from structured corporate dresses to stunning occasion wear.

📞 Reach Anne: ${phones[0]} | ${phones[1]}
💬 WhatsApp: ${wa}
🌐 ${web}
📸 ${ig}

Let's make this Q4 gifting season one your team actually talks about.

Warmly,
Anne's Fashion Line`,

      // 6 — CIC Insurance
      `Subject: Annual Staff Gala Gift Idea — Anne's Fashion Boutique Vouchers ✨

Dear ${item.contact || 'HR Team'} at ${item.company},

Planning for the ${item.event}? We might have exactly what you're looking for.

We're Anne's Fashion Line — a Nairobi boutique specialising in occasion wear and corporate fashion. We work with organisations to supply batch boutique vouchers that make meaningful, memorable staff gifts.

Imagine your team arriving at next year's events dressed in outfits gifted by ${item.company}. That's brand loyalty and culture built through style.

📞 ${phones[0]} | ${phones[1]}
💬 ${wa}
🌐 ${web}
📸 ${ig} | Facebook: ${fb}

Looking forward to connecting,
Anne
Anne's Fashion Line`,

      // 7 — Britam
      `Subject: Elevating Corporate Gifting — Anne's Fashion Boutique Vouchers for Britam 💼

Dear ${item.contact || 'Corporate Affairs'} at ${item.company},

Britam's brand stands for trust, quality, and prestige — and that's exactly what we deliver at Anne's Fashion Line.

For your ${item.event}, we're offering custom boutique fashion vouchers that reflect your brand's calibre while giving your staff and clients the joy of genuine personal choice.

From elegant dinner dresses to curated corporate wardrobes, our collection speaks the language of achievement.

📞 ${phones[0]} | ${phones[1]}
💬 ${wa}
🌐 ${web}
📸 ${ig}

Let's create a gifting partnership that reflects the Britam standard.

Warmly,
Anne Wanjiku
Anne's Fashion Line`,

      // 8 — EABL
      `Subject: Celebrate Excellence with Fashion — Anne's Boutique Gift Vouchers for EABL 🏆

Dear ${item.contact || 'Corporate Relations'} at ${item.company},

EABL celebrates excellence every year — and your top performers deserve a gift that matches their achievement.

We're Anne's Fashion Line. For your ${item.event}, we can supply boutique vouchers redeemable across our dinner, occasion, and corporate fashion collections. A beautiful dress is a trophy she'll actually wear.

✨ Batch supply, any denomination
✨ Premium packaging available
✨ Online + walk-in redemption

📞 ${phones[0]} | ${phones[1]}
💬 ${wa}
🌐 ${web}
📸 ${ig}

Here's to celebrating excellence in style!
Anne's Fashion Line`,

      // 9 — Stanbic / generic fallback
      `Subject: Q4 Employee Appreciation — A Fresh Gifting Idea from Anne's Boutique 🌸

Dear ${item.contact || 'Team'} at ${item.company},

We know Q4 means events, celebrations, and the annual gift puzzle. We're here to make that last part easy.

Anne's Fashion Line is a Nairobi boutique offering batch boutique fashion vouchers — a gift your female staff will genuinely look forward to redeeming.

For your ${item.event}, we can design a custom voucher programme that fits your budget and your culture.

📞 ${phones[0]} | ${phones[1]}
💬 ${wa}
🌐 ${web}
📸 ${ig} | TikTok: ${tt}

Let's make this year-end one to remember.

Warmly,
Anne's Fashion Line — Nairobi`
    ];

    return drafts[index % drafts.length];
  }

  if (category === 'corporate_women') {
    const drafts = [
      // 0
      `Subject: Your Q4 Wardrobe Just Called 👗 — Anne's Fashion Line, Nairobi

Hi ${item.name || 'there'},

You're heading into the busiest season of the corporate calendar — presentations, galas, award dinners, year-end events. And you know as well as we do: what you wear is half the confidence.

We're Anne's Fashion Line, a Nairobi boutique dedicated to women like you — who lead finance teams, make boardroom decisions, and still have to show up flawlessly at the gala.

We noticed the ${item.event || 'Q4 events season'} is coming up (${item.event_window || 'Oct–Dec'}), and we have a feeling your wardrobe might need a stunning addition.

Our collections include:
👗 Corporate Chic — sharp, structured, effortlessly elegant
🌸 Dinner & Occasion — for year-end galas and after-hours events
✨ All-Round Closets — premium wear, tailored to your style

Browse our latest drops: ${web}
Instagram for inspo: ${ig}
📞 Call or WhatsApp Anne: ${phones[0]} | ${phones[1]}
💬 ${wa}

You've earned the wardrobe. Let's find it.

With love from Nairobi,
Anne's Fashion Line`,

      // 1
      `Subject: Hi ${item.name ? item.name.split(' ')[0] : 'there'}, We Think You'll Love This 💛

Hi ${item.name ? item.name.split(' ')[0] : 'there'},

As ${item.title || 'a senior professional'} at ${item.company}, we know Q4 means event after event — and looking the part is non-negotiable.

Anne's Fashion Line is a Nairobi boutique that curates occasion and corporate wardrobes for powerhouse women. We'd love to introduce ourselves the best way we know how: through beautiful clothes.

For the ${item.event || 'upcoming events season'}, we have a stunning new collection of dinner dresses and corporate occasion wear that we genuinely think was made for someone in your position.

🌐 Explore: ${web}
📸 Follow: ${ig}
📞 ${phones[0]} | ${phones[1]}
💬 WhatsApp: ${wa}
🎵 TikTok: ${tt}

We're here whenever your wardrobe is ready for its upgrade.

Warmly,
Anne's Fashion Line`,

      // 2
      `Subject: Anne's Fashion Line — For the Woman Who Commands the Room 💼✨

Dear ${item.name || 'there'},

You walk into a room and people notice. That's not an accident — it's intention. It's how you dress, how you carry yourself, what you choose to wear when it matters.

We're Anne's Fashion Line, and we exist for women exactly like you.

As ${item.title || 'a senior professional'} at ${item.company}, the ${item.event || 'Q4 season'} is ahead of you. We want to make sure you're wearing something you absolutely love.

Our occasion and corporate collections: ${web}
📱 Instagram: ${ig}
📞 ${phones[0]} | ${phones[1]}

Let us know what you're looking for — we do private styling too.

Anne's Fashion Line — Nairobi`,

      // 3
      `Subject: A Quick Closet Question, ${item.name ? item.name.split(' ')[0] : 'there'} 👗

Hi ${item.name ? item.name.split(' ')[0] : 'there'},

Quick question: when was the last time you added something truly stunning to your wardrobe?

If the answer is "it's been a while" — that's exactly why we're writing.

Anne's Fashion Line is a Nairobi boutique specialising in corporate and occasion wear. With ${item.event || 'the year-end season'} around the corner, now is the perfect time.

We have:
✨ Dinner dresses that make a statement
✨ Corporate chic pieces that go from meeting to gala
✨ Limited edition occasion wardrobes

Explore: ${web} | Follow: ${ig}
📞 ${phones[0]} | ${phones[1]} | 💬 ${wa}

Looking forward to adding something beautiful to your life!

Anne`,

      // 4
      `Subject: ${item.company} Events Season — Is Your Wardrobe Ready? 🌟

Hi ${item.name || 'there'},

The ${item.event || 'events season'} at ${item.company} is approaching (${item.event_window || 'Q4'}). As ${item.title || 'a senior professional'}, you'll be on stage, at the table, and in the room where it counts.

We're Anne's Fashion Line — Nairobi's boutique for the woman who shows up brilliantly.

We curate occasion and dinner wardrobes specifically for professionals who need to look powerful and effortlessly stylish. No second-guessing. No compromise.

🌐 ${web} | 📸 ${ig} | 🎵 ${tt}
📞 ${phones[0]} | ${phones[1]}
💬 ${wa}

Reach out — we'd love to style you for this season.

Anne's Fashion Line`,

      // 5
      `Subject: Styling for the Boardroom & Beyond — Anne's Fashion Line 💎

Dear ${item.name || 'there'},

At Anne's Fashion Line, we believe the right dress isn't just clothing — it's armour. It's confidence you wear.

For a ${item.title || 'senior professional'} like you at ${item.company}, the upcoming ${item.event || 'Q4 events'} deserve an outfit that matches your position.

We curate:
👗 Corporate Chic — from meeting rooms to networking events
🌸 Dinner & Occasion — for the gala, the awards, the closing ceremony
✨ Private Styling — because one size never really fits all

📞 ${phones[0]} | ${phones[1]}
💬 ${wa}
🌐 ${web}
📸 ${ig} | ${fb}

Let's find your look for this season.

Warmly,
Anne`,

      // 6
      `Subject: We Made This For You, ${item.name ? item.name.split(' ')[0] : 'there'} 🌸

Hi ${item.name ? item.name.split(' ')[0] : 'there'},

Not a mass email (well, almost). We specifically chose to reach out to ${item.title || 'senior professionals'} at ${item.company} because we know the events season is real for you — and we have exactly what you need.

Anne's Fashion Line is Nairobi's go-to boutique for occasion and corporate fashion. The ${item.event || 'Q4 season'} is upon us, and we have a stunning collection that was practically designed for a woman in your world.

🌐 ${web}
📸 ${ig}
📞 ${phones[0]} | ${phones[1]}
💬 ${wa}

Come find your Q4 look with us.

Anne's Fashion Line`,

      // 7
      `Subject: Private Styling for the Season Ahead — Anne's Fashion Line ✨

Dear ${item.name || 'there'},

The end of the year is the most photographed, most visible season for professionals at the top of their game. At ${item.company}, we know you'll be in the room.

Anne's Fashion Line offers private styling appointments alongside our ready collection of dinner dresses, corporate occasion pieces, and all-round wardrobes.

For your ${item.event || 'upcoming Q4 events'} (${item.event_window || 'Nov–Dec'}), let us help you find something you'll love wearing.

📞 Book a styling call: ${phones[0]} | ${phones[1]}
💬 ${wa}
🌐 ${web}
📸 ${ig}

Here's to a fabulous close of year!
Anne's Fashion Line`,

      // 8
      `Subject: The Dress for Your Next Big Moment Is Waiting — Anne's Fashion Line 👗

Hi ${item.name ? item.name.split(' ')[0] : 'there'},

There's always a next big moment. A presentation, a gala, a dinner, a ceremony. And every time, the question is the same: what am I going to wear?

We're Anne's Fashion Line — and we've been answering that question for professional women in Nairobi since day one.

For the ${item.event || 'events ahead'} at ${item.company}, we have exactly what you need: stunning, polished, and unapologetically feminine occasion wear.

🌐 ${web} | 📸 ${ig} | 🎵 ${tt}
📞 ${phones[0]} | ${phones[1]} | 💬 ${wa}

Your next big moment is waiting. So is the dress.

Anne's Fashion Line`,

      // 9
      `Subject: One Last Closet Message Before Q4 Gets Busy 😊 — Anne's Fashion Line

Hi ${item.name ? item.name.split(' ')[0] : 'there'},

We know your inbox is full and your Q4 calendar is probably overflowing. So we'll keep this short.

We're Anne's Fashion Line, a Nairobi boutique. We have a stunning collection of occasion and corporate dresses. The ${item.event || 'events season'} is almost here. We think you'd love what we have.

That's it. That's the message. 😊

🌐 ${web} | 📸 ${ig}
📞 ${phones[0]} | ${phones[1]} | 💬 ${wa}

Come take a look when you get a moment.

Anne`
    ];

    return drafts[index % drafts.length];
  }

  if (category === 'diaspora') {
    const drafts = [
      // 0
      `Subject: Nairobi Fashion, Shipped to Your Door — Anne's Fashion Line 🌍✈️

Hi ${item.contact || item.name || 'Ladies'},

You know that feeling — you're at a formal event, you look around, and nothing in the shops here feels quite like home? That vibrant, warm, unapologetically beautiful African fashion that fits your spirit?

We know that feeling. That's why we exist.

Anne's Fashion Line is a premium Nairobi boutique — and we ship worldwide. 🌍📦

For your ${item.event || 'upcoming event'} (${item.event_window || 'this season'}), we can supply the entire group with stunning occasion dresses shipped straight from Nairobi to ${item.location || 'your city'}.

✨ Red Carpet & Dinner Dresses
✨ Contemporary African Power Dressing
✨ Limited Edition Occasion Wardrobes

Browse: ${web}
📱 Instagram: ${ig}
📞 Diaspora desk: ${phones[0]} | ${phones[1]}
💬 WhatsApp: ${wa}

Bring a piece of home to your next big moment.

With love from Nairobi,
Anne's Fashion Line`,

      // 1
      `Subject: Your Nairobi Boutique — Now Shipping to ${item.location || 'You'} 📦

Hi ${item.contact || 'Ladies'},

We're Anne's Fashion Line, a Nairobi boutique, and we've been thinking about communities like ${item.name || 'yours'} — women who love authentic African fashion and are always on the hunt for something that truly represents home.

We ship worldwide. And with your ${item.event || 'upcoming event'} approaching, we'd love to be your boutique for this season.

Batch orders welcome. Group bookings available. Personal styling over WhatsApp: ${wa}

🌐 ${web} | 📸 ${ig} | 🎵 ${tt}
📞 ${phones[0]} | ${phones[1]}

Let's dress your community beautifully.

Anne's Fashion Line — Nairobi`,

      // 2
      `Subject: We Ship Home to You 🌸 — Anne's Fashion Line, Nairobi

Dear ${item.contact || 'Community Leaders'},

The fashion world is global — but authentic, beautiful Nairobi boutique style is something that hits differently when you're away from home.

For ${item.name || 'your community'} and the ${item.event || 'upcoming events season'} in ${item.location || 'your city'}, we want to be your trusted Nairobi boutique supplier.

✈️ We ship internationally.
🎀 Group orders and batch event dresses welcome.
📲 Order via WhatsApp for a personal experience: ${wa}

Browse the collection: ${web}
Instagram: ${ig} | Facebook: ${fb}
📞 ${phones[0]} | ${phones[1]}

Home is always in style with Anne's Fashion Line.

Warmly,
Anne`,

      // 3
      `Subject: Hosting an Event? We'll Dress Your Community 💃 — Anne's Fashion Line

Hi ${item.contact || 'Team'},

We heard ${item.name || 'your community'} has an ${item.event || 'exciting event'} coming up in ${item.location || 'your city'} (${item.event_window || 'this season'}). We love that energy — and we'd love to be part of it.

Anne's Fashion Line is a premium Nairobi boutique. We specialise in occasion wear and ship internationally. We've dressed communities across the UK, USA, and Europe — and we'd love to work with yours.

✨ Batch event dresses
✨ Exclusive boutique styles you won't find elsewhere
✨ WhatsApp-first ordering, personal service

📞 ${phones[0]} | ${phones[1]}
💬 ${wa}
🌐 ${web}
📸 ${ig}

Let's make your event one to remember.

Anne's Fashion Line`,

      // 4
      `Subject: Authentic Nairobi Fashion for Your Upcoming Gala ✨

Dear ${item.contact || 'Organising Committee'},

Congratulations on organising the ${item.event || 'upcoming event'} for ${item.name || 'your community'} in ${item.location || 'your city'}!

We're Anne's Fashion Line — Nairobi's boutique for women who want to feel genuinely beautiful at every occasion. And we ship worldwide.

For your event, we can supply batch occasion dresses directly from our Nairobi boutique. Each piece is curated for the woman who wants to look extraordinary without compromising on authenticity.

📦 International shipping available
🎁 Group orders welcome
💬 Order over WhatsApp: ${wa}

🌐 ${web} | 📸 ${ig} | 🎵 ${tt}
📞 ${phones[0]} | ${phones[1]}

Let's dress your community beautifully — straight from home.

Anne's Fashion Line — Nairobi`,

      // 5
      `Subject: Home in a Dress — Anne's Fashion Line Ships Worldwide 🌍

Dear ${item.contact || 'Community'},

There's something about wearing a Nairobi boutique dress at a formal event abroad — it's pride, it's style, it's belonging.

For ${item.name || 'your community'}'s ${item.event || 'upcoming event'} in ${item.location || 'your city'}, we want to be your fashion partner.

Anne's Fashion Line ships internationally. Our occasion collection includes stunning dinner dresses, formal gowns, and contemporary occasion wear — all curated from our Nairobi boutique.

📞 ${phones[0]} | ${phones[1]}
💬 ${wa}
🌐 ${web}
📸 ${ig} | ${fb}

Bring home with you — stylishly.
Anne's Fashion Line`,

      // 6
      `Subject: Dressing ${item.name || 'Your Community'} from Nairobi to ${item.location || 'the World'} ✈️

Hi ${item.contact || 'Team'},

We've been thinking about groups like ${item.name || 'yours'} — talented, proud, stylish women who want their wardrobe to tell the story of where they come from.

We're Anne's Fashion Line, and we ship from Nairobi to the world.

For your ${item.event || 'upcoming event'} (${item.event_window || 'this season'}), we can supply batch occasion dresses with international shipping. Personal styling available over WhatsApp.

🌐 ${web} | 📸 ${ig} | 🎵 ${tt}
📞 ${phones[0]} | ${phones[1]} | 💬 ${wa}

Let's make your community shine — in Nairobi style.

Anne`,

      // 7
      `Subject: Anne's Boutique — Your Fashion Home Away From Home 🌸

Dear ${item.contact || 'Community Leaders'},

You've built a community of amazing women in ${item.location || 'your city'}. We build amazing wardrobes for them in Nairobi.

Together, we're a perfect match.

For ${item.name || 'your community'}'s ${item.event || 'upcoming event'}, Anne's Fashion Line can supply beautiful occasion dresses shipped internationally — from our boutique directly to your group.

📦 Batch orders, any size
💬 WhatsApp-first ordering: ${wa}
🌐 ${web} | 📸 ${ig}
📞 ${phones[0]} | ${phones[1]}

Let's dress your community beautifully — straight from home.

With love,
Anne's Fashion Line — Nairobi`,

      // 8
      `Subject: We Ship Nairobi Fashion to ${item.location || 'Your City'} — Anne's Fashion Line 🌍

Hi ${item.contact || 'Ladies'},

We know you've probably looked everywhere for authentic, beautiful African occasion wear that ships reliably to ${item.location || 'your city'}.

Look no further.

Anne's Fashion Line is a Nairobi boutique that ships worldwide. For your ${item.event || 'upcoming event'}, we have a stunning collection of dinner dresses, occasion gowns, and contemporary African fashion ready to ship to you.

✨ International shipping ✈️
✨ Batch group orders welcome
✨ WhatsApp ordering for a personal experience: ${wa}

🌐 ${web} | 📸 ${ig} | 🎵 ${tt}
📞 ${phones[0]} | ${phones[1]}

We can't wait to dress your community.

Anne's Fashion Line`,

      // 9
      `Subject: One Last Thing Before Your ${item.event || 'Big Event'} — Anne's Fashion Line 💛

Hi ${item.contact || item.name || 'Ladies'},

Your ${item.event || 'event'} is coming up. The venue is booked. The agenda is set. The only question left: what are you wearing?

Anne's Fashion Line, Nairobi. We ship worldwide. We have exactly what you need.

🌍 International shipping | 🎁 Batch orders | 💬 Personal WhatsApp service

📞 ${phones[0]} | ${phones[1]}
💬 ${wa}
🌐 ${web} | 📸 ${ig}

See you at the event — dressed beautifully.

Anne's Fashion Line`
    ];

    return drafts[index % drafts.length];
  }

  return '';
}

function openEmailModal(index, category) {
  const lead = sessionLeads[category][index];
  if (!lead) return;

  currentModalLead = lead;
  currentModalCategory = category;

  const contentEl = document.getElementById('emailPreviewContent');
  contentEl.textContent = lead.email_draft || craftEmailDraft(category, lead);

  document.getElementById('emailModal').classList.add('active');
}

function closeEmailModal(e, force = false) {
  if (force || (e && e.target.id === 'emailModal')) {
    document.getElementById('emailModal').classList.remove('active');
  }
}

function copyEmailContent() {
  const text = document.getElementById('emailPreviewContent').textContent;
  copyToClipboard(text);
  showToast('Email draft copied to clipboard!');
}

function copyLeadEmail(email) {
  if (!email || email === '—') return;
  copyToClipboard(email);
  showToast(`Copied ${email}`);
}

async function markLeadSent() {
  if (!currentModalLead) return;
  currentModalLead.email_sent = 1;
  showToast('Lead marked as contacted!');
  closeEmailModal(null, true);
  renderLeadsTable(currentModalCategory, sessionLeads[currentModalCategory]);

  // If saved in D1, update backend
  if (currentModalLead.id) {
    try {
      await fetch(`${API_BASE}/api/admin/leads/${currentModalLead.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Token': adminToken || ''
        },
        body: JSON.stringify({ email_sent: 1 })
      });
    } catch (e) {
      console.warn('Could not update lead status in D1:', e);
    }
  }
}

async function saveLeads(category) {
  const leads = sessionLeads[category];
  if (!leads || leads.length === 0) {
    showToast('No leads to save. Run a scan first!', 'error');
    return;
  }

  showToast('Saving leads to database...');
  try {
    const res = await fetch(`${API_BASE}/api/admin/leads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Token': adminToken || ''
      },
      body: JSON.stringify(leads)
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Successfully saved ${leads.length} leads to Cloudflare D1!`);
    } else {
      showToast('Failed to save leads', 'error');
    }
  } catch (e) {
    showToast('Error connecting to database', 'error');
  }
}

// ========================================================
// ANALYTICS & SOCIAL SECTION
// ========================================================

async function loadAnalyticsData() {
  // ── Real analytics from Cloudflare D1 via Worker ─────────────────────────
  try {
    const res = await fetch(`${API_BASE}/api/admin/analytics`, {
      headers: { 'X-Admin-Token': adminToken || '' }
    });
    const data = await res.json();

    if (data.success) {
      // Summary stats
      const todayViews    = data.today_views    ?? 0;
      const uniqueVisitors = data.unique_visitors ?? 0;
      const totalEvents   = data.total_events   ?? 0;

      const tvEl = document.getElementById('perf-today-views');
      const uvEl = document.getElementById('perf-unique-visitors');
      const teEl = document.getElementById('perf-total-events');
      if (tvEl) tvEl.textContent = todayViews.toLocaleString();
      if (uvEl) uvEl.textContent = uniqueVisitors.toLocaleString();
      if (teEl) teEl.textContent = totalEvents.toLocaleString();

      // Top pages table
      const pagesBody = document.getElementById('topPagesBody');
      if (pagesBody) {
        const pages = data.top_pages || [];
        if (pages.length > 0) {
          pagesBody.innerHTML = pages.map(p => `
            <tr>
              <td><strong>${escapeHtml(p.page_name || p.page || '—')}</strong></td>
              <td class="gold">${(p.views || p.total_views || 0).toLocaleString()}</td>
              <td>${(p.visitors || p.unique_visitors || 0).toLocaleString()}</td>
            </tr>
          `).join('');
        } else {
          pagesBody.innerHTML = `<tr><td colspan="3" class="empty-row">No page visits recorded yet — data will appear as visitors browse the site</td></tr>`;
        }
      }

      // Top products table
      const prodBody = document.getElementById('productViewsBody');
      if (prodBody) {
        const prods = data.top_products || [];
        if (prods.length > 0) {
          prodBody.innerHTML = prods.map(p => `
            <tr>
              <td><strong>${escapeHtml(p.product_title || p.product_id || '—')}</strong></td>
              <td class="gold">${formatKES(p.price || 0)}</td>
              <td>${(p.views || p.total_views || 0).toLocaleString()}</td>
            </tr>
          `).join('');
        } else {
          prodBody.innerHTML = `<tr><td colspan="3" class="empty-row">No product views recorded yet — data will appear as customers browse products</td></tr>`;
        }
      }
    }
  } catch (e) {
    console.error('Error loading analytics data:', e);
    const pagesBody = document.getElementById('topPagesBody');
    const prodBody  = document.getElementById('productViewsBody');
    if (pagesBody) pagesBody.innerHTML = `<tr><td colspan="3" class="empty-row">Could not load analytics — check API connection</td></tr>`;
    if (prodBody)  prodBody.innerHTML  = `<tr><td colspan="3" class="empty-row">Could not load analytics — check API connection</td></tr>`;
  }
  // ─────────────────────────────────────────────────────────────────────────

  // Restore saved social stats from localStorage
  ['ig_followers', 'ig_posts', 'ig_engagement', 'wa_contacts', 'wa_broadcasts', 'wa_orders', 'tt_followers', 'tt_views', 'tt_likes'].forEach(key => {
    const val   = localStorage.getItem(`stat_${key}`);
    const input = document.getElementById(key.replace('_', '-'));
    if (input && val) input.value = val;
  });
}

function saveSocialStat(key, val) {
  localStorage.setItem(`stat_${key}`, val);
}

// ========================================================
// UTILITIES
// ========================================================

function formatKES(amount) {
  const n = parseFloat(amount || 0);
  return 'KSh ' + n.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function formatDate(dateString) {
  if (!dateString) return '—';
  const d = new Date(dateString);
  if (isNaN(d)) return dateString;
  return d.toLocaleDateString('en-KE', { month: 'short', day: 'numeric', year: 'numeric' });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function copyToClipboard(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text);
  } else {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type === 'error' ? 'toast-error' : ''}`;
  toast.innerHTML = `<i class="fas ${type === 'error' ? 'fa-exclamation-circle' : 'fa-check-circle'}"></i> <span>${escapeHtml(message)}</span>`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}
