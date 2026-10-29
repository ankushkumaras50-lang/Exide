// Exide Battery Wholesale & AET Official Partner
// Dedicated ERP Management System Client Application Controller
(function() {
  'use strict';

  class ErpApp {
    constructor() {
      this.tokenKey = 'bm_exide_admin_token';
      this.sessionKey = 'bm_exide_admin_session';
      this.currentUser = null;
      this.activeRoute = 'dashboard';
      this.productsData = [];
      this.inventoryData = [];
      this.metricsData = null;
      this.currentEditingImages = [];
      this.currentTheme = 'slate';

      this.init();
    }

    async init() {
      this.bindGlobalEvents();
      this.setTheme(localStorage.getItem('bm_exide_erp_theme') || 'slate');
      const isAuthenticated = await this.verifySession();
      if (isAuthenticated) {
        this.renderAppShell();
        this.handleRouteFromUrl();
      } else {
        this.renderLoginScreen();
      }
    }

    bindGlobalEvents() {
      window.addEventListener('popstate', () => this.handleRouteFromUrl());
    }

    setTheme(themeName) {
      this.currentTheme = themeName || 'slate';
      document.documentElement.setAttribute('data-theme', this.currentTheme);
      localStorage.setItem('bm_exide_erp_theme', this.currentTheme);
      const sel = document.getElementById('erp-theme-select');
      if (sel) sel.value = this.currentTheme;
    }

    // ------------------------------------------------------------------------
    // AUTHENTICATION & SESSION VERIFICATION
    // ------------------------------------------------------------------------
    async verifySession() {
      const token = localStorage.getItem(this.tokenKey);
      if (!token) return false;

      try {
        const res = await fetch('/api/auth/admin-verify', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success && data.admin) {
          this.currentUser = data.admin;
          return true;
        }
      } catch (err) {
        console.warn('Session verification error:', err);
      }

      this.logout(false);
      return false;
    }

    async handleLogin(username, password) {
      const errBox = document.getElementById('erp-login-error');
      const submitBtn = document.getElementById('erp-login-btn');
      if (errBox) errBox.style.display = 'none';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Verifying credentials...';
      }

      try {
        const res = await fetch('/api/auth/admin-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        const data = await res.json().catch(() => ({}));

        if (res.ok && data.success && data.token) {
          localStorage.setItem(this.tokenKey, data.token);
          localStorage.setItem(this.sessionKey, JSON.stringify(data.admin));
          this.currentUser = data.admin;
          this.renderAppShell();
          this.navigate('dashboard');
        } else {
          if (errBox) {
            errBox.textContent = data.message || 'Invalid administrator or staff credentials.';
            errBox.style.display = 'block';
          }
        }
      } catch (err) {
        if (errBox) {
          errBox.textContent = 'Connection error. Please check your network and retry.';
          errBox.style.display = 'block';
        }
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Sign In to ERP';
        }
      }
    }

    logout(redirect = true) {
      localStorage.removeItem(this.tokenKey);
      localStorage.removeItem(this.sessionKey);
      this.currentUser = null;
      if (redirect) {
        this.renderLoginScreen();
      }
    }

    // ------------------------------------------------------------------------
    // ROUTING & NAVIGATION
    // ------------------------------------------------------------------------
    handleRouteFromUrl() {
      const path = window.location.pathname.toLowerCase();
      let route = 'dashboard';
      if (path.includes('/products')) route = 'products';
      else if (path.includes('/inventory')) route = 'inventory';
      else if (path.includes('/purchases')) route = 'purchases';
      else if (path.includes('/sales')) route = 'sales';
      else if (path.includes('/customers')) route = 'customers';
      else if (path.includes('/suppliers')) route = 'suppliers';
      else if (path.includes('/reports')) route = 'reports';
      else if (path.includes('/settings')) route = 'settings';
      else if (path.includes('/users')) route = 'users';

      this.navigate(route, false);
    }

    navigate(route, updateHistory = true) {
      this.activeRoute = route;
      if (updateHistory) {
        window.history.pushState({}, '', `/erp/${route}`);
      }

      // Update sidebar nav highlighting
      document.querySelectorAll('.erp-nav-item').forEach(item => {
        if (item.getAttribute('data-route') === route) {
          item.classList.add('active');
        } else {
          item.classList.remove('active');
        }
      });

      // Update Page Title
      const titleEl = document.getElementById('erp-page-title');
      if (titleEl) {
        const titles = {
          dashboard: 'Executive Dashboard & Live Store Sync',
          products: 'Product Catalogue & Pricing Management',
          inventory: 'Warehouse Stock Balances & Movement Ledger',
          purchases: 'Purchase Orders & Inward Goods (GRN)',
          sales: 'Sales Orders, Quotations & Tax Invoicing',
          customers: 'Commercial Customer Accounts',
          suppliers: 'Authorized Battery Suppliers Directory',
          reports: 'Financial Reports & Profitability Ledger',
          settings: 'Store Configuration & IRD VAT Settings',
          users: 'Staff Accounts & Role-Based Access Control'
        };
        titleEl.textContent = titles[route] || 'Exide Wholesale ERP';
      }

      this.renderCurrentView();

      // Close mobile sidebar if open
      const sidebar = document.getElementById('erp-sidebar');
      if (sidebar) sidebar.classList.remove('open');
    }

    // ------------------------------------------------------------------------
    // VIEW RENDERING
    // ------------------------------------------------------------------------
    renderCurrentView() {
      const container = document.getElementById('erp-main-view');
      if (!container) return;

      container.innerHTML = '<div style="padding:2rem; text-align:center; color:#64748B;">Loading ERP module data...</div>';

      switch (this.activeRoute) {
        case 'dashboard':
          this.renderDashboardView(container);
          break;
        case 'orders':
          this.renderOrdersView(container);
          break;
        case 'products':
          this.renderProductsView(container);
          break;
        case 'inventory':
          this.renderInventoryView(container);
          break;
        case 'purchases':
          this.renderPurchasesView(container);
          break;
        case 'sales':
          this.renderSalesView(container);
          break;
        case 'customers':
          this.renderCustomersView(container);
          break;
        case 'suppliers':
          this.renderSuppliersView(container);
          break;
        case 'reports':
          this.renderReportsView(container);
          break;
        case 'settings':
          this.renderSettingsView(container);
          break;
        case 'users':
          this.renderUsersView(container);
          break;
        default:
          this.renderDashboardView(container);
      }
    }

    // ------------------------------------------------------------------------
    // 1. DASHBOARD VIEW
    // ------------------------------------------------------------------------
    async renderDashboardView(container) {
      try {
        const token = localStorage.getItem(this.tokenKey);
        const res = await fetch('/api/erp/metrics', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (!data.success) {
          container.innerHTML = `<div class="erp-card"><div class="erp-card-body" style="color:#EF4444;">${data.message || 'Error loading dashboard metrics.'}</div></div>`;
          return;
        }

        this.metricsData = data;
        const inv = data.inventory || {};
        const sales = data.sales || {};
        const profit = data.profitability || null;
        const role = data.role;

        container.innerHTML = `
          <!-- KPI Metrics Row -->
          <div class="erp-kpi-grid">
            <div class="erp-kpi-card">
              <div class="erp-kpi-label">Total Unique SKUs</div>
              <div class="erp-kpi-val blue">${inv.totalSKUs || 0}</div>
              <div class="erp-kpi-sub">Commercial Catalog</div>
            </div>
            <div class="erp-kpi-card">
              <div class="erp-kpi-label">Stock Units on Hand</div>
              <div class="erp-kpi-val">${(inv.totalUnitsInStock || 0).toLocaleString()}</div>
              <div class="erp-kpi-sub">Central Depot & Butwal</div>
            </div>
            <div class="erp-kpi-card">
              <div class="erp-kpi-label">Inventory Valuation (Cost)</div>
              <div class="erp-kpi-val green">${inv.costValuationNPR !== null ? 'NPR ' + inv.costValuationNPR.toLocaleString() : '<span style="font-size:0.9rem; color:#64748B;">Restricted</span>'}</div>
              <div class="erp-kpi-sub">${inv.costValuationNPR !== null ? 'At Landed Purchase Cost' : 'Hidden for ' + role}</div>
            </div>
            <div class="erp-kpi-card">
              <div class="erp-kpi-label">Retail Catalogue Value</div>
              <div class="erp-kpi-val">NPR ${(inv.retailValuationNPR || 0).toLocaleString()}</div>
              <div class="erp-kpi-sub">At Official Selling Price</div>
            </div>
            <div class="erp-kpi-card">
              <div class="erp-kpi-label">Today's Sales (NPR)</div>
              <div class="erp-kpi-val green">NPR ${(sales.dailySalesNPR || 0).toLocaleString()}</div>
              <div class="erp-kpi-sub">Kathmandu & Nationwide</div>
            </div>
            <div class="erp-kpi-card">
              <div class="erp-kpi-label">Monthly Gross Revenue</div>
              <div class="erp-kpi-val">NPR ${(sales.monthlySalesNPR || 0).toLocaleString()}</div>
              <div class="erp-kpi-sub">${new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })}</div>
            </div>
            <div class="erp-kpi-card">
              <div class="erp-kpi-label">Estimated Gross Profit</div>
              <div class="erp-kpi-val ${profit ? 'green' : ''}">${profit ? 'NPR ' + profit.grossProfitEstimateNPR.toLocaleString() : '<span style="font-size:0.9rem; color:#64748B;">Restricted</span>'}</div>
              <div class="erp-kpi-sub">${profit ? 'Margin: ' + profit.grossMarginPercentage + '%' : 'Accountant / SuperAdmin only'}</div>
            </div>
            <div class="erp-kpi-card">
              <div class="erp-kpi-label">Low Stock Alerts</div>
              <div class="erp-kpi-val red">${inv.lowStockCount || 0}</div>
              <div class="erp-kpi-sub">Below Reorder Threshold</div>
            </div>
          </div>

          <!-- Quick Action Bar -->
          <div class="erp-card" style="margin-bottom:1.5rem;">
            <div class="erp-card-body" style="padding:1rem 1.5rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.75rem;">
              <div style="font-weight:700; color:#0F172A;">
                ⚡ Fast ERP Operations:
              </div>
              <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
                <button class="erp-btn erp-btn-primary" onclick="window.erpApp.openProductModal()">+ Add New SKU</button>
                <button class="erp-btn erp-btn-secondary" onclick="window.erpApp.openStockAdjustModal()">📦 Adjust Stock</button>
                <button class="erp-btn erp-btn-secondary" onclick="window.erpApp.navigate('inventory')">📋 Stock Ledger</button>
                <button class="erp-btn erp-btn-secondary" onclick="window.open('/', '_blank')">🌐 View Storefront</button>
              </div>
            </div>
          </div>

          <!-- Low Stock Warnings & Recent Activity Grid -->
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(400px, 1fr)); gap:1.5rem;">
            <!-- Low Stock Table -->
            <div class="erp-card">
              <div class="erp-card-header">
                <span class="erp-card-title">⚠️ Priority Reorder & Low Stock Alerts</span>
                <span class="erp-badge erp-badge-red">${inv.lowStockAlerts ? inv.lowStockAlerts.length : 0} SKUs</span>
              </div>
              <div class="erp-table-responsive">
                <table class="erp-table">
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Product Title</th>
                      <th>Brand</th>
                      <th style="text-align:center;">On Hand</th>
                      <th style="text-align:center;">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${inv.lowStockAlerts && inv.lowStockAlerts.length > 0 ? inv.lowStockAlerts.map(it => `
                      <tr>
                        <td><strong>${it.sku}</strong></td>
                        <td>${it.name}</td>
                        <td>${it.brand}</td>
                        <td style="text-align:center;"><span class="erp-badge ${it.currentStock === 0 ? 'erp-badge-red' : 'erp-badge-yellow'}">${it.currentStock} units</span></td>
                        <td style="text-align:center;">
                          <button class="erp-btn erp-btn-secondary" style="height:28px; padding:0 0.5rem; font-size:0.75rem;" onclick="window.erpApp.openStockAdjustModal('${it.id}', '${it.sku}')">Restock</button>
                        </td>
                      </tr>
                    `).join('') : '<tr><td colspan="5" style="text-align:center; color:#10B981; padding:2rem;">✅ All SKUs currently above safety thresholds.</td></tr>'}
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Recent Employee & Ledger Activity -->
            <div class="erp-card">
              <div class="erp-card-header">
                <span class="erp-card-title">📋 Recent System & Audit Activity</span>
                <span class="erp-badge erp-badge-blue">Live Stream</span>
              </div>
              <div class="erp-table-responsive">
                <table class="erp-table">
                  <thead>
                    <tr>
                      <th>Action</th>
                      <th>Entity</th>
                      <th>Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${data.recentActivity && data.recentActivity.length > 0 ? data.recentActivity.map(act => `
                      <tr>
                        <td><span class="erp-badge erp-badge-blue">${act.action}</span></td>
                        <td>${act.entity}</td>
                        <td style="font-size:0.75rem; color:#64748B;">${new Date(act.timestamp).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                      </tr>
                    `).join('') : '<tr><td colspan="3" style="text-align:center; color:#64748B; padding:2rem;">No recent activity logged.</td></tr>'}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        `;
      } catch (e) {
        container.innerHTML = `<div class="erp-card"><div class="erp-card-body" style="color:#EF4444;">Failed to load ERP dashboard metrics: ${e.message}</div></div>`;
      }
    }

    // ------------------------------------------------------------------------
    // 2. PRODUCTS VIEW
    // ------------------------------------------------------------------------
    async renderProductsView(container) {
      try {
        const token = localStorage.getItem(this.tokenKey);
        const res = await fetch('/api/erp/products', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (!data.success) {
          container.innerHTML = `<div class="erp-card"><div class="erp-card-body" style="color:#EF4444;">${data.message}</div></div>`;
          return;
        }

        this.productsData = data.products || [];
        const canViewCost = !!data.canViewCostPrice;

        container.innerHTML = `
          <div class="erp-card">
            <div class="erp-card-header">
              <div>
                <span class="erp-card-title">Commercial Product Catalogue (${data.count} Active SKUs)</span>
                <div style="font-size:0.8rem; color:#64748B; margin-top:2px;">Exide Inverter, Automotive, Solar Panels & Online UPS</div>
              </div>
              <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
                <button class="erp-btn erp-btn-secondary" onclick="window.erpApp.exportProductsCSV()">Export CSV</button>
                <button class="erp-btn erp-btn-primary" onclick="window.erpApp.openProductModal()">+ Add New SKU</button>
              </div>
            </div>
            <div class="erp-card-body">
              <div class="erp-controls-row">
                <div class="erp-filter-group">
                  <input type="text" id="erp-prod-search" class="erp-input" placeholder="Search SKU, Name, or Brand..." style="width:260px;" oninput="window.erpApp.filterProductsTable()">
                  <select id="erp-prod-brand-filter" class="erp-select" onchange="window.erpApp.filterProductsTable()">
                    <option value="all">All Brands</option>
                    <option value="Exide">Exide</option>
                    <option value="Smarten">Smarten</option>
                    <option value="Livfast">Livfast</option>
                    <option value="SF Sonic">SF Sonic</option>
                    <option value="Eastman">Eastman</option>
                    <option value="Genus">Genus</option>
                  </select>
                  <select id="erp-prod-status-filter" class="erp-select" onchange="window.erpApp.filterProductsTable()">
                    <option value="all">All Stock Levels</option>
                    <option value="in_stock">In Stock Only</option>
                    <option value="low_stock">Low Stock Alerts</option>
                    <option value="out_of_stock">Out of Stock</option>
                  </select>
                </div>
                <div style="font-size:0.85rem; color:#64748B;">
                  ${canViewCost ? '🔒 Landed purchase cost visible' : '🛡️ Landed purchase cost restricted for your role'}
                </div>
              </div>

              <div class="erp-table-responsive">
                <table class="erp-table">
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Product Title & Specs</th>
                      <th>Brand</th>
                      <th>Retail (NPR)</th>
                      ${canViewCost ? '<th>Cost (NPR)</th><th>Margin</th>' : ''}
                      <th style="text-align:center;">Stock Qty</th>
                      <th>Status</th>
                      <th style="text-align:center;">Actions</th>
                    </tr>
                  </thead>
                  <tbody id="erp-products-tbody">
                    ${this.renderProductsTableRows(this.productsData, canViewCost)}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        `;
      } catch (e) {
        container.innerHTML = `<div class="erp-card"><div class="erp-card-body" style="color:#EF4444;">Error: ${e.message}</div></div>`;
      }
    }

    renderProductsTableRows(products, canViewCost) {
      if (!products || products.length === 0) {
        return `<tr><td colspan="${canViewCost ? 8 : 6}" style="text-align:center; padding:2rem; color:#64748B;">No matching product SKUs found.</td></tr>`;
      }

      return products.map(p => {
        const stock = parseInt(p.stock, 10) || 0;
        const minStock = parseInt(p.minStock, 10) || 5;
        const retail = parseFloat(p.price || 0);
        const cost = parseFloat(p.costPrice || 0);
        const marginPct = retail > 0 && cost > 0 ? (((retail - cost) / retail) * 100).toFixed(1) : 0;

        let statusBadge = `<span class="erp-badge erp-badge-green">In Stock</span>`;
        if (stock === 0) statusBadge = `<span class="erp-badge erp-badge-red">Out of Stock</span>`;
        else if (stock <= minStock) statusBadge = `<span class="erp-badge erp-badge-yellow">Low Stock (${stock})</span>`;

        return `
          <tr>
            <td><strong>${p.sku}</strong></td>
            <td>
              <div style="font-weight:700; color:#0F172A;">${p.name}</div>
              <div style="font-size:0.75rem; color:#64748B;">${p.capacity || ''} • ${p.warranty || '36M Warranty'}</div>
            </td>
            <td><span class="erp-badge erp-badge-blue">${p.brand}</span></td>
            <td><strong>NPR ${retail.toLocaleString()}</strong></td>
            ${canViewCost ? `
              <td>NPR ${cost.toLocaleString()}</td>
              <td><span style="color:${marginPct > 15 ? '#10B981' : '#F59E0B'}; font-weight:700;">${marginPct}%</span></td>
            ` : ''}
            <td style="text-align:center; font-weight:800; font-size:1rem; color:#0F172A;">${stock}</td>
            <td>${statusBadge}</td>
            <td style="text-align:center;">
              <div style="display:flex; gap:0.35rem; justify-content:center;">
                <button class="erp-btn erp-btn-secondary" style="height:28px; padding:0 0.55rem; font-size:0.75rem;" onclick="window.erpApp.openProductModal('${p.id}')">Edit</button>
                <button class="erp-btn erp-btn-secondary" style="height:28px; padding:0 0.55rem; font-size:0.75rem;" onclick="window.erpApp.openStockAdjustModal('${p.id}', '${p.sku}')">Stock</button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }

    filterProductsTable() {
      const search = (document.getElementById('erp-prod-search')?.value || '').toLowerCase().trim();
      const brand = document.getElementById('erp-prod-brand-filter')?.value || 'all';
      const status = document.getElementById('erp-prod-status-filter')?.value || 'all';

      let filtered = this.productsData;

      if (brand !== 'all') {
        filtered = filtered.filter(p => p.brand && p.brand.toLowerCase() === brand.toLowerCase());
      }

      if (status !== 'all') {
        if (status === 'in_stock') filtered = filtered.filter(p => (p.stock || 0) > (p.minStock || 5));
        else if (status === 'low_stock') filtered = filtered.filter(p => (p.stock || 0) <= (p.minStock || 5) && (p.stock || 0) > 0);
        else if (status === 'out_of_stock') filtered = filtered.filter(p => (p.stock || 0) === 0);
      }

      if (search) {
        filtered = filtered.filter(p =>
          (p.sku && p.sku.toLowerCase().includes(search)) ||
          (p.name && p.name.toLowerCase().includes(search)) ||
          (p.brand && p.brand.toLowerCase().includes(search))
        );
      }

      const tbody = document.getElementById('erp-products-tbody');
      if (tbody) {
        const canViewCost = this.metricsData?.inventory?.costValuationNPR !== null;
        tbody.innerHTML = this.renderProductsTableRows(filtered, canViewCost);
      }
    }

    // ------------------------------------------------------------------------
    // 3. INVENTORY & STOCK LEDGER VIEW
    // ------------------------------------------------------------------------
    async renderInventoryView(container) {
      try {
        const token = localStorage.getItem(this.tokenKey);
        const res = await fetch('/api/erp/inventory', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (!data.success) {
          container.innerHTML = `<div class="erp-card"><div class="erp-card-body" style="color:#EF4444;">${data.message}</div></div>`;
          return;
        }

        this.inventoryData = data.balances || [];

        container.innerHTML = `
          <div class="erp-card">
            <div class="erp-card-header">
              <div>
                <span class="erp-card-title">Live Warehouse Stock Balances & Projections</span>
                <div style="font-size:0.8rem; color:#64748B;">Central Depot (Bijulibazar, Kathmandu) • Immutable Stock Ledger Model</div>
              </div>
              <div style="display:flex; gap:0.5rem;">
                <button class="erp-btn erp-btn-secondary" onclick="window.erpApp.viewMovementLedger()">📜 View Ledger History</button>
                <button class="erp-btn erp-btn-primary" onclick="window.erpApp.openStockAdjustModal()">+ Inward Consignment / Adjust</button>
              </div>
            </div>
            <div class="erp-card-body">
              <div class="erp-table-responsive">
                <table class="erp-table">
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Product Title & Capacity</th>
                      <th>Warehouse</th>
                      <th style="text-align:center;">Physical Stock</th>
                      <th style="text-align:center;">Reserved</th>
                      <th style="text-align:center;">Available for Sale</th>
                      <th>Threshold</th>
                      <th>Status</th>
                      <th style="text-align:center;">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${this.inventoryData.map(b => `
                      <tr>
                        <td><strong>${b.sku}</strong></td>
                        <td>
                          <div style="font-weight:700; color:#0F172A;">${b.name}</div>
                          <div style="font-size:0.75rem; color:#64748B;">${b.brand} • ${b.capacity || ''}</div>
                        </td>
                        <td>${b.warehouse}</td>
                        <td style="text-align:center; font-weight:800; font-size:1.05rem;">${b.stockOnHand}</td>
                        <td style="text-align:center; color:#64748B;">${b.stockReserved}</td>
                        <td style="text-align:center; font-weight:800; color:#10B981; font-size:1.05rem;">${b.availableStock}</td>
                        <td>${b.reorderThreshold}</td>
                        <td><span class="erp-badge ${b.status === 'IN_STOCK' ? 'erp-badge-green' : b.status === 'LOW_STOCK' ? 'erp-badge-yellow' : 'erp-badge-red'}">${b.status}</span></td>
                        <td style="text-align:center;">
                          <button class="erp-btn erp-btn-secondary" style="height:28px; padding:0 0.65rem; font-size:0.75rem;" onclick="window.erpApp.openStockAdjustModal('${b.productId}', '${b.sku}')">Adjust</button>
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        `;
      } catch (e) {
        container.innerHTML = `<div class="erp-card"><div class="erp-card-body" style="color:#EF4444;">Error: ${e.message}</div></div>`;
      }
    }

    async viewMovementLedger() {
      const token = localStorage.getItem(this.tokenKey);
      try {
        const res = await fetch('/api/erp/inventory?view=ledger', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        const movements = data.movements || [];

        const modalBody = document.getElementById('erp-modal-body');
        const modalTitle = document.getElementById('erp-modal-title');
        if (modalTitle) modalTitle.textContent = 'Immutable Stock Ledger Movement History';
        if (modalBody) {
          modalBody.innerHTML = `
            <div style="max-height:60vh; overflow-y:auto;">
              <table class="erp-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Action</th>
                    <th>Reference</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  ${movements.map(m => `
                    <tr>
                      <td style="font-size:0.75rem; color:#64748B;">${new Date(m.timestamp).toLocaleString('en-GB')}</td>
                      <td><span class="erp-badge erp-badge-blue">${m.action}</span></td>
                      <td>${m.newState?.referenceId || m.entityId || '-'}</td>
                      <td>${m.newState?.reason || m.action} (Qty: ${m.newState?.quantity || '-'})</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `;
          document.getElementById('erp-modal-overlay')?.classList.add('open');
        }
      } catch(e) {
        alert('Failed to load stock movements: ' + e.message);
      }
    }

    // ------------------------------------------------------------------------
    // 4. MODALS & FORMS (Product SKU & Stock Adjustment)
    // ------------------------------------------------------------------------
    openProductModal(productId = null) {
      const prod = productId ? this.productsData.find(p => p.id === productId) : null;
      const modal = document.getElementById('erp-modal-overlay');
      const modalBox = modal ? modal.querySelector('.erp-modal') : null;
      const title = document.getElementById('erp-modal-title');
      const body = document.getElementById('erp-modal-body');
      if (!modal || !title || !body) return;

      if (modalBox) {
        modalBox.classList.add('erp-modal-xl');
      }

      title.innerHTML = `
        <div style="display:flex; align-items:center; gap:0.65rem;">
          <span style="font-size:1.35rem;">${prod ? '✏️' : '📦'}</span>
          <div>
            <div style="font-size:1.15rem; font-weight:800; color:var(--erp-dark);">
              ${prod ? `Edit Product SKU: ${prod.sku}` : 'Add New Battery / Inverter SKU'}
            </div>
            <div style="font-size:0.75rem; color:var(--erp-muted); font-weight:500;">
              Configure detailed specifications, multi-image gallery, rich description, and Nepal power warranty perks.
            </div>
          </div>
        </div>
      `;

      // Initialize editing images array
      if (prod && Array.isArray(prod.images) && prod.images.length > 0) {
        this.currentEditingImages = [...prod.images];
      } else if (prod && prod.image) {
        this.currentEditingImages = [prod.image];
      } else {
        this.currentEditingImages = [];
      }

      // Read existing specs & services
      const pSpecs = (prod && typeof prod.specs === 'object' && prod.specs) ? prod.specs : {};
      const pServices = (prod && Array.isArray(prod.complimentaryServices)) ? prod.complimentaryServices : [
        'Free Battery Terminal Greasing (Prevents sulfur buildup)',
        'Free Inverter Charging Voltage Calibration Check',
        'Free Official Stamped Warranty Card Verification'
      ];

      const pFeatures = (prod && Array.isArray(prod.features)) ? prod.features.join('\n') : '';
      const pVehicles = (prod && Array.isArray(prod.compatibleVehicles))
        ? prod.compatibleVehicles.join(', ')
        : (pSpecs['Compatible Vehicles'] || '');

      body.innerHTML = `
        <form id="erp-product-form" onsubmit="event.preventDefault(); window.erpApp.submitProductForm('${prod ? prod.id : ''}');">
          <!-- Modular Tabs Navigation Strip -->
          <div class="erp-sku-tabs">
            <button type="button" class="erp-sku-tab-btn active" data-tab="basic" onclick="window.erpApp.switchSkuTab('basic')">
              📌 1. Basic Info
            </button>
            <button type="button" class="erp-sku-tab-btn" data-tab="pricing" onclick="window.erpApp.switchSkuTab('pricing')">
              💰 2. Pricing & Commercials
            </button>
            <button type="button" class="erp-sku-tab-btn" data-tab="specs" onclick="window.erpApp.switchSkuTab('specs')">
              ⚙️ 3. Technical Specs
            </button>
            <button type="button" class="erp-sku-tab-btn" data-tab="warranty" onclick="window.erpApp.switchSkuTab('warranty')">
              🛡️ 4. Warranty & Services
            </button>
            <button type="button" class="erp-sku-tab-btn" data-tab="gallery" onclick="window.erpApp.switchSkuTab('gallery')">
              🖼️ 5. Multi-Images & Media
            </button>
            <button type="button" class="erp-sku-tab-btn" data-tab="description" onclick="window.erpApp.switchSkuTab('description')">
              📝 6. Rich Description
            </button>
          </div>

          <!-- TAB 1: BASIC INFO & CLASSIFICATION -->
          <div class="erp-sku-tab-pane active" id="erp-tab-basic">
            <div class="erp-form-section-card">
              <div class="erp-form-section-title">🏷️ Core Identification & Brand</div>
              <div class="erp-form-section-sub">Required identifiers to list this battery in the wholesale master catalog.</div>

              <div class="erp-form-grid" style="margin-bottom:1rem;">
                <div class="erp-form-group">
                  <label class="erp-form-label">SKU Code * (Unique Identification)</label>
                  <input type="text" id="erp-sku-input" class="erp-input" style="width:100%; text-transform:uppercase; font-weight:800; color:#003399;" value="${prod ? prod.sku : ''}" placeholder="e.g. EX-IMTT1500" required ${prod ? 'readonly style="background:var(--erp-surface-alt);"' : ''}>
                  <small style="color:var(--erp-muted); font-size:0.74rem;">Unique barcode/SKU registered in inventory.</small>
                </div>
                <div class="erp-form-group">
                  <label class="erp-form-label">Manufacturer Brand *</label>
                  <select id="erp-brand-input" class="erp-select" style="width:100%; font-weight:700;">
                    <option value="Exide" ${prod && prod.brand === 'Exide' ? 'selected' : ''}>Exide (AET Official Partner)</option>
                    <option value="Smarten" ${prod && prod.brand === 'Smarten' ? 'selected' : ''}>Smarten Power Systems</option>
                    <option value="Livfast" ${prod && prod.brand === 'Livfast' ? 'selected' : ''}>Livfast Fast Charge</option>
                    <option value="SF Sonic" ${prod && prod.brand === 'SF Sonic' ? 'selected' : ''}>SF Sonic Power</option>
                    <option value="Eastman" ${prod && prod.brand === 'Eastman' ? 'selected' : ''}>Eastman Heavy Duty</option>
                    <option value="Genus" ${prod && prod.brand === 'Genus' ? 'selected' : ''}>Genus Inverter</option>
                    <option value="Luminous" ${prod && prod.brand === 'Luminous' ? 'selected' : ''}>Luminous Power Technologies</option>
                    <option value="Okaya" ${prod && prod.brand === 'Okaya' ? 'selected' : ''}>Okaya Power</option>
                    <option value="Amaron" ${prod && prod.brand === 'Amaron' ? 'selected' : ''}>Amaron Hi-Life</option>
                  </select>
                </div>
              </div>

              <div class="erp-form-group" style="margin-bottom:1rem;">
                <label class="erp-form-label">Full Product Name / Title *</label>
                <input type="text" id="erp-name-input" class="erp-input" style="width:100%; font-weight:700;" value="${prod ? prod.name : ''}" placeholder="e.g. Exide 150 Ah Invamaster Tall Tubular Inverter Battery - IMTT1500" required>
              </div>

              <div class="erp-form-grid">
                <div class="erp-form-group">
                  <label class="erp-form-label">Primary Product Category</label>
                  <select id="erp-category-input" class="erp-select" style="width:100%;">
                    <option value="inverter-battery" ${prod && prod.categories && prod.categories.includes('inverter-battery') ? 'selected' : ''}>Inverter Battery (Home/Office)</option>
                    <option value="automotive-car" ${prod && prod.categories && prod.categories.includes('automotive-car') ? 'selected' : ''}>Automotive Car & SUV Battery</option>
                    <option value="motorcycle-bike" ${prod && prod.categories && prod.categories.includes('motorcycle-bike') ? 'selected' : ''}>Motorcycle & Scooter Battery</option>
                    <option value="solar-tubular" ${prod && prod.categories && prod.categories.includes('solar-tubular') ? 'selected' : ''}>Solar Deep Cycle Tubular</option>
                    <option value="commercial-heavy" ${prod && prod.categories && prod.categories.includes('commercial-heavy') ? 'selected' : ''}>Commercial Heavy Duty (Truck/Bus)</option>
                    <option value="inverter-ups" ${prod && prod.categories && prod.categories.includes('inverter-ups') ? 'selected' : ''}>Home Inverter & Pure Sinewave UPS</option>
                    <option value="solar-panel" ${prod && prod.categories && prod.categories.includes('solar-panel') ? 'selected' : ''}>Solar Photovoltaic Panel</option>
                    <option value="ev-rickshaw" ${prod && prod.categories && prod.categories.includes('ev-rickshaw') ? 'selected' : ''}>E-Rickshaw & EV Traction Battery</option>
                  </select>
                </div>
                <div class="erp-form-group">
                  <label class="erp-form-label">Application Sub-Type</label>
                  <input type="text" id="erp-app-type-input" class="erp-input" style="width:100%;" value="${prod ? (prod.specs?.Application || '') : ''}" placeholder="e.g. Residential UPS / Heavy Commercial">
                </div>
              </div>

              <div style="display:flex; align-items:center; justify-content:space-between; margin-top:0.75rem; padding:0.75rem 1rem; background:var(--erp-surface-alt); border-radius:8px; border:1px solid var(--erp-border);">
                <div>
                  <strong style="font-size:0.86rem; color:var(--erp-dark); display:block;">Storefront Visibility & Highlights</strong>
                  <span style="font-size:0.75rem; color:var(--erp-muted);">Control whether this SKU is publicly orderable by consumers.</span>
                </div>
                <div style="display:flex; gap:1.25rem; align-items:center;">
                  <label style="display:flex; align-items:center; gap:0.45rem; cursor:pointer; font-size:0.82rem; font-weight:700;">
                    <input type="checkbox" id="erp-featured-input" ${prod && prod.featured ? 'checked' : ''} style="width:16px; height:16px; accent-color:#ED1C24;">
                    <span>★ Featured in Hot Sales</span>
                  </label>
                  <select id="erp-active-input" class="erp-select" style="height:32px; font-size:0.78rem; font-weight:700;">
                    <option value="active" ${!prod || prod.isActive !== false ? 'selected' : ''}>🟢 Active (Public)</option>
                    <option value="inactive" ${prod && prod.isActive === false ? 'selected' : ''}>🔴 Inactive (Draft)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <!-- TAB 2: PRICING, TAX & COMMERCIALS -->
          <div class="erp-sku-tab-pane" id="erp-tab-pricing">
            <div class="erp-form-section-card">
              <div class="erp-form-section-title">💰 Price Setup, IRD VAT & Trade-In Rebates</div>
              <div class="erp-form-section-sub">All currency calculations are grounded in Nepalese Rupees (NPR / रू).</div>

              <div class="erp-form-grid" style="margin-bottom:1rem;">
                <div class="erp-form-group">
                  <label class="erp-form-label">Retail Selling Price (NPR) *</label>
                  <div style="display:flex; align-items:center; gap:0.5rem;">
                    <span style="font-weight:800; font-size:1.05rem; color:var(--erp-primary);">NPR</span>
                    <input type="number" id="erp-price-input" class="erp-input" style="width:100%; font-size:1.1rem; font-weight:800; color:var(--erp-primary);" value="${prod ? prod.price : ''}" placeholder="34000" min="0" required>
                  </div>
                  <small style="color:var(--erp-muted); font-size:0.74rem;">The actual customer invoice price on storefront.</small>
                </div>
                <div class="erp-form-group">
                  <label class="erp-form-label">MRP (Maximum Retail Price in NPR)</label>
                  <div style="display:flex; align-items:center; gap:0.5rem;">
                    <span style="font-weight:700; color:var(--erp-muted);">NPR</span>
                    <input type="number" id="erp-mrp-input" class="erp-input" style="width:100%;" value="${prod ? (prod.originalPrice || prod.mrp || '') : ''}" placeholder="36000" min="0">
                  </div>
                  <small style="color:var(--erp-muted); font-size:0.74rem;">Displays strike-through discount comparison on card.</small>
                </div>
              </div>

              <div class="erp-form-grid" style="margin-bottom:1rem;">
                <div class="erp-form-group">
                  <label class="erp-form-label">Landed Cost Price (NPR)</label>
                  <div style="display:flex; align-items:center; gap:0.5rem;">
                    <span style="font-weight:700; color:var(--erp-muted);">NPR</span>
                    <input type="number" id="erp-cost-input" class="erp-input" style="width:100%;" value="${prod ? (prod.costPrice || '') : ''}" placeholder="27500" min="0">
                  </div>
                  <small style="color:var(--erp-muted); font-size:0.74rem;">Confidential inward purchase price for gross profit calculations.</small>
                </div>
                <div class="erp-form-group">
                  <label class="erp-form-label">Wholesale / Dealer Price (NPR)</label>
                  <div style="display:flex; align-items:center; gap:0.5rem;">
                    <span style="font-weight:700; color:var(--erp-muted);">NPR</span>
                    <input type="number" id="erp-wholesale-input" class="erp-input" style="width:100%;" value="${prod ? (prod.wholesalePrice || '') : ''}" placeholder="30500" min="0">
                  </div>
                  <small style="color:var(--erp-muted); font-size:0.74rem;">Applied automatically for VIP business accounts.</small>
                </div>
              </div>

              <div class="erp-form-grid" style="margin-bottom:1rem;">
                <div class="erp-form-group">
                  <label class="erp-form-label">Nepal IRD VAT Rate (%)</label>
                  <select id="erp-vat-input" class="erp-select" style="width:100%;">
                    <option value="13" ${!prod || prod.vatRate === 13 || prod.vatRate === undefined ? 'selected' : ''}>13.00% Standard Nepal Statutory VAT</option>
                    <option value="0" ${prod && prod.vatRate === 0 ? 'selected' : ''}>0.00% Tax Exempt (Solar Special Classification)</option>
                  </select>
                </div>
                <div class="erp-form-group">
                  <label class="erp-form-label">Scrap Trade-In Battery Equivalent (Ah)</label>
                  <div style="display:flex; align-items:center; gap:0.5rem;">
                    <input type="number" id="erp-scrap-ah-input" class="erp-input" style="width:120px; font-weight:700;" value="${prod ? (prod.scrapAh || parseFloat(prod.capacity) || 150) : 150}" min="0">
                    <span style="font-size:0.85rem; font-weight:700; color:var(--erp-dark);">Ah capacity</span>
                  </div>
                  <small style="color:var(--erp-muted); font-size:0.74rem;">Default scrap trade-in size suggested in customer cart.</small>
                </div>
              </div>

              <div class="erp-form-grid">
                <div class="erp-form-group">
                  <label class="erp-form-label">${prod ? 'Physical Stock Units' : 'Opening Stock Units *'}</label>
                  <input type="number" id="erp-stock-input" class="erp-input" style="width:100%; font-weight:800;" value="${prod ? (prod.stock || 0) : 10}" ${prod ? 'readonly style="background:var(--erp-surface-alt);"' : ''}>
                  <small style="color:var(--erp-muted); font-size:0.74rem;">${prod ? 'Use "Adjust Stock" on dashboard to change physical ledger balance.' : 'Initial units recorded in opening stock balance.'}</small>
                </div>
                <div class="erp-form-group">
                  <label class="erp-form-label">Low Stock Warning Threshold</label>
                  <input type="number" id="erp-minstock-input" class="erp-input" style="width:100%; font-weight:700; color:#D97706;" value="${prod ? (prod.minStock || 5) : 5}" min="1">
                  <small style="color:var(--erp-muted); font-size:0.74rem;">Triggers low stock warnings when inventory drops below this.</small>
                </div>
              </div>
            </div>
          </div>

          <!-- TAB 3: TECHNICAL SPECIFICATIONS & FITMENT -->
          <div class="erp-sku-tab-pane" id="erp-tab-specs">
            <div class="erp-form-section-card">
              <div class="erp-form-section-title">⚙️ Battery Engineering Ratings & Dimensions</div>
              <div class="erp-form-section-sub">Any fields left empty will be automatically omitted from the customer product page.</div>

              <div class="erp-form-grid" style="margin-bottom:1rem;">
                <div class="erp-form-group">
                  <label class="erp-form-label">Battery Capacity</label>
                  <input type="text" id="erp-capacity-input" class="erp-input" style="width:100%;" value="${prod ? (prod.capacity || '') : ''}" placeholder="e.g. 150Ah @ C20 or 44Ah">
                </div>
                <div class="erp-form-group">
                  <label class="erp-form-label">Nominal Operating Voltage</label>
                  <input type="text" id="erp-voltage-input" class="erp-input" style="width:100%;" value="${prod ? (pSpecs['Nominal Voltage'] || '12 V') : '12 V'}" placeholder="e.g. 12 V / 24 V">
                </div>
              </div>

              <div class="erp-form-grid" style="margin-bottom:1rem;">
                <div class="erp-form-group">
                  <label class="erp-form-label">Cold Cranking Amps (CCA)</label>
                  <input type="text" id="erp-cca-input" class="erp-input" style="width:100%;" value="${prod ? (pSpecs['Cold Cranking Amps (CCA)'] || '') : ''}" placeholder="e.g. 550 CCA (for Car / Starter batteries)">
                </div>
                <div class="erp-form-group">
                  <label class="erp-form-label">Internal Plate Technology</label>
                  <select id="erp-tech-input" class="erp-select" style="width:100%;">
                    <option value="">-- Select or Optional --</option>
                    <option value="Tall Tubular Lead-Acid" ${pSpecs['Technology'] === 'Tall Tubular Lead-Acid' || (prod && prod.categories && prod.categories.includes('inverter-battery')) ? 'selected' : ''}>Tall Tubular Lead-Acid (Deep Cycle)</option>
                    <option value="Short Tubular Deep Cycle" ${pSpecs['Technology'] === 'Short Tubular Deep Cycle' ? 'selected' : ''}>Short Tubular Deep Cycle</option>
                    <option value="SMF / VRLA Maintenance-Free" ${pSpecs['Technology'] === 'SMF / VRLA Maintenance-Free' ? 'selected' : ''}>SMF / VRLA Maintenance-Free</option>
                    <option value="AGM Premium Start-Stop" ${pSpecs['Technology'] === 'AGM Premium Start-Stop' ? 'selected' : ''}>AGM Premium Start-Stop</option>
                    <option value="Gel Electrolyte Solar Deep Cycle" ${pSpecs['Technology'] === 'Gel Electrolyte Solar Deep Cycle' ? 'selected' : ''}>Gel Electrolyte Solar Deep Cycle</option>
                    <option value="Lithium Iron Phosphate (LiFePO4)" ${pSpecs['Technology'] === 'Lithium Iron Phosphate (LiFePO4)' ? 'selected' : ''}>Lithium Iron Phosphate (LiFePO4)</option>
                  </select>
                </div>
              </div>

              <div class="erp-form-grid" style="margin-bottom:1rem;">
                <div class="erp-form-group">
                  <label class="erp-form-label">Terminal Layout & Type</label>
                  <input type="text" id="erp-terminal-input" class="erp-input" style="width:100%;" value="${prod ? (pSpecs['Terminal Type'] || '') : ''}" placeholder="e.g. L-Type Heavy Lead / Standard Post Right +">
                </div>
                <div class="erp-form-group">
                  <label class="erp-form-label">Dimensions (L × W × H in mm)</label>
                  <input type="text" id="erp-dimensions-input" class="erp-input" style="width:100%;" value="${prod ? (pSpecs['Dimensions (L x W x H)'] || '') : ''}" placeholder="e.g. 535 x 215 x 480 mm">
                </div>
              </div>

              <div class="erp-form-grid">
                <div class="erp-form-group">
                  <label class="erp-form-label">Filled Gross Weight (kg)</label>
                  <input type="text" id="erp-weight-input" class="erp-input" style="width:100%;" value="${prod ? (pSpecs['Gross Weight'] || '') : ''}" placeholder="e.g. 58.1 kg">
                </div>
                <div class="erp-form-group">
                  <label class="erp-form-label">Compatible Vehicles / Models (Automotive)</label>
                  <input type="text" id="erp-vehicles-input" class="erp-input" style="width:100%;" value="${pVehicles}" placeholder="e.g. Toyota Hilux, Mahindra Scorpio, Hyundai Creta">
                  <small style="color:var(--erp-muted); font-size:0.74rem;">Comma-separated vehicle model names.</small>
                </div>
              </div>
            </div>
          </div>

          <!-- TAB 4: WARRANTY & COMPLIMENTARY SERVICES -->
          <div class="erp-sku-tab-pane" id="erp-tab-warranty">
            <div class="erp-form-section-card">
              <div class="erp-form-section-title">🛡️ Nepal Warranty Coverage Breakdown</div>
              <div class="erp-form-section-sub">Official authorized partner physical warranty card details.</div>

              <div class="erp-form-grid" style="margin-bottom:1rem;">
                <div class="erp-form-group">
                  <label class="erp-form-label">Total Official Warranty Duration</label>
                  <input type="text" id="erp-warranty-input" class="erp-input" style="width:100%; font-weight:700;" value="${prod ? prod.warranty : '36 Months (24M Replacement + 12M Pro-Rata)'}" placeholder="e.g. 36 Months Warranty">
                </div>
                <div class="erp-form-group">
                  <label class="erp-form-label">Free Replacement Guarantee Period</label>
                  <input type="text" id="erp-warranty-free-input" class="erp-input" style="width:100%;" value="${prod ? (prod.warrantyFree || '24 Months Free Replacement') : '24 Months Free Replacement'}" placeholder="e.g. 24 Months Free Replacement">
                </div>
              </div>

              <div class="erp-form-group" style="margin-bottom:1.5rem;">
                <label class="erp-form-label">Pro-Rata Warranty Period</label>
                <input type="text" id="erp-warranty-prorata-input" class="erp-input" style="width:100%;" value="${prod ? (prod.warrantyProRata || '12 Months Pro-Rata') : '12 Months Pro-Rata'}" placeholder="e.g. 12 Months Pro-Rata">
              </div>

              <!-- Complimentary Nepal Power Services Checkboxes -->
              <div style="border-top:1.5px solid var(--erp-border); padding-top:1.25rem;">
                <div class="erp-form-section-title" style="color:#059669;">
                  ⚡ Complimentary Nepal Power Services Included
                </div>
                <div class="erp-form-section-sub">
                  Check all complimentary benefits provided with this SKU. Checked services will display prominently in a verified service box on the product detail page.
                </div>

                <div class="erp-services-grid">
                  <label class="erp-service-checkbox-card ${pServices.some(s => s.includes('Terminal Greasing')) ? 'checked' : ''}">
                    <input type="checkbox" id="svc-terminal-greasing" class="erp-service-check" ${pServices.some(s => s.includes('Terminal Greasing')) ? 'checked' : ''} onchange="this.closest('.erp-service-checkbox-card').classList.toggle('checked', this.checked)">
                    <div class="erp-service-meta">
                      <strong>Free Battery Terminal Greasing (Prevents sulfur buildup)</strong>
                      <span>Specially formulated anti-corrosion petroleum grease applied to lead terminals during doorstep installation.</span>
                    </div>
                  </label>

                  <label class="erp-service-checkbox-card ${pServices.some(s => s.includes('Voltage Calibration')) ? 'checked' : ''}">
                    <input type="checkbox" id="svc-voltage-calibration" class="erp-service-check" ${pServices.some(s => s.includes('Voltage Calibration')) ? 'checked' : ''} onchange="this.closest('.erp-service-checkbox-card').classList.toggle('checked', this.checked)">
                    <div class="erp-service-meta">
                      <strong>Free Inverter Charging Voltage Calibration Check</strong>
                      <span>Technician inspects float voltage (13.8V) and boost charging cutoff (14.4V) to maximize tubular battery lifespan.</span>
                    </div>
                  </label>

                  <label class="erp-service-checkbox-card ${pServices.some(s => s.includes('Warranty Card')) ? 'checked' : ''}">
                    <input type="checkbox" id="svc-warranty-card" class="erp-service-check" ${pServices.some(s => s.includes('Warranty Card')) ? 'checked' : ''} onchange="this.closest('.erp-service-checkbox-card').classList.toggle('checked', this.checked)">
                    <div class="erp-service-meta">
                      <strong>Free Official Stamped Warranty Card Verification</strong>
                      <span>Official AET Partner Nepal physical ink stamp and barcode serial logging in central IRD warranty database.</span>
                    </div>
                  </label>

                  <label class="erp-service-checkbox-card ${pServices.some(s => s.includes('Cold Cranking')) ? 'checked' : ''}">
                    <input type="checkbox" id="svc-doorstep-testing" class="erp-service-check" ${pServices.some(s => s.includes('Cold Cranking')) ? 'checked' : ''} onchange="this.closest('.erp-service-checkbox-card').classList.toggle('checked', this.checked)">
                    <div class="erp-service-meta">
                      <strong>Free Doorstep Cold Cranking Amps (CCA) Inspection</strong>
                      <span>Digital battery conductance meter diagnostic test verifying factory full charge before customer handover.</span>
                    </div>
                  </label>

                  <label class="erp-service-checkbox-card ${pServices.some(s => s.includes('Scrap Battery')) ? 'checked' : ''}">
                    <input type="checkbox" id="svc-scrap-collection" class="erp-service-check" ${pServices.some(s => s.includes('Scrap Battery')) ? 'checked' : ''} onchange="this.closest('.erp-service-checkbox-card').classList.toggle('checked', this.checked)">
                    <div class="erp-service-meta">
                      <strong>Free Scrap Battery Doorstep Collection with Spot Cash Rebate</strong>
                      <span>Old depleted battery safely loaded onto technician dispatch van with instant cash rebate or invoice credit.</span>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <!-- TAB 5: MULTI-IMAGES & MEDIA GALLERY -->
          <div class="erp-sku-tab-pane" id="erp-tab-gallery">
            <div class="erp-form-section-card">
              <div class="erp-form-section-title">🖼️ Product Photo Gallery & Direct Image Links</div>
              <div class="erp-form-section-sub">
                Upload multiple high-resolution images or add external image URLs. The primary cover image will display on catalog cards; all images will appear in customer interactive zoom gallery.
              </div>

              <!-- Upload Dropzone -->
              <div class="erp-img-dropzone" onclick="document.getElementById('erp-sku-file-input').click()" ondragover="event.preventDefault(); this.classList.add('dragover');" ondragleave="this.classList.remove('dragover');" ondrop="event.preventDefault(); this.classList.remove('dragover'); window.erpApp.handleSkuImageUpload(event.dataTransfer.files);">
                <input type="file" id="erp-sku-file-input" multiple accept="image/*" style="display:none;" onchange="window.erpApp.handleSkuImageUpload(this.files)">
                <div style="font-size:2rem; margin-bottom:0.35rem;">📸</div>
                <strong style="color:var(--erp-dark); font-size:0.92rem; display:block; margin-bottom:0.25rem;">Click to Upload Multiple Photos or Drag & Drop Here</strong>
                <span style="font-size:0.76rem; color:var(--erp-muted);">Supports PNG, JPG, WEBP, SVG • Multi-select enabled</span>
              </div>

              <!-- Add Image by Direct Link -->
              <div style="margin-bottom:1.25rem;">
                <label class="erp-form-label">Or Add Image by Direct Web Link / URL</label>
                <div class="erp-img-url-bar">
                  <input type="url" id="erp-sku-img-url" class="erp-input" style="flex:1;" placeholder="https://example.com/images/exide-battery-front.jpg">
                  <button type="button" class="erp-btn erp-btn-secondary" onclick="window.erpApp.addSkuImageByUrl()">+ Add Link</button>
                </div>
              </div>

              <!-- Attached Images Grid -->
              <div style="border-top:1px solid var(--erp-border); padding-top:1rem;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
                  <span style="font-size:0.85rem; font-weight:800; color:var(--erp-dark);">Attached Photos Gallery</span>
                  <span style="font-size:0.75rem; color:var(--erp-muted);">Click "Set as Primary" to change cover image</span>
                </div>
                <div class="erp-gallery-grid" id="erp-sku-gallery-grid">
                  <!-- Dynamically populated via renderSkuGallery() -->
                </div>
              </div>
            </div>
          </div>

          <!-- TAB 6: RICH DESCRIPTION & BULLET ADVANTAGES -->
          <div class="erp-sku-tab-pane" id="erp-tab-description">
            <div class="erp-form-section-card">
              <div class="erp-form-section-title">📝 Product Overview & Rich Description Formatting</div>
              <div class="erp-form-section-sub">
                Edit product marketing copy, technical bullet points, and highlighted features with bold, italic, custom font sizes, lists, and media embedding.
              </div>

              <div class="erp-form-group" style="margin-bottom:1.25rem;">
                <label class="erp-form-label">Short Summary (Headline Teaser - Optional)</label>
                <input type="text" id="erp-shortdesc-input" class="erp-input" style="width:100%;" value="${prod ? (prod.shortDesc || '') : ''}" placeholder="e.g. Heavy-duty tubular plate battery engineered for deep cyclic discharges and frequent power cuts in Nepal.">
                <small style="color:var(--erp-muted); font-size:0.74rem;">If left empty, will be omitted cleanly.</small>
              </div>

              <!-- Rich Text Formatting Toolbar & Editor -->
              <div class="erp-form-group" style="margin-bottom:1.25rem;">
                <label class="erp-form-label">Detailed Product Description & In-Depth Overview</label>
                <div class="erp-editor-toolbar">
                  <button type="button" class="erp-editor-btn" onclick="window.erpApp.formatEditor('bold')" title="Bold"><b>B</b></button>
                  <button type="button" class="erp-editor-btn" onclick="window.erpApp.formatEditor('italic')" title="Italic"><i>I</i></button>
                  <button type="button" class="erp-editor-btn" onclick="window.erpApp.formatEditor('underline')" title="Underline"><u>U</u></button>
                  <button type="button" class="erp-editor-btn" onclick="window.erpApp.formatEditor('strikeThrough')" title="Strikethrough"><s>S</s></button>

                  <span style="width:1px; height:18px; background:var(--erp-border); margin:0 4px;"></span>

                  <select class="erp-editor-select" onchange="window.erpApp.formatEditor('fontSize', this.value); this.selectedIndex=0;" title="Font Size">
                    <option value="" disabled selected>Size</option>
                    <option value="2">Small (12px)</option>
                    <option value="3">Normal (14px)</option>
                    <option value="4">Subheading (18px)</option>
                    <option value="5">Heading (22px)</option>
                  </select>

                  <select class="erp-editor-select" onchange="window.erpApp.formatEditor('formatBlock', this.value); this.selectedIndex=0;" title="Block Style">
                    <option value="" disabled selected>Style</option>
                    <option value="<p>">Paragraph</option>
                    <option value="<h3>">Heading 3</option>
                    <option value="<h4>">Heading 4</option>
                    <option value="<blockquote>">Quote</option>
                  </select>

                  <span style="width:1px; height:18px; background:var(--erp-border); margin:0 4px;"></span>

                  <button type="button" class="erp-editor-btn" onclick="window.erpApp.formatEditor('insertUnorderedList')" title="Bullet List">•≡</button>
                  <button type="button" class="erp-editor-btn" onclick="window.erpApp.formatEditor('insertOrderedList')" title="Numbered List">1≡</button>

                  <span style="width:1px; height:18px; background:var(--erp-border); margin:0 4px;"></span>

                  <button type="button" class="erp-editor-btn" onclick="window.erpApp.insertEditorLink()" title="Insert Link">🔗</button>
                  <button type="button" class="erp-editor-btn" onclick="window.erpApp.insertEditorMedia()" title="Embed Image / Media">🖼️</button>
                  <button type="button" class="erp-editor-btn" onclick="window.erpApp.formatEditor('removeFormat')" title="Clear Formatting">🧹</button>
                </div>

                <div id="erp-sku-desc-editor" class="erp-sku-rich-editor" contenteditable="true" placeholder="Enter comprehensive product overview, battery chemistry, cycles, discharge rates, and warranty conditions...">${prod ? (prod.description || '') : ''}</div>
              </div>

              <!-- Key Engineering Features / Bullet Points -->
              <div class="erp-form-group">
                <label class="erp-form-label">Key Engineering Advantages (1 bullet feature per line)</label>
                <textarea id="erp-features-input" class="erp-input" style="width:100%; height:90px; padding:8px 10px; font-family:monospace; font-size:0.82rem; line-height:1.5;" placeholder="Higher backups with minimal plate degradation&#10;Superior recovery from deep discharge cycles&#10;Special tubular technology requires lower topping-up frequency">${pFeatures}</textarea>
                <small style="color:var(--erp-muted); font-size:0.74rem;">Each line becomes a bullet point under "Key Engineering Advantages" on the product detail modal.</small>
              </div>
            </div>
          </div>

          <!-- Bottom Action Buttons Strip -->
          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:1.5rem; padding-top:1rem; border-top:1.5px solid var(--erp-border); flex-wrap:wrap; gap:1rem;">
            <div style="font-size:0.76rem; color:var(--erp-muted);">
              Fields with <strong>*</strong> are required. Empty optional specs are omitted automatically from public view.
            </div>
            <div style="display:flex; gap:0.75rem;">
              <button type="button" class="erp-btn erp-btn-secondary" onclick="document.getElementById('erp-modal-overlay').classList.remove('open')">Cancel</button>
              <button type="submit" id="erp-sku-submit-btn" class="erp-btn erp-btn-primary" style="padding:0 1.75rem;">
                💾 ${prod ? 'Update Product SKU' : 'Create & Save Product SKU'}
              </button>
            </div>
          </div>
        </form>
      `;

      // Render the gallery grid with initial images
      this.renderSkuGallery();

      modal.classList.add('open');
    }

    switchSkuTab(tabId) {
      document.querySelectorAll('.erp-sku-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
      });
      document.querySelectorAll('.erp-sku-tab-pane').forEach(pane => {
        pane.classList.toggle('active', pane.id === `erp-tab-${tabId}`);
      });
    }

    formatEditor(command, value = null) {
      const editor = document.getElementById('erp-sku-desc-editor');
      if (editor) editor.focus();
      document.execCommand(command, false, value);
    }

    insertEditorLink() {
      const url = prompt('Enter link URL (e.g. https://exidebattery.com.np):');
      if (url) {
        this.formatEditor('createLink', url);
      }
    }

    insertEditorMedia() {
      const choice = prompt('Enter direct image URL to embed, or type "upload" to choose a file:', 'https://');
      if (!choice) return;
      if (choice.toLowerCase() === 'upload') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e) => {
          const file = e.target.files[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = (re) => {
              this.formatEditor('insertImage', re.target.result);
            };
            reader.readAsDataURL(file);
          }
        };
        input.click();
      } else if (choice.trim() !== '') {
        this.formatEditor('insertImage', choice.trim());
      }
    }

    handleSkuImageUpload(files) {
      if (!files || !files.length) return;
      Array.from(files).forEach(file => {
        if (!file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = (e) => {
          this.currentEditingImages.push(e.target.result);
          this.renderSkuGallery();
        };
        reader.readAsDataURL(file);
      });
    }

    addSkuImageByUrl() {
      const input = document.getElementById('erp-sku-img-url');
      const url = input?.value?.trim();
      if (!url) return;
      this.currentEditingImages.push(url);
      if (input) input.value = '';
      this.renderSkuGallery();
    }

    setPrimarySkuImage(index) {
      if (index <= 0 || index >= this.currentEditingImages.length) return;
      const item = this.currentEditingImages.splice(index, 1)[0];
      this.currentEditingImages.unshift(item);
      this.renderSkuGallery();
    }

    removeSkuImage(index) {
      this.currentEditingImages.splice(index, 1);
      this.renderSkuGallery();
    }

    renderSkuGallery() {
      const container = document.getElementById('erp-sku-gallery-grid');
      if (!container) return;
      if (!this.currentEditingImages || this.currentEditingImages.length === 0) {
        container.innerHTML = `
          <div style="grid-column: 1 / -1; text-align:center; padding:1.5rem; color:var(--erp-muted); font-size:0.82rem; border:1px dashed var(--erp-border); border-radius:8px;">
            No photos added yet. Upload files or paste direct image URLs above.
          </div>
        `;
        return;
      }

      container.innerHTML = this.currentEditingImages.map((imgUrl, idx) => `
        <div class="erp-gallery-card ${idx === 0 ? 'is-primary' : ''}">
          <img src="${imgUrl}" alt="Product Photo ${idx + 1}" class="erp-gallery-thumb" onerror="this.src='/assets/logo.png'">
          ${idx === 0 ? '<span class="erp-primary-badge">★ Primary</span>' : ''}
          <div class="erp-gallery-actions">
            <button type="button" class="erp-gallery-btn" onclick="window.erpApp.removeSkuImage(${idx})" title="Remove photo">&times;</button>
          </div>
          ${idx > 0 ? `<button type="button" class="erp-make-primary-btn" onclick="window.erpApp.setPrimarySkuImage(${idx})">Set as Primary</button>` : ''}
        </div>
      `).join('');
    }

    async submitProductForm(productId) {
      const sku = document.getElementById('erp-sku-input')?.value.trim();
      const name = document.getElementById('erp-name-input')?.value.trim();
      const brand = document.getElementById('erp-brand-input')?.value;
      const price = document.getElementById('erp-price-input')?.value;

      if (!sku || !name || !brand || !price) {
        alert('Please fill in required fields: SKU Code, Product Title, Brand, and Retail Price.');
        this.switchSkuTab('basic');
        return;
      }

      // Collect all modular options
      const category = document.getElementById('erp-category-input')?.value || 'inverter-battery';
      const appType = document.getElementById('erp-app-type-input')?.value.trim() || '';
      const isActive = document.getElementById('erp-active-input')?.value !== 'inactive';
      const isFeatured = document.getElementById('erp-featured-input')?.checked ?? false;

      const mrp = document.getElementById('erp-mrp-input')?.value;
      const costPrice = document.getElementById('erp-cost-input')?.value;
      const wholesalePrice = document.getElementById('erp-wholesale-input')?.value;
      const vatRate = document.getElementById('erp-vat-input')?.value;
      const scrapRebateEligible = true;
      const scrapAh = document.getElementById('erp-scrap-ah-input')?.value;

      const capacity = document.getElementById('erp-capacity-input')?.value.trim() || '';
      const voltage = document.getElementById('erp-voltage-input')?.value.trim() || '';
      const cca = document.getElementById('erp-cca-input')?.value.trim() || '';
      const technology = document.getElementById('erp-tech-input')?.value.trim() || '';
      const terminalLayout = document.getElementById('erp-terminal-input')?.value.trim() || '';
      const dimensions = document.getElementById('erp-dimensions-input')?.value.trim() || '';
      const weight = document.getElementById('erp-weight-input')?.value.trim() || '';
      const vehiclesRaw = document.getElementById('erp-vehicles-input')?.value || '';
      const compatibleVehicles = vehiclesRaw.split(',').map(s => s.trim()).filter(Boolean);

      const warranty = document.getElementById('erp-warranty-input')?.value.trim() || '';
      const warrantyFree = document.getElementById('erp-warranty-free-input')?.value.trim() || '';
      const warrantyProRata = document.getElementById('erp-warranty-prorata-input')?.value.trim() || '';

      // Complimentary Nepal Power Services (Only checked ones)
      const complimentaryServices = [];
      if (document.getElementById('svc-terminal-greasing')?.checked) {
        complimentaryServices.push('Free Battery Terminal Greasing (Prevents sulfur buildup)');
      }
      if (document.getElementById('svc-voltage-calibration')?.checked) {
        complimentaryServices.push('Free Inverter Charging Voltage Calibration Check');
      }
      if (document.getElementById('svc-warranty-card')?.checked) {
        complimentaryServices.push('Free Official Stamped Warranty Card Verification');
      }
      if (document.getElementById('svc-doorstep-testing')?.checked) {
        complimentaryServices.push('Free Doorstep Cold Cranking Amps (CCA) Inspection');
      }
      if (document.getElementById('svc-scrap-collection')?.checked) {
        complimentaryServices.push('Free Scrap Battery Doorstep Collection with Spot Cash Rebate');
      }

      // Stock
      const stock = document.getElementById('erp-stock-input')?.value;
      const minStock = document.getElementById('erp-minstock-input')?.value;

      // Images
      const images = (this.currentEditingImages && this.currentEditingImages.length > 0)
        ? this.currentEditingImages
        : ['assets/logo.png'];
      const image = images[0];

      // Description & Features
      const shortDesc = document.getElementById('erp-shortdesc-input')?.value.trim() || '';
      const description = document.getElementById('erp-sku-desc-editor')?.innerHTML?.trim() || '';
      const featuresRaw = document.getElementById('erp-features-input')?.value || '';
      const features = featuresRaw.split('\n').map(s => s.trim()).filter(Boolean);

      // Specs Object (only include filled specs)
      const specs = {};
      if (brand) specs['Brand'] = brand;
      if (capacity) specs['Capacity'] = capacity;
      if (voltage) specs['Nominal Voltage'] = voltage;
      if (cca) specs['Cold Cranking Amps (CCA)'] = cca;
      if (technology) specs['Technology'] = technology;
      if (terminalLayout) specs['Terminal Type'] = terminalLayout;
      if (dimensions) specs['Dimensions (L x W x H)'] = dimensions;
      if (weight) specs['Gross Weight'] = weight;
      if (appType) specs['Application'] = appType;
      if (compatibleVehicles.length > 0) specs['Compatible Vehicles'] = compatibleVehicles.join(', ');

      const token = localStorage.getItem(this.tokenKey);
      const isEdit = !!productId;

      const submitBtn = document.getElementById('erp-sku-submit-btn');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving SKU...';
      }

      try {
        const res = await fetch('/api/erp/products', {
          method: isEdit ? 'PUT' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            id: productId,
            sku, name, brand, category, categories: [category],
            capacity, voltage, cca, technology, terminalLayout, dimensions, weight,
            compatibleVehicles,
            price: parseFloat(price) || 0,
            mrp: mrp ? parseFloat(mrp) : undefined,
            costPrice: costPrice ? parseFloat(costPrice) : undefined,
            wholesalePrice: wholesalePrice ? parseFloat(wholesalePrice) : undefined,
            vatRate: vatRate !== undefined ? parseFloat(vatRate) : 13,
            scrapRebateEligible,
            scrapAh: scrapAh ? parseFloat(scrapAh) : undefined,
            stock: parseInt(stock, 10) || 0,
            minStock: parseInt(minStock, 10) || 5,
            warranty, warrantyFree, warrantyProRata,
            complimentaryServices,
            image, images,
            shortDesc, description, features,
            specs,
            featured: isFeatured,
            isActive
          })
        });
        const data = await res.json();
        if (data.success) {
          alert(data.message || `Product SKU "${sku}" saved successfully! ✓`);
          document.getElementById('erp-modal-overlay')?.classList.remove('open');

          if (data.product) {
            if (isEdit) {
              const idx = this.productsData.findIndex(p => p.id === data.product.id || p.sku === data.product.sku);
              if (idx !== -1) this.productsData[idx] = data.product;
            } else {
              this.productsData.unshift(data.product);
            }
            if (window.productsCatalog) {
              if (isEdit) {
                const cIdx = window.productsCatalog.findIndex(p => p.id === data.product.id || p.sku === data.product.sku);
                if (cIdx !== -1) window.productsCatalog[cIdx] = data.product;
              } else {
                window.productsCatalog.unshift(data.product);
              }
              if (window.renderProductsCatalog) window.renderProductsCatalog();
            }
          }

          this.renderProductsView(document.getElementById('erp-main-view'));
        } else {
          alert('Error: ' + (data.message || 'Failed to save product SKU.'));
        }
      } catch (e) {
        alert('Network error: ' + e.message);
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = isEdit ? '💾 Update Product SKU' : '💾 Create & Save Product SKU';
        }
      }
    }

    openStockAdjustModal(productId = '', sku = '') {
      const modal = document.getElementById('erp-modal-overlay');
      const title = document.getElementById('erp-modal-title');
      const body = document.getElementById('erp-modal-body');
      if (!modal || !title || !body) return;
      modal.querySelector('.erp-modal')?.classList.remove('erp-modal-xl');

      title.textContent = 'Atomic Stock Adjustment & Ledger Movement';

      body.innerHTML = `
        <form id="erp-stock-adjust-form" onsubmit="event.preventDefault(); window.erpApp.submitStockAdjustForm();">
          <div class="erp-form-group">
            <label class="erp-form-label">Target Product SKU *</label>
            <select id="erp-adjust-sku" class="erp-select" style="width:100%;" required>
              ${this.productsData.map(p => `
                <option value="${p.id}" ${p.id === productId || p.sku === sku ? 'selected' : ''}>${p.sku} - ${p.name} (Current: ${p.stock || 0} units)</option>
              `).join('')}
            </select>
          </div>

          <div class="erp-form-grid">
            <div class="erp-form-group">
              <label class="erp-form-label">Movement Type *</label>
              <select id="erp-adjust-type" class="erp-select" style="width:100%;">
                <option value="RECEIVE">Inbound Shipment / Restock (+)</option>
                <option value="DEDUCT">Deduct Damaged / Warehouse Shrinkage (-)</option>
                <option value="AUDIT_COUNT">Authorized Stock Audit Adjustment (+/-)</option>
              </select>
            </div>
            <div class="erp-form-group">
              <label class="erp-form-label">Quantity *</label>
              <input type="number" id="erp-adjust-qty" class="erp-input" style="width:100%;" min="1" value="5" required>
            </div>
          </div>

          <div class="erp-form-group">
            <label class="erp-form-label">Reason / Reference Document *</label>
            <input type="text" id="erp-adjust-reason" class="erp-input" style="width:100%;" placeholder="e.g. Supplier Inward Consignment #4928" required>
          </div>

          <div style="display:flex; justify-content:flex-end; gap:0.75rem; margin-top:1.5rem;">
            <button type="button" class="erp-btn erp-btn-secondary" onclick="document.getElementById('erp-modal-overlay').classList.remove('open')">Cancel</button>
            <button type="submit" class="erp-btn erp-btn-primary">Commit Stock Movement</button>
          </div>
        </form>
      `;

      modal.classList.add('open');
    }

    async submitStockAdjustForm() {
      const productId = document.getElementById('erp-adjust-sku')?.value;
      const adjustmentType = document.getElementById('erp-adjust-type')?.value;
      const quantity = document.getElementById('erp-adjust-qty')?.value;
      const reason = document.getElementById('erp-adjust-reason')?.value.trim();

      const token = localStorage.getItem(this.tokenKey);

      try {
        const res = await fetch('/api/erp/inventory', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            productId, adjustmentType, quantity, reason
          })
        });
        const data = await res.json();
        if (data.success) {
          alert(data.message || 'Stock successfully adjusted!');
          document.getElementById('erp-modal-overlay')?.classList.remove('open');
          if (this.activeRoute === 'inventory') this.renderInventoryView(document.getElementById('erp-main-view'));
          else if (this.activeRoute === 'products') this.renderProductsView(document.getElementById('erp-main-view'));
          else this.renderDashboardView(document.getElementById('erp-main-view'));
        } else {
          alert('Error: ' + (data.message || 'Failed to adjust stock.'));
        }
      } catch (e) {
        alert('Network error: ' + e.message);
      }
    }

    exportProductsCSV() {
      if (!this.productsData || this.productsData.length === 0) {
        alert('No products available for export.');
        return;
      }

      let csv = 'SKU,Product Name,Brand,Capacity,Selling Price (NPR),Stock Units,Min Threshold,Status\n';
      this.productsData.forEach(p => {
        csv += `"${p.sku}","${p.name}","${p.brand}","${p.capacity || ''}",${p.price || 0},${p.stock || 0},${p.minStock || 5},"${(p.stock || 0) > 0 ? 'In Stock' : 'Out of Stock'}"\n`;
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Exide_Nepal_Inventory_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    // ------------------------------------------------------------------------
    // 4. PURCHASES & INWARD GOODS (GRN) VIEW
    // ------------------------------------------------------------------------
    async renderPurchasesView(container) {
      try {
        const token = localStorage.getItem(this.tokenKey);
        const res = await fetch('/api/erp/purchases', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        const purchases = data.purchases || [];

        container.innerHTML = `
          <div class="erp-card">
            <div class="erp-card-header">
              <div>
                <span class="erp-card-title">📥 Purchase Orders & Inward Goods (GRN)</span>
                <span style="font-size:0.85rem; color:#64748B; margin-left:0.5rem;">(${purchases.length} Procurement Records)</span>
              </div>
              <div style="display:flex; gap:0.5rem;">
                <button class="erp-btn erp-btn-primary" onclick="window.erpApp.openPurchaseModal()">+ Create Purchase Order</button>
              </div>
            </div>
            <div class="erp-card-body" style="padding:0;">
              <table class="erp-table">
                <thead>
                  <tr>
                    <th>PO Number</th>
                    <th>Supplier</th>
                    <th>Order Date</th>
                    <th>Items</th>
                    <th>Grand Total</th>
                    <th>Status</th>
                    <th style="text-align:right;">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${purchases.length === 0 ? '<tr><td colspan="7" style="text-align:center; padding:2rem; color:#64748B;">No purchase orders found. Click "+ Create Purchase Order" to begin.</td></tr>' : ''}
                  ${purchases.map(po => {
                    const statusClass = po.status === 'COMPLETED' ? 'erp-badge-green' : (po.status === 'PARTIALLY_RECEIVED' ? 'erp-badge-blue' : (po.status === 'CANCELLED' ? 'erp-badge-red' : 'erp-badge-orange'));
                    return `
                      <tr>
                        <td><strong>${po.poNumber}</strong></td>
                        <td>
                          <div style="font-weight:600;">${po.supplierName}</div>
                          <div style="font-size:0.75rem; color:#64748B;">PAN: ${po.supplierPan || 'N/A'}</div>
                        </td>
                        <td>${new Date(po.orderDate).toLocaleDateString('en-GB')}</td>
                        <td>${po.items ? po.items.length : 0} SKUs</td>
                        <td style="font-weight:700;">NPR ${(po.pricing ? po.pricing.grandTotal : 0).toLocaleString()}</td>
                        <td><span class="erp-badge ${statusClass}">${po.status}</span></td>
                        <td style="text-align:right;">
                          ${po.status !== 'COMPLETED' && po.status !== 'CANCELLED' ? `
                            <button class="erp-btn erp-btn-secondary" style="padding:0.25rem 0.6rem; font-size:0.8rem;" onclick="window.erpApp.openGrnModal('${po.poNumber}')">📦 Receive GRN</button>
                          ` : '<span style="font-size:0.8rem; color:#10B981; font-weight:600;">✓ Inwarded</span>'}
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `;
      } catch (e) {
        container.innerHTML = `<div class="erp-card"><div class="erp-card-body" style="color:#EF4444;">Error loading purchases: ${e.message}</div></div>`;
      }
    }

    async openPurchaseModal() {
      const modal = document.getElementById('erp-modal-overlay');
      const title = document.getElementById('erp-modal-title');
      const body = document.getElementById('erp-modal-body');
      if (!modal || !title || !body) return;
      modal.querySelector('.erp-modal')?.classList.remove('erp-modal-xl');

      title.textContent = 'Create Commercial Purchase Order (PO)';

      const token = localStorage.getItem(this.tokenKey);
      let suppliers = [];
      let products = [];

      try {
        const [sRes, pRes] = await Promise.all([
          fetch('/api/erp/suppliers', { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch('/api/erp/products', { headers: { 'Authorization': `Bearer ${token}` } })
        ]);
        const sData = await sRes.json();
        const pData = await pRes.json();
        suppliers = sData.suppliers || [];
        products = pData.products || [];
      } catch(e) {}

      body.innerHTML = `
        <form onsubmit="event.preventDefault(); window.erpApp.submitPurchaseOrder();">
          <div class="erp-form-group">
            <label class="erp-form-label">Authorized Supplier</label>
            <select id="erp-po-supplier" class="erp-select" required>
              ${suppliers.map(s => `<option value="${s.id}">${s.name} (PAN: ${s.pan})</option>`).join('')}
            </select>
          </div>

          <div class="erp-form-group">
            <label class="erp-form-label">Primary Product SKU to Order</label>
            <select id="erp-po-product" class="erp-select" required onchange="window.erpApp.updatePoCostHint(this.value)">
              ${products.map(p => `<option value="${p.id}" data-cost="${p.costPrice || ''}">${p.name} (${p.sku})</option>`).join('')}
            </select>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
            <div class="erp-form-group">
              <label class="erp-form-label">Order Quantity (Units)</label>
              <input type="number" id="erp-po-qty" class="erp-input" value="10" min="1" required>
            </div>
            <div class="erp-form-group">
              <label class="erp-form-label">Unit Landed Cost (NPR)</label>
              <input type="number" id="erp-po-cost" class="erp-input" placeholder="e.g. 18500" required>
            </div>
          </div>

          <div class="erp-form-group">
            <label class="erp-form-label">Procurement Notes / Warehouse Instructions</label>
            <input type="text" id="erp-po-notes" class="erp-input" value="Delivery to Bijulibazar Kathmandu central store." required>
          </div>

          <div style="margin-top:1.5rem; display:flex; justify-content:flex-end; gap:0.75rem;">
            <button type="button" class="erp-btn erp-btn-secondary" onclick="document.getElementById('erp-modal-overlay').classList.remove('open')">Cancel</button>
            <button type="submit" class="erp-btn erp-btn-primary">Generate Purchase Order</button>
          </div>
        </form>
      `;

      if (products.length > 0) {
        const firstCost = products[0].costPrice;
        if (firstCost) document.getElementById('erp-po-cost').value = firstCost;
      }

      modal.classList.add('open');
    }

    updatePoCostHint(productId) {
      const select = document.getElementById('erp-po-product');
      const selected = select.options[select.selectedIndex];
      const cost = selected.getAttribute('data-cost');
      if (cost) document.getElementById('erp-po-cost').value = cost;
    }

    async submitPurchaseOrder() {
      const supplierId = document.getElementById('erp-po-supplier')?.value;
      const productId = document.getElementById('erp-po-product')?.value;
      const quantity = parseInt(document.getElementById('erp-po-qty')?.value, 10);
      const unitCost = parseFloat(document.getElementById('erp-po-cost')?.value);
      const notes = document.getElementById('erp-po-notes')?.value;

      const token = localStorage.getItem(this.tokenKey);

      try {
        const res = await fetch('/api/erp/purchases', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            supplierId,
            items: [{ productId, orderedQty: quantity, unitCost }],
            notes
          })
        });
        const data = await res.json();
        if (data.success) {
          alert(data.message || 'Purchase Order generated!');
          document.getElementById('erp-modal-overlay')?.classList.remove('open');
          this.renderPurchasesView(document.getElementById('erp-main-view'));
        } else {
          alert('Error: ' + (data.message || 'Failed to create PO'));
        }
      } catch (e) {
        alert('Network error: ' + e.message);
      }
    }

    async openGrnModal(poNumber) {
      const modal = document.getElementById('erp-modal-overlay');
      const title = document.getElementById('erp-modal-title');
      const body = document.getElementById('erp-modal-body');
      if (!modal || !title || !body) return;

      title.textContent = `Inward Goods Receipt (GRN) for ${poNumber}`;
      const token = localStorage.getItem(this.tokenKey);

      try {
        const res = await fetch(`/api/erp/purchases?po=${poNumber}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        const po = data.purchaseOrder;

        if (!po || !po.items || po.items.length === 0) {
          alert('Could not load purchase order line items.');
          return;
        }

        body.innerHTML = `
          <form onsubmit="event.preventDefault(); window.erpApp.submitGrn('${poNumber}');">
            <div style="background:#F1F5F9; padding:0.75rem 1rem; border-radius:6px; margin-bottom:1rem; font-size:0.85rem;">
              <strong>Supplier:</strong> ${po.supplierName} &bull; <strong>Order Date:</strong> ${new Date(po.orderDate).toLocaleDateString()}
            </div>

            <div style="margin-bottom:1rem;">
              <label class="erp-form-label">Line Items to Inward to Central Stock</label>
              ${po.items.map((item, idx) => {
                const remaining = (item.orderedQty || 0) - (item.receivedQty || 0);
                return `
                  <div style="display:grid; grid-template-columns:2fr 1fr 1fr; gap:0.75rem; align-items:center; background:#FFFFFF; border:1px solid #E2E8F0; padding:0.75rem; border-radius:6px; margin-bottom:0.5rem;">
                    <div>
                      <div style="font-weight:600; font-size:0.85rem;">${item.name}</div>
                      <div style="font-size:0.75rem; color:#64748B;">SKU: ${item.sku} | Ordered: ${item.orderedQty} | Prev Received: ${item.receivedQty || 0}</div>
                      <input type="hidden" id="grn-prod-${idx}" value="${item.productId}">
                    </div>
                    <div>
                      <label style="font-size:0.75rem; color:#475569;">Receive Qty</label>
                      <input type="number" id="grn-qty-${idx}" class="erp-input" value="${remaining > 0 ? remaining : 0}" min="1" max="${remaining > 0 ? remaining : 999}" required>
                    </div>
                    <div>
                      <label style="font-size:0.75rem; color:#475569;">Landed Cost (NPR)</label>
                      <input type="number" id="grn-cost-${idx}" class="erp-input" value="${item.unitCost || 0}">
                    </div>
                  </div>
                `;
              }).join('')}
            </div>

            <div class="erp-form-group">
              <label class="erp-form-label">Receipt Remarks / Transit Quality Check</label>
              <input type="text" id="grn-notes" class="erp-input" value="Verified in good condition, acid levels full, sealed terminals." required>
            </div>

            <div style="margin-top:1.5rem; display:flex; justify-content:flex-end; gap:0.75rem;">
              <button type="button" class="erp-btn erp-btn-secondary" onclick="document.getElementById('erp-modal-overlay').classList.remove('open')">Cancel</button>
              <button type="submit" class="erp-btn erp-btn-primary">Confirm GRN & Update Inventory</button>
            </div>
          </form>
        `;

        modal.classList.add('open');
      } catch(e) {
        alert('Error: ' + e.message);
      }
    }

    async submitGrn(poNumber) {
      const token = localStorage.getItem(this.tokenKey);
      const notes = document.getElementById('grn-notes')?.value;

      const receivedItems = [];
      let idx = 0;
      while (document.getElementById(`grn-prod-${idx}`)) {
        const productId = document.getElementById(`grn-prod-${idx}`).value;
        const qty = parseInt(document.getElementById(`grn-qty-${idx}`).value, 10);
        const cost = parseFloat(document.getElementById(`grn-cost-${idx}`).value);
        if (qty > 0) {
          receivedItems.push({ productId, quantityReceived: qty, unitLandedCost: cost });
        }
        idx++;
      }

      if (receivedItems.length === 0) {
        alert('Please specify quantity received for at least one item.');
        return;
      }

      try {
        const res = await fetch('/api/erp/purchases?action=receive', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ poNumber, receivedItems, notes })
        });
        const data = await res.json();
        if (data.success) {
          alert(data.message || 'Goods Received Note processed! Inventory stock updated.');
          document.getElementById('erp-modal-overlay')?.classList.remove('open');
          this.renderPurchasesView(document.getElementById('erp-main-view'));
        } else {
          alert('Error: ' + (data.message || 'Failed to process GRN.'));
        }
      } catch(e) {
        alert('Network error: ' + e.message);
      }
    }

    // ------------------------------------------------------------------------
    // 4B. COMMERCIAL ORDER MANAGEMENT MODULE (FLIPKART / AMAZON SELLER STYLE)
    // ------------------------------------------------------------------------
    async renderOrdersView(container) {
      try {
        const token = localStorage.getItem(this.tokenKey);
        const statusParam = this.ordersFilterStatus || 'all';
        const searchParam = encodeURIComponent(this.ordersSearchQuery || '');
        const paymentParam = this.ordersPaymentMethod || 'all';
        const dateParam = this.ordersDateRange || 'all';

        const res = await fetch(`/api/erp/orders?status=${statusParam}&search=${searchParam}&paymentMethod=${paymentParam}&dateRange=${dateParam}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        const orders = data.orders || [];
        this.ordersData = orders;
        const summary = data.summary || {
          totalOrders: orders.length,
          pending: 0,
          processing: 0,
          shipped: 0,
          delivered: 0,
          cancelled: 0,
          totalRevenue: 0,
          pendingValue: 0
        };

        // Update sidebar nav badge
        const badge = document.getElementById('erp-nav-orders-count');
        if (badge) {
          badge.textContent = summary.pending;
          badge.style.display = summary.pending > 0 ? 'inline-block' : 'none';
        }

        container.innerHTML = `
          <!-- Header Strip -->
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1.25rem; flex-wrap:wrap; gap:1rem;">
            <div>
              <h2 style="font-size:1.35rem; font-weight:800; color:#0F172A; margin:0 0 0.25rem 0;">🛍️ Commercial Order Fulfillment & Dispatch</h2>
              <div style="font-size:0.85rem; color:#64748B;">Flipkart / Amazon Seller Hub style workflow for web orders, dispatch riders, and IRD tax invoices.</div>
            </div>
            <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
              <button class="erp-btn erp-btn-secondary" onclick="window.erpApp.exportOrdersCsv()">📥 Export CSV</button>
              <button class="erp-btn erp-btn-primary" onclick="window.erpApp.renderOrdersView(document.getElementById('erp-main-view'))">🔄 Refresh Orders</button>
            </div>
          </div>

          <!-- Top KPI Metric Cards -->
          <div class="erp-order-summary-grid">
            <div class="erp-order-metric-tile">
              <div class="erp-order-metric-icon" style="background:#EFF6FF; color:#1D4ED8;">📦</div>
              <div>
                <div style="font-size:0.75rem; font-weight:700; color:#64748B; text-transform:uppercase;">Total Orders Volume</div>
                <div style="font-size:1.3rem; font-weight:900; color:#0F172A;">${summary.totalOrders}</div>
                <div style="font-size:0.75rem; color:#10B981; font-weight:700;">NPR ${(summary.totalRevenue || 0).toLocaleString()} fulfilled</div>
              </div>
            </div>

            <div class="erp-order-metric-tile" style="border-left:4px solid #F59E0B;">
              <div class="erp-order-metric-icon" style="background:#FEF3C7; color:#D97706;">⏳</div>
              <div>
                <div style="font-size:0.75rem; font-weight:700; color:#64748B; text-transform:uppercase;">Needs Confirmation</div>
                <div style="font-size:1.3rem; font-weight:900; color:#B45309;">${summary.pending}</div>
                <div style="font-size:0.75rem; color:#B45309; font-weight:700;">NPR ${(summary.pendingValue || 0).toLocaleString()} awaiting</div>
              </div>
            </div>

            <div class="erp-order-metric-tile" style="border-left:4px solid #3B82F6;">
              <div class="erp-order-metric-icon" style="background:#EFF6FF; color:#2563EB;">🚚</div>
              <div>
                <div style="font-size:0.75rem; font-weight:700; color:#64748B; text-transform:uppercase;">Dispatched / In-Transit</div>
                <div style="font-size:1.3rem; font-weight:900; color:#1D4ED8;">${summary.shipped}</div>
                <div style="font-size:0.75rem; color:#2563EB; font-weight:700;">Assigned to riders</div>
              </div>
            </div>

            <div class="erp-order-metric-tile" style="border-left:4px solid #10B981;">
              <div class="erp-order-metric-icon" style="background:#ECFDF5; color:#059669;">✅</div>
              <div>
                <div style="font-size:0.75rem; font-weight:700; color:#64748B; text-transform:uppercase;">Delivered & Tested</div>
                <div style="font-size:1.3rem; font-weight:900; color:#047857;">${summary.delivered}</div>
                <div style="font-size:0.75rem; color:#059669; font-weight:700;">Verified customer handoff</div>
              </div>
            </div>
          </div>

          <!-- Flipkart / Amazon Seller-style Filter Tabs -->
          <div class="erp-order-tab-bar">
            <button class="erp-order-tab-btn ${statusParam === 'all' ? 'active' : ''}" onclick="window.erpApp.filterOrdersByStatus('all')">
              All Orders <span class="erp-tab-count">${summary.totalOrders}</span>
            </button>
            <button class="erp-order-tab-btn ${statusParam === 'pending' ? 'active' : ''}" onclick="window.erpApp.filterOrdersByStatus('pending')">
              ⏳ Pending <span class="erp-tab-count">${summary.pending}</span>
            </button>
            <button class="erp-order-tab-btn ${statusParam === 'processing' ? 'active' : ''}" onclick="window.erpApp.filterOrdersByStatus('processing')">
              ⚙️ Processing / Confirmed <span class="erp-tab-count">${summary.processing}</span>
            </button>
            <button class="erp-order-tab-btn ${statusParam === 'shipped' ? 'active' : ''}" onclick="window.erpApp.filterOrdersByStatus('shipped')">
              🚚 Dispatched / In Transit <span class="erp-tab-count">${summary.shipped}</span>
            </button>
            <button class="erp-order-tab-btn ${statusParam === 'delivered' ? 'active' : ''}" onclick="window.erpApp.filterOrdersByStatus('delivered')">
              ✅ Delivered <span class="erp-tab-count">${summary.delivered}</span>
            </button>
            <button class="erp-order-tab-btn ${statusParam === 'cancelled' ? 'active' : ''}" onclick="window.erpApp.filterOrdersByStatus('cancelled')">
              ❌ Cancelled / Returned <span class="erp-tab-count">${summary.cancelled}</span>
            </button>
          </div>

          <!-- Search & Filter Controls Toolbar -->
          <div class="erp-order-toolbar">
            <div class="erp-order-search-box">
              <span style="margin-right:0.5rem; color:#94A3B8;">🔍</span>
              <input type="text" placeholder="Search Order #, Customer, Phone, City, IRD PAN..." value="${this.ordersSearchQuery || ''}" onkeydown="if(event.key==='Enter') window.erpApp.searchOrders(this.value)" oninput="window.erpApp.debounceSearchOrders(this.value)">
            </div>

            <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
              <select class="erp-input" style="height:40px; font-size:0.85rem; width:auto;" onchange="window.erpApp.filterOrdersByPayment(this.value)">
                <option value="all" ${paymentParam === 'all' ? 'selected' : ''}>All Payments</option>
                <option value="esewa" ${paymentParam === 'esewa' ? 'selected' : ''}>eSewa Mobile Wallet</option>
                <option value="khalti" ${paymentParam === 'khalti' ? 'selected' : ''}>Khalti Digital Wallet</option>
                <option value="fonepay" ${paymentParam === 'fonepay' ? 'selected' : ''}>Fonepay Dynamic QR</option>
                <option value="cod" ${paymentParam === 'cod' ? 'selected' : ''}>Cash on Delivery</option>
                <option value="bank" ${paymentParam === 'bank' ? 'selected' : ''}>Bank Transfer / ConnectIPS</option>
              </select>

              <select class="erp-input" style="height:40px; font-size:0.85rem; width:auto;" onchange="window.erpApp.filterOrdersByDate(this.value)">
                <option value="all" ${dateParam === 'all' ? 'selected' : ''}>All Time</option>
                <option value="today" ${dateParam === 'today' ? 'selected' : ''}>Today</option>
                <option value="yesterday" ${dateParam === 'yesterday' ? 'selected' : ''}>Yesterday</option>
                <option value="last7days" ${dateParam === 'last7days' ? 'selected' : ''}>Last 7 Days</option>
                <option value="last30days" ${dateParam === 'last30days' ? 'selected' : ''}>Last 30 Days</option>
              </select>
            </div>
          </div>

          <!-- Commercial Orders Table -->
          <div class="erp-card" style="padding:0; overflow:hidden;">
            <div class="erp-table-responsive">
              <table class="erp-table">
                <thead>
                  <tr>
                    <th>Order & Date</th>
                    <th>Customer Details</th>
                    <th>Items & Battery Ah</th>
                    <th>Scrap Exchange</th>
                    <th>Financials & Gateway</th>
                    <th>Fulfillment Status</th>
                    <th style="text-align:right;">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${orders.length === 0 ? `
                    <tr>
                      <td colspan="7" style="text-align:center; padding:3rem 1rem; color:#64748B;">
                        <div style="font-size:2rem; margin-bottom:0.5rem;">📦</div>
                        <div style="font-size:1rem; font-weight:700; color:#0F172A;">No orders found matching current filters</div>
                        <div style="font-size:0.8rem; margin-top:0.25rem;">Try clearing your search query or selecting a different status tab.</div>
                      </td>
                    </tr>
                  ` : ''}

                  ${orders.map(o => {
                    const st = String(o.status || 'CONFIRMED').toUpperCase();
                    let stBadge = 'erp-badge-blue';
                    if (st === 'PENDING' || st === 'CREATED') stBadge = 'erp-badge-yellow';
                    else if (st === 'PROCESSING' || st === 'CONFIRMED') stBadge = 'erp-badge-blue';
                    else if (st === 'SHIPPED' || st === 'OUT_FOR_DELIVERY') stBadge = 'erp-badge-purple';
                    else if (st === 'DELIVERED') stBadge = 'erp-badge-green';
                    else if (st === 'CANCELLED') stBadge = 'erp-badge-red';

                    const p = o.pricing || o.calculations || {};
                    const scrapRebate = p.scrapExchangeDeduction || 0;
                    const grandTotal = p.grandTotal || o.grandTotal || 0;
                    const items = Array.isArray(o.items) ? o.items : [];
                    const customer = o.customer || {};
                    const cleanPhone = String(customer.phone || '').replace(/\D/g, '');

                    return `
                      <tr>
                        <td>
                          <div style="font-weight:800; color:#0F172A; font-size:0.92rem;">#${o.orderId || o.id}</div>
                          <div style="font-size:0.75rem; color:#64748B; margin-top:2px;">
                            ${o.orderDateFormatted || (o.date ? new Date(o.date).toLocaleDateString('en-GB') : 'Recent')}
                          </div>
                          ${o.invoiceNumber ? `<div style="font-size:0.72rem; color:#1E40AF; font-weight:700;">Inv: ${o.invoiceNumber}</div>` : ''}
                        </td>

                        <td>
                          <div style="font-weight:700; color:#0F172A;">${customer.fullName || 'Customer'}</div>
                          <div style="font-size:0.78rem; display:flex; align-items:center; gap:0.35rem; margin-top:2px;">
                            <a href="tel:${cleanPhone}" style="color:#2563EB; text-decoration:none; font-weight:600;">📞 ${customer.phone || 'N/A'}</a>
                            ${cleanPhone ? `
                              <a href="https://wa.me/977${cleanPhone.slice(-10)}?text=Namaste%20${encodeURIComponent(customer.fullName || '')}%2C%20regarding%20your%20Exide%20Battery%20Order%20${o.orderId}." target="_blank" style="color:#16A34A; text-decoration:none;" title="Chat on WhatsApp">
                                💬
                              </a>
                            ` : ''}
                          </div>
                          <div style="font-size:0.74rem; color:#64748B; margin-top:2px;">
                            📍 ${customer.city || customer.district || 'Kathmandu'}, Ward ${customer.ward || '10'}
                          </div>
                        </td>

                        <td>
                          <div style="font-size:0.82rem; font-weight:700; color:#0F172A;">
                            ${items.length} Product${items.length !== 1 ? 's' : ''}
                          </div>
                          <div style="font-size:0.74rem; color:#475569; max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                            ${items.map(i => `${i.name || i.sku} (${i.quantity || 1}x)`).join(', ')}
                          </div>
                        </td>

                        <td>
                          ${scrapRebate > 0 ? `
                            <span style="display:inline-flex; align-items:center; gap:3px; background:#ECFDF5; color:#047857; font-weight:700; font-size:0.78rem; padding:2px 8px; border-radius:6px; border:1px solid #A7F3D0;">
                              ♻️ -NPR ${scrapRebate.toLocaleString()}
                            </span>
                            <div style="font-size:0.72rem; color:#64748B; margin-top:2px;">
                              ${p.scrapBatteryAh ? p.scrapBatteryAh + 'Ah trade-in' : 'Scrap Deducted'}
                            </div>
                          ` : `
                            <span style="font-size:0.78rem; color:#94A3B8;">None</span>
                          `}
                        </td>

                        <td>
                          <div style="font-weight:900; color:#0F172A; font-size:0.95rem;">
                            NPR ${grandTotal.toLocaleString()}
                          </div>
                          <div style="display:flex; align-items:center; gap:0.35rem; margin-top:2px;">
                            <span style="font-size:0.72rem; font-weight:800; text-transform:uppercase; color:#475569; background:#F1F5F9; padding:1px 6px; border-radius:4px;">
                              ${o.paymentMethod || 'COD'}
                            </span>
                            <span style="font-size:0.72rem; font-weight:700; color:${o.paymentStatus === 'PAID' ? '#16A34A' : '#D97706'};">
                              ● ${o.paymentStatus || 'PENDING'}
                            </span>
                          </div>
                        </td>

                        <td>
                          <span class="erp-badge ${stBadge}">
                            ${st}
                          </span>
                          <div style="font-size:0.74rem; color:#475569; margin-top:3px;">
                            🏍️ ${customer.assignedRider || o.assignedRider || 'Standard Dispatch'}
                          </div>
                        </td>

                        <td style="text-align:right;">
                          <div style="display:inline-flex; align-items:center; gap:0.35rem;">
                            <button class="erp-btn erp-btn-sm erp-btn-secondary" onclick="window.erpApp.openOrderDetailsModal('${o.orderId}')" title="View Full Order Details">
                              👁️
                            </button>
                            <button class="erp-btn erp-btn-sm erp-btn-primary" onclick="window.erpApp.openOrderStatusModal('${o.orderId}')" title="Update Fulfillment & Assign Rider">
                              🚚
                            </button>
                            <button class="erp-btn erp-btn-sm erp-btn-secondary" onclick="window.erpApp.printPackingSlipModal('${o.orderId}')" title="Print Shipping Packing Slip">
                              🏷️
                            </button>
                            <button class="erp-btn erp-btn-sm erp-btn-secondary" onclick="window.erpApp.printTaxInvoiceModal('${o.orderId}')" title="Print IRD Tax Invoice">
                              🧾
                            </button>
                          </div>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `;
      } catch (err) {
        console.error('Error rendering orders view:', err);
        container.innerHTML = `
          <div class="erp-card" style="padding:2rem; text-align:center; color:#DC2626;">
            <h3>Error Loading Order Management Module</h3>
            <p>${err.message}</p>
            <button class="erp-btn erp-btn-primary" onclick="window.erpApp.renderOrdersView(document.getElementById('erp-main-view'))">Retry</button>
          </div>
        `;
      }
    }

    filterOrdersByStatus(status) {
      this.ordersFilterStatus = status;
      this.renderOrdersView(document.getElementById('erp-main-view'));
    }

    searchOrders(query) {
      this.ordersSearchQuery = query;
      this.renderOrdersView(document.getElementById('erp-main-view'));
    }

    debounceSearchOrders(val) {
      clearTimeout(this._searchTimer);
      this._searchTimer = setTimeout(() => {
        this.searchOrders(val);
      }, 350);
    }

    filterOrdersByPayment(method) {
      this.ordersPaymentMethod = method;
      this.renderOrdersView(document.getElementById('erp-main-view'));
    }

    filterOrdersByDate(range) {
      this.ordersDateRange = range;
      this.renderOrdersView(document.getElementById('erp-main-view'));
    }

    // Modal 1: Comprehensive Order Details & Audit Trail
    openOrderDetailsModal(orderId) {
      const order = (this.ordersData || []).find(o => o.orderId === orderId || o.id === orderId);
      if (!order) {
        alert(`Order #${orderId} not found.`);
        return;
      }

      const modalOverlay = document.getElementById('erp-modal-overlay');
      const modalContent = document.getElementById('erp-modal-content');
      if (!modalOverlay || !modalContent) return;

      const customer = order.customer || {};
      const pricing = order.pricing || order.calculations || {};
      const items = Array.isArray(order.items) ? order.items : [];
      const cleanPhone = String(customer.phone || '').replace(/\D/g, '');
      const scrap = order.scrapExchangeRecord || pricing.scrapBatteryAh ? {
        capacityAh: pricing.scrapBatteryAh || order.scrapExchangeRecord?.capacityAh,
        rebateAmount: pricing.scrapExchangeDeduction || order.scrapExchangeRecord?.rebateAmount
      } : null;

      modalContent.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1.5px solid #E2E8F0; padding-bottom:1rem; margin-bottom:1.25rem;">
          <div>
            <h3 style="margin:0; font-size:1.25rem; font-weight:800; color:#0F172A;">Order Details: #${order.orderId || order.id}</h3>
            <div style="font-size:0.8rem; color:#64748B;">Placed on ${order.orderDateFormatted || (order.date ? new Date(order.date).toLocaleString('en-GB') : 'Recent')}</div>
          </div>
          <button type="button" class="erp-btn erp-btn-secondary" onclick="document.getElementById('erp-modal-overlay').classList.remove('open')">✕ Close</button>
        </div>

        <!-- Status & Fulfillment Banner -->
        <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:10px; padding:1rem; margin-bottom:1.25rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.75rem;">
          <div>
            <span style="font-size:0.78rem; font-weight:700; color:#64748B; text-transform:uppercase;">Current State:</span>
            <span class="erp-badge ${order.status === 'DELIVERED' ? 'erp-badge-green' : (order.status === 'CANCELLED' ? 'erp-badge-red' : 'erp-badge-blue')}" style="margin-left:0.4rem; font-size:0.85rem;">
              ${order.status || 'CONFIRMED'}
            </span>
          </div>
          <div>
            <span style="font-size:0.78rem; font-weight:700; color:#64748B; text-transform:uppercase;">Payment:</span>
            <span style="font-size:0.85rem; font-weight:800; color:#0F172A; margin-left:0.4rem;">${order.paymentMethod || 'COD'} (${order.paymentStatus || 'PENDING'})</span>
          </div>
          <div>
            <span style="font-size:0.78rem; font-weight:700; color:#64748B; text-transform:uppercase;">Assigned Rider:</span>
            <span style="font-size:0.85rem; font-weight:800; color:#1E40AF; margin-left:0.4rem;">${customer.assignedRider || order.assignedRider || 'Standard Dispatch'}</span>
          </div>
        </div>

        <!-- Customer & Delivery Information Grid -->
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:1.25rem;">
          <div style="background:#FFFFFF; border:1px solid #E2E8F0; border-radius:10px; padding:1rem;">
            <h4 style="font-size:0.85rem; font-weight:800; color:#0F172A; margin:0 0 0.5rem 0; text-transform:uppercase; letter-spacing:0.5px;">👤 Customer Information</h4>
            <div style="font-size:0.88rem; font-weight:700; color:#0F172A;">${customer.fullName || 'Valued Customer'}</div>
            <div style="font-size:0.82rem; color:#475569; margin-top:2px;">Phone: <strong>${customer.phone || 'N/A'}</strong></div>
            ${customer.email ? `<div style="font-size:0.82rem; color:#475569;">Email: ${customer.email}</div>` : ''}
            ${customer.pan ? `<div style="font-size:0.82rem; color:#1E40AF; font-weight:700; margin-top:4px;">Buyer IRD PAN: ${customer.pan}</div>` : ''}
            ${cleanPhone ? `
              <div style="margin-top:0.6rem;">
                <a href="https://wa.me/977${cleanPhone.slice(-10)}?text=Namaste%20${encodeURIComponent(customer.fullName || '')}%2C%20regarding%20your%20Exide%20Battery%20Order%20${order.orderId}." target="_blank" class="erp-btn erp-btn-sm" style="background:#25D366; color:#FFFFFF; text-decoration:none; display:inline-flex; align-items:center; gap:4px;">
                  💬 WhatsApp Customer
                </a>
              </div>
            ` : ''}
          </div>

          <div style="background:#FFFFFF; border:1px solid #E2E8F0; border-radius:10px; padding:1rem;">
            <h4 style="font-size:0.85rem; font-weight:800; color:#0F172A; margin:0 0 0.5rem 0; text-transform:uppercase; letter-spacing:0.5px;">📍 Doorstep Delivery Destination</h4>
            <div style="font-size:0.85rem; font-weight:700; color:#0F172A;">${customer.deliveryAddress || customer.address || 'Kathmandu'}</div>
            <div style="font-size:0.82rem; color:#475569; margin-top:2px;">City / District: <strong>${customer.city || customer.district || 'Kathmandu'}</strong></div>
            <div style="font-size:0.82rem; color:#475569;">Ward No: <strong>${customer.ward || '10'}</strong></div>
            ${customer.landmark ? `<div style="font-size:0.82rem; color:#D97706; font-weight:600;">Landmark: ${customer.landmark}</div>` : ''}
          </div>
        </div>

        <!-- Ordered Products Line Items Table -->
        <div style="margin-bottom:1.25rem;">
          <h4 style="font-size:0.85rem; font-weight:800; color:#0F172A; margin:0 0 0.5rem 0; text-transform:uppercase;">📦 Ordered Items (${items.length})</h4>
          <table class="erp-table" style="font-size:0.85rem;">
            <thead>
              <tr>
                <th>Item / SKU</th>
                <th>Capacity / Specs</th>
                <th>Warranty</th>
                <th>Qty</th>
                <th>Unit Price</th>
                <th style="text-align:right;">Line Total</th>
              </tr>
            </thead>
            <tbody>
              ${items.map(i => `
                <tr>
                  <td>
                    <div style="font-weight:700; color:#0F172A;">${i.name || i.sku}</div>
                    <div style="font-size:0.74rem; color:#64748B;">SKU: ${i.sku || 'N/A'}</div>
                  </td>
                  <td>${i.capacity || '12V Power System'}</td>
                  <td><span style="font-size:0.75rem; background:#EFF6FF; color:#1D4ED8; padding:2px 6px; border-radius:4px;">${i.warranty || '36 Mo'}</span></td>
                  <td><strong>${i.quantity || 1}</strong></td>
                  <td>NPR ${(i.unitPrice || i.price || 0).toLocaleString()}</td>
                  <td style="text-align:right; font-weight:800;">NPR ${((i.quantity || 1) * (i.unitPrice || i.price || 0)).toLocaleString()}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- Scrap Battery Trade-In Rebate (if applicable) -->
        ${scrap && scrap.rebateAmount > 0 ? `
          <div style="background:#ECFDF5; border:1.5px solid #10B981; border-radius:10px; padding:0.85rem 1rem; margin-bottom:1.25rem; display:flex; justify-content:space-between; align-items:center;">
            <div>
              <strong style="color:#047857; font-size:0.9rem;">♻️ Old Battery Scrap Buyback Rebate Applied</strong>
              <div style="font-size:0.78rem; color:#065F46;">Capacity: ${scrap.capacityAh} Ah • Certified Nepal Rate: NPR 35.00/Ah</div>
            </div>
            <div style="font-size:1.15rem; font-weight:900; color:#047857;">- NPR ${scrap.rebateAmount.toLocaleString()}</div>
          </div>
        ` : ''}

        <!-- Official Nepal IRD Financials Breakdown -->
        <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:10px; padding:1rem; margin-bottom:1.5rem; display:flex; flex-direction:column; gap:0.4rem; max-width:380px; margin-left:auto;">
          <div style="display:flex; justify-content:space-between; font-size:0.85rem; color:#475569;">
            <span>Subtotal:</span>
            <span>NPR ${(pricing.rawSubtotal || 0).toLocaleString()}</span>
          </div>
          ${(pricing.scrapExchangeDeduction || 0) > 0 ? `
            <div style="display:flex; justify-content:space-between; font-size:0.85rem; color:#047857; font-weight:700;">
              <span>Scrap Trade-in Rebate:</span>
              <span>- NPR ${pricing.scrapExchangeDeduction.toLocaleString()}</span>
            </div>
          ` : ''}
          <div style="display:flex; justify-content:space-between; font-size:0.85rem; color:#475569;">
            <span>Nepal 13% IRD VAT:</span>
            <span>NPR ${(pricing.vatAmount || 0).toLocaleString()}</span>
          </div>
          <div style="display:flex; justify-content:space-between; font-size:0.85rem; color:#475569;">
            <span>Delivery & Fitting:</span>
            <span style="color:#16A34A; font-weight:700;">FREE (Kathmandu Valley)</span>
          </div>
          <div style="border-top:1.5px solid #CBD5E1; padding-top:0.5rem; margin-top:0.25rem; display:flex; justify-content:space-between; font-size:1.15rem; font-weight:900; color:#0F172A;">
            <span>Grand Total:</span>
            <span style="color:#0047BA;">NPR ${(pricing.grandTotal || order.grandTotal || 0).toLocaleString()}</span>
          </div>
        </div>

        <!-- Action Buttons -->
        <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid #E2E8F0; padding-top:1rem; flex-wrap:wrap; gap:0.5rem;">
          <div style="display:flex; gap:0.5rem;">
            <button class="erp-btn erp-btn-secondary" onclick="window.erpApp.printPackingSlipModal('${order.orderId}')">🏷️ Print Packing Slip</button>
            <button class="erp-btn erp-btn-secondary" onclick="window.erpApp.printTaxInvoiceModal('${order.orderId}')">🧾 Print IRD Tax Invoice</button>
          </div>
          <button class="erp-btn erp-btn-primary" onclick="window.erpApp.openOrderStatusModal('${order.orderId}')">🚚 Dispatch / Update Status</button>
        </div>
      `;

      modalOverlay.classList.add('open');
    }

    // Modal 2: Quick Status Transition & Rider Assignment
    openOrderStatusModal(orderId) {
      const order = (this.ordersData || []).find(o => o.orderId === orderId || o.id === orderId);
      if (!order) {
        alert(`Order #${orderId} not found.`);
        return;
      }

      const modalOverlay = document.getElementById('erp-modal-overlay');
      const modalContent = document.getElementById('erp-modal-content');
      if (!modalOverlay || !modalContent) return;

      const customer = order.customer || {};
      const currentStatus = String(order.status || 'CONFIRMED').toUpperCase();
      const currentPayment = String(order.paymentStatus || 'PENDING').toUpperCase();

      modalContent.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1.5px solid #E2E8F0; padding-bottom:1rem; margin-bottom:1.25rem;">
          <div>
            <h3 style="margin:0; font-size:1.25rem; font-weight:800; color:#0F172A;">Update Fulfillment: #${order.orderId || order.id}</h3>
            <div style="font-size:0.8rem; color:#64748B;">Customer: ${customer.fullName || 'Valued Buyer'} (${customer.phone || 'N/A'})</div>
          </div>
          <button type="button" class="erp-btn erp-btn-secondary" onclick="document.getElementById('erp-modal-overlay').classList.remove('open')">✕ Close</button>
        </div>

        <form onsubmit="event.preventDefault(); window.erpApp.submitOrderStatusUpdate('${order.orderId}');">
          <div class="erp-form-group" style="margin-bottom:1.15rem;">
            <label class="erp-label">Fulfillment State *</label>
            <select id="erp-order-status-select" class="erp-input" style="font-weight:700;">
              <option value="PENDING" ${currentStatus === 'PENDING' ? 'selected' : ''}>⏳ PENDING (Awaiting Phone Verification)</option>
              <option value="CONFIRMED" ${currentStatus === 'CONFIRMED' || currentStatus === 'PROCESSING' ? 'selected' : ''}>⚙️ CONFIRMED / PROCESSING (Packed at Bijulibazar Hub)</option>
              <option value="SHIPPED" ${currentStatus === 'SHIPPED' || currentStatus === 'OUT_FOR_DELIVERY' ? 'selected' : ''}>🚚 SHIPPED (Handed to Rider / Out for Fitting)</option>
              <option value="DELIVERED" ${currentStatus === 'DELIVERED' ? 'selected' : ''}>✅ DELIVERED (Installed, Calibrated & Completed)</option>
              <option value="CANCELLED" ${currentStatus === 'CANCELLED' ? 'selected' : ''}>❌ CANCELLED (Return Stock to Warehouse)</option>
            </select>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:1.15rem;">
            <div class="erp-form-group">
              <label class="erp-label">Payment Condition</label>
              <select id="erp-order-paystatus-select" class="erp-input">
                <option value="PENDING" ${currentPayment === 'PENDING' ? 'selected' : ''}>⏳ Pending Payment (COD)</option>
                <option value="PAID" ${currentPayment === 'PAID' ? 'selected' : ''}>✅ Paid & Reconciled</option>
                <option value="REFUNDED" ${currentPayment === 'REFUNDED' ? 'selected' : ''}>↩️ Refunded / Reclaimed</option>
              </select>
            </div>

            <div class="erp-form-group">
              <label class="erp-label">Assigned Delivery Rider</label>
              <select id="erp-order-rider-select" class="erp-input">
                <option value="Standard Kathmandu Express">Standard Kathmandu Express</option>
                <option value="Ramesh Thapa (+977 9801234567 - Central Rider)">Ramesh Thapa (+977 9801234567 - Central Rider)</option>
                <option value="Bikash Shrestha (+977 9812345678 - Lalitpur & Patan)">Bikash Shrestha (+977 9812345678 - Lalitpur & Patan)</option>
                <option value="Sujan Karki (+977 9823456789 - Bhaktapur Express)">Sujan Karki (+977 9823456789 - Bhaktapur Express)</option>
                <option value="Direct Counter Pickup (Bijulibazar Store)">Direct Counter Pickup (Bijulibazar Store)</option>
              </select>
            </div>
          </div>

          <div class="erp-form-group" style="margin-bottom:1.15rem;">
            <label class="erp-label">Dispatch Vehicle & Technician Note</label>
            <input type="text" id="erp-order-vehicle-input" class="erp-input" placeholder="e.g. Ba 2 Ja 4521 Scooter - Carry terminal grease & multimeter" value="${order.dispatchVehicle || ''}">
          </div>

          <div class="erp-form-group" style="margin-bottom:1.5rem;">
            <label class="erp-label">Tracking Timeline Note</label>
            <input type="text" id="erp-order-tracking-note" class="erp-input" placeholder="e.g. Battery checked on load tester, loaded for Bijulibazar dispatch.">
          </div>

          <div style="display:flex; justify-content:flex-end; gap:0.5rem; border-top:1px solid #E2E8F0; padding-top:1rem;">
            <button type="button" class="erp-btn erp-btn-secondary" onclick="document.getElementById('erp-modal-overlay').classList.remove('open')">Cancel</button>
            <button type="submit" class="erp-btn erp-btn-primary" style="background:#0047BA;">💾 Save & Update Fulfillment</button>
          </div>
        </form>
      `;

      modalOverlay.classList.add('open');
    }

    async submitOrderStatusUpdate(orderId) {
      try {
        const token = localStorage.getItem(this.tokenKey);
        const statusEl = document.getElementById('erp-order-status-select');
        const payEl = document.getElementById('erp-order-paystatus-select');
        const riderEl = document.getElementById('erp-order-rider-select');
        const vehicleEl = document.getElementById('erp-order-vehicle-input');
        const noteEl = document.getElementById('erp-order-tracking-note');

        const payload = {
          orderId,
          status: statusEl ? statusEl.value : 'CONFIRMED',
          paymentStatus: payEl ? payEl.value : 'PAID',
          assignedRider: riderEl ? riderEl.value : 'Standard Kathmandu Express',
          dispatchVehicle: vehicleEl ? vehicleEl.value.trim() : '',
          trackingNote: noteEl ? noteEl.value.trim() : ''
        };

        const res = await fetch('/api/erp/orders', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (data.success) {
          alert(`Order #${orderId} fulfillment updated successfully!`);
          document.getElementById('erp-modal-overlay')?.classList.remove('open');
          this.renderOrdersView(document.getElementById('erp-main-view'));
        } else {
          alert('Error: ' + (data.message || 'Failed to update order.'));
        }
      } catch (err) {
        alert('Network error: ' + err.message);
      }
    }

    // Modal 3: Flipkart / Amazon Style Commercial Shipping Packing Slip
    printPackingSlipModal(orderId) {
      const order = (this.ordersData || []).find(o => o.orderId === orderId || o.id === orderId);
      if (!order) {
        alert(`Order #${orderId} not found.`);
        return;
      }

      const customer = order.customer || {};
      const pricing = order.pricing || order.calculations || {};
      const items = Array.isArray(order.items) ? order.items : [];

      const modalOverlay = document.getElementById('erp-modal-overlay');
      const modalContent = document.getElementById('erp-modal-content');
      if (!modalOverlay || !modalContent) return;

      modalContent.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1.5px solid #E2E8F0; padding-bottom:1rem; margin-bottom:1.25rem;">
          <div>
            <h3 style="margin:0; font-size:1.25rem; font-weight:800; color:#0F172A;">Commercial Packing Slip & Shipping Label</h3>
            <div style="font-size:0.8rem; color:#64748B;">Standard Flipkart / Amazon Seller Format</div>
          </div>
          <div style="display:flex; gap:0.5rem;">
            <button class="erp-btn erp-btn-primary" onclick="window.print()">🖨️ Print Label</button>
            <button class="erp-btn erp-btn-secondary" onclick="document.getElementById('erp-modal-overlay').classList.remove('open')">✕ Close</button>
          </div>
        </div>

        <div id="printable-slip" style="border:2px dashed #0F172A; padding:1.5rem; background:#FFFFFF; font-family:'Courier New', Courier, monospace; color:#0F172A;">
          <!-- Slip Header -->
          <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #0F172A; padding-bottom:1rem; margin-bottom:1rem;">
            <div>
              <div style="font-size:1.4rem; font-weight:900; letter-spacing:1px;">EXIDE BATTERY WHOLESALE</div>
              <div style="font-size:0.85rem;">AET Official Partner • Nepal Power Hub</div>
              <div style="font-size:0.8rem;">Bijulibazar, Kathmandu • Seller PAN: 609823412</div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:1.1rem; font-weight:900;">EXP-DOORSTEP</div>
              <div style="font-size:0.85rem;">ORDER: #${order.orderId}</div>
              <div style="font-size:0.85rem;">INV: ${order.invoiceNumber || 'PENDING'}</div>
            </div>
          </div>

          <!-- Shipping Destination -->
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; border-bottom:1.5px solid #CBD5E1; padding-bottom:1rem; margin-bottom:1rem;">
            <div>
              <div style="font-size:0.75rem; font-weight:800; text-transform:uppercase;">DELIVERY ADDRESS (SHIP TO):</div>
              <div style="font-size:1.05rem; font-weight:900; margin-top:2px;">${customer.fullName || 'Customer'}</div>
              <div style="font-size:0.9rem;">${customer.deliveryAddress || customer.address || 'Kathmandu'}</div>
              <div style="font-size:0.9rem;">${customer.city || customer.district || 'Kathmandu'}, Ward ${customer.ward || '10'}</div>
              <div style="font-size:0.9rem; font-weight:700;">TEL: ${customer.phone || 'N/A'}</div>
            </div>
            <div>
              <div style="font-size:0.75rem; font-weight:800; text-transform:uppercase;">DISPATCH & PAYMENT:</div>
              <div style="font-size:0.9rem; font-weight:800; margin-top:2px;">GATEWAY: ${String(order.paymentMethod || 'COD').toUpperCase()}</div>
              <div style="font-size:0.9rem; font-weight:800;">COLLECT AMOUNT: NPR ${(pricing.grandTotal || order.grandTotal || 0).toLocaleString()}</div>
              <div style="font-size:0.85rem; margin-top:4px;">COURIER: ${customer.assignedRider || order.assignedRider || 'Kathmandu Central Rider'}</div>
            </div>
          </div>

          <!-- Warehouse Picker & Packer Checklist -->
          <div style="margin-bottom:1rem;">
            <div style="font-size:0.75rem; font-weight:800; text-transform:uppercase; margin-bottom:0.5rem;">PACKAGE CONTENTS CHECKLIST:</div>
            <table style="width:100%; border-collapse:collapse; font-size:0.85rem;">
              <thead>
                <tr style="border-bottom:1px solid #0F172A; text-align:left;">
                  <th style="padding:4px 0;">[ ] Item Description</th>
                  <th style="padding:4px 0;">SKU</th>
                  <th style="padding:4px 0;">Qty</th>
                  <th style="padding:4px 0; text-align:right;">Verified</th>
                </tr>
              </thead>
              <tbody>
                ${items.map(i => `
                  <tr style="border-bottom:1px dashed #CBD5E1;">
                    <td style="padding:6px 0;">[ ] ${i.name || i.sku}</td>
                    <td style="padding:6px 0;">${i.sku || 'N/A'}</td>
                    <td style="padding:6px 0;">${i.quantity || 1}</td>
                    <td style="padding:6px 0; text-align:right;">( ___ )</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <!-- Complimentary Services Checklist -->
          <div style="background:#F1F5F9; padding:0.6rem; border-radius:6px; font-size:0.78rem; margin-bottom:1rem;">
            <strong>COMPLIMENTARY SERVICES CHECKLIST:</strong>
            <div>[ ] Free Battery Terminal Greasing Applied</div>
            <div>[ ] Inverter Charging Voltage Calibration Tested</div>
            <div>[ ] Official Stamped Manufacturer Warranty Card Stamped & Delivered</div>
          </div>

          <!-- Barcode simulation -->
          <div style="text-align:center; font-family:'Courier New', monospace; font-size:1.1rem; letter-spacing:6px; margin-top:1rem; border-top:1px solid #0F172A; padding-top:0.75rem;">
            *${order.orderId}*
          </div>
        </div>
      `;

      modalOverlay.classList.add('open');
    }

    // CSV Export
    exportOrdersCsv() {
      const orders = this.ordersData || [];
      if (orders.length === 0) {
        alert('No orders available to export.');
        return;
      }

      let csv = 'Order ID,Date,Invoice Number,Customer Name,Phone,Address,City,Ward,Items Count,Scrap Rebate NPR,13% VAT NPR,Grand Total NPR,Payment Method,Payment Status,Fulfillment Status,Assigned Rider\n';

      orders.forEach(o => {
        const c = o.customer || {};
        const p = o.pricing || o.calculations || {};
        const row = [
          o.orderId || o.id,
          o.orderDateFormatted || (o.date ? new Date(o.date).toLocaleDateString('en-GB') : ''),
          o.invoiceNumber || '',
          `"${(c.fullName || '').replace(/"/g, '""')}"`,
          c.phone || '',
          `"${(c.deliveryAddress || c.address || '').replace(/"/g, '""')}"`,
          c.city || c.district || 'Kathmandu',
          c.ward || '10',
          Array.isArray(o.items) ? o.items.length : 0,
          p.scrapExchangeDeduction || 0,
          p.vatAmount || 0,
          p.grandTotal || o.grandTotal || 0,
          o.paymentMethod || 'COD',
          o.paymentStatus || 'PENDING',
          o.status || 'CONFIRMED',
          `"${(c.assignedRider || o.assignedRider || 'Standard').replace(/"/g, '""')}"`
        ];
        csv += row.join(',') + '\n';
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Exide_Orders_Export_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    // ------------------------------------------------------------------------
    // 5. SALES, TAX INVOICES & BATTERY EXCHANGE VIEW
    // ------------------------------------------------------------------------
    async renderSalesView(container) {
      try {
        const token = localStorage.getItem(this.tokenKey);
        const res = await fetch('/api/erp/sales', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        const orders = data.orders || [];

        container.innerHTML = `
          <div class="erp-card">
            <div class="erp-card-header">
              <div>
                <span class="erp-card-title">🧾 Sales Orders, Quotations & Tax Invoices</span>
                <span style="font-size:0.85rem; color:#64748B; margin-left:0.5rem;">(Nepal IRD 13% VAT Compliant)</span>
              </div>
              <div style="display:flex; gap:0.5rem;">
                <button class="erp-btn erp-btn-secondary" onclick="window.erpApp.openExchangeModal()">♻️ Scrap Buyback</button>
                <button class="erp-btn erp-btn-primary" onclick="window.erpApp.openSalesModal()">+ Issue Tax Invoice / Sale</button>
              </div>
            </div>
            <div class="erp-card-body" style="padding:0;">
              <table class="erp-table">
                <thead>
                  <tr>
                    <th>Invoice / Order</th>
                    <th>Customer Details</th>
                    <th>Date</th>
                    <th>Items</th>
                    <th>Scrap Rebate</th>
                    <th>13% VAT</th>
                    <th>Grand Total</th>
                    <th>Status</th>
                    <th style="text-align:right;">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${orders.length === 0 ? '<tr><td colspan="9" style="text-align:center; padding:2rem; color:#64748B;">No sales records found. Click "+ Issue Tax Invoice / Sale" to create one.</td></tr>' : ''}
                  ${orders.map(o => {
                    const statusClass = o.status === 'CONFIRMED' || o.status === 'DELIVERED' ? 'erp-badge-green' : (o.status === 'QUOTATION' ? 'erp-badge-blue' : (o.status === 'CANCELLED' ? 'erp-badge-red' : 'erp-badge-orange'));
                    const p = o.pricing || {};
                    return `
                      <tr>
                        <td>
                          <div style="font-weight:700; color:#0F172A;">${o.invoiceNumber || o.orderId}</div>
                          <div style="font-size:0.75rem; color:#64748B;">ID: ${o.orderId}</div>
                        </td>
                        <td>
                          <div style="font-weight:600;">${o.customer ? o.customer.fullName : 'Customer'}</div>
                          <div style="font-size:0.75rem; color:#64748B;">📱 ${o.customer ? o.customer.phone : ''} ${o.customer && o.customer.pan ? '| PAN: ' + o.customer.pan : ''}</div>
                        </td>
                        <td>${o.orderDateFormatted || new Date(o.date).toLocaleDateString('en-GB')}</td>
                        <td>${o.items ? o.items.length : 0} items</td>
                        <td style="color:${p.scrapExchangeDeduction > 0 ? '#10B981' : '#64748B'}; font-weight:600;">
                          ${p.scrapExchangeDeduction > 0 ? '- NPR ' + p.scrapExchangeDeduction.toLocaleString() : 'NPR 0'}
                        </td>
                        <td>NPR ${(p.vatAmount || 0).toLocaleString()}</td>
                        <td style="font-weight:800; color:#0F172A;">NPR ${(p.grandTotal || 0).toLocaleString()}</td>
                        <td><span class="erp-badge ${statusClass}">${o.status}</span></td>
                        <td style="text-align:right;">
                          <button class="erp-btn erp-btn-secondary" style="padding:0.25rem 0.6rem; font-size:0.8rem;" onclick="window.erpApp.printTaxInvoiceModal('${o.orderId}')">🖨️ View Tax Bill</button>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `;
      } catch (e) {
        container.innerHTML = `<div class="erp-card"><div class="erp-card-body" style="color:#EF4444;">Error loading sales invoices: ${e.message}</div></div>`;
      }
    }

    async openSalesModal() {
      const modal = document.getElementById('erp-modal-overlay');
      const title = document.getElementById('erp-modal-title');
      const body = document.getElementById('erp-modal-body');
      if (!modal || !title || !body) return;
      modal.querySelector('.erp-modal')?.classList.remove('erp-modal-xl');

      title.textContent = 'Issue Official Nepal IRD VAT 13% Tax Invoice';
      const token = localStorage.getItem(this.tokenKey);
      let products = [];

      try {
        const res = await fetch('/api/erp/products', { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        products = data.products || [];
      } catch(e) {}

      body.innerHTML = `
        <form onsubmit="event.preventDefault(); window.erpApp.submitSalesOrder();">
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
            <div class="erp-form-group">
              <label class="erp-form-label">Customer Full Name</label>
              <input type="text" id="erp-sale-name" class="erp-input" placeholder="e.g. Ramesh Shrestha" required>
            </div>
            <div class="erp-form-group">
              <label class="erp-form-label">Customer Mobile Phone (+977)</label>
              <input type="tel" id="erp-sale-phone" class="erp-input" placeholder="e.g. 9841234567" required>
            </div>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
            <div class="erp-form-group">
              <label class="erp-form-label">Buyer IRD VAT / PAN (Optional)</label>
              <input type="text" id="erp-sale-pan" class="erp-input" placeholder="e.g. 609823412">
            </div>
            <div class="erp-form-group">
              <label class="erp-form-label">Delivery Address (Kathmandu)</label>
              <input type="text" id="erp-sale-addr" class="erp-input" value="Bijulibazar, Kathmandu" required>
            </div>
          </div>

          <div style="border-top:1px solid #E2E8F0; padding-top:1rem; margin-top:0.5rem;">
            <div style="display:grid; grid-template-columns:2fr 1fr 1fr; gap:1rem;">
              <div class="erp-form-group">
                <label class="erp-form-label">Product to Sell</label>
                <select id="erp-sale-prod" class="erp-select" required onchange="window.erpApp.updateSalePriceHint(this.value)">
                  ${products.map(p => `<option value="${p.id}" data-price="${p.price || 0}" data-stock="${p.stock || 0}">${p.name} (Stock: ${p.stock || 0})</option>`).join('')}
                </select>
              </div>
              <div class="erp-form-group">
                <label class="erp-form-label">Quantity</label>
                <input type="number" id="erp-sale-qty" class="erp-input" value="1" min="1" required oninput="window.erpApp.recalcSaleTotal()">
              </div>
              <div class="erp-form-group">
                <label class="erp-form-label">Unit Price (NPR)</label>
                <input type="number" id="erp-sale-price" class="erp-input" value="${products[0] ? products[0].price : 25000}" required oninput="window.erpApp.recalcSaleTotal()">
              </div>
            </div>
          </div>

          <!-- Scrap Battery Trade-In Section -->
          <div style="background:#F0FDF4; border:1px solid #86EFAC; padding:1rem; border-radius:6px; margin-top:1rem;">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:0.5rem;">
              <label style="font-weight:700; color:#166534; cursor:pointer;">
                <input type="checkbox" id="erp-sale-exchange-check" onchange="window.erpApp.toggleSaleExchangeSection(this.checked)">
                Include Old Battery Exchange Trade-In (NPR 35 / Ah Rebate)
              </label>
            </div>
            <div id="erp-sale-exchange-fields" style="display:none; grid-template-columns:1fr 1fr 1fr; gap:0.75rem; margin-top:0.5rem;">
              <div>
                <label style="font-size:0.75rem; color:#166534;">Scrap Capacity (Ah)</label>
                <input type="number" id="erp-sale-scrap-ah" class="erp-input" placeholder="e.g. 150" value="150" oninput="window.erpApp.recalcSaleTotal()">
              </div>
              <div>
                <label style="font-size:0.75rem; color:#166534;">Old Brand / Model</label>
                <input type="text" id="erp-sale-scrap-brand" class="erp-input" value="Exide Tubular">
              </div>
              <div>
                <label style="font-size:0.75rem; color:#166534;">Condition</label>
                <select id="erp-sale-scrap-cond" class="erp-select">
                  <option value="INTACT">Intact (Full Lead Cells)</option>
                  <option value="SWOLLEN">Swollen / Bulged</option>
                  <option value="LEAKING">Cracked / Acid Leaking</option>
                </select>
              </div>
            </div>
          </div>

          <!-- Live Financial Breakdown -->
          <div style="background:#F8FAFC; border:1px solid #E2E8F0; padding:1rem; border-radius:6px; margin-top:1rem; font-size:0.85rem; line-height:1.6;">
            <div style="display:flex; justify-content:space-between;"><span>Subtotal:</span><strong id="erp-live-sub">NPR 0</strong></div>
            <div style="display:flex; justify-content:space-between; color:#10B981;"><span>Scrap Trade-in Rebate (@ NPR 35/Ah):</span><strong id="erp-live-rebate">- NPR 0</strong></div>
            <div style="display:flex; justify-content:space-between;"><span>Taxable Base:</span><strong id="erp-live-taxable">NPR 0</strong></div>
            <div style="display:flex; justify-content:space-between;"><span>Nepal VAT (13%):</span><strong id="erp-live-vat">NPR 0</strong></div>
            <div style="display:flex; justify-content:space-between; font-size:1.05rem; border-top:1px solid #CBD5E1; padding-top:0.5rem; margin-top:0.5rem;">
              <strong>Grand Total (Payable):</strong><strong id="erp-live-grand" style="color:#003399;">NPR 0</strong>
            </div>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-top:1rem;">
            <div class="erp-form-group">
              <label class="erp-form-label">Payment Method</label>
              <select id="erp-sale-payment-method" class="erp-select">
                <option value="CASH_ON_DELIVERY">Cash on Delivery (COD)</option>
                <option value="ESEWA">eSewa Mobile Wallet</option>
                <option value="KHALTI">Khalti Digital Wallet</option>
                <option value="BANK_TRANSFER">NIC Asia Bank Transfer</option>
              </select>
            </div>
            <div class="erp-form-group">
              <label class="erp-form-label">Order Type</label>
              <select id="erp-sale-type" class="erp-select">
                <option value="SALE">Confirmed Sale (Deduct Stock)</option>
                <option value="QUOTATION">Formal Quotation (Reserve Only)</option>
              </select>
            </div>
          </div>

          <div style="margin-top:1.5rem; display:flex; justify-content:flex-end; gap:0.75rem;">
            <button type="button" class="erp-btn erp-btn-secondary" onclick="document.getElementById('erp-modal-overlay').classList.remove('open')">Cancel</button>
            <button type="submit" class="erp-btn erp-btn-primary">Generate Official IRD Tax Bill</button>
          </div>
        </form>
      `;

      this.recalcSaleTotal();
      modal.classList.add('open');
    }

    updateSalePriceHint(productId) {
      const select = document.getElementById('erp-sale-prod');
      const selected = select.options[select.selectedIndex];
      const price = selected.getAttribute('data-price');
      if (price) document.getElementById('erp-sale-price').value = price;
      this.recalcSaleTotal();
    }

    toggleSaleExchangeSection(checked) {
      const el = document.getElementById('erp-sale-exchange-fields');
      if (el) el.style.display = checked ? 'grid' : 'none';
      this.recalcSaleTotal();
    }

    recalcSaleTotal() {
      const qty = parseInt(document.getElementById('erp-sale-qty')?.value, 10) || 1;
      const price = parseFloat(document.getElementById('erp-sale-price')?.value) || 0;
      const subtotal = qty * price;

      let scrapDeduction = 0;
      const isExchange = document.getElementById('erp-sale-exchange-check')?.checked;
      if (isExchange) {
        const ah = parseFloat(document.getElementById('erp-sale-scrap-ah')?.value) || 0;
        scrapDeduction = Math.round(ah * 35);
      }

      const taxable = Math.max(0, subtotal - scrapDeduction);
      const vat = Math.round(taxable * 0.13);
      const grand = taxable + vat;

      const subEl = document.getElementById('erp-live-sub');
      const rebEl = document.getElementById('erp-live-rebate');
      const taxEl = document.getElementById('erp-live-taxable');
      const vatEl = document.getElementById('erp-live-vat');
      const grandEl = document.getElementById('erp-live-grand');

      if (subEl) subEl.textContent = `NPR ${subtotal.toLocaleString()}`;
      if (rebEl) rebEl.textContent = `- NPR ${scrapDeduction.toLocaleString()}`;
      if (taxEl) taxEl.textContent = `NPR ${taxable.toLocaleString()}`;
      if (vatEl) vatEl.textContent = `NPR ${vat.toLocaleString()}`;
      if (grandEl) grandEl.textContent = `NPR ${grand.toLocaleString()}`;
    }

    async submitSalesOrder() {
      const fullName = document.getElementById('erp-sale-name')?.value;
      const phone = document.getElementById('erp-sale-phone')?.value;
      const pan = document.getElementById('erp-sale-pan')?.value;
      const address = document.getElementById('erp-sale-addr')?.value;
      const productId = document.getElementById('erp-sale-prod')?.value;
      const quantity = parseInt(document.getElementById('erp-sale-qty')?.value, 10) || 1;
      const unitPrice = parseFloat(document.getElementById('erp-sale-price')?.value) || 0;
      const paymentMethod = document.getElementById('erp-sale-payment-method')?.value;
      const orderType = document.getElementById('erp-sale-type')?.value;

      const isExchange = document.getElementById('erp-sale-exchange-check')?.checked;
      let scrapExchange = null;
      if (isExchange) {
        scrapExchange = {
          hasExchange: true,
          capacityAh: parseFloat(document.getElementById('erp-sale-scrap-ah')?.value) || 0,
          scrapRate: 35,
          oldBrand: document.getElementById('erp-sale-scrap-brand')?.value || 'Generic',
          physicalCondition: document.getElementById('erp-sale-scrap-cond')?.value || 'INTACT'
        };
      }

      const token = localStorage.getItem(this.tokenKey);

      try {
        const res = await fetch('/api/erp/sales', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            customer: { fullName, phone, pan, address },
            items: [{ productId, quantity, unitPrice }],
            scrapExchange,
            paymentMethod,
            orderType
          })
        });
        const data = await res.json();
        if (data.success) {
          alert(`Success! ${data.message}`);
          document.getElementById('erp-modal-overlay')?.classList.remove('open');
          this.renderSalesView(document.getElementById('erp-main-view'));
          if (data.orderId) {
            this.printTaxInvoiceModal(data.orderId);
          }
        } else {
          alert('Error: ' + (data.message || 'Failed to issue sales invoice.'));
        }
      } catch(e) {
        alert('Network error: ' + e.message);
      }
    }

    async printTaxInvoiceModal(orderId) {
      const modal = document.getElementById('erp-modal-overlay');
      const title = document.getElementById('erp-modal-title');
      const body = document.getElementById('erp-modal-body');
      if (!modal || !title || !body) return;

      title.textContent = `Official Nepal IRD Tax Invoice (${orderId})`;
      const token = localStorage.getItem(this.tokenKey);

      try {
        const res = await fetch(`/api/erp/sales?id=${orderId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        const o = data.order;
        if (!o) { alert('Invoice details not found.'); return; }

        const p = o.pricing || {};

        body.innerHTML = `
          <div id="printable-tax-invoice" style="background:#FFFFFF; padding:1.5rem; border:1px solid #E2E8F0; font-family:'Inter', sans-serif; color:#0F172A; max-width:650px; margin:0 auto; line-height:1.5;">
            <!-- Header -->
            <div style="text-align:center; border-bottom:2px solid #003399; padding-bottom:1rem; margin-bottom:1rem;">
              <h2 style="margin:0; color:#003399; font-size:1.3rem;">EXIDE BATTERY WHOLESALE</h2>
              <div style="font-size:0.85rem; font-weight:700; color:#64748B;">AET Official Partner • The Power House Nepal</div>
              <div style="font-size:0.8rem; color:#475569;">Bijulibazar (Opposite Sunrise City Home), Kathmandu, Nepal</div>
              <div style="font-size:0.8rem; color:#475569;">Phone: +977 9705997260 | Email: batterymartbtl@gmail.com</div>
              <div style="font-size:0.9rem; font-weight:800; color:#B91C1C; margin-top:0.25rem;">SELLER IRD VAT / PAN: 609823412</div>
            </div>

            <div style="display:flex; justify-content:space-between; font-size:0.85rem; margin-bottom:1rem; border-bottom:1px dashed #CBD5E1; padding-bottom:0.75rem;">
              <div>
                <div><strong>INVOICE NO:</strong> ${o.invoiceNumber || o.orderId}</div>
                <div><strong>Order Ref:</strong> ${o.orderId}</div>
                <div><strong>Date:</strong> ${o.orderDateFormatted || new Date(o.date).toLocaleDateString()}</div>
                <div><strong>Mode:</strong> ${o.paymentMethod} (${o.paymentStatus})</div>
              </div>
              <div style="text-align:right;">
                <div><strong>BUYER / CUSTOMER:</strong> ${o.customer ? o.customer.fullName : 'Valued Customer'}</div>
                <div><strong>Contact:</strong> ${o.customer ? o.customer.phone : 'N/A'}</div>
                <div><strong>Buyer PAN:</strong> ${o.customer && o.customer.pan ? o.customer.pan : 'N/A (Consumer)'}</div>
                <div><strong>Delivery:</strong> ${o.customer ? o.customer.address : 'Kathmandu'}</div>
              </div>
            </div>

            <!-- Items Table -->
            <table style="width:100%; border-collapse:collapse; font-size:0.85rem; margin-bottom:1rem;">
              <thead>
                <tr style="background:#0F172A; color:#FFFFFF;">
                  <th style="padding:0.4rem; text-align:left;">SN</th>
                  <th style="padding:0.4rem; text-align:left;">Description of Battery / Goods</th>
                  <th style="padding:0.4rem; text-align:center;">Qty</th>
                  <th style="padding:0.4rem; text-align:right;">Rate (NPR)</th>
                  <th style="padding:0.4rem; text-align:right;">Amount (NPR)</th>
                </tr>
              </thead>
              <tbody>
                ${(o.items || []).map((item, idx) => `
                  <tr style="border-bottom:1px solid #E2E8F0;">
                    <td style="padding:0.4rem;">${idx + 1}</td>
                    <td style="padding:0.4rem;">
                      <strong>${item.name}</strong><br>
                      <span style="font-size:0.75rem; color:#64748B;">SKU: ${item.sku} | ${item.warranty || 'Warranty Included'}</span>
                    </td>
                    <td style="padding:0.4rem; text-align:center;">${item.quantity}</td>
                    <td style="padding:0.4rem; text-align:right;">${(item.unitPrice || item.price || 0).toLocaleString()}</td>
                    <td style="padding:0.4rem; text-align:right;">${(item.itemTotal || item.lineTotal || 0).toLocaleString()}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <!-- Financial Calculations -->
            <div style="display:flex; justify-content:flex-end;">
              <table style="font-size:0.85rem; width:280px; line-height:1.6;">
                <tr><td>Gross Subtotal:</td><td style="text-align:right; font-weight:600;">NPR ${(p.rawSubtotal || 0).toLocaleString()}</td></tr>
                ${p.scrapExchangeDeduction > 0 ? `
                  <tr style="color:#10B981;"><td>Trade-In Rebate (@ NPR 35/Ah):</td><td style="text-align:right; font-weight:600;">- NPR ${p.scrapExchangeDeduction.toLocaleString()}</td></tr>
                ` : ''}
                <tr><td>Taxable Amount:</td><td style="text-align:right; font-weight:600;">NPR ${(p.taxableAmount || 0).toLocaleString()}</td></tr>
                <tr><td>Nepal VAT (13.00%):</td><td style="text-align:right; font-weight:600;">NPR ${(p.vatAmount || 0).toLocaleString()}</td></tr>
                <tr style="font-size:1rem; font-weight:800; border-top:2px solid #0F172A; color:#003399;">
                  <td>Grand Total:</td><td style="text-align:right;">NPR ${(p.grandTotal || 0).toLocaleString()}</td>
                </tr>
              </table>
            </div>

            <!-- Footer Compliance Notice -->
            <div style="border-top:1px dashed #CBD5E1; padding-top:0.75rem; margin-top:1rem; font-size:0.75rem; color:#64748B; text-align:center;">
              Computer Generated Official Tax Bill pursuant to Nepal Inland Revenue Department (IRD) Regulations.<br>
              Thank you for trusting Exide Battery Wholesale & AET Official Partner!
            </div>
          </div>

          <div style="margin-top:1.5rem; display:flex; justify-content:flex-end; gap:0.75rem;">
            <button class="erp-btn erp-btn-secondary" onclick="window.print()">🖨️ Print Invoice</button>
            <button class="erp-btn erp-btn-primary" onclick="document.getElementById('erp-modal-overlay').classList.remove('open')">Close</button>
          </div>
        `;

        modal.classList.add('open');
      } catch(e) {
        alert('Error loading invoice: ' + e.message);
      }
    }

    async openExchangeModal() {
      const modal = document.getElementById('erp-modal-overlay');
      const title = document.getElementById('erp-modal-title');
      const body = document.getElementById('erp-modal-body');
      if (!modal || !title || !body) return;
      modal.querySelector('.erp-modal')?.classList.remove('erp-modal-xl');

      title.textContent = 'Direct Scrap Battery Buyback / Walk-In Trade-In';

      body.innerHTML = `
        <form onsubmit="event.preventDefault(); window.erpApp.submitDirectExchange();">
          <div style="background:#F0FDF4; border:1px solid #86EFAC; padding:0.75rem 1rem; border-radius:6px; margin-bottom:1rem; font-size:0.85rem; color:#166534;">
            Official Exide Scrap Rate: <strong>NPR 35.00 / Ampere-hour (Ah)</strong> &bull; Cash/Digital Rebate Disbursed Immediately
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
            <div class="erp-form-group">
              <label class="erp-form-label">Customer Name</label>
              <input type="text" id="exc-cust-name" class="erp-input" placeholder="e.g. Sunil Yadav" required>
            </div>
            <div class="erp-form-group">
              <label class="erp-form-label">Customer Mobile Phone</label>
              <input type="tel" id="exc-cust-phone" class="erp-input" placeholder="e.g. 9809163454" required>
            </div>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:1rem;">
            <div class="erp-form-group">
              <label class="erp-form-label">Battery Capacity (Ah)</label>
              <input type="number" id="exc-ah" class="erp-input" value="150" min="1" required oninput="document.getElementById('exc-rebate-val').textContent = 'NPR ' + (Math.round((parseFloat(this.value)||0)*35)).toLocaleString()">
            </div>
            <div class="erp-form-group">
              <label class="erp-form-label">Old Brand</label>
              <input type="text" id="exc-brand" class="erp-input" value="Exide Tubular" required>
            </div>
            <div class="erp-form-group">
              <label class="erp-form-label">Condition</label>
              <select id="exc-cond" class="erp-select">
                <option value="INTACT">Intact (Good Lead)</option>
                <option value="SWOLLEN">Swollen / Bulged</option>
                <option value="LEAKING">Leaking / Cracked</option>
              </select>
            </div>
          </div>

          <div style="background:#F8FAFC; border:1px solid #E2E8F0; padding:0.75rem 1rem; border-radius:6px; margin-top:0.5rem; display:flex; justify-content:space-between; align-items:center;">
            <span style="font-weight:700;">Computed Cash Rebate:</span>
            <span id="exc-rebate-val" style="font-size:1.1rem; font-weight:800; color:#10B981;">NPR 5,250</span>
          </div>

          <div style="margin-top:1.5rem; display:flex; justify-content:flex-end; gap:0.75rem;">
            <button type="button" class="erp-btn erp-btn-secondary" onclick="document.getElementById('erp-modal-overlay').classList.remove('open')">Cancel</button>
            <button type="submit" class="erp-btn erp-btn-primary">Record Scrap Buyback</button>
          </div>
        </form>
      `;

      modal.classList.add('open');
    }

    async submitDirectExchange() {
      const customerName = document.getElementById('exc-cust-name')?.value;
      const customerPhone = document.getElementById('exc-cust-phone')?.value;
      const capacityAh = parseFloat(document.getElementById('exc-ah')?.value);
      const oldBrand = document.getElementById('exc-brand')?.value;
      const physicalCondition = document.getElementById('exc-cond')?.value;

      const token = localStorage.getItem(this.tokenKey);

      try {
        const res = await fetch('/api/erp/exchanges', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            customerName, customerPhone, capacityAh, oldBrand, physicalCondition
          })
        });
        const data = await res.json();
        if (data.success) {
          alert(`Scrap Battery registered! ${data.message}`);
          document.getElementById('erp-modal-overlay')?.classList.remove('open');
          this.renderSalesView(document.getElementById('erp-main-view'));
        } else {
          alert('Error: ' + (data.message || 'Failed to record scrap battery.'));
        }
      } catch(e) {
        alert('Network error: ' + e.message);
      }
    }

    // ------------------------------------------------------------------------
    // 6. SUPPLIERS DIRECTORY VIEW
    // ------------------------------------------------------------------------
    async renderSuppliersView(container) {
      try {
        const token = localStorage.getItem(this.tokenKey);
        const res = await fetch('/api/erp/suppliers', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        const suppliers = data.suppliers || [];

        container.innerHTML = `
          <div class="erp-card">
            <div class="erp-card-header">
              <div>
                <span class="erp-card-title">🏭 Authorized Battery Suppliers Directory</span>
                <span style="font-size:0.85rem; color:#64748B; margin-left:0.5rem;">(${suppliers.length} Partner Manufacturers)</span>
              </div>
              <button class="erp-btn erp-btn-primary" onclick="window.erpApp.openSupplierModal()">+ Add Supplier</button>
            </div>
            <div class="erp-card-body" style="padding:0;">
              <table class="erp-table">
                <thead>
                  <tr>
                    <th>Supplier / Manufacturer</th>
                    <th>PAN / Tax ID</th>
                    <th>Contact Person</th>
                    <th>Phone / Email</th>
                    <th>Depot / Location</th>
                    <th>Terms</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${suppliers.map(s => `
                    <tr>
                      <td>
                        <div style="font-weight:700; color:#0F172A;">${s.name}</div>
                        <div style="font-size:0.75rem; color:#64748B;">${Array.isArray(s.categories) ? s.categories.join(', ') : ''}</div>
                      </td>
                      <td><strong>${s.pan || 'N/A'}</strong></td>
                      <td>${s.contactPerson || 'Official Sales Rep'}</td>
                      <td>
                        <div>${s.phone || 'N/A'}</div>
                        <div style="font-size:0.75rem; color:#64748B;">${s.email || ''}</div>
                      </td>
                      <td>${s.address || s.city || 'Kathmandu'}</td>
                      <td><span class="erp-badge erp-badge-blue">${s.paymentTerms || 'Net 30'}</span></td>
                      <td><span class="erp-badge erp-badge-green">${s.status || 'ACTIVE'}</span></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `;
      } catch (e) {
        container.innerHTML = `<div class="erp-card"><div class="erp-card-body" style="color:#EF4444;">Error loading suppliers: ${e.message}</div></div>`;
      }
    }

    openSupplierModal() {
      const modal = document.getElementById('erp-modal-overlay');
      const title = document.getElementById('erp-modal-title');
      const body = document.getElementById('erp-modal-body');
      if (!modal || !title || !body) return;

      title.textContent = 'Add Authorized Supplier Partner';

      body.innerHTML = `
        <form onsubmit="event.preventDefault(); window.erpApp.submitSupplierForm();">
          <div class="erp-form-group">
            <label class="erp-form-label">Supplier / Company Name</label>
            <input type="text" id="sup-name" class="erp-input" placeholder="e.g. Exide Industries Ltd." required>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
            <div class="erp-form-group">
              <label class="erp-form-label">Official Tax PAN</label>
              <input type="text" id="sup-pan" class="erp-input" placeholder="e.g. 301294821" required>
            </div>
            <div class="erp-form-group">
              <label class="erp-form-label">Contact Person</label>
              <input type="text" id="sup-person" class="erp-input" placeholder="e.g. Sanjeev Verma">
            </div>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
            <div class="erp-form-group">
              <label class="erp-form-label">Contact Phone</label>
              <input type="tel" id="sup-phone" class="erp-input" placeholder="e.g. +977-1-4221199" required>
            </div>
            <div class="erp-form-group">
              <label class="erp-form-label">Email Address</label>
              <input type="email" id="sup-email" class="erp-input" placeholder="e.g. supply@exide.com.np">
            </div>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
            <div class="erp-form-group">
              <label class="erp-form-label">Depot Address</label>
              <input type="text" id="sup-addr" class="erp-input" placeholder="e.g. Birgunj Dry Port / Kathmandu">
            </div>
            <div class="erp-form-group">
              <label class="erp-form-label">Payment Terms</label>
              <select id="sup-terms" class="erp-select">
                <option value="Net 30">Net 30 Days</option>
                <option value="Net 15">Net 15 Days</option>
                <option value="Immediate">Immediate / Advance</option>
              </select>
            </div>
          </div>

          <div style="margin-top:1.5rem; display:flex; justify-content:flex-end; gap:0.75rem;">
            <button type="button" class="erp-btn erp-btn-secondary" onclick="document.getElementById('erp-modal-overlay').classList.remove('open')">Cancel</button>
            <button type="submit" class="erp-btn erp-btn-primary">Save Supplier</button>
          </div>
        </form>
      `;

      modal.classList.add('open');
    }

    async submitSupplierForm() {
      const name = document.getElementById('sup-name')?.value;
      const pan = document.getElementById('sup-pan')?.value;
      const contactPerson = document.getElementById('sup-person')?.value;
      const phone = document.getElementById('sup-phone')?.value;
      const email = document.getElementById('sup-email')?.value;
      const address = document.getElementById('sup-addr')?.value;
      const paymentTerms = document.getElementById('sup-terms')?.value;

      const token = localStorage.getItem(this.tokenKey);

      try {
        const res = await fetch('/api/erp/suppliers', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            name, pan, contactPerson, phone, email, address, paymentTerms
          })
        });
        const data = await res.json();
        if (data.success) {
          alert('Supplier added successfully!');
          document.getElementById('erp-modal-overlay')?.classList.remove('open');
          this.renderSuppliersView(document.getElementById('erp-main-view'));
        } else {
          alert('Error: ' + (data.message || 'Failed to add supplier.'));
        }
      } catch(e) {
        alert('Network error: ' + e.message);
      }
    }

    // ------------------------------------------------------------------------
    // 7. CUSTOMERS VIEW
    // ------------------------------------------------------------------------
    async renderCustomersView(container) {
      try {
        const token = localStorage.getItem(this.tokenKey);
        const res = await fetch('/api/erp/sales', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        const orders = data.orders || [];

        // Aggregate unique customer profiles from orders
        const customerMap = {};
        orders.forEach(o => {
          if (!o.customer || !o.customer.phone) return;
          const phone = o.customer.phone;
          if (!customerMap[phone]) {
            customerMap[phone] = {
              fullName: o.customer.fullName,
              phone: o.customer.phone,
              email: o.customer.email || 'N/A',
              pan: o.customer.pan || 'Retail',
              address: o.customer.address || o.customer.city || 'Kathmandu',
              ordersCount: 0,
              totalSpent: 0
            };
          }
          customerMap[phone].ordersCount += 1;
          customerMap[phone].totalSpent += (o.pricing ? o.pricing.grandTotal : 0);
        });

        const customerList = Object.values(customerMap);

        container.innerHTML = `
          <div class="erp-card">
            <div class="erp-card-header">
              <span class="erp-card-title">👥 Commercial & Retail Customer Accounts</span>
              <span style="font-size:0.85rem; color:#64748B;">(${customerList.length} Verified Buyers)</span>
            </div>
            <div class="erp-card-body" style="padding:0;">
              <table class="erp-table">
                <thead>
                  <tr>
                    <th>Customer Name</th>
                    <th>Phone (+977)</th>
                    <th>Email</th>
                    <th>PAN / Category</th>
                    <th>Delivery Address</th>
                    <th>Orders</th>
                    <th>Total Spent</th>
                  </tr>
                </thead>
                <tbody>
                  ${customerList.length === 0 ? '<tr><td colspan="7" style="text-align:center; padding:2rem; color:#64748B;">No customer accounts found yet.</td></tr>' : ''}
                  ${customerList.map(c => `
                    <tr>
                      <td style="font-weight:700;">${c.fullName}</td>
                      <td>${c.phone}</td>
                      <td>${c.email}</td>
                      <td><span class="erp-badge erp-badge-blue">${c.pan}</span></td>
                      <td>${c.address}</td>
                      <td><strong>${c.ordersCount}</strong></td>
                      <td style="font-weight:700; color:#0F172A;">NPR ${c.totalSpent.toLocaleString()}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `;
      } catch(e) {
        container.innerHTML = `<div class="erp-card"><div class="erp-card-body" style="color:#EF4444;">Error loading customer list: ${e.message}</div></div>`;
      }
    }

    // ------------------------------------------------------------------------
    // 8. REPORTS & TAX LEDGER VIEW
    // ------------------------------------------------------------------------
    async renderReportsView(container) {
      try {
        const token = localStorage.getItem(this.tokenKey);
        const [mRes, sRes, pRes] = await Promise.all([
          fetch('/api/erp/metrics', { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch('/api/erp/sales', { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch('/api/erp/purchases', { headers: { 'Authorization': `Bearer ${token}` } })
        ]);
        const mData = await mRes.json();
        const sData = await sRes.json();
        const pData = await pRes.json();

        const orders = sData.orders || [];
        const purchases = pData.purchases || [];

        let totalVatCollected = 0;
        let totalSalesRevenue = 0;
        let totalScrapRebates = 0;

        orders.forEach(o => {
          if (o.status !== 'CANCELLED' && o.pricing) {
            totalVatCollected += (o.pricing.vatAmount || 0);
            totalSalesRevenue += (o.pricing.grandTotal || 0);
            totalScrapRebates += (o.pricing.scrapExchangeDeduction || 0);
          }
        });

        let totalPurchasesCost = 0;
        purchases.forEach(po => {
          if (po.status !== 'CANCELLED' && po.pricing) {
            totalPurchasesCost += (po.pricing.grandTotal || 0);
          }
        });

        container.innerHTML = `
          <div class="erp-kpi-grid">
            <div class="erp-kpi-card">
              <div class="erp-kpi-label">Nepal IRD 13% VAT Collected</div>
              <div class="erp-kpi-val green">NPR ${totalVatCollected.toLocaleString()}</div>
              <div class="erp-kpi-sub">Seller PAN: 609823412</div>
            </div>
            <div class="erp-kpi-card">
              <div class="erp-kpi-label">Total Commercial Sales</div>
              <div class="erp-kpi-val blue">NPR ${totalSalesRevenue.toLocaleString()}</div>
              <div class="erp-kpi-sub">${orders.length} Confirmed Invoices</div>
            </div>
            <div class="erp-kpi-card">
              <div class="erp-kpi-label">Total Procurement POs</div>
              <div class="erp-kpi-val">NPR ${totalPurchasesCost.toLocaleString()}</div>
              <div class="erp-kpi-sub">${purchases.length} Purchase Orders</div>
            </div>
            <div class="erp-kpi-card">
              <div class="erp-kpi-label">Scrap Trade-in Subsidies</div>
              <div class="erp-kpi-val red">NPR ${totalScrapRebates.toLocaleString()}</div>
              <div class="erp-kpi-sub">Rebated at NPR 35 / Ah</div>
            </div>
          </div>

          <div class="erp-card" style="margin-top:1.5rem;">
            <div class="erp-card-header">
              <span class="erp-card-title">📊 Nepal IRD VAT Sales Register (Form 13)</span>
              <button class="erp-btn erp-btn-secondary" onclick="window.print()">🖨️ Print IRD Ledger</button>
            </div>
            <div class="erp-card-body" style="padding:0;">
              <table class="erp-table">
                <thead>
                  <tr>
                    <th>Invoice No</th>
                    <th>Date</th>
                    <th>Buyer Name</th>
                    <th>Buyer PAN</th>
                    <th>Taxable Sales</th>
                    <th>13% VAT Amount</th>
                    <th>Gross Invoice NPR</th>
                  </tr>
                </thead>
                <tbody>
                  ${orders.slice(0, 20).map(o => {
                    const p = o.pricing || {};
                    return `
                      <tr>
                        <td><strong>${o.invoiceNumber || o.orderId}</strong></td>
                        <td>${o.orderDateFormatted || new Date(o.date).toLocaleDateString()}</td>
                        <td>${o.customer ? o.customer.fullName : 'Retail Customer'}</td>
                        <td>${o.customer && o.customer.pan ? o.customer.pan : 'N/A'}</td>
                        <td>NPR ${(p.taxableAmount || 0).toLocaleString()}</td>
                        <td style="font-weight:700; color:#10B981;">NPR ${(p.vatAmount || 0).toLocaleString()}</td>
                        <td style="font-weight:800;">NPR ${(p.grandTotal || 0).toLocaleString()}</td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `;
      } catch(e) {
        container.innerHTML = `<div class="erp-card"><div class="erp-card-body" style="color:#EF4444;">Error loading report: ${e.message}</div></div>`;
      }
    }

    renderSettingsView(c) {
      let savedSettings = {};
      try {
        savedSettings = JSON.parse(localStorage.getItem('bm_exide_erp_settings') || '{}');
      } catch (e) {
        savedSettings = {};
      }

      const s = {
        businessName: savedSettings.businessName || 'Exide Battery Wholesale (AET Official Partner)',
        vatNumber: savedSettings.vatNumber || '609823412',
        headOffice: savedSettings.headOffice || 'Bijulibazar, opposite Sunrise City Home, Kathmandu, Nepal',
        storePhone: savedSettings.storePhone || '+977 9705997260',
        storeEmail: savedSettings.storeEmail || 'batterymartbtl@gmail.com',
        operatingHours: savedSettings.operatingHours || '8:00 AM - 8:00 PM (Daily)',
        scrapRatePerAh: savedSettings.scrapRatePerAh !== undefined ? savedSettings.scrapRatePerAh : 35,
        vatRate: savedSettings.vatRate !== undefined ? savedSettings.vatRate : 13,
        freeDeliveryThreshold: savedSettings.freeDeliveryThreshold !== undefined ? savedSettings.freeDeliveryThreshold : 0,
        wholesaleDiscount: savedSettings.wholesaleDiscount !== undefined ? savedSettings.wholesaleDiscount : 5,
        deliveryWindow: savedSettings.deliveryWindow || '2-4 Hours (Kathmandu Express)',
        dispatchHub: savedSettings.dispatchHub || 'Bijulibazar Central Service Depot',
        doorstepTesting: savedSettings.doorstepTesting !== undefined ? savedSettings.doorstepTesting : true,
        scrapPickup: savedSettings.scrapPickup !== undefined ? savedSettings.scrapPickup : true,
        smsAlerts: savedSettings.smsAlerts !== undefined ? savedSettings.smsAlerts : true,
        whatsappAlerts: savedSettings.whatsappAlerts !== undefined ? savedSettings.whatsappAlerts : true,
        minStockAlert: savedSettings.minStockAlert !== undefined ? savedSettings.minStockAlert : 5
      };

      c.innerHTML = `
        <div style="max-width: 1080px; margin: 0 auto; display: flex; flex-direction: column; gap: 1.5rem;">
          <!-- Top Bar Header with Actions -->
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
            <div>
              <h2 style="font-size: 1.35rem; font-weight: 800; color: var(--erp-dark); margin: 0 0 0.25rem 0;">
                ⚙️ Store Configuration & Operations Settings
              </h2>
              <p style="font-size: 0.84rem; color: var(--erp-muted); margin: 0;">
                Manage business registration, IRD VAT, scrap trade-in calculations, dispatch logistics, and live alerts.
              </p>
            </div>
            <div style="display: flex; gap: 0.65rem; flex-wrap: wrap;">
              <button type="button" class="erp-btn erp-btn-secondary" onclick="window.erpApp.exportProductsCSV()">
                📥 Export Stock Master
              </button>
              <button type="button" class="erp-btn erp-btn-secondary" onclick="window.erpApp.exportSalesOrdersCSV()">
                📄 Export Sales Ledger
              </button>
              <button type="button" class="erp-btn erp-btn-primary" onclick="document.getElementById('erp-settings-form').requestSubmit()">
                💾 Save All Settings
              </button>
            </div>
          </div>

          <form id="erp-settings-form" onsubmit="event.preventDefault(); window.erpApp.saveSettingsFromForm();">
            <!-- 1. General Business & Legal Identification -->
            <div class="erp-card" style="margin-bottom: 1.5rem;">
              <div class="erp-card-header">
                <span class="erp-card-title">🏢 1. General Business Profile & Nepal IRD Tax</span>
              </div>
              <div class="erp-card-body">
                <div class="erp-form-grid" style="margin-bottom: 1rem;">
                  <div class="erp-form-group">
                    <label class="erp-form-label">Registered Legal Name / Trade Entity *</label>
                    <input type="text" id="erp-cfg-bizname" class="erp-input" style="width:100%;" value="${s.businessName}" required />
                    <small style="color:var(--erp-muted); font-size:0.75rem; display:block; margin-top:4px;">Printed on official IRD tax invoices and digital receipts.</small>
                  </div>
                  <div class="erp-form-group">
                    <label class="erp-form-label">Nepal IRD VAT / PAN Registration *</label>
                    <input type="text" id="erp-cfg-vat" class="erp-input" style="width:100%; font-weight:700; color:#003399;" value="${s.vatNumber}" required />
                    <small style="color:var(--erp-muted); font-size:0.75rem; display:block; margin-top:4px;">Official 9-digit Inland Revenue Department taxpayer identifier.</small>
                  </div>
                </div>

                <div class="erp-form-group" style="margin-bottom: 1rem;">
                  <label class="erp-form-label">Central Warehouse / Head Office Location *</label>
                  <input type="text" id="erp-cfg-hq" class="erp-input" style="width:100%;" value="${s.headOffice}" required />
                </div>

                <div class="erp-form-grid">
                  <div class="erp-form-group">
                    <label class="erp-form-label">Customer Support Hotline / WhatsApp *</label>
                    <input type="text" id="erp-cfg-phone" class="erp-input" style="width:100%; font-weight:700;" value="${s.storePhone}" required />
                  </div>
                  <div class="erp-form-group">
                    <label class="erp-form-label">Official Invoicing & Support Email</label>
                    <input type="email" id="erp-cfg-email" class="erp-input" style="width:100%;" value="${s.storeEmail}" required />
                  </div>
                </div>
              </div>
            </div>

            <!-- 2. Pricing, Tax & Trade-In Rebates -->
            <div class="erp-card" style="margin-bottom: 1.5rem;">
              <div class="erp-card-header">
                <span class="erp-card-title">💰 2. Pricing Engine, Tax Rates & Scrap Battery Buyback</span>
              </div>
              <div class="erp-card-body">
                <div class="erp-form-grid" style="margin-bottom: 1rem;">
                  <div class="erp-form-group">
                    <label class="erp-form-label">♻️ Scrap Battery Buyback Rate (NPR per Ah) *</label>
                    <div style="display:flex; align-items:center; gap:0.5rem;">
                      <input type="number" id="erp-cfg-scraprate" class="erp-input" style="width:140px; font-weight:800; color:#ED1C24; font-size:1.1rem;" value="${s.scrapRatePerAh}" min="5" max="100" step="0.5" required />
                      <span style="font-weight:700; color:var(--erp-dark);">NPR / Ah</span>
                    </div>
                    <small style="color:var(--erp-muted); font-size:0.75rem; display:block; margin-top:4px;">
                      Deducted automatically during cart checkout (e.g. 150Ah × NPR ${s.scrapRatePerAh} = NPR ${(150 * s.scrapRatePerAh).toLocaleString()} trade-in discount).
                    </small>
                  </div>

                  <div class="erp-form-group">
                    <label class="erp-form-label">🏛️ Nepal Value-Added Tax (VAT Rate %) *</label>
                    <div style="display:flex; align-items:center; gap:0.5rem;">
                      <input type="number" id="erp-cfg-vatrate" class="erp-input" style="width:140px; font-weight:800; font-size:1.1rem;" value="${s.vatRate}" min="0" max="30" step="0.5" required />
                      <span style="font-weight:700; color:var(--erp-dark);">%</span>
                    </div>
                    <small style="color:var(--erp-muted); font-size:0.75rem; display:block; margin-top:4px;">
                      Official standard statutory VAT rate applied to taxable sales invoices.
                    </small>
                  </div>
                </div>

                <div class="erp-form-grid">
                  <div class="erp-form-group">
                    <label class="erp-form-label">🚚 Free Kathmandu Valley Delivery Minimum Order</label>
                    <div style="display:flex; align-items:center; gap:0.5rem;">
                      <input type="number" id="erp-cfg-freedelivery" class="erp-input" style="width:140px; font-weight:700;" value="${s.freeDeliveryThreshold}" min="0" step="500" />
                      <span style="font-weight:700; color:var(--erp-dark);">NPR (0 = Always Free)</span>
                    </div>
                  </div>

                  <div class="erp-form-group">
                    <label class="erp-form-label">👑 Wholesale Partner Volume Discount (%)</label>
                    <div style="display:flex; align-items:center; gap:0.5rem;">
                      <input type="number" id="erp-cfg-wsdiscount" class="erp-input" style="width:140px; font-weight:700;" value="${s.wholesaleDiscount}" min="0" max="50" step="1" />
                      <span style="font-weight:700; color:var(--erp-dark);">% Extra Discount</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 3. Logistics, Dispatch Hub & Doorstep Services -->
            <div class="erp-card" style="margin-bottom: 1.5rem;">
              <div class="erp-card-header">
                <span class="erp-card-title">🚚 3. Dispatch Logistics & Field Technician Services</span>
              </div>
              <div class="erp-card-body">
                <div class="erp-form-grid" style="margin-bottom: 1.25rem;">
                  <div class="erp-form-group">
                    <label class="erp-form-label">Central Dispatch Depot Location</label>
                    <input type="text" id="erp-cfg-hub" class="erp-input" style="width:100%;" value="${s.dispatchHub}" />
                  </div>
                  <div class="erp-form-group">
                    <label class="erp-form-label">Express Delivery Fulfillment Window</label>
                    <input type="text" id="erp-cfg-window" class="erp-input" style="width:100%;" value="${s.deliveryWindow}" />
                  </div>
                </div>

                <div style="display:flex; flex-direction:column; gap:0.85rem; padding:1rem; background:#F8FAFC; border-radius:10px; border:1px solid #E2E8F0;">
                  <label style="display:flex; align-items:center; gap:0.75rem; cursor:pointer; font-size:0.88rem; font-weight:700; color:var(--erp-dark);">
                    <input type="checkbox" id="erp-cfg-doorstep-test" ${s.doorstepTesting ? 'checked' : ''} style="width:18px; height:18px; accent-color:#003399;" />
                    <span>⚡ Free Doorstep Voltage & Cold Cranking Amps (CCA) Inspection by Technician</span>
                  </label>
                  <label style="display:flex; align-items:center; gap:0.75rem; cursor:pointer; font-size:0.88rem; font-weight:700; color:var(--erp-dark);">
                    <input type="checkbox" id="erp-cfg-scrap-pickup" ${s.scrapPickup ? 'checked' : ''} style="width:18px; height:18px; accent-color:#003399;" />
                    <span>♻️ Delivery Crew Doorstep Collection of Old Scrap Battery with Spot Cash Rebate</span>
                  </label>
                </div>
              </div>
            </div>

            <!-- 4. Operational Alerts & Inventory Thresholds -->
            <div class="erp-card" style="margin-bottom: 1.5rem;">
              <div class="erp-card-header">
                <span class="erp-card-title">🔔 4. Operational Alerts & Low-Stock Safeguards</span>
              </div>
              <div class="erp-card-body">
                <div class="erp-form-grid" style="margin-bottom: 1.25rem;">
                  <div class="erp-form-group">
                    <label class="erp-form-label">⚠️ Global Minimum Reorder Alert Threshold</label>
                    <div style="display:flex; align-items:center; gap:0.5rem;">
                      <input type="number" id="erp-cfg-minstock" class="erp-input" style="width:140px; font-weight:800; color:#D97706; font-size:1.05rem;" value="${s.minStockAlert}" min="1" max="50" />
                      <span style="font-weight:700; color:var(--erp-dark);">Units remaining</span>
                    </div>
                    <small style="color:var(--erp-muted); font-size:0.75rem; display:block; margin-top:4px;">
                      Triggers instant warning badges on executive dashboard and stock ledger when depleted.
                    </small>
                  </div>
                  <div class="erp-form-group">
                    <label class="erp-form-label">Operating Hours for Storefront</label>
                    <input type="text" id="erp-cfg-hours" class="erp-input" style="width:100%;" value="${s.operatingHours}" />
                  </div>
                </div>

                <div style="display:flex; flex-direction:column; gap:0.85rem; padding:1rem; background:#F8FAFC; border-radius:10px; border:1px solid #E2E8F0;">
                  <label style="display:flex; align-items:center; gap:0.75rem; cursor:pointer; font-size:0.88rem; font-weight:700; color:var(--erp-dark);">
                    <input type="checkbox" id="erp-cfg-whatsapp" ${s.whatsappAlerts ? 'checked' : ''} style="width:18px; height:18px; accent-color:#059669;" />
                    <span>💬 WhatsApp Order Dispatch Alerts & Digital Receipt links to Customers</span>
                  </label>
                  <label style="display:flex; align-items:center; gap:0.75rem; cursor:pointer; font-size:0.88rem; font-weight:700; color:var(--erp-dark);">
                    <input type="checkbox" id="erp-cfg-sms" ${s.smsAlerts ? 'checked' : ''} style="width:18px; height:18px; accent-color:#003399;" />
                    <span>📱 SMS Out-For-Delivery Alerts with Technician Contact Info</span>
                  </label>
                </div>
              </div>
            </div>

            <!-- Save Bar at Bottom -->
            <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1rem; margin-bottom: 2rem;">
              <button type="button" class="erp-btn erp-btn-secondary" onclick="window.erpApp.resetSettingsToDefaults()">
                ↺ Reset Defaults
              </button>
              <button type="submit" class="erp-btn erp-btn-primary" style="height:44px; padding:0 1.75rem;">
                💾 Save Store Settings
              </button>
            </div>
          </form>
        </div>
      `;
    }

    saveSettingsFromForm() {
      const settings = {
        businessName: document.getElementById('erp-cfg-bizname')?.value.trim() || 'Exide Battery Wholesale (AET Official Partner)',
        vatNumber: document.getElementById('erp-cfg-vat')?.value.trim() || '609823412',
        headOffice: document.getElementById('erp-cfg-hq')?.value.trim() || 'Bijulibazar, Kathmandu',
        storePhone: document.getElementById('erp-cfg-phone')?.value.trim() || '+977 9705997260',
        storeEmail: document.getElementById('erp-cfg-email')?.value.trim() || 'batterymartbtl@gmail.com',
        scrapRatePerAh: Number(document.getElementById('erp-cfg-scraprate')?.value) || 35,
        vatRate: Number(document.getElementById('erp-cfg-vatrate')?.value) || 13,
        freeDeliveryThreshold: Number(document.getElementById('erp-cfg-freedelivery')?.value) || 0,
        wholesaleDiscount: Number(document.getElementById('erp-cfg-wsdiscount')?.value) || 5,
        dispatchHub: document.getElementById('erp-cfg-hub')?.value.trim() || 'Bijulibazar Central Service Depot',
        deliveryWindow: document.getElementById('erp-cfg-window')?.value.trim() || '2-4 Hours (Kathmandu Express)',
        operatingHours: document.getElementById('erp-cfg-hours')?.value.trim() || '8:00 AM - 8:00 PM (Daily)',
        doorstepTesting: document.getElementById('erp-cfg-doorstep-test')?.checked ?? true,
        scrapPickup: document.getElementById('erp-cfg-scrap-pickup')?.checked ?? true,
        minStockAlert: Number(document.getElementById('erp-cfg-minstock')?.value) || 5,
        whatsappAlerts: document.getElementById('erp-cfg-whatsapp')?.checked ?? true,
        smsAlerts: document.getElementById('erp-cfg-sms')?.checked ?? true
      };

      localStorage.setItem('bm_exide_erp_settings', JSON.stringify(settings));

      if (window.stockManager && typeof window.stockManager.updateSettings === 'function') {
        window.stockManager.updateSettings({
          scrapRatePerAh: settings.scrapRatePerAh,
          storePhone: settings.storePhone,
          storeEmail: settings.storeEmail,
          headOffice: settings.headOffice,
          vatNumber: settings.vatNumber
        });
      }

      alert('ERP Store & Operations settings updated successfully! ✓');
    }

    resetSettingsToDefaults() {
      if (!confirm('Reset all ERP store parameters to official factory defaults?')) return;
      localStorage.removeItem('bm_exide_erp_settings');
      this.renderSettingsView(document.getElementById('erp-main-view'));
      alert('Settings reset to official Exide factory defaults.');
    }

    async exportSalesOrdersCSV() {
      let orders = [];
      try {
        const token = localStorage.getItem(this.tokenKey);
        const res = await fetch('/api/erp/sales', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        orders = data.orders || [];
      } catch (e) {
        orders = [];
      }

      if (!orders || orders.length === 0) {
        try {
          orders = JSON.parse(localStorage.getItem('exide_orders') || '[]');
        } catch (e) {
          orders = [];
        }
      }

      if (orders.length === 0) {
        alert('No sales orders recorded yet to export.');
        return;
      }

      let csv = 'Order ID,Customer Name,Phone,Date,Status,Payment Method,Grand Total (NPR)\\n';
      orders.forEach(o => {
        const custName = (o.customer?.name || o.customerName || 'Customer').replace(/"/g, '""');
        const phone = o.customer?.phone || o.customerPhone || '';
        const date = o.createdAt ? new Date(o.createdAt).toLocaleDateString('en-GB') : '';
        const status = o.status || 'CONFIRMED';
        const payment = o.paymentMethod || 'Cash on Delivery';
        const total = o.pricing?.grandTotal || o.total || o.grandTotal || 0;
        csv += `"${o.id}","${custName}","${phone}","${date}","${status}","${payment}",${total}\\n`;
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Exide_Sales_Ledger_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    renderUsersView(c) {
      c.innerHTML = `
        <div class="erp-card">
          <div class="erp-card-header">
            <span class="erp-card-title">🛡️ Staff Directory & Role-Based Access Control</span>
            <button class="erp-btn erp-btn-primary" onclick="alert('Staff invitations can be created by SuperAdmin.')">+ Invite Staff Member</button>
          </div>
          <div class="erp-card-body">
            <p style="color:#64748B;">Staff accounts are protected with salted cryptographic hashes and authenticated server claims. Self-registration is disabled for security compliance.</p>
          </div>
        </div>
      `;
    }

    // ------------------------------------------------------------------------
    // APPLICATION SHELL & LOGIN SCREEN
    // ------------------------------------------------------------------------
    renderAppShell() {
      const user = this.currentUser || {};
      const appEl = document.getElementById('erp-app-root');
      if (!appEl) return;

      appEl.innerHTML = `
        <div class="erp-container">
          <!-- Sidebar Navigation -->
          <aside class="erp-sidebar" id="erp-sidebar">
            <div class="erp-brand">
              <img src="/assets/logo.png" alt="Exide Nepal" class="erp-brand-logo">
              <div>
                <div class="erp-brand-title">EXIDE ERP</div>
                <div class="erp-brand-sub">The Power House Nepal</div>
              </div>
            </div>

            <nav class="erp-nav">
              <a class="erp-nav-item active" data-route="dashboard" onclick="window.erpApp.navigate('dashboard')">
                <span class="erp-nav-icon">📊</span> Dashboard
              </a>
              <a class="erp-nav-item" data-route="orders" onclick="window.erpApp.navigate('orders')">
                <span class="erp-nav-icon">🛍️</span> Orders Management <span class="erp-nav-badge" id="erp-nav-orders-count" style="display:none; background:#ED1C24; color:#FFFFFF; border-radius:12px; font-size:0.7rem; font-weight:800; padding:1px 7px; margin-left:auto;">0</span>
              </a>
              <a class="erp-nav-item" data-route="products" onclick="window.erpApp.navigate('products')">
                <span class="erp-nav-icon">📦</span> Product Catalogue
              </a>
              <a class="erp-nav-item" data-route="inventory" onclick="window.erpApp.navigate('inventory')">
                <span class="erp-nav-icon">📋</span> Stock Ledger
              </a>
              <a class="erp-nav-item" data-route="purchases" onclick="window.erpApp.navigate('purchases')">
                <span class="erp-nav-icon">📥</span> Purchases & GRN
              </a>
              <a class="erp-nav-item" data-route="sales" onclick="window.erpApp.navigate('sales')">
                <span class="erp-nav-icon">🧾</span> Sales & Invoices
              </a>
              <a class="erp-nav-item" data-route="customers" onclick="window.erpApp.navigate('customers')">
                <span class="erp-nav-icon">👥</span> Customers
              </a>
              <a class="erp-nav-item" data-route="suppliers" onclick="window.erpApp.navigate('suppliers')">
                <span class="erp-nav-icon">🏭</span> Suppliers
              </a>
              <a class="erp-nav-item" data-route="reports" onclick="window.erpApp.navigate('reports')">
                <span class="erp-nav-icon">📈</span> Reports
              </a>
              <a class="erp-nav-item" data-route="settings" onclick="window.erpApp.navigate('settings')">
                <span class="erp-nav-icon">⚙️</span> Store Settings
              </a>
              <a class="erp-nav-item" data-route="users" onclick="window.erpApp.navigate('users')">
                <span class="erp-nav-icon">🛡️</span> Staff & Security
              </a>
            </nav>

            <div class="erp-user-strip">
              <div class="erp-user-info">
                <div class="erp-user-name">${user.name || 'Store Staff'}</div>
                <div class="erp-user-role-badge">${user.role || 'Staff'}</div>
              </div>
              <button class="erp-btn-logout" title="Sign Out" onclick="window.erpApp.logout()">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              </button>
            </div>
          </aside>

          <!-- Main Content Area -->
          <main class="erp-main">
            <header class="erp-topbar">
              <div style="display:flex; align-items:center; gap:1rem;">
                <button class="erp-menu-btn" onclick="document.getElementById('erp-sidebar').classList.toggle('open')">☰</button>
                <h1 class="erp-page-title" id="erp-page-title">Executive Dashboard & Live Store Sync</h1>
              </div>
              <div class="erp-topbar-actions">
                <span class="erp-badge-live">● Live Store Sync (Bijulibazar)</span>
                <div class="erp-theme-picker">
                  <span style="font-size:0.72rem; color:var(--erp-muted); font-weight:700;">Theme:</span>
                  <select id="erp-theme-select" class="erp-theme-select" onchange="window.erpApp.setTheme(this.value)">
                    <option value="slate" ${this.currentTheme === 'slate' ? 'selected' : ''}>👔 Slate</option>
                    <option value="obsidian" ${this.currentTheme === 'obsidian' ? 'selected' : ''}>🌑 Obsidian</option>
                    <option value="navy" ${this.currentTheme === 'navy' ? 'selected' : ''}>⚓ Royal Navy</option>
                    <option value="emerald" ${this.currentTheme === 'emerald' ? 'selected' : ''}>🌲 Emerald</option>
                  </select>
                </div>
                <span style="font-size:0.8rem; color:#64748B;">Asia/Kathmandu (NPR)</span>
              </div>
            </header>

            <div class="erp-content" id="erp-main-view"></div>
          </main>
        </div>

        <!-- Global Action Modal -->
        <div class="erp-modal-overlay" id="erp-modal-overlay">
          <div class="erp-modal">
            <div class="erp-modal-header">
              <h3 class="erp-modal-title" id="erp-modal-title">ERP Action</h3>
              <button class="erp-modal-close" onclick="document.getElementById('erp-modal-overlay').classList.remove('open')">&times;</button>
            </div>
            <div class="erp-modal-body" id="erp-modal-body"></div>
          </div>
        </div>
      `;
    }

    renderLoginScreen() {
      const appEl = document.getElementById('erp-app-root');
      if (!appEl) return;

      appEl.innerHTML = `
        <div class="erp-login-wrapper">
          <div class="erp-login-card">
            <div class="erp-login-header">
              <img src="/assets/logo.png" alt="Exide Nepal" class="erp-login-logo">
              <h2 class="erp-login-heading">EXIDE ERP GATEWAY</h2>
              <div class="erp-login-sub">The Power House • Bijulibazar, Kathmandu</div>
            </div>

            <div id="erp-login-error" style="display:none; background:#FEF2F2; border:1px solid #F87171; color:#B91C1C; padding:0.75rem 1rem; border-radius:6px; font-size:0.85rem; margin-bottom:1.25rem;"></div>

            <form onsubmit="event.preventDefault(); window.erpApp.handleLogin(document.getElementById('erp-user-input').value, document.getElementById('erp-pass-input').value);">
              <div class="erp-form-group">
                <label class="erp-form-label">Username / Staff Email</label>
                <input type="text" id="erp-user-input" class="erp-input" style="width:100%;" placeholder="e.g. admin@exidebattery.com.np" required autofocus>
              </div>

              <div class="erp-form-group">
                <label class="erp-form-label">Password</label>
                <input type="password" id="erp-pass-input" class="erp-input" style="width:100%;" placeholder="Enter secure password" required>
              </div>

              <button type="submit" id="erp-login-btn" class="erp-btn erp-btn-primary" style="width:100%; justify-content:center; height:44px; margin-top:1rem;">Sign In to ERP</button>
            </form>

            <div style="margin-top:1.5rem; text-align:center; font-size:0.8rem; color:#64748B;">
              🔒 Protected Enterprise System • Authorized Access Only<br>
              <a href="/" style="color:#003399; text-decoration:none; font-weight:700; margin-top:0.5rem; display:inline-block;">← Return to Customer Storefront</a>
            </div>
          </div>
        </div>
      `;
    }
  }

  // Mount application instance globally
  window.addEventListener('DOMContentLoaded', () => {
    window.erpApp = new ErpApp();
  });
})();
