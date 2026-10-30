// Exide Battery Wholesale & AET Official Partner - Comprehensive Stock & Inventory Management System (ERP)
// Commercial e-commerce inventory, order lifecycle, scrap rebate settings, media uploads, and dynamic category specs

class StockManagementSystem {
  constructor() {
    this.storageKey = 'bm_exide_stock_inventory';
    this.logsKey = 'bm_exide_stock_audit_logs';
    this.ordersKey = 'bm_exide_orders';
    this.settingsKey = 'bm_exide_erp_settings';
    this.customCategoriesKey = 'bm_exide_custom_categories';

    this.inventory = [];
    this.auditLogs = [];
    this.orders = [];
    this.settings = {
      scrapRatePerAh: 35, // NPR per Ah for scrap battery trade-in
      storePhone: '+9779705997260',
      storeEmail: 'batterymartbtl@gmail.com',
      headOffice: 'Kathmandu - Bijulibazar (Head office) - Bijulibazar, Anamnagar (near to BhatBhateni)',
      vatNumber: '609823412',
      defaultDeliveryFee: 0
    };
    this.customCategories = [];
    this.activeAdminTab = 'inventory'; // 'inventory' | 'orders' | 'audit' | 'settings'
    this.currentEditingProductId = null;
    this.selectedOrderForView = null;
    this.currentVehicleTags = [];
    this.currentMediaList = [];
    this.logisticsCrewKey = 'bm_exide_logistics_crew';
    this.logisticsCrew = [];

    this.init();
  }

  init() {
    this.loadSettings();
    this.loadLogisticsCrew();
    this.loadCustomCategories();
    this.loadData();
    this.loadOrders();

    // Real-time synchronization when order placed from storefront cart or another tab
    window.addEventListener('orders_synced', (e) => {
      this.loadOrders();
      this.syncServerOrders();
    });

    window.addEventListener('storage', (e) => {
      if (e.key === 'exide_orders' || e.key === 'bm_exide_orders' || e.key === 'exide_orders_sync_trigger') {
        this.loadOrders();
        this.syncServerOrders();
      }
    });

    // Expose productsCatalog globally for storefront & cart
    window.productsCatalog = this.inventory;

    // Bind dropzone and editor table shortcuts after DOM loads
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.bindSystemEvents());
    } else {
      setTimeout(() => this.bindSystemEvents(), 80);
    }
  }

  bindSystemEvents() {
    this.setupDropzone();
    this.setupEditorTableShortcuts();
  }

  setupDropzone() {
    const dropzone = document.getElementById('media-dropzone');
    if (!dropzone || dropzone._hasDropListeners) return;
    dropzone._hasDropListeners = true;

    ['dragenter', 'dragover'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.add('drag-active');
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('drag-active');
      }, false);
    });

    dropzone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const files = dt ? dt.files : null;
      if (files && files.length > 0) {
        this.handleMultipleMediaUpload(files);
      }
    }, false);
  }

  setupEditorTableShortcuts() {
    const editor = document.getElementById('new-detailed-desc-editor');
    if (!editor || editor._hasTableShortcuts) return;
    editor._hasTableShortcuts = true;

    editor.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return;
        let cell = sel.anchorNode;
        while (cell && cell !== editor && cell.nodeName !== 'TD' && cell.nodeName !== 'TH') {
          cell = cell.parentNode;
        }
        if (cell && (cell.nodeName === 'TD' || cell.nodeName === 'TH')) {
          e.preventDefault();
          const table = cell.closest('table');
          if (!table) return;
          const allCells = Array.from(table.querySelectorAll('th, td'));
          const currentIdx = allCells.indexOf(cell);
          if (e.shiftKey) {
            if (currentIdx > 0) {
              allCells[currentIdx - 1].focus();
            }
          } else {
            if (currentIdx < allCells.length - 1) {
              allCells[currentIdx + 1].focus();
            } else {
              window.addDescTableRow();
              const updatedCells = Array.from(table.querySelectorAll('th, td'));
              if (updatedCells[currentIdx + 1]) {
                updatedCells[currentIdx + 1].focus();
              }
            }
          }
        }
      }
    });
  }

  loadSettings() {
    try {
      const stored = localStorage.getItem(this.settingsKey);
      if (stored) {
        this.settings = { ...this.settings, ...JSON.parse(stored) };
      } else {
        this.saveSettings();
      }
    } catch (e) {
      console.error('Error loading ERP settings', e);
    }
  }

  saveSettings() {
    try {
      localStorage.setItem(this.settingsKey, JSON.stringify(this.settings));
    } catch (e) {
      console.error('Error saving ERP settings', e);
    }
  }

  getScrapRatePerAh() {
    return Number(this.settings.scrapRatePerAh) || 35;
  }

  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    this.saveSettings();
    if (window.cartSystem) {
      window.cartSystem.renderCartUI();
    }
    showToast('ERP Store settings updated successfully!', 'success');
  }

  loadCustomCategories() {
    try {
      const stored = localStorage.getItem(this.customCategoriesKey);
      if (stored) {
        this.customCategories = JSON.parse(stored);
      }
    } catch (e) {
      console.error('Error loading custom categories', e);
    }
  }

  saveCustomCategories() {
    try {
      localStorage.setItem(this.customCategoriesKey, JSON.stringify(this.customCategories));
    } catch (e) {
      console.error('Error saving custom categories', e);
    }
  }

  getAllCategories() {
    const baseCats = [
      { id: 'inverter-battery', name: 'Inverter Battery' },
      { id: 'car-battery', name: 'Car Battery' },
      { id: 'automotive-battery', name: 'Automotive Battery' },
      { id: 'lithium-battery', name: 'Lithium Battery' },
      { id: 'inverter', name: 'Inverter & Home UPS' },
      { id: 'solar-hybrid-pcu', name: 'Solar Hybrid PCU' },
      { id: 'online-ups', name: 'Online UPS' },
      { id: 'voltage-stabilizer', name: 'Voltage Stabilizer' },
      { id: 'solar-charge-controller', name: 'Solar Charge Controller' }
    ];
    return [...baseCats, ...this.customCategories];
  }

  addCustomCategory(name, slug = null) {
    if (!name || !name.trim()) return null;
    const catName = name.trim();
    const catId = slug ? slug.trim().toLowerCase() : catName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    
    // Check if exists
    const exists = this.getAllCategories().some(c => c.id === catId);
    if (exists) {
      return catId;
    }

    const newCat = { id: catId, name: catName, isCustom: true };
    this.customCategories.push(newCat);
    this.saveCustomCategories();
    this.populateCategoryDropdowns();
    showToast(`New Category "${catName}" added!`, 'success');
    return catId;
  }

  loadData() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        this.inventory = JSON.parse(stored);
      } else {
        // Initialize with INITIAL_PRODUCTS
        this.inventory = JSON.parse(JSON.stringify(INITIAL_PRODUCTS));
        this.saveInventory();
      }

      const storedLogs = localStorage.getItem(this.logsKey);
      if (storedLogs) {
        this.auditLogs = JSON.parse(storedLogs);
      } else {
        this.auditLogs = [
          {
            id: 'LOG-1001',
            timestamp: new Date(Date.now() - 3600000 * 24 * 2).toLocaleString(),
            sku: 'EX-IMTT1500',
            productName: 'Exide 150 Ah Invamaster Tubular Battery',
            action: 'RESTOCK',
            quantity: 20,
            previousStock: 4,
            newStock: 24,
            reason: 'Consignment shipment from Exide Nepal Depot',
            user: 'Store Manager (Kathmandu HQ)'
          },
          {
            id: 'LOG-1002',
            timestamp: new Date(Date.now() - 3600000 * 12).toLocaleString(),
            sku: 'EX-MTX80',
            productName: 'Exide Matrix 12V 80Ah Heavy-Duty Car Battery',
            action: 'RESTOCK',
            quantity: 10,
            previousStock: 8,
            newStock: 18,
            reason: 'Vehicle battery restock batch #B98',
            user: 'Inventory Lead'
          }
        ];
        this.saveLogs();
      }
    } catch (e) {
      console.error('Error loading inventory data', e);
      this.inventory = JSON.parse(JSON.stringify(INITIAL_PRODUCTS));
    }
  }

  saveInventory() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.inventory));
      window.productsCatalog = this.inventory;
    } catch (e) {
      console.error('Error saving inventory', e);
    }
  }

  saveLogs() {
    try {
      localStorage.setItem(this.logsKey, JSON.stringify(this.auditLogs));
    } catch (e) {
      console.error('Error saving logs', e);
    }
  }

  loadLogisticsCrew() {
    try {
      const stored = localStorage.getItem(this.logisticsCrewKey);
      if (stored) {
        this.logisticsCrew = JSON.parse(stored);
      } else {
        this.logisticsCrew = [
          {
            id: 'RIDER-01',
            name: 'Bikram Thapa',
            phone: '9851087654',
            vehicleType: 'Delivery Van',
            plateNumber: 'BA 2 CHA 4521',
            territory: 'Kathmandu Valley Central & Lalitpur',
            status: 'Available',
            activeOrdersCount: 2
          },
          {
            id: 'RIDER-02',
            name: 'Prakash Shrestha',
            phone: '9847098231',
            vehicleType: 'Motorbike Express',
            plateNumber: 'BA 98 PA 1234',
            territory: 'Kathmandu Ring Road & Bhaktapur',
            status: 'On Delivery',
            activeOrdersCount: 1
          },
          {
            id: 'RIDER-03',
            name: 'Sunil Chaudhary',
            phone: '9801239876',
            vehicleType: 'Commercial Pickup',
            plateNumber: 'LU 1 CHA 8842',
            territory: 'Butwal - Bhairahawa Corridor',
            status: 'Available',
            activeOrdersCount: 0
          }
        ];
        this.saveLogisticsCrew();
      }
    } catch (e) {
      this.logisticsCrew = [];
    }
  }

  saveLogisticsCrew() {
    try {
      localStorage.setItem(this.logisticsCrewKey, JSON.stringify(this.logisticsCrew));
      if (window.firebaseService) {
        window.firebaseService.saveLogisticsCrew(this.logisticsCrew);
      }
    } catch (e) {}
  }

  addLogisticsCrewMember(data) {
    if (!data.name || !data.phone) {
      if (typeof showToast === 'function') showToast('Rider name and phone are required.', 'warning');
      return;
    }
    const cleanPhone = data.phone.replace(/\D/g, '');
    const newMember = {
      id: 'RIDER-' + Date.now().toString(36).toUpperCase(),
      name: data.name.trim(),
      phone: cleanPhone || data.phone.trim(),
      vehicleType: data.vehicleType || 'Delivery Van',
      plateNumber: (data.plateNumber || 'BA 2 CHA 0000').toUpperCase(),
      territory: data.territory || 'Kathmandu Valley',
      status: data.status || 'Available',
      activeOrdersCount: 0
    };
    this.logisticsCrew.push(newMember);
    this.saveLogisticsCrew();
    this.renderSettingsUI();
    if (typeof showToast === 'function') showToast(`Logistics rider ${newMember.name} added successfully!`, 'success');
  }

  deleteLogisticsCrewMember(id) {
    if (confirm('Are you sure you want to remove this delivery crew member?')) {
      this.logisticsCrew = this.logisticsCrew.filter(r => r.id !== id);
      this.saveLogisticsCrew();
      this.renderSettingsUI();
      if (typeof showToast === 'function') showToast('Logistics crew member removed.', 'info');
    }
  }

  normalizeOrder(order) {
    if (!order) return null;
    const status = order.status || order.orderStatus || 'Confirmed';
    const orderId = order.orderId || order.id || ('EXD-' + Math.floor(100000 + Math.random() * 900000));
    const customer = order.customer || {};
    const pricing = order.pricing || {};
    const calculations = order.calculations || {};
    const grandTotal = Number(calculations.grandTotal ?? pricing.grandTotal ?? 0);
    const rawSubtotal = Number(calculations.rawSubtotal ?? pricing.rawSubtotal ?? pricing.subtotal ?? grandTotal);
    const scrapExchangeDeduction = Number(calculations.scrapExchangeDeduction ?? pricing.scrapExchangeDeduction ?? pricing.scrapDiscount ?? 0);
    const finalDelivery = Number(calculations.finalDelivery ?? pricing.deliveryFee ?? 0);
    const vatAmount = Number(calculations.vatAmount ?? pricing.vatAmount ?? pricing.vat13Percent ?? 0);
    const taxableAmount = Number(calculations.taxableAmount ?? pricing.taxableAmount ?? (grandTotal - vatAmount));

    let items = Array.isArray(order.items) && order.items.length > 0 ? order.items.map(it => ({
      id: it.id || it.sku || 'EX-ITEM',
      sku: it.sku || it.id || 'EX-SKU',
      name: it.name || 'Exide Commercial Battery',
      price: Number(it.price || 0),
      quantity: Number(it.quantity || 1),
      capacity: it.capacity || '',
      brand: it.brand || 'Exide',
      image: it.image || 'assets/logo.png'
    })) : [
      {
        id: 'exide-battery-150-invamaster',
        sku: 'EX-IMTT1500',
        name: 'Exide 150 Ah Invamaster Tubular Battery',
        price: grandTotal || 34000,
        quantity: 1,
        capacity: '150Ah - 12V',
        brand: 'Exide',
        image: 'assets/images/exide-imtt1500.png'
      }
    ];

    return {
      ...order,
      orderId: orderId,
      id: orderId,
      status: status,
      orderStatus: status,
      invoiceNumber: order.invoiceNumber || ('INV-2026-' + Math.floor(10000 + Math.random() * 90000)),
      orderDate: order.orderDate || order.orderDateFormatted || (order.date ? new Date(order.date).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB')),
      customer: {
        fullName: customer.fullName || customer.name || 'Valued Customer',
        phone: customer.phone || '98XXXXXXXX',
        email: customer.email || '',
        province: customer.province || 'Bagmati',
        district: customer.district || 'Kathmandu',
        city: customer.city || customer.district || 'Kathmandu',
        ward: customer.ward || '01',
        address: customer.address || customer.deliveryAddress || 'Kathmandu, Nepal',
        deliveryAddress: customer.deliveryAddress || customer.address || 'Kathmandu, Nepal',
        landmark: customer.landmark || '',
        notes: customer.notes || order.notes || ''
      },
      items: items,
      calculations: {
        rawSubtotal,
        scrapExchangeDeduction,
        scrapBatteryAh: calculations.scrapBatteryAh || order.scrapExchange?.capacityAh || 0,
        scrapRate: calculations.scrapRate || order.scrapExchange?.ratePerAh || 35,
        finalDelivery,
        vatAmount,
        taxableAmount,
        grandTotal
      },
      pricing: {
        rawSubtotal,
        scrapExchangeDeduction,
        deliveryFee: finalDelivery,
        vatAmount,
        taxableAmount,
        grandTotal
      },
      paymentMethod: (order.paymentMethod || 'COD').toUpperCase(),
      paymentStatus: (order.paymentStatus || (order.paymentMethod === 'COD' ? 'Pending Cash Collection' : 'Paid / Confirmed')).toString(),
      assignedRider: order.assignedRider || null
    };
  }

  assignOrderToRider(orderId, riderId) {
    let order = this.orders.find(o => o.orderId === orderId || o.id === orderId);
    if (!order) return;
    order = this.normalizeOrder(order);

    let assignedRider = null;
    if (riderId === 'PROVIDER-CARGO') {
      assignedRider = {
        id: 'PROVIDER-CARGO',
        name: 'Nepal Can Move / Pathao Cargo Logistics',
        phone: '+977-1-5970000',
        vehicle: 'Provincial Cargo Courier (Transit)'
      };
    } else if (riderId) {
      const rider = this.logisticsCrew.find(r => r.id === riderId);
      assignedRider = rider ? {
        id: rider.id,
        name: rider.name,
        phone: rider.phone,
        vehicle: `${rider.vehicleType} (${rider.plateNumber})`
      } : null;
    }

    order.assignedRider = assignedRider;
    const idx = this.orders.findIndex(o => o.orderId === orderId || o.id === orderId);
    if (idx >= 0) this.orders[idx] = order;

    this.saveOrders();
    this.renderOrdersTable();
    if (typeof showToast === 'function') {
      showToast(`Order #${orderId} assigned to ${assignedRider ? assignedRider.name : 'Unassigned'}`, 'success');
    }

    if (assignedRider && window.notifyManager && order.customer) {
      window.notifyManager.showMobileNotificationBanner({
        icon: '🚚',
        badge: 'Logistics Assigned',
        title: `Assigned: ${assignedRider.name}`,
        message: `Order #${orderId} assigned to ${assignedRider.name} (${assignedRider.phone}).`
      });
    }

    if (typeof fetch === 'function') {
      fetch('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: orderId,
          assignedRider: assignedRider
        })
      }).catch(err => console.warn('Could not sync rider assignment to backend:', err));
    }
  }

  loadOrders() {
    try {
      const stored = localStorage.getItem(this.ordersKey);
      let localOrders = [];
      if (stored) {
        try { localOrders = JSON.parse(stored); } catch (e) { localOrders = []; }
      }
      // Also merge any orders saved under 'exide_orders' by customer checkout
      const clientOrders = JSON.parse(localStorage.getItem('exide_orders') || '[]');
      const combined = [...localOrders];
      clientOrders.forEach(co => {
        if (!combined.some(o => (o.orderId && o.orderId === co.orderId) || (o.invoiceNumber && o.invoiceNumber === co.invoiceNumber))) {
          combined.unshift(co);
        }
      });

      // Purge legacy demo seed orders completely
      const demoIds = ['EX-NP-842109', 'EX-NP-719342'];
      const realOrders = combined.filter(o => {
        const id = o.orderId || o.id;
        return id && !demoIds.includes(id);
      });

      this.orders = realOrders.map(o => this.normalizeOrder(o)).filter(Boolean);
      this.orders.sort((a, b) => {
        const dateA = new Date(a.date || a.orderDate || 0).getTime();
        const dateB = new Date(b.date || b.orderDate || 0).getTime();
        return dateB - dateA;
      });

      this.saveOrders();

      // Immediately sync with authoritative backend orders API
      this.syncServerOrders();
    } catch (e) {
      console.error('Error loading orders', e);
      this.orders = [];
    }
  }

  async syncServerOrders() {
    if (typeof fetch !== 'function') return;
    try {
      let serverOrders = [];
      try {
        const res = await fetch('/api/orders');
        if (res.ok) {
          const data = await res.json();
          if (data && data.success && Array.isArray(data.orders)) {
            serverOrders = data.orders;
          }
        }
      } catch (e) {}

      if (serverOrders.length === 0) {
        try {
          const erpRes = await fetch('/api/erp/orders?status=all');
          if (erpRes.ok) {
            const erpData = await erpRes.json();
            if (erpData && erpData.success && Array.isArray(erpData.orders)) {
              serverOrders = erpData.orders;
            }
          }
        } catch (e) {}
      }

      if (serverOrders.length > 0) {
        const map = new Map();
        (this.orders || []).forEach(o => {
          const key = o.orderId || o.id || o.invoiceNumber;
          if (key) map.set(key, o);
        });

        serverOrders.forEach(so => {
          const norm = this.normalizeOrder(so);
          if (!norm) return;
          const key = norm.orderId || norm.id || norm.invoiceNumber;
          if (key) {
            const existing = map.get(key) || {};
            map.set(key, { ...existing, ...norm });
          }
        });

        const demoIds = ['EX-NP-842109', 'EX-NP-719342'];
        this.orders = Array.from(map.values())
          .filter(o => !demoIds.includes(o.orderId) && !demoIds.includes(o.id))
          .sort((a, b) => {
            const dateA = new Date(a.date || a.createdAt || a.orderDate || 0).getTime();
            const dateB = new Date(b.date || b.createdAt || b.orderDate || 0).getTime();
            return dateB - dateA;
          });

        this.saveOrders();
        if (this.activeAdminTab === 'orders') {
          this.renderOrdersTable();
        }
        if (typeof this.updateDashboardKPIs === 'function') this.updateDashboardKPIs();
      }
    } catch (err) {
      console.warn('Backend orders sync offline notice:', err);
    }
  }
      console.error('Error loading orders', e);
      this.orders = [];
    }
  }

  saveOrders() {
    try {
      localStorage.setItem(this.ordersKey, JSON.stringify(this.orders));
    } catch (e) {
      console.error('Error saving orders', e);
    }
  }

  getMetrics() {
    const totalSkus = this.inventory.length;
    const totalUnits = this.inventory.reduce((sum, item) => sum + item.stock, 0);
    const totalAssetValuation = this.inventory.reduce((sum, item) => sum + (item.costPrice * item.stock), 0);
    const totalRetailValuation = this.inventory.reduce((sum, item) => sum + (item.price * item.stock), 0);
    const lowStockCount = this.inventory.filter(item => item.stock > 0 && item.stock <= item.minStock).length;
    const outOfStockCount = this.inventory.filter(item => item.stock === 0).length;

    const totalOrders = this.orders.length;
    const pendingOrders = this.orders.filter(o => o.status === 'Pending' || o.status === 'Processing').length;
    const dispatchedOrders = this.orders.filter(o => o.status === 'Dispatched').length;
    const deliveredOrders = this.orders.filter(o => o.status === 'Delivered').length;
    const totalRevenue = this.orders.reduce((sum, o) => sum + (o.calculations?.grandTotal || 0), 0);

    return {
      totalSkus,
      totalUnits,
      totalAssetValuation,
      totalRetailValuation,
      lowStockCount,
      outOfStockCount,
      totalOrders,
      pendingOrders,
      dispatchedOrders,
      deliveredOrders,
      totalRevenue
    };
  }

  adjustStock(productId, deltaQty, reason, user = 'Inventory Staff') {
    const item = this.inventory.find(p => p.id === productId);
    if (!item) return false;

    const previousStock = item.stock;
    const newStock = Math.max(0, previousStock + deltaQty);
    item.stock = newStock;

    // Record audit log
    const log = {
      id: 'LOG-' + Math.floor(1000 + Math.random() * 9000),
      timestamp: new Date().toLocaleString(),
      sku: item.sku,
      productName: item.name,
      action: deltaQty > 0 ? 'RESTOCK / INBOUND' : 'DEDUCT / OUTBOUND',
      quantity: Math.abs(deltaQty),
      previousStock,
      newStock,
      reason: reason || (deltaQty > 0 ? 'Manual Stock Inbound' : 'Manual Stock Adjustment'),
      user
    };

    this.auditLogs.unshift(log);
    this.saveInventory();
    this.saveLogs();

    this.renderAdminUI();
    if (window.renderProductsCatalog) window.renderProductsCatalog();
    if (window.cartSystem) window.cartSystem.renderCartUI();

    showToast(`Stock updated for ${item.sku}: Now ${newStock} units`, 'success');
    return true;
  }

  deductStockForOrder(productId, qty, orderId) {
    const item = this.inventory.find(p => p.id === productId);
    if (!item) return;

    const prevStock = item.stock;
    item.stock = Math.max(0, item.stock - qty);

    const log = {
      id: 'LOG-' + Math.floor(1000 + Math.random() * 9000),
      timestamp: new Date().toLocaleString(),
      sku: item.sku,
      productName: item.name,
      action: 'CUSTOMER ORDER',
      quantity: qty,
      previousStock: prevStock,
      newStock: item.stock,
      reason: `Customer Order #${orderId} fulfilled`,
      user: 'Automated Checkout'
    };

    this.auditLogs.unshift(log);
    this.saveInventory();
    this.saveLogs();

    this.renderAdminUI();
    if (window.renderProductsCatalog) window.renderProductsCatalog();
  }

  // ==========================================================================
  // DYNAMIC CATEGORY TECHNICAL FEATURES
  // ==========================================================================
  renderCategoryTechFields(categorySlug, currentSpecs = {}) {
    const container = document.getElementById('new-tech-features-container');
    if (!container) return;

    let fieldsHtml = '';

    if (categorySlug === 'inverter-battery') {
      fieldsHtml = `
        <div style="background:#F0F7FF; border:1px solid #BFDBFE; border-radius:8px; padding:1rem; margin-bottom:1rem;">
          <h4 style="font-size:0.88rem; font-weight:800; color:#1E40AF; margin-bottom:0.75rem;">⚡ Inverter Battery Technical Specs</h4>
          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">Battery Capacity (Ah) *</label>
              <input type="text" id="spec-capacity" class="form-input" placeholder="e.g. 150Ah @ C20" value="${currentSpecs['Capacity'] || '150 Ah @ C20'}">
            </div>
            <div class="form-group">
              <label class="form-label">Nominal Voltage (V) *</label>
              <input type="text" id="spec-voltage" class="form-input" placeholder="e.g. 12V" value="${currentSpecs['Nominal Voltage'] || '12 V'}">
            </div>
          </div>
          <div class="form-grid-2" style="margin-top:0.75rem;">
            <div class="form-group">
              <label class="form-label">Technology Plate Type</label>
              <select id="spec-tech" class="form-select">
                <option value="Tall Tubular Lead-Acid" ${currentSpecs['Technology'] === 'Tall Tubular Lead-Acid' ? 'selected' : ''}>Tall Tubular Lead-Acid</option>
                <option value="Short Tubular Deep Cycle" ${currentSpecs['Technology'] === 'Short Tubular Deep Cycle' ? 'selected' : ''}>Short Tubular Deep Cycle</option>
                <option value="Flat Plate Inverter Battery" ${currentSpecs['Technology'] === 'Flat Plate Inverter Battery' ? 'selected' : ''}>Flat Plate Inverter Battery</option>
                <option value="Gel Tubular Maintenance Free" ${currentSpecs['Technology'] === 'Gel Tubular Maintenance Free' ? 'selected' : ''}>Gel Tubular Maintenance Free</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Electrolyte Volume</label>
              <input type="text" id="spec-electrolyte" class="form-input" placeholder="e.g. 18.5 Litres" value="${currentSpecs['Electrolyte Volume'] || '18.5 Litres'}">
            </div>
          </div>
          <div class="form-grid-2" style="margin-top:0.75rem;">
            <div class="form-group">
              <label class="form-label">Gross Weight</label>
              <input type="text" id="spec-weight" class="form-input" placeholder="e.g. 58 kg" value="${currentSpecs['Gross Weight'] || '58.5 kg'}">
            </div>
            <div class="form-group">
              <label class="form-label">Recommended Inverter Rating</label>
              <input type="text" id="spec-inverter-match" class="form-input" placeholder="e.g. 900VA - 1500VA" value="${currentSpecs['Recommended Inverter'] || '900VA - 1500VA Pure Sinewave'}">
            </div>
          </div>
        </div>
      `;
    } else if (categorySlug === 'inverter' || categorySlug === 'ups') {
      fieldsHtml = `
        <div style="background:#FAF5FF; border:1px solid #E9D5FF; border-radius:8px; padding:1rem; margin-bottom:1rem;">
          <h4 style="font-size:0.88rem; font-weight:800; color:#6B21A8; margin-bottom:0.75rem;">⚡ Inverter & Home UPS Technical Specs</h4>
          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">VA Rating (VA) *</label>
              <input type="text" id="spec-va" class="form-input" placeholder="e.g. 1050VA" value="${currentSpecs['VA Rating'] || '1050VA'}">
            </div>
            <div class="form-group">
              <label class="form-label">Rated Output Wattage (W) *</label>
              <input type="text" id="spec-watts" class="form-input" placeholder="e.g. 840W" value="${currentSpecs['Rated Wattage'] || '840W'}">
            </div>
          </div>
          <div class="form-grid-2" style="margin-top:0.75rem;">
            <div class="form-group">
              <label class="form-label">Output Waveform</label>
              <select id="spec-waveform" class="form-select">
                <option value="Pure Sine Wave" ${currentSpecs['Waveform'] === 'Pure Sine Wave' ? 'selected' : ''}>Pure Sine Wave (Silent & Safe for Electronics)</option>
                <option value="Modified Sine Wave" ${currentSpecs['Waveform'] === 'Modified Sine Wave' ? 'selected' : ''}>Modified Sine Wave / Square Wave</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Battery System Voltage</label>
              <select id="spec-batt-volt" class="form-select">
                <option value="12V (Single Battery)" ${currentSpecs['Battery Voltage'] === '12V (Single Battery)' ? 'selected' : ''}>12V (Single Battery)</option>
                <option value="24V (Double Battery)" ${currentSpecs['Battery Voltage'] === '24V (Double Battery)' ? 'selected' : ''}>24V (Double Battery)</option>
                <option value="48V (Four Batteries)" ${currentSpecs['Battery Voltage'] === '48V (Four Batteries)' ? 'selected' : ''}>48V (Four Batteries)</option>
              </select>
            </div>
          </div>
          <div class="form-grid-2" style="margin-top:0.75rem;">
            <div class="form-group">
              <label class="form-label">Display & Control</label>
              <input type="text" id="spec-display" class="form-input" placeholder="e.g. Smart LED Indications / LCD" value="${currentSpecs['Display'] || 'Smart LED Indications'}">
            </div>
            <div class="form-group">
              <label class="form-label">Transfer Time</label>
              <input type="text" id="spec-transfer" class="form-input" placeholder="e.g. < 15ms (UPS Mode)" value="${currentSpecs['Transfer Time'] || '< 15ms (UPS Mode)'}">
            </div>
          </div>
        </div>
      `;
    } else if (categorySlug === 'car-battery' || categorySlug === 'automotive-battery') {
      fieldsHtml = `
        <div style="background:#FFF7ED; border:1px solid #FED7AA; border-radius:8px; padding:1rem; margin-bottom:1rem;">
          <h4 style="font-size:0.88rem; font-weight:800; color:#C2410C; margin-bottom:0.75rem;">🚗 Automotive & Vehicle Battery Specs</h4>
          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">Cold Cranking Amps (CCA) *</label>
              <input type="text" id="spec-cca" class="form-input" placeholder="e.g. 520 CCA" value="${currentSpecs['CCA'] || '520 CCA'}">
            </div>
            <div class="form-group">
              <label class="form-label">Capacity (Ah) *</label>
              <input type="text" id="spec-car-ah" class="form-input" placeholder="e.g. 65Ah" value="${currentSpecs['Capacity'] || '65 Ah'}">
            </div>
          </div>
          <div class="form-grid-2" style="margin-top:0.75rem;">
            <div class="form-group">
              <label class="form-label">Terminal Layout</label>
              <select id="spec-terminal" class="form-select">
                <option value="Left Layout (L)" ${currentSpecs['Terminal Layout'] === 'Left Layout (L)' ? 'selected' : ''}>Left Layout (L)</option>
                <option value="Right Layout (R)" ${currentSpecs['Terminal Layout'] === 'Right Layout (R)' ? 'selected' : ''}>Right Layout (R)</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Maintenance Classification</label>
              <input type="text" id="spec-maint" class="form-input" placeholder="e.g. Sealed Zero Maintenance (SMF)" value="${currentSpecs['Maintenance'] || 'Sealed Zero Maintenance (SMF)'}">
            </div>
          </div>

          <!-- Vehicle Brand & Model Tagging -->
          <div style="margin-top:1rem; padding-top:0.85rem; border-top:1px dashed #FDBA74;">
            <label class="form-label" style="color:#C2410C; font-weight:700; margin-bottom:0.35rem;">
              🏷️ Tag Compatible Vehicles & Models (e.g. Maruti Swift, Hyundai Creta, Toyota Hilux)
            </label>
            <div style="display:flex; gap:0.5rem; margin-bottom:0.5rem;">
              <input type="text" id="compatible-vehicle-input" class="form-input" placeholder="Type vehicle brand/model..." style="flex:1;" onkeydown="if(event.key==='Enter'){ event.preventDefault(); window.stockManager.addVehicleTag(); }">
              <button type="button" class="btn-primary-blue" style="padding:0.4rem 0.9rem; font-size:0.8rem; background:var(--color-exide-blue); color:#fff; border:none; border-radius:6px; cursor:pointer; font-weight:700;" onclick="window.stockManager.addVehicleTag()">+ Add Tag</button>
            </div>
            <div style="display:flex; flex-wrap:wrap; gap:0.35rem; align-items:center; margin-bottom:0.6rem;">
              <span style="font-size:0.75rem; color:#64748B;">Quick add:</span>
              ${['Maruti Swift', 'Hyundai Creta', 'Toyota Hilux', 'Mahindra Scorpio', 'Tata Nexon', 'Suzuki Baleno', 'Toyota Fortuner', 'Hyundai i20', 'Honda City', 'Kia Seltos'].map(v => `
                <button type="button" class="btn-tag-pill" onclick="window.stockManager.addVehicleTag('${v}')">+ ${v}</button>
              `).join('')}
            </div>
            <div id="compatible-vehicles-tags-box" style="display:flex; flex-wrap:wrap; gap:0.4rem; min-height:28px;"></div>
          </div>
        </div>
      `;
    } else if (categorySlug === 'solar-hybrid-pcu' || categorySlug === 'solar-charge-controller') {
      fieldsHtml = `
        <div style="background:#FEFCE8; border:1px solid #FEF08A; border-radius:8px; padding:1rem; margin-bottom:1rem;">
          <h4 style="font-size:0.88rem; font-weight:800; color:#854D0E; margin-bottom:0.75rem;">☀️ Solar Hybrid & Controller Specs</h4>
          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">Max Solar PV Capacity (Wp) *</label>
              <input type="text" id="spec-solar-wp" class="form-input" placeholder="e.g. 1500 Wp" value="${currentSpecs['Max PV Input'] || '1500 Wp'}">
            </div>
            <div class="form-group">
              <label class="form-label">Charge Controller Type</label>
              <select id="spec-solar-type" class="form-select">
                <option value="MPPT High Efficiency" ${currentSpecs['Controller Type'] === 'MPPT High Efficiency' ? 'selected' : ''}>MPPT (Maximum Power Point Tracking)</option>
                <option value="PWM Intelligent" ${currentSpecs['Controller Type'] === 'PWM Intelligent' ? 'selected' : ''}>PWM Intelligent Controller</option>
              </select>
            </div>
          </div>
          <div class="form-grid-2" style="margin-top:0.75rem;">
            <div class="form-group">
              <label class="form-label">Solar Voc Range</label>
              <input type="text" id="spec-voc" class="form-input" placeholder="e.g. 18V - 50V" value="${currentSpecs['Solar Voc Range'] || '18V - 55V'}">
            </div>
            <div class="form-group">
              <label class="form-label">Priority Logic</label>
              <input type="text" id="spec-priority" class="form-input" placeholder="e.g. Solar -> Battery -> Grid" value="${currentSpecs['Priority Mode'] || 'Solar -> Battery -> Grid Auto-Shift'}">
            </div>
          </div>
        </div>
      `;
    } else if (categorySlug === 'lithium-battery') {
      fieldsHtml = `
        <div style="background:#ECFDF5; border:1px solid #A7F3D0; border-radius:8px; padding:1rem; margin-bottom:1rem;">
          <h4 style="font-size:0.88rem; font-weight:800; color:#065F46; margin-bottom:0.75rem;">🔋 Lithium Storage & BMS Specs</h4>
          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">Cell Chemistry</label>
              <input type="text" id="spec-chem" class="form-input" placeholder="e.g. LiFePO4 (Lithium Iron Phosphate)" value="${currentSpecs['Chemistry'] || 'LiFePO4 (Lithium Iron Phosphate)'}">
            </div>
            <div class="form-group">
              <label class="form-label">Cycle Life (@ 80% DoD)</label>
              <input type="text" id="spec-cycles" class="form-input" placeholder="e.g. 4000+ Cycles" value="${currentSpecs['Cycle Life'] || '4000+ Cycles (10+ Years)'}">
            </div>
          </div>
          <div class="form-grid-2" style="margin-top:0.75rem;">
            <div class="form-group">
              <label class="form-label">Integrated BMS Features</label>
              <input type="text" id="spec-bms" class="form-input" placeholder="e.g. Overcharge, Short Circuit & Thermal Protection" value="${currentSpecs['BMS Protection'] || 'Overcharge, Low Voltage & Thermal Auto-Cut'}">
            </div>
            <div class="form-group">
              <label class="form-label">Fast Charge Rate</label>
              <input type="text" id="spec-charge-rate" class="form-input" placeholder="e.g. 2-3 Hours Full Charge" value="${currentSpecs['Charging Speed'] || '2-3 Hours 100% Rapid Charge'}">
            </div>
          </div>
        </div>
      `;
    } else {
      // Custom / generic category
      fieldsHtml = `
        <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:8px; padding:1rem; margin-bottom:1rem;">
          <h4 style="font-size:0.88rem; font-weight:800; color:#334155; margin-bottom:0.75rem;">⚙️ General / Custom Specifications</h4>
          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">Specification 1</label>
              <input type="text" id="spec-custom-1" class="form-input" placeholder="Key: Value (e.g. Input: 220V AC)" value="${Object.entries(currentSpecs)[0] ? Object.entries(currentSpecs)[0][0] + ': ' + Object.entries(currentSpecs)[0][1] : ''}">
            </div>
            <div class="form-group">
              <label class="form-label">Specification 2</label>
              <input type="text" id="spec-custom-2" class="form-input" placeholder="Key: Value (e.g. Efficiency: 94%)" value="${Object.entries(currentSpecs)[1] ? Object.entries(currentSpecs)[1][0] + ': ' + Object.entries(currentSpecs)[1][1] : ''}">
            </div>
          </div>
          <div class="form-grid-2" style="margin-top:0.75rem;">
            <div class="form-group">
              <label class="form-label">Specification 3</label>
              <input type="text" id="spec-custom-3" class="form-input" placeholder="Key: Value" value="${Object.entries(currentSpecs)[2] ? Object.entries(currentSpecs)[2][0] + ': ' + Object.entries(currentSpecs)[2][1] : ''}">
            </div>
            <div class="form-group">
              <label class="form-label">Specification 4</label>
              <input type="text" id="spec-custom-4" class="form-input" placeholder="Key: Value" value="${Object.entries(currentSpecs)[3] ? Object.entries(currentSpecs)[3][0] + ': ' + Object.entries(currentSpecs)[3][1] : ''}">
            </div>
          </div>
        </div>
      `;
    }

    container.innerHTML = fieldsHtml;
    if (categorySlug === 'car-battery' || categorySlug === 'automotive-battery') {
      this.renderVehicleTags();
    }
  }

  // Vehicle Tagging Management
  addVehicleTag(tagName = null) {
    const input = document.getElementById('compatible-vehicle-input');
    const tag = (tagName || input?.value || '').trim();
    if (!tag) return;
    if (!this.currentVehicleTags) this.currentVehicleTags = [];
    if (!this.currentVehicleTags.includes(tag)) {
      this.currentVehicleTags.push(tag);
      this.renderVehicleTags();
    }
    if (input) input.value = '';
  }

  removeVehicleTag(index) {
    if (!this.currentVehicleTags) return;
    this.currentVehicleTags.splice(index, 1);
    this.renderVehicleTags();
  }

  renderVehicleTags() {
    const box = document.getElementById('compatible-vehicles-tags-box');
    if (!box) return;
    if (!this.currentVehicleTags || this.currentVehicleTags.length === 0) {
      box.innerHTML = `<span style="font-size:0.75rem; color:#94A3B8; font-style:italic;">No vehicles tagged yet. Click suggestions or type above.</span>`;
      return;
    }
    box.innerHTML = this.currentVehicleTags.map((veh, idx) => `
      <span class="compatible-vehicle-badge">
        🚗 ${veh}
        <button type="button" class="btn-remove-tag" onclick="window.stockManager.removeVehicleTag(${idx})" title="Remove">✕</button>
      </span>
    `).join('');
  }

  // Auto SKU Code Generation based on brand's first 2-3 letters & sequential numbering
  generateSkuForBrand(brand) {
    const brandPrefixMap = {
      'exide': 'EX',
      'smarten': 'SM',
      'livfast': 'LF',
      'sf sonic': 'SF',
      'eastman': 'EM',
      'genus': 'GN',
      'geon': 'GO',
      'luminous': 'LM'
    };
    const bKey = (brand || '').toLowerCase().trim();
    let prefix = brandPrefixMap[bKey];
    if (!prefix) {
      prefix = (brand || 'SKU').replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase() || 'EX';
    }

    let maxNum = 1000;
    (this.inventory || []).forEach(p => {
      if (p.sku && typeof p.sku === 'string') {
        const match = p.sku.match(new RegExp(`^${prefix}[-_]?([0-9]+)`, 'i'));
        if (match && match[1]) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxNum) {
            maxNum = num;
          }
        }
      }
    });

    return `${prefix}-${maxNum + 1}`;
  }

  onBrandChange(brand) {
    if (!this.currentEditingProductId) {
      const skuInput = document.getElementById('new-sku');
      if (skuInput) {
        skuInput.value = this.generateSkuForBrand(brand);
      }
    }
  }

  gatherSpecsFromForm(categorySlug) {
    const specs = {};
    const addValidSpec = (key, val) => {
      if (val === null || val === undefined) return;
      const s = String(val).trim();
      if (s !== '' && s !== '0' && s !== '0.0' && s !== '0 Ah' && s !== '0 V' && s !== '0W' && s !== '0VA') {
        specs[key] = s;
      }
    };

    if (categorySlug === 'inverter-battery') {
      addValidSpec('Capacity', document.getElementById('spec-capacity')?.value);
      addValidSpec('Nominal Voltage', document.getElementById('spec-voltage')?.value);
      addValidSpec('Technology', document.getElementById('spec-tech')?.value);
      addValidSpec('Electrolyte Volume', document.getElementById('spec-electrolyte')?.value);
      addValidSpec('Gross Weight', document.getElementById('spec-weight')?.value);
      addValidSpec('Recommended Inverter', document.getElementById('spec-inverter-match')?.value);
    } else if (categorySlug === 'inverter' || categorySlug === 'ups') {
      addValidSpec('VA Rating', document.getElementById('spec-va')?.value);
      addValidSpec('Rated Wattage', document.getElementById('spec-watts')?.value);
      addValidSpec('Waveform', document.getElementById('spec-waveform')?.value);
      addValidSpec('Battery Voltage', document.getElementById('spec-batt-volt')?.value);
      addValidSpec('Display', document.getElementById('spec-display')?.value);
      addValidSpec('Transfer Time', document.getElementById('spec-transfer')?.value);
    } else if (categorySlug === 'car-battery' || categorySlug === 'automotive-battery') {
      addValidSpec('CCA', document.getElementById('spec-cca')?.value);
      addValidSpec('Capacity', document.getElementById('spec-car-ah')?.value);
      addValidSpec('Terminal Layout', document.getElementById('spec-terminal')?.value);
      addValidSpec('Maintenance', document.getElementById('spec-maint')?.value);
      if (this.currentVehicleTags && this.currentVehicleTags.length > 0) {
        addValidSpec('Compatible Vehicles', this.currentVehicleTags.join(', '));
      }
    } else if (categorySlug === 'solar-hybrid-pcu' || categorySlug === 'solar-charge-controller') {
      addValidSpec('Max PV Input', document.getElementById('spec-solar-wp')?.value);
      addValidSpec('Controller Type', document.getElementById('spec-solar-type')?.value);
      addValidSpec('Solar Voc Range', document.getElementById('spec-voc')?.value);
      addValidSpec('Priority Mode', document.getElementById('spec-priority')?.value);
    } else if (categorySlug === 'lithium-battery') {
      addValidSpec('Chemistry', document.getElementById('spec-chem')?.value);
      addValidSpec('Cycle Life', document.getElementById('spec-cycles')?.value);
      addValidSpec('BMS Protection', document.getElementById('spec-bms')?.value);
      addValidSpec('Charging Speed', document.getElementById('spec-charge-rate')?.value);
    } else {
      ['spec-custom-1', 'spec-custom-2', 'spec-custom-3', 'spec-custom-4'].forEach(id => {
        const val = document.getElementById(id)?.value?.trim();
        if (val && val.includes(':')) {
          const parts = val.split(':');
          addValidSpec(parts[0].trim(), parts.slice(1).join(':').trim());
        } else if (val) {
          addValidSpec('Feature ' + id.slice(-1), val);
        }
      });
    }

    return specs;
  }

  // ==========================================================================
  // PRODUCT MANAGEMENT: ADD, EDIT & UPDATE
  // ==========================================================================
  populateCategoryDropdowns(selectedVal = 'inverter-battery') {
    const selects = ['new-category', 'admin-category-filter'];
    const cats = this.getAllCategories();

    selects.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;

      const isFilter = id.includes('filter');
      let html = isFilter ? '<option value="all">All Categories</option>' : '';

      cats.forEach(c => {
        html += `<option value="${c.id}" ${c.id === selectedVal ? 'selected' : ''}>${c.name}</option>`;
      });

      if (!isFilter) {
        html += `<option value="__new_custom__">+ Add Custom Category...</option>`;
      }

      el.innerHTML = html;
    });
  }

  openProductFormModal(productId = null) {
    this.currentEditingProductId = productId;
    const modal = document.getElementById('new-product-modal');
    const titleEl = document.getElementById('product-form-title');
    const submitBtn = document.getElementById('product-form-submit-btn');

    this.populateCategoryDropdowns();
    this.setupDropzone();

    if (productId) {
      const prod = this.inventory.find(p => p.id === productId);
      if (!prod) return;

      if (titleEl) titleEl.textContent = `Edit Product: ${prod.sku} (${prod.brand})`;
      if (submitBtn) submitBtn.textContent = 'Update Product & Save';

      // Fill inputs
      document.getElementById('new-sku').value = prod.sku;
      document.getElementById('new-name').value = prod.name;
      document.getElementById('new-brand').value = prod.brand;
      document.getElementById('new-category').value = prod.categories[0] || 'inverter-battery';
      document.getElementById('new-capacity').value = prod.capacity || '';
      document.getElementById('new-cost').value = prod.costPrice || 0;
      document.getElementById('new-price').value = prod.price || 0;
      document.getElementById('new-stock').value = prod.stock || 0;
      document.getElementById('new-min-stock').value = prod.minStock || 3;
      document.getElementById('new-warranty').value = prod.warranty || '36 Months';
      document.getElementById('new-short-desc').value = prod.shortDesc || prod.name;

      // Rich Text Description Sync
      const editorEl = document.getElementById('new-detailed-desc-editor');
      if (editorEl) editorEl.innerHTML = prod.description || '';
      document.getElementById('new-detailed-desc').value = prod.description || '';

      document.getElementById('new-brochure-url').value = prod.brochureUrl || '';

      // Initialize Multi-Media List (Strictly show uploaded images only)
      if (prod.images && Array.isArray(prod.images) && prod.images.length > 0) {
        this.currentMediaList = prod.images
          .filter(img => img && typeof img === 'string' && img.trim() !== '' && img !== 'assets/logo.png')
          .map((img, idx) => ({
            id: 'media-' + Date.now() + '-' + idx,
            url: img,
            name: typeof img === 'string' && img.startsWith('data:') ? `Uploaded Media ${idx + 1}` : (typeof img === 'string' ? img.split('/').pop().split('?')[0] : `Media ${idx + 1}`),
            type: (typeof img === 'string' && (img.match(/\.(mp4|webm|ogg)$/i) || img.startsWith('data:video/'))) ? 'video' : ((typeof img === 'string' && (img.match(/\.pdf$/i) || img.startsWith('data:application/pdf'))) ? 'pdf' : 'image'),
            isPrimary: prod.image ? (img === prod.image) : (idx === 0)
          }));
      } else if (prod.image && prod.image.trim() && prod.image !== 'assets/logo.png') {
        this.currentMediaList = [{
          id: 'media-' + Date.now() + '-0',
          url: prod.image,
          name: prod.image.startsWith('data:') ? 'Uploaded Image 1' : prod.image.split('/').pop().split('?')[0] || 'Cover Image',
          type: 'image',
          isPrimary: true
        }];
      } else {
        this.currentMediaList = [];
      }

      this.syncPrimaryImageToInputs();
      this.renderMediaGalleryUI();

      this.currentVehicleTags = prod.compatibleVehicles ? [...prod.compatibleVehicles] : [];

      // Render category specific technical features
      this.renderCategoryTechFields(prod.categories[0] || 'inverter-battery', prod.specs || {});
    } else {
      if (titleEl) titleEl.textContent = 'Add New Product to Inventory';
      if (submitBtn) submitBtn.textContent = 'Create Product Entry';

      document.getElementById('new-product-form')?.reset();
      
      const selectedBrand = document.getElementById('new-brand')?.value || 'Exide';
      document.getElementById('new-sku').value = this.generateSkuForBrand(selectedBrand);

      this.currentMediaList = [];
      this.syncPrimaryImageToInputs();
      this.renderMediaGalleryUI();

      const editorEl = document.getElementById('new-detailed-desc-editor');
      if (editorEl) editorEl.innerHTML = '';
      document.getElementById('new-detailed-desc').value = '';

      this.currentVehicleTags = [];

      this.renderCategoryTechFields('inverter-battery', {});
    }

    if (modal) modal.classList.add('open');
  }

  saveProductFromForm() {
    if (window.authManager && !window.authManager.isAdminAuthenticated()) {
      if (typeof showToast === 'function') showToast('Administrator authentication required to save products.', 'error');
      if (window.authManager) window.authManager.openAdminLoginModal();
      return;
    }

    const sku = document.getElementById('new-sku')?.value.trim().toUpperCase();
    const name = document.getElementById('new-name')?.value.trim();
    const brand = document.getElementById('new-brand')?.value;
    const category = document.getElementById('new-category')?.value;
    const capacity = document.getElementById('new-capacity')?.value.trim();
    const costPrice = Number(document.getElementById('new-cost')?.value) || 0;
    const price = Number(document.getElementById('new-price')?.value) || 0;
    const stock = Number(document.getElementById('new-stock')?.value) || 0;
    const minStock = Number(document.getElementById('new-min-stock')?.value) || 3;
    const warranty = document.getElementById('new-warranty')?.value.trim() || '36 Months';
    const shortDesc = document.getElementById('new-short-desc')?.value.trim() || name;
    
    // Rich Text Description value
    const editorEl = document.getElementById('new-detailed-desc-editor');
    const description = (editorEl ? editorEl.innerHTML.trim() : '') || document.getElementById('new-detailed-desc')?.value.trim() || shortDesc;
    
    // Multi-Media & Images determination: strictly store genuine uploaded images only
    const primaryMedia = this.currentMediaList.find(m => m.isPrimary) || this.currentMediaList[0];
    const image = primaryMedia ? primaryMedia.url : (document.getElementById('new-image-url')?.value.trim() || 'assets/logo.png');
    const images = this.currentMediaList.length > 0
      ? this.currentMediaList.map(m => m.url)
      : (image && image !== 'assets/logo.png' ? [image] : []);
    const mediaList = [...this.currentMediaList];
    const brochureUrl = document.getElementById('new-brochure-url')?.value.trim() || '';

    if (!sku || !name || !price) {
      showToast('Please fill in required fields (SKU, Name, Price)', 'warning');
      return;
    }

    const brandSlug = brand.toLowerCase().replace(/\s+/g, '-');
    const brandColor = brand === 'Exide' ? '#ED1C24' : (brand === 'Smarten' ? '#10509A' : (brand === 'Livfast' ? '#FF5F1D' : '#0047BA'));

    const specs = this.gatherSpecsFromForm(category);
    specs['Brand'] = brand;
    specs['Model'] = sku;
    specs['Warranty'] = warranty;

    if (this.currentEditingProductId) {
      // UPDATE EXISTING PRODUCT
      const item = this.inventory.find(p => p.id === this.currentEditingProductId);
      if (item) {
        const oldStock = item.stock;
        item.sku = sku;
        item.name = name;
        item.brand = brand;
        item.brandSlug = brandSlug;
        item.brandColor = brandColor;
        item.categories = [category];
        item.capacity = capacity;
        item.costPrice = costPrice;
        item.price = price;
        item.stock = stock;
        item.minStock = minStock;
        item.warranty = warranty;
        item.shortDesc = shortDesc;
        item.description = description;
        item.image = image;
        item.images = images;
        item.mediaList = mediaList;
        item.brochureUrl = brochureUrl;
        item.compatibleVehicles = [...this.currentVehicleTags];
        item.specs = { ...item.specs, ...specs };

        this.auditLogs.unshift({
          id: 'LOG-' + Math.floor(1000 + Math.random() * 9000),
          timestamp: new Date().toLocaleString(),
          sku: item.sku,
          productName: item.name,
          action: 'PRODUCT UPDATED',
          quantity: Math.abs(stock - oldStock),
          previousStock: oldStock,
          newStock: stock,
          reason: 'Product information, gallery media & specifications updated via ERP',
          user: 'Store Administrator'
        });

        this.saveInventory();
        this.saveLogs();
        this.renderAdminUI();
        if (window.renderProductsCatalog) window.renderProductsCatalog();
        showToast(`Product ${sku} updated successfully!`, 'success');
      }
    } else {
      // CREATE NEW PRODUCT
      const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Math.floor(100 + Math.random() * 900);
      const newProduct = {
        id,
        sku,
        name,
        brand,
        brandSlug,
        brandColor,
        categories: [category],
        price,
        originalPrice: Math.round(price * 1.15),
        discount: 'Special Launch',
        image,
        images,
        mediaList,
        brochureUrl,
        featured: true,
        warranty,
        capacity: capacity || '150Ah - 12V',
        stock,
        minStock,
        costPrice,
        rating: 4.9,
        reviewsCount: 1,
        shortDesc,
        description,
        compatibleVehicles: [...this.currentVehicleTags],
        features: [
          "100% Genuine authorized import",
          "Official manufacturer stamped warranty card",
          "Free doorstep terminal fitting & testing across Nepal"
        ],
        specs,
        serialNumbers: ['SN-' + Math.floor(100000 + Math.random() * 900000)]
      };

      this.inventory.unshift(newProduct);
      this.auditLogs.unshift({
        id: 'LOG-' + Math.floor(1000 + Math.random() * 9000),
        timestamp: new Date().toLocaleString(),
        sku: newProduct.sku,
        productName: newProduct.name,
        action: 'NEW SKU ADDED',
        quantity: newProduct.stock,
        previousStock: 0,
        newStock: newProduct.stock,
        reason: 'New product entry created with multiple media files in ERP system',
        user: 'Store Administrator'
      });

      this.saveInventory();
      this.saveLogs();
      this.renderAdminUI();
      if (window.renderProductsCatalog) window.renderProductsCatalog();
      showToast(`New SKU ${newProduct.sku} created!`, 'success');
    }

    document.getElementById('new-product-modal')?.classList.remove('open');
    this.currentEditingProductId = null;
  }

  deleteProduct(productId) {
    if (window.authManager && !window.authManager.isAdminAuthenticated()) {
      if (typeof showToast === 'function') showToast('Administrator authentication required.', 'error');
      if (window.authManager) window.authManager.openAdminLoginModal();
      return;
    }
    const item = this.inventory.find(p => p.id === productId);
    if (!item) return;

    if (confirm(`Are you sure you want to remove ${item.name} (${item.sku}) from active inventory?`)) {
      this.inventory = this.inventory.filter(p => p.id !== productId);
      this.auditLogs.unshift({
        id: 'LOG-' + Math.floor(1000 + Math.random() * 9000),
        timestamp: new Date().toLocaleString(),
        sku: item.sku,
        productName: item.name,
        action: 'PRODUCT DELETED',
        quantity: item.stock,
        previousStock: item.stock,
        newStock: 0,
        reason: 'Product entry deleted from inventory by Admin',
        user: 'Store Administrator'
      });

      this.saveInventory();
      this.saveLogs();
      this.renderAdminUI();
      if (window.renderProductsCatalog) window.renderProductsCatalog();
      showToast(`Product ${item.sku} removed from inventory`, 'info');
    }
  }

  // ==========================================================================
  // MULTIPLE MEDIA & IMAGE UPLOADS HANDLERS
  // ==========================================================================
  handleMultipleMediaUpload(files) {
    if (!files || files.length === 0) return;
    const fileArr = Array.from(files);
    let loadedCount = 0;
    const initialLen = this.currentMediaList.length;

    const processFile = (file, index) => {
      let fileType = 'image';
      if (file.type.startsWith('video/')) fileType = 'video';
      else if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) fileType = 'pdf';

      const isFirstOverall = (initialLen === 0 && index === 0);
      const hasExistingPrimary = this.currentMediaList.some(m => m.isPrimary);

      const appendMedia = (finalUrl, finalSize) => {
        this.currentMediaList.push({
          id: 'media-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6),
          url: finalUrl,
          name: file.name,
          size: finalSize || file.size,
          type: fileType,
          isPrimary: !hasExistingPrimary && isFirstOverall
        });

        loadedCount++;
        if (loadedCount === fileArr.length) {
          if (!this.currentMediaList.some(m => m.isPrimary) && this.currentMediaList.length > 0) {
            this.currentMediaList[0].isPrimary = true;
          }
          this.syncPrimaryImageToInputs();
          this.renderMediaGalleryUI();
          // Reset file input so user can upload multiple batches
          const inputEl = document.getElementById('new-multi-media-input');
          if (inputEl) inputEl.value = '';
          if (typeof showToast === 'function') {
            showToast(`Added ${fileArr.length} media file(s) successfully!`, 'success');
          }
        }
      };

      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target.result;
        // If image, optimize and resize to max 1200px for crystal-clear visual quality and lightweight storage
        if (fileType === 'image') {
          const img = new Image();
          img.onload = () => {
            const maxDim = 1200;
            let w = img.width;
            let h = img.height;
            if (w > maxDim || h > maxDim) {
              if (w > h) {
                h = Math.round((h * maxDim) / w);
                w = maxDim;
              } else {
                w = Math.round((w * maxDim) / h);
                h = maxDim;
              }
            }
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            const optimizedUrl = canvas.toDataURL('image/jpeg', 0.88);
            appendMedia(optimizedUrl, Math.round(optimizedUrl.length * 0.75));
          };
          img.onerror = () => appendMedia(dataUrl, file.size);
          img.src = dataUrl;
        } else {
          appendMedia(dataUrl, file.size);
        }
      };
      reader.readAsDataURL(file);
    };

    fileArr.forEach((file, index) => processFile(file, index));
  }

  handleMediaFileUpload(file) {
    if (file) this.handleMultipleMediaUpload([file]);
  }

  addMediaFromUrlInput() {
    const input = document.getElementById('new-media-url-input');
    if (!input) return;
    const rawVal = input.value.trim();
    if (!rawVal) {
      if (typeof showToast === 'function') showToast('Please enter an image or media URL', 'warning');
      return;
    }

    const urls = rawVal.split(/[\n,]+/).map(u => u.trim()).filter(Boolean);
    let added = 0;
    urls.forEach(url => {
      let fileType = 'image';
      if (url.match(/\.(mp4|webm|ogg)$/i)) fileType = 'video';
      else if (url.match(/\.pdf$/i)) fileType = 'pdf';

      const hasPrimary = this.currentMediaList.some(m => m.isPrimary);
      this.currentMediaList.push({
        id: 'media-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6),
        url: url,
        name: url.split('/').pop().split('?')[0] || `Media Item ${this.currentMediaList.length + 1}`,
        type: fileType,
        isPrimary: !hasPrimary && added === 0 && this.currentMediaList.length === 0
      });
      added++;
    });

    if (!this.currentMediaList.some(m => m.isPrimary) && this.currentMediaList.length > 0) {
      this.currentMediaList[0].isPrimary = true;
    }

    input.value = '';
    this.syncPrimaryImageToInputs();
    this.renderMediaGalleryUI();
    if (typeof showToast === 'function') showToast(`Added ${added} media item(s) from URL!`, 'success');
  }

  setPrimaryMedia(mediaId) {
    this.currentMediaList.forEach(m => {
      m.isPrimary = (m.id === mediaId);
    });
    this.syncPrimaryImageToInputs();
    this.renderMediaGalleryUI();
    if (typeof showToast === 'function') showToast('Primary cover image updated!', 'info');
  }

  removeMedia(mediaId) {
    const idx = this.currentMediaList.findIndex(m => m.id === mediaId);
    if (idx === -1) return;
    const wasPrimary = this.currentMediaList[idx].isPrimary;
    this.currentMediaList.splice(idx, 1);
    if (wasPrimary && this.currentMediaList.length > 0) {
      this.currentMediaList[0].isPrimary = true;
    }
    this.syncPrimaryImageToInputs();
    this.renderMediaGalleryUI();
    if (typeof showToast === 'function') showToast('Media item removed', 'info');
  }

  moveMedia(mediaId, direction) {
    const idx = this.currentMediaList.findIndex(m => m.id === mediaId);
    if (idx === -1) return;
    const targetIdx = direction === 'left' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= this.currentMediaList.length) return;
    const temp = this.currentMediaList[idx];
    this.currentMediaList[idx] = this.currentMediaList[targetIdx];
    this.currentMediaList[targetIdx] = temp;
    this.syncPrimaryImageToInputs();
    this.renderMediaGalleryUI();
  }

  clearAllMedia() {
    if (this.currentMediaList.length === 0) return;
    if (confirm('Are you sure you want to remove all media files from this product?')) {
      this.currentMediaList = [];
      this.syncPrimaryImageToInputs();
      this.renderMediaGalleryUI();
      if (typeof showToast === 'function') showToast('All product media files cleared', 'info');
    }
  }

  syncPrimaryImageToInputs() {
    const primary = this.currentMediaList.find(m => m.isPrimary) || this.currentMediaList[0];
    const urlInput = document.getElementById('new-image-url');
    const previewImg = document.getElementById('new-image-preview');
    if (primary) {
      if (urlInput) urlInput.value = primary.url;
      if (previewImg) {
        previewImg.src = primary.url;
        previewImg.style.display = 'block';
      }
    } else {
      if (urlInput) urlInput.value = '';
      if (previewImg) {
        previewImg.src = '';
        previewImg.style.display = 'none';
      }
    }
  }

  formatFileSize(bytes) {
    if (!bytes || isNaN(bytes)) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  renderMediaGalleryUI() {
    const container = document.getElementById('product-media-gallery');
    if (!container) return;

    if (this.currentMediaList.length === 0) {
      container.innerHTML = `
        <div class="media-gallery-empty">
          <div style="font-size:1.8rem; margin-bottom:0.25rem;">🖼️</div>
          <strong style="color:#334155; font-size:0.88rem;">No Media Uploaded Yet</strong>
          <span style="color:#64748B; font-size:0.78rem; display:block; margin-top:2px;">
            Select multiple images or media files above to create an interactive product gallery.
          </span>
        </div>
      `;
      return;
    }

    const imagesCount = this.currentMediaList.filter(m => m.type === 'image').length;
    const otherCount = this.currentMediaList.length - imagesCount;

    const cardsHtml = this.currentMediaList.map((media, idx) => {
      let previewEl = '';
      if (media.type === 'video') {
        previewEl = `
          <div class="media-preview-video-box">
            <video src="${media.url}" muted preload="metadata" style="width:100%; height:100%; object-fit:cover;"></video>
            <span class="media-video-play-icon">▶</span>
          </div>`;
      } else if (media.type === 'pdf') {
        previewEl = `
          <div class="media-preview-pdf-box">
            <span style="font-size:1.6rem;">📄</span>
            <span style="font-size:0.68rem; font-weight:700; color:#DC2626;">PDF SPEC</span>
          </div>`;
      } else {
        previewEl = `<img src="${media.url}" alt="${media.name || 'Product Image'}" class="media-preview-thumb">`;
      }

      const sizeStr = media.size ? this.formatFileSize(media.size) : '';

      return `
        <div class="media-gallery-card ${media.isPrimary ? 'is-primary' : ''}" data-id="${media.id}">
          <div class="media-card-top-badges">
            ${media.isPrimary ? '<span class="media-badge-primary">★ Main Cover</span>' : `<span class="media-badge-type">${media.type.toUpperCase()}</span>`}
            <span class="media-card-order-num">#${idx + 1}</span>
          </div>

          <div class="media-card-thumb-wrap">
            ${previewEl}
          </div>

          <div class="media-card-info">
            <div class="media-card-filename" title="${media.name || ''}">${media.name || `Media ${idx + 1}`}</div>
            ${sizeStr ? `<small class="media-card-filesize">${sizeStr}</small>` : ''}
          </div>

          <div class="media-card-actions">
            ${!media.isPrimary ? `
              <button type="button" class="btn-media-action make-primary" onclick="window.stockManager.setPrimaryMedia('${media.id}')" title="Set as primary/cover thumbnail">
                ★ Cover
              </button>
            ` : `
              <span class="media-primary-label">✓ Active Cover</span>
            `}
            <div class="media-card-move-group">
              <button type="button" class="btn-media-action move" onclick="window.stockManager.moveMedia('${media.id}', 'left')" title="Move left / earlier in gallery" ${idx === 0 ? 'disabled' : ''}>◀</button>
              <button type="button" class="btn-media-action move" onclick="window.stockManager.moveMedia('${media.id}', 'right')" title="Move right / later in gallery" ${idx === this.currentMediaList.length - 1 ? 'disabled' : ''}>▶</button>
              <button type="button" class="btn-media-action delete" onclick="window.stockManager.removeMedia('${media.id}')" title="Delete media file">🗑️</button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div class="media-gallery-summary-bar">
        <div>
          <strong>${this.currentMediaList.length} Media File${this.currentMediaList.length > 1 ? 's' : ''} Uploaded</strong>
          <span style="color:#64748B; font-size:0.75rem; margin-left:0.5rem;">
            (${imagesCount} Image${imagesCount !== 1 ? 's' : ''}${otherCount > 0 ? `, ${otherCount} other media` : ''})
          </span>
        </div>
        <button type="button" class="btn-clear-media" onclick="window.stockManager.clearAllMedia()" title="Remove all uploaded media">
          Clear All Media
        </button>
      </div>
      <div class="media-cards-grid">
        ${cardsHtml}
      </div>
    `;
  }

  // ==========================================================================
  // COMMERCIAL ORDERS MANAGEMENT
  // ==========================================================================
  advanceOrderStatus(orderId) {
    let order = this.orders.find(o => o.orderId === orderId || o.id === orderId);
    if (!order) return;
    order = this.normalizeOrder(order);

    const stages = ['Confirmed', 'Processing', 'Dispatched', 'Delivered'];
    let currentIdx = stages.findIndex(s => s.toLowerCase() === (order.status || 'Confirmed').toLowerCase());
    if (currentIdx === -1) {
      if ((order.status || '').toLowerCase() === 'pending') currentIdx = 0;
      else currentIdx = 0;
    }

    if (currentIdx < stages.length - 1) {
      const nextStage = stages[currentIdx + 1];
      order.status = nextStage;
      order.orderStatus = nextStage;

      if (!order.trackingHistory) order.trackingHistory = [];
      order.trackingHistory.push({
        step: nextStage,
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        note: `Order advanced to ${nextStage} by Store Logistics Coordinator`
      });

      const idx = this.orders.findIndex(o => o.orderId === orderId || o.id === orderId);
      if (idx >= 0) this.orders[idx] = order;

      this.saveOrders();
      this.renderOrdersTable();
      if (this.selectedOrderForView && (this.selectedOrderForView.orderId === orderId || this.selectedOrderForView.id === orderId)) {
        this.openOrderDetailsModal(orderId);
      }
      if (typeof showToast === 'function') {
        showToast(`Order #${orderId} advanced to "${nextStage}"!`, 'success');
      }

      if (typeof fetch === 'function') {
        fetch('/api/orders', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: orderId,
            status: nextStage,
            orderStatus: nextStage,
            trackingNote: `Advanced to ${nextStage}`
          })
        }).catch(err => console.warn('Could not sync status to backend:', err));
      }
    } else {
      if (typeof showToast === 'function') {
        showToast(`Order #${orderId} is already marked as Delivered.`, 'info');
      }
    }
  }

  updateOrderStatus(orderId, newStatus, trackingNote = '', driverName = '', driverPhone = '', vehicleNumber = '') {
    let order = this.orders.find(o => o.orderId === orderId || o.id === orderId);
    if (!order) return;
    order = this.normalizeOrder(order);

    order.status = newStatus;
    order.orderStatus = newStatus;
    if (!order.trackingHistory) order.trackingHistory = [];
    order.trackingHistory.push({
      step: newStatus,
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      note: trackingNote || `Status updated to ${newStatus}`
    });

    if (driverName || driverPhone || vehicleNumber) {
      order.driverInfo = {
        driverName: driverName || order.driverInfo?.driverName || 'Depot Delivery Team',
        driverPhone: driverPhone || order.driverInfo?.driverPhone || '+9779705997260',
        vehicleNumber: vehicleNumber || order.driverInfo?.vehicleNumber || 'Dispatch'
      };
    }

    const idx = this.orders.findIndex(o => o.orderId === orderId || o.id === orderId);
    if (idx >= 0) this.orders[idx] = order;

    this.saveOrders();
    this.renderOrdersTable();
    if (this.selectedOrderForView && (this.selectedOrderForView.orderId === orderId || this.selectedOrderForView.id === orderId)) {
      this.openOrderDetailsModal(orderId);
    }
    if (typeof showToast === 'function') {
      showToast(`Order #${orderId} updated to ${newStatus}`, 'success');
    }

    if (typeof fetch === 'function') {
      fetch('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: orderId,
          status: newStatus,
          orderStatus: newStatus,
          trackingNote: trackingNote || `Status updated to ${newStatus}`
        })
      }).catch(err => console.warn('Could not sync status to backend:', err));
    }
  }

  toggleOrderPaymentStatus(orderId) {
    let order = this.orders.find(o => o.orderId === orderId || o.id === orderId);
    if (!order) return;
    order = this.normalizeOrder(order);

    const isPaid = (order.paymentStatus || '').toLowerCase().includes('paid');
    order.paymentStatus = isPaid ? 'Pending / Unverified' : 'Paid / Verified by Admin';

    const idx = this.orders.findIndex(o => o.orderId === orderId || o.id === orderId);
    if (idx >= 0) this.orders[idx] = order;

    this.saveOrders();
    this.renderOrdersTable();
    if (this.selectedOrderForView && (this.selectedOrderForView.orderId === orderId || this.selectedOrderForView.id === orderId)) {
      this.openOrderDetailsModal(orderId);
    }
    if (typeof showToast === 'function') {
      showToast(`Payment status updated for #${orderId}`, 'success');
    }

    if (typeof fetch === 'function') {
      fetch('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: orderId,
          paymentStatus: order.paymentStatus
        })
      }).catch(err => console.warn('Could not sync payment status to backend:', err));
    }
  }

  openOrderDetailsModal(orderId) {
    let rawOrder = this.orders.find(o => o.orderId === orderId || o.id === orderId);
    if (!rawOrder) return;
    const order = this.normalizeOrder(rawOrder);

    this.selectedOrderForView = order;
    const modal = document.getElementById('order-detail-modal');
    const container = document.getElementById('order-detail-content');
    if (!modal || !container) return;

    const stages = ['Confirmed', 'Processing', 'Dispatched', 'Delivered'];
    let currentIdx = stages.findIndex(s => s.toLowerCase() === (order.status || 'Confirmed').toLowerCase());
    if (currentIdx === -1) {
      if ((order.status || '').toLowerCase() === 'pending') currentIdx = 0;
      else currentIdx = 0;
    }
    const currentStatus = order.status || 'Confirmed';

    container.innerHTML = `
      <div style="background:#0F172A; color:#fff; padding:1.25rem 1.75rem; border-radius:12px 12px 0 0; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
        <div>
          <div style="display:flex; align-items:center; gap:0.75rem; flex-wrap:wrap;">
            <span style="background:var(--color-exide-red); color:#fff; font-size:0.75rem; font-weight:800; padding:2px 8px; border-radius:4px; text-transform:uppercase;">
              TAX INVOICE #${order.invoiceNumber || 'INV-2026'}
            </span>
            <h3 style="font-size:1.35rem; font-weight:800; margin:0;">Order #${order.orderId}</h3>
          </div>
          <p style="font-size:0.8rem; color:#94A3B8; margin-top:0.25rem; margin-bottom:0;">Placed on ${order.orderDate}</p>
        </div>
        <div style="display:flex; align-items:center; gap:0.75rem;">
          <span class="badge-order-status ${currentStatus.toLowerCase()}">${currentStatus}</span>
          <button onclick="document.getElementById('order-detail-modal').classList.remove('open')" style="color:#CBD5E1; font-size:1.5rem; line-height:1; background:none; border:none; cursor:pointer;">&times;</button>
        </div>
      </div>

      <div style="padding:1.25rem; max-height:calc(85vh - 80px); overflow-y:auto; -webkit-overflow-scrolling:touch;">
        <!-- Commercial Tracking Progress Bar -->
        <div style="background:#F8FAFC; border:1.5px solid #E2E8F0; border-radius:10px; padding:1rem; margin-bottom:1.25rem;">
          <div style="font-size:0.85rem; font-weight:800; color:#0F172A; margin-bottom:1rem; display:flex; justify-content:space-between;">
            <span>📦 Order Fulfillment & Logistics Pipeline</span>
            <span style="color:var(--color-exide-blue);">Stage ${Math.max(1, currentIdx + 1)} of 4</span>
          </div>

          <div style="display:flex; justify-content:space-between; position:relative; margin-bottom:1rem; gap:0.25rem;">
            ${stages.map((st, i) => {
              const isPast = i <= currentIdx;
              const isCurrent = i === currentIdx;
              return `
                <div style="flex:1; text-align:center; position:relative;">
                  <div style="width:28px; height:28px; border-radius:50%; margin:0 auto 0.3rem; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:0.8rem; background:${isPast ? 'var(--color-success)' : '#E2E8F0'}; color:${isPast ? '#fff' : '#64748B'};">
                    ${isPast ? '✓' : (i + 1)}
                  </div>
                  <div style="font-size:0.72rem; font-weight:${isCurrent ? '800' : '600'}; color:${isCurrent ? 'var(--color-exide-red)' : (isPast ? '#0F172A' : '#94A3B8')};">
                    ${st}
                  </div>
                </div>
              `;
            }).join('')}
          </div>

          <div style="display:flex; gap:0.5rem; justify-content:flex-end; border-top:1px dashed #CBD5E1; padding-top:0.75rem;">
            ${currentStatus.toLowerCase() !== 'delivered' ? `
              <button class="btn-primary-red" style="font-size:0.8rem; padding:0.4rem 1rem;" onclick="window.stockManager.advanceOrderStatus('${order.orderId}')">
                Proceed to Next Step (${stages[currentIdx + 1] || 'Done'}) →
              </button>
            ` : '<span style="color:var(--color-success); font-weight:700; font-size:0.85rem;">✓ Order Successfully Delivered & Finalized</span>'}
          </div>
        </div>

        <div class="order-detail-grid-cols" style="display:grid; grid-template-columns:1fr 1fr; gap:1.25rem; margin-bottom:1.25rem;">
          <!-- Customer & Packaging Address -->
          <div style="background:#fff; border:1px solid #E2E8F0; border-radius:8px; padding:1rem;">
            <h4 style="font-size:0.85rem; font-weight:800; color:#475569; text-transform:uppercase; margin-bottom:0.75rem;">
              👤 Customer & Packaging Destination
            </h4>
            <div style="font-size:1rem; font-weight:800; color:#0F172A; margin-bottom:0.25rem;">${order.customer.fullName}</div>
            <div style="font-size:0.85rem; color:#334155; margin-bottom:0.25rem;">
              📞 Mobile: <strong>${order.customer.phone}</strong> 
              <a href="https://wa.me/977${order.customer.phone.replace(/[^0-9]/g, '')}?text=Hello%20${encodeURIComponent(order.customer.fullName)}%2C%20regarding%20your%20Battery%20Mart%20order%20%23${order.orderId}%3A" target="_blank" style="color:#25D366; font-weight:700; margin-left:0.5rem;">[WhatsApp]</a>
            </div>
            <div style="font-size:0.85rem; color:#334155; margin-bottom:0.5rem;">✉️ Email: ${order.customer.email || 'N/A'}</div>
            
            <div style="background:#F1F5F9; border-radius:6px; padding:0.75rem; font-size:0.85rem; margin-top:0.5rem;">
              <strong style="color:#0F172A; display:block; margin-bottom:0.25rem;">📦 Delivery Address:</strong>
              ${order.customer.address || order.customer.deliveryAddress}, Ward No. ${order.customer.ward || '01'}<br>
              ${order.customer.city || order.customer.district}, ${order.customer.district} (${order.customer.province})<br>
              ${order.customer.landmark ? `<span style="color:#64748B;">Landmark: ${order.customer.landmark}</span><br>` : ''}
              <span style="color:var(--color-exide-blue); font-weight:700;">Service: ${order.fittingService || 'Doorstep Delivery & Installation'}</span>
            </div>
            ${order.customer.notes ? `<div style="margin-top:0.5rem; font-size:0.8rem; color:#D97706;"><strong>Note:</strong> ${order.customer.notes}</div>` : ''}
          </div>

          <!-- Payment & Scrap Battery Details -->
          <div style="background:#fff; border:1px solid #E2E8F0; border-radius:8px; padding:1rem;">
            <h4 style="font-size:0.85rem; font-weight:800; color:#475569; text-transform:uppercase; margin-bottom:0.75rem;">
              💳 Commercial Payment & Deductions
            </h4>
            <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
              <span style="font-size:0.85rem; color:#64748B;">Payment Mode:</span>
              <strong style="font-size:0.9rem; color:#0F172A;">${order.paymentMethod}</strong>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem;">
              <span style="font-size:0.85rem; color:#64748B;">Payment Status:</span>
              <button onclick="window.stockManager.toggleOrderPaymentStatus('${order.orderId}')" style="background:#F8FAFC; border:1px solid #CBD5E1; border-radius:4px; padding:3px 8px; font-size:0.8rem; font-weight:700; color:${(order.paymentStatus || '').toLowerCase().includes('paid') ? 'var(--color-success)' : 'var(--color-danger)'}; cursor:pointer;">
                ${order.paymentStatus} ✎
              </button>
            </div>

            <!-- Scrap Battery Recycling Breakdown -->
            <div style="background:${order.calculations?.scrapExchangeDeduction > 0 ? '#F0FDF4' : '#F8FAFC'}; border:1px solid ${order.calculations?.scrapExchangeDeduction > 0 ? '#86EFAC' : '#E2E8F0'}; border-radius:6px; padding:0.75rem; margin-top:0.75rem;">
              <strong style="font-size:0.85rem; color:${order.calculations?.scrapExchangeDeduction > 0 ? '#166534' : '#64748B'}; display:block; margin-bottom:0.25rem;">
                ♻️ Scrap Battery Recycling Trade-In:
              </strong>
              ${order.calculations?.scrapExchangeDeduction > 0 ? `
                <div style="font-size:0.82rem; color:#14532D;">
                  Customer Scrap Capacity: <strong>${order.calculations?.scrapBatteryAh || 150} Ah</strong><br>
                  Recycling Rate: <strong>NPR ${order.calculations?.scrapRate || 35} / Ah</strong><br>
                  <strong style="color:var(--color-success);">Calculated Rebate: - NPR ${(order.calculations?.scrapExchangeDeduction || 0).toLocaleString()}</strong>
                </div>
              ` : '<span style="font-size:0.82rem; color:#64748B;">No scrap battery trade-in requested for this order.</span>'}
            </div>

            ${order.driverInfo || order.assignedRider ? `
              <div style="margin-top:0.75rem; font-size:0.82rem; color:#334155; border-top:1px solid #E2E8F0; padding-top:0.5rem;">
                <strong>Assigned Logistics:</strong> ${order.assignedRider ? `${order.assignedRider.name} (${order.assignedRider.phone})` : `${order.driverInfo?.driverName} (${order.driverInfo?.driverPhone})`}
              </div>
            ` : ''}
          </div>
        </div>

        <!-- Ordered Products Table -->
        <h4 style="font-size:0.9rem; font-weight:800; color:#0F172A; margin-bottom:0.5rem;">Ordered Products & Power Packages</h4>
        <div style="overflow-x:auto; -webkit-overflow-scrolling:touch; width:100%;">
          <table class="admin-stock-table" style="background:#fff; border:1px solid #E2E8F0; border-radius:6px; margin-bottom:1.25rem; min-width:480px;">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Product Details</th>
                <th style="text-align:center;">Qty</th>
                <th style="text-align:right;">Rate (NPR)</th>
                <th style="text-align:right;">Subtotal (NPR)</th>
              </tr>
            </thead>
            <tbody>
              ${order.items.map(item => `
                <tr>
                  <td><code style="font-weight:700; color:var(--color-exide-blue);">${item.sku || 'SKU'}</code></td>
                  <td>
                    <div style="display:flex; align-items:center; gap:0.5rem;">
                      <img src="${item.image || 'assets/logo.png'}" alt="" style="width:36px; height:36px; object-fit:contain; border-radius:4px; border:1px solid #E2E8F0; padding:2px;">
                      <div>
                        <strong style="color:#0F172A;">${item.name}</strong>
                        <small style="display:block; color:#64748B;">${item.capacity || ''}</small>
                      </div>
                    </div>
                  </td>
                  <td style="text-align:center; font-weight:700;">${item.quantity || 1}</td>
                  <td style="text-align:right;">${(item.price || 0).toLocaleString()}</td>
                  <td style="text-align:right; font-weight:800; color:var(--color-exide-red);">${((item.price || 0) * (item.quantity || 1)).toLocaleString()}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- Order Total Row -->
        <div style="display:flex; justify-content:flex-end; margin-bottom:1.25rem;">
          <div style="width:100%; max-width:320px; background:#F8FAFC; border:1.5px solid #E2E8F0; border-radius:8px; padding:1rem; font-size:0.9rem;">
            <div style="display:flex; justify-content:space-between; margin-bottom:0.25rem;">
              <span style="color:#64748B;">Subtotal:</span>
              <strong>NPR ${(order.calculations?.rawSubtotal || 0).toLocaleString()}</strong>
            </div>
            ${order.calculations?.scrapExchangeDeduction > 0 ? `
              <div style="display:flex; justify-content:space-between; color:var(--color-success); margin-bottom:0.25rem;">
                <span>Old Battery Scrap Rebate:</span>
                <strong>- NPR ${(order.calculations?.scrapExchangeDeduction || 0).toLocaleString()}</strong>
              </div>
            ` : ''}
            <div style="display:flex; justify-content:space-between; margin-bottom:0.25rem;">
              <span style="color:#64748B;">Express Delivery & Fitting:</span>
              <strong style="color:var(--color-success);">${order.calculations?.finalDelivery === 0 ? 'FREE' : 'NPR ' + order.calculations.finalDelivery}</strong>
            </div>
            <div style="display:flex; justify-content:space-between; border-top:1px solid #E2E8F0; padding-top:0.4rem; font-size:1.15rem; font-weight:800; color:var(--color-exide-red);">
              <span>Grand Total:</span>
              <span>NPR ${(order.calculations?.grandTotal || 0).toLocaleString()}</span>
            </div>
          </div>
        </div>

        <!-- Footer Actions -->
        <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid #E2E8F0; padding-top:1.25rem; flex-wrap:wrap; gap:0.75rem;">
          <div style="display:flex; gap:0.75rem; align-items:center; flex-wrap:wrap;">
            <div style="display:flex; gap:0.4rem; align-items:center;">
              <label style="font-size:0.85rem; font-weight:700; color:#475569;">Status:</label>
              <select style="height:36px; padding:0 0.5rem; border:1px solid #CBD5E1; border-radius:6px; font-size:0.85rem;" onchange="window.stockManager.updateOrderStatus('${order.orderId}', this.value)">
                <option value="Confirmed" ${currentStatus.toLowerCase() === 'confirmed' || currentStatus.toLowerCase() === 'pending' ? 'selected' : ''}>Confirmed</option>
                <option value="Processing" ${currentStatus.toLowerCase() === 'processing' ? 'selected' : ''}>Processing</option>
                <option value="Dispatched" ${currentStatus.toLowerCase() === 'dispatched' ? 'selected' : ''}>Dispatched</option>
                <option value="Delivered" ${currentStatus.toLowerCase() === 'delivered' ? 'selected' : ''}>Delivered</option>
                <option value="Cancelled" ${currentStatus.toLowerCase() === 'cancelled' ? 'selected' : ''}>Cancelled</option>
              </select>
            </div>

            <div style="display:flex; gap:0.4rem; align-items:center;">
              <label style="font-size:0.85rem; font-weight:700; color:#475569;">Rider:</label>
              <select style="height:36px; padding:0 0.5rem; border:1.5px solid #3B82F6; border-radius:6px; font-size:0.82rem; background:#EFF6FF; color:#1E3A8A; font-weight:700;" onchange="window.stockManager.assignOrderToRider('${order.orderId}', this.value); window.stockManager.openOrderDetailsModal('${order.orderId}');">
                <option value="">-- Select Rider / Provider --</option>
                <option value="PROVIDER-CARGO" ${order.assignedRider && order.assignedRider.id === 'PROVIDER-CARGO' ? 'selected' : ''}>Nepal Can Move (Cargo)</option>
                ${this.logisticsCrew.map(r => `
                  <option value="${r.id}" ${order.assignedRider && (order.assignedRider.id === r.id || order.assignedRider.name === r.name) ? 'selected' : ''}>${r.name} (${r.status})</option>
                `).join('')}
              </select>
            </div>
          </div>

          <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
            <button class="btn-primary-red" style="font-size:0.85rem; padding:0.5rem 1.15rem;" onclick="window.stockManager.printCommercialInvoice('${order.orderId}')">
              🖨️ Print Tax Invoice / VAT Bill
            </button>
            <button class="btn-primary-blue" style="font-size:0.85rem; padding:0.5rem 1.15rem; background:#0047BA; color:#fff; border:none; border-radius:6px; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:0.35rem;" onclick="window.stockManager.printShippingParcelLabel('${order.orderId}')">
              🏷️ Print Shipping Label
            </button>
            <button class="btn-outline-white" style="border-color:#CBD5E1; color:#0F172A; font-size:0.85rem; padding:0.5rem 1rem;" onclick="document.getElementById('order-detail-modal').classList.remove('open')">
              Close
            </button>
          </div>
        </div>
      </div>
    `;

    modal.classList.add('open');
  }

  printCommercialInvoice(orderId) {
    const order = this.orders.find(o => o.orderId === orderId);
    if (!order) return;

    if (window.printTaxInvoice) {
      window.printTaxInvoice(order);
    } else if (window.cartSystem && window.cartSystem.renderInvoiceUI) {
      window.cartSystem.renderInvoiceUI(order);
      window.cartSystem.openCheckoutModal();
      window.cartSystem.goToCheckoutStep(4);
      setTimeout(() => {
        window.print();
      }, 400);
    }
  }

  printShippingParcelLabel(orderIdOrObj) {
    let order = null;
    if (typeof orderIdOrObj === 'object' && orderIdOrObj !== null) {
      order = orderIdOrObj;
    } else {
      order = (this.orders || []).find(o => (o.orderId === orderIdOrObj || o.id === orderIdOrObj));
      if (!order) {
        try {
          const localList = JSON.parse(localStorage.getItem('exide_orders') || '[]');
          order = localList.find(o => (o.orderId === orderIdOrObj || o.id === orderIdOrObj));
        } catch(e) {}
      }
    }

    if (!order) {
      if (typeof showToast === 'function') showToast(`Order #${orderIdOrObj} not found.`, 'warning');
      return;
    }

    this.renderShippingParcelLabelModal(order);
  }

  renderShippingParcelLabelModal(order) {
    let modal = document.getElementById('shipping-parcel-label-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'shipping-parcel-label-modal';
      modal.className = 'modal-overlay';
      modal.style.zIndex = '10040';
      modal.innerHTML = `
        <div style="background:#fff; border-radius:12px; width:100%; max-width:820px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.25); max-height:92vh; overflow-y:auto; padding:1.5rem; position:relative;">
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1.5px solid #E2E8F0; padding-bottom:0.75rem; margin-bottom:1rem;">
            <div>
              <h3 style="margin:0; font-size:1.15rem; font-weight:800; color:#0F172A;">Commercial Shipping & Delivery Label</h3>
              <span style="font-size:0.75rem; color:#64748B;">Flipkart & Amazon Nepal Dispatch Manifest</span>
            </div>
            <div style="display:flex; gap:0.5rem;">
              <button type="button" class="btn btn-primary" onclick="window.print()" style="font-size:0.8rem; padding:6px 14px; font-weight:700; background:#0047BA; color:#fff; border:none; border-radius:6px; cursor:pointer;">
                🖨️ Print Label
              </button>
              <button type="button" class="btn btn-secondary" onclick="document.getElementById('shipping-parcel-label-modal').classList.remove('open')" style="font-size:0.8rem; padding:6px 12px; border:1px solid #CBD5E1; background:#F8FAFC; border-radius:6px; cursor:pointer;">
                ✕ Close
              </button>
            </div>
          </div>
          <div id="shipping-parcel-label-body"></div>
        </div>
      `;
      document.body.appendChild(modal);
    }

    const customer = order.customer || {};
    const pricing = order.pricing || order.calculations || {};
    const items = Array.isArray(order.items) ? order.items : [];
    const dateFormatted = order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-GB') : (order.date || 'Recent');
    const orderNum = order.orderId || order.id || 'EXD-2026';
    const grandTotal = Number(pricing.grandTotal || order.grandTotal || order.total || 0).toLocaleString('en-IN');
    const scrapRebate = Number(pricing.scrapExchangeDeduction || 0);

    // Delivery personnel info
    const rawRider = order.deliveryRider || order.assignedRider || order.dispatchRider || order.driverInfo || {};
    const riderName = typeof rawRider === 'string' ? rawRider : (rawRider.name || rawRider.driverName || 'Kathmandu Central Dispatch');
    const riderPhone = typeof rawRider === 'object' && rawRider.phone ? rawRider.phone : '9705997260';
    const riderVehicle = typeof rawRider === 'object' && rawRider.vehicle ? rawRider.vehicle : (order.dispatchVehicle || 'Motorbike Express');

    const bodyEl = document.getElementById('shipping-parcel-label-body');
    if (bodyEl) {
      bodyEl.innerHTML = `
        <div style="border:2px dashed #0F172A; padding:1.25rem; background:#FFFFFF; font-family:'Courier New', Courier, monospace; color:#0F172A;">
          <!-- Header Bar -->
          <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #0F172A; padding-bottom:0.75rem; margin-bottom:1rem;">
            <div>
              <div style="font-size:1.35rem; font-weight:900; letter-spacing:1px; color:#0047BA;">EXIDE BATTERY WHOLESALE</div>
              <div style="font-size:0.82rem; font-weight:700;">AET Official Partner • Nepal Power House</div>
              <div style="font-size:0.75rem; color:#475569;">Bijulibazar, Kathmandu • Hotline: +977-9705997260</div>
              <div style="font-size:0.75rem; color:#475569;">IRD Nepal Seller PAN: <strong>609823412</strong></div>
            </div>
            <div style="text-align:right;">
              <div style="background:#0F172A; color:#FFFFFF; padding:4px 10px; font-weight:900; font-size:0.85rem; border-radius:4px; display:inline-block; margin-bottom:4px;">
                PRIORITY DOORSTEP DELIVERY
              </div>
              <div style="font-size:0.78rem; font-weight:700;">MANIFEST: #${orderNum}</div>
              <div style="font-size:0.72rem; color:#475569;">Date: ${dateFormatted}</div>
            </div>
          </div>

          <!-- Barcode Simulation -->
          <div style="text-align:center; margin-bottom:1rem; border-bottom:1px dashed #CBD5E1; padding-bottom:0.75rem;">
            <div style="font-family:'Libre Barcode 39', monospace, monospace; font-size:2.2rem; letter-spacing:4px; line-height:1;">
              *${orderNum}*
            </div>
            <div style="font-size:0.72rem; color:#64748B; letter-spacing:1px; margin-top:2px;">
              AWB: EXD-${orderNum.replace(/\D/g, '').padEnd(8, '0')}-KTM
            </div>
          </div>

          <!-- Recipient & Dispatch Grid -->
          <div style="display:grid; grid-template-columns:1.2fr 1fr; gap:1rem; border-bottom:2px solid #0F172A; padding-bottom:1rem; margin-bottom:1rem;">
            <div style="background:#F8FAFC; border:1px solid #CBD5E1; border-radius:6px; padding:0.75rem;">
              <div style="font-size:0.75rem; font-weight:900; color:#64748B; text-transform:uppercase; margin-bottom:4px;">
                📦 SHIP TO RECIPIENT:
              </div>
              <div style="font-size:1.05rem; font-weight:900; color:#0F172A;">${customer.fullName || 'Valued Customer'}</div>
              <div style="font-size:0.88rem; font-weight:800; color:#0047BA; margin-top:2px;">
                📞 +977-${customer.phone || '98XXXXXXXX'} ${customer.alternatePhone ? ' / ' + customer.alternatePhone : ''}
              </div>
              <div style="font-size:0.82rem; margin-top:4px; color:#1E293B;">
                📍 ${customer.deliveryAddress || customer.address || 'Kathmandu Valley'}, ${customer.city || 'Kathmandu'}, Ward ${customer.ward || '10'}
              </div>
              ${customer.landmark ? `<div style="font-size:0.75rem; color:#059669; font-weight:700; margin-top:2px;">🚩 Landmark: ${customer.landmark}</div>` : ''}
              ${customer.panNumber ? `<div style="font-size:0.75rem; color:#4338CA; font-weight:700; margin-top:2px;">🏢 Buyer PAN: ${customer.panNumber}</div>` : ''}
            </div>

            <div style="background:#F8FAFC; border:1px solid #CBD5E1; border-radius:6px; padding:0.75rem;">
              <div style="font-size:0.75rem; font-weight:900; color:#64748B; text-transform:uppercase; margin-bottom:4px;">
                🚚 DISPATCH & RIDER:
              </div>
              <div style="font-size:0.95rem; font-weight:800; color:#0F172A;">${riderName}</div>
              <div style="font-size:0.82rem; color:#0047BA; font-weight:700;">📞 +977-${riderPhone}</div>
              <div style="font-size:0.8rem; color:#475569; margin-top:2px;">Vehicle: <strong>${riderVehicle}</strong></div>
              <div style="margin-top:8px; padding-top:6px; border-top:1px dashed #CBD5E1;">
                <span style="font-size:0.72rem; color:#64748B;">Payment Mode:</span>
                <div style="font-size:0.95rem; font-weight:900; color:${String(order.paymentStatus || '').toUpperCase().includes('PAID') ? '#059669' : '#DC2626'};">
                  ${(order.paymentMethod || 'COD').toUpperCase()} • ${order.paymentStatus || 'COLLECT CASH'}
                </div>
              </div>
            </div>
          </div>

          <!-- Parcel Items -->
          <div style="margin-bottom:1rem;">
            <div style="font-size:0.75rem; font-weight:900; color:#64748B; text-transform:uppercase; margin-bottom:6px;">
              PARCEL CONTENTS & SPECIFICATIONS:
            </div>
            <table style="width:100%; border-collapse:collapse; font-size:0.82rem;">
              <thead>
                <tr style="border-bottom:1px solid #0F172A; text-align:left;">
                  <th style="padding:4px 0;">Item & Model</th>
                  <th style="padding:4px 0;">Ah / Specs</th>
                  <th style="padding:4px 0; text-align:center;">Qty</th>
                  <th style="padding:4px 0; text-align:right;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${items.map(it => `
                  <tr style="border-bottom:1px dashed #E2E8F0;">
                    <td style="padding:6px 0; font-weight:700;">${it.name || it.sku || 'Exide Battery'}</td>
                    <td style="padding:6px 0;">${it.capacity || '12V Power'}</td>
                    <td style="padding:6px 0; text-align:center;"><strong>${it.quantity || 1}</strong></td>
                    <td style="padding:6px 0; text-align:right; font-weight:800;">Rs. ${((it.quantity || 1) * (it.price || it.unitPrice || 0)).toLocaleString('en-IN')}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <!-- Financials & Scrap Collection -->
          <div style="display:flex; justify-content:space-between; align-items:center; background:#0F172A; color:#FFFFFF; padding:0.75rem 1rem; border-radius:6px; margin-bottom:1rem;">
            <div>
              ${scrapRebate > 0 ? `
                <div style="font-size:0.75rem; color:#34D399; font-weight:700;">
                  ♻️ OLD BATTERY BUYBACK: Collect scrap (-Rs. ${scrapRebate.toLocaleString('en-IN')})
                </div>
              ` : `
                <div style="font-size:0.75rem; color:#94A3B8;">Free Doorstep Delivery & Terminal Greasing</div>
              `}
              <div style="font-size:0.82rem; font-weight:700;">COLLECTION AMOUNT:</div>
            </div>
            <div style="font-size:1.4rem; font-weight:900; color:#60A5FA;">
              Rs. ${grandTotal}
            </div>
          </div>

          <!-- Inspection Verification Box -->
          <div style="border:1px solid #CBD5E1; padding:0.65rem 0.85rem; border-radius:6px; font-size:0.72rem; color:#334155;">
            <strong>Mandatory Pre-Dispatch Protocol Verified:</strong>
            <div style="display:flex; gap:1.25rem; margin-top:3px; flex-wrap:wrap;">
              <span>[✓] 12V Open Circuit & Load Verified</span>
              <span>[✓] Free Terminal Grease Sachet Packed</span>
              <span>[✓] Warranty Card Stamped with Official Hub Seal</span>
            </div>
          </div>
        </div>
      `;
    }

    modal.classList.add('open');
  }

  // ==========================================================================
  // ADMIN ERP MODAL & UI RENDERING
  // ==========================================================================
  switchAdminTab(tabName) {
    this.activeAdminTab = tabName;
    document.querySelectorAll('.admin-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    const tabs = ['inventory', 'orders', 'audit', 'settings'];
    tabs.forEach(t => {
      const el = document.getElementById(`admin-tab-${t}`);
      if (el) {
        if (t === tabName) {
          el.style.display = 'block';
          el.classList.remove('admin-tab-content-pane');
          void el.offsetWidth; // retrigger CSS animation
          el.classList.add('admin-tab-content-pane');
        } else {
          el.style.display = 'none';
        }
      }
    });

    if (tabName === 'orders') {
      this.loadOrders();
      this.renderOrdersTable();
      this.syncServerOrders();
    } else if (tabName === 'inventory') {
      this.filterAndRenderTable();
    } else if (tabName === 'audit') {
      this.renderAuditLogsTable();
    } else if (tabName === 'settings') {
      this.renderSettingsUI();
    }
  }

  openAdminModal() {
    if (window.authManager && !window.authManager.isAdminAuthenticated()) {
      window.authManager.guardAdmin(() => {
        this.openAdminModal();
      });
      return;
    }
    this.loadOrders();
    this.syncServerOrders();
    this.renderAdminUI();
    if (window.authManager) window.authManager.updateAuthUI();
    const modal = document.getElementById('admin-modal-overlay');
    if (modal) modal.classList.add('open');
  }

  closeAdminModal() {
    const modal = document.getElementById('admin-modal-overlay');
    if (modal) modal.classList.remove('open');
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
  }

  renderAdminUI() {
    const metrics = this.getMetrics();

    // Render KPIs
    const elSkus = document.getElementById('kpi-total-skus');
    const elUnits = document.getElementById('kpi-total-units');
    const elAssetVal = document.getElementById('kpi-asset-val');
    const elRetailVal = document.getElementById('kpi-retail-val');
    const elLowStock = document.getElementById('kpi-low-stock');
    const elOrdersBadge = document.getElementById('admin-orders-count-badge');

    if (elSkus) elSkus.textContent = metrics.totalSkus;
    if (elUnits) elUnits.textContent = metrics.totalUnits.toLocaleString();
    if (elAssetVal) elAssetVal.textContent = `NPR ${(metrics.totalAssetValuation / 100000).toFixed(2)} Lakh`;
    if (elRetailVal) elRetailVal.textContent = `NPR ${(metrics.totalRetailValuation / 100000).toFixed(2)} Lakh`;
    if (elLowStock) elLowStock.textContent = metrics.lowStockCount + (metrics.outOfStockCount > 0 ? ` (${metrics.outOfStockCount} Out)` : '');
    if (elOrdersBadge) elOrdersBadge.textContent = metrics.totalOrders;

    // Render active tab view
    this.switchAdminTab(this.activeAdminTab);
  }

  filterAndRenderTable() {
    const tableBody = document.getElementById('admin-stock-table-body');
    if (!tableBody) return;

    const searchTerm = (document.getElementById('admin-search-input')?.value || '').toLowerCase();
    const brandFilter = document.getElementById('admin-brand-filter')?.value || 'all';
    const statusFilter = document.getElementById('admin-status-filter')?.value || 'all';

    let filtered = this.inventory.filter(item => {
      const matchSearch = item.name.toLowerCase().includes(searchTerm) || item.sku.toLowerCase().includes(searchTerm);
      const matchBrand = brandFilter === 'all' || item.brandSlug === brandFilter;
      let matchStatus = true;
      if (statusFilter === 'in-stock') matchStatus = item.stock > item.minStock;
      else if (statusFilter === 'low-stock') matchStatus = item.stock > 0 && item.stock <= item.minStock;
      else if (statusFilter === 'out-stock') matchStatus = item.stock === 0;

      return matchSearch && matchBrand && matchStatus;
    });

    if (filtered.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 2rem; color: #64748B;">No matching inventory products found.</td></tr>`;
      return;
    }

    tableBody.innerHTML = filtered.map(item => {
      let statusBadge = '<span class="badge-stock in">● In Stock</span>';
      if (item.stock === 0) {
        statusBadge = '<span class="badge-stock out">● Out of Stock</span>';
      } else if (item.stock <= item.minStock) {
        statusBadge = '<span class="badge-stock low">● Low Stock</span>';
      }

      const margin = item.price - item.costPrice;
      const marginPct = Math.round((margin / item.costPrice) * 100);

      return `
        <tr>
          <td>
            <div style="font-weight:800; font-family:monospace; color:var(--color-exide-blue);">${item.sku}</div>
          </td>
          <td>
            <div style="display:flex; align-items:center; gap:0.75rem;">
              <div style="position:relative; width:40px; height:40px; flex-shrink:0;">
                <img src="${item.image}" alt="" style="width:40px; height:40px; object-fit:contain; border-radius:4px; border:1px solid #E2E8F0; padding:2px; background:#fff;">
                ${item.images && item.images.length > 1 ? `<span class="badge-media-count" title="${item.images.length} Media Files Uploaded">📷 ${item.images.length}</span>` : ''}
              </div>
              <div>
                <div style="font-weight:700; color:#0F172A;">${item.name}</div>
                <small style="color:#64748B;">${item.capacity || ''}</small>
              </div>
            </div>
          </td>
          <td>
            <span style="font-size:0.75rem; font-weight:700; padding:2px 8px; border-radius:4px; background:${item.brandColor}15; color:${item.brandColor}; border:1px solid ${item.brandColor}40;">
              ${item.brand}
            </span>
          </td>
          <td style="color:#64748B;">NPR ${item.costPrice.toLocaleString()}</td>
          <td style="font-weight:700; color:var(--color-exide-red);">NPR ${item.price.toLocaleString()}</td>
          <td>
            <span style="color:var(--color-success); font-weight:700;">+${marginPct}%</span>
          </td>
          <td style="text-align:center;">
            <strong style="font-size:1.1rem; color:${item.stock === 0 ? 'var(--color-danger)' : (item.stock <= item.minStock ? 'var(--color-warning)' : '#0F172A')}">
              ${item.stock}
            </strong>
            <small style="display:block; color:#94A3B8;">min: ${item.minStock}</small>
          </td>
          <td>${statusBadge}</td>
          <td>
            <div class="stock-action-btns">
              <button class="btn-stock-adjust" onclick="window.stockManager.promptStockModal('${item.id}', 10)" title="Receive Stock Shipment">
                + Restock
              </button>
              <button class="btn-stock-adjust deduct" onclick="window.stockManager.promptStockModal('${item.id}', -1)" title="Adjust or Deduct">
                - Adjust
              </button>
              <button class="btn-stock-edit" onclick="window.stockManager.openProductFormModal('${item.id}')" title="Edit & Update Product Info">
                ✏️ Edit
              </button>
              <button class="btn-stock-delete" onclick="window.stockManager.deleteProduct('${item.id}')" title="Delete SKU">
                🗑️
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  renderOrdersTable() {
    const tableBody = document.getElementById('admin-orders-table-body');
    if (!tableBody) return;

    const searchTerm = (document.getElementById('admin-orders-search')?.value || '').toLowerCase().trim();
    const statusFilter = (document.getElementById('admin-orders-status-filter')?.value || 'all').toLowerCase();

    // Ensure all orders in memory are normalized
    this.orders = (this.orders || []).map(o => this.normalizeOrder(o)).filter(Boolean);

    let filtered = this.orders.filter(order => {
      const ordId = (order.orderId || order.id || '').toLowerCase();
      const custName = (order.customer?.fullName || '').toLowerCase();
      const custPhone = (order.customer?.phone || '');
      const custDist = (order.customer?.district || '').toLowerCase();
      const custCity = (order.customer?.city || '').toLowerCase();

      const matchSearch = !searchTerm ||
                          ordId.includes(searchTerm) ||
                          custName.includes(searchTerm) ||
                          custPhone.includes(searchTerm) ||
                          custDist.includes(searchTerm) ||
                          custCity.includes(searchTerm);

      const ordStatus = (order.status || order.orderStatus || 'Confirmed').toLowerCase();
      let matchStatus = false;
      if (statusFilter === 'all') {
        matchStatus = true;
      } else if (statusFilter === 'pending') {
        matchStatus = ordStatus === 'pending' || ordStatus === 'confirmed';
      } else {
        matchStatus = ordStatus === statusFilter;
      }

      return matchSearch && matchStatus;
    });

    if (filtered.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 2rem; color:#64748B;">No commercial orders found matching criteria.</td></tr>`;
      return;
    }

    tableBody.innerHTML = filtered.map(order => {
      const items = Array.isArray(order.items) ? order.items : [];
      const itemsCount = items.reduce((s, i) => s + (Number(i.quantity) || 1), 0);
      const itemNames = items.map(i => `${i.quantity || 1}x ${(i.name || 'Battery').split('-')[0]}`).join(', ');
      const status = order.status || order.orderStatus || 'Confirmed';
      const statusLower = status.toLowerCase();
      const paymentStatus = (order.paymentStatus || 'Pending').toString();
      const isPaid = paymentStatus.toLowerCase().includes('paid');
      const grandTotal = Number(order.calculations?.grandTotal ?? order.pricing?.grandTotal ?? 0);

      return `
        <tr>
          <td>
            <strong style="color:var(--color-exide-blue); font-family:monospace;">${order.orderId}</strong>
            <small style="display:block; color:#94A3B8;">${order.orderDate || 'Today'}</small>
          </td>
          <td>
            <div style="font-weight:700; color:#0F172A;">${order.customer?.fullName || 'Valued Customer'}</div>
            <div style="font-size:0.8rem; color:#64748B;">📞 ${order.customer?.phone || 'N/A'}</div>
          </td>
          <td>
            <div style="font-size:0.85rem; color:#0F172A;">${order.customer?.city || 'Kathmandu'}, ${order.customer?.district || 'Nepal'}</div>
            <small style="color:#64748B;">Ward ${order.customer?.ward || '01'}</small>
          </td>
          <td>
            <span title="${itemNames}" style="font-size:0.82rem; color:#334155; display:block; max-width:180px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
              ${itemsCount} Item(s): ${itemNames || 'Exide Battery'}
            </span>
          </td>
          <td>
            <strong style="font-size:0.95rem; color:var(--color-exide-red);">
              NPR ${grandTotal.toLocaleString()}
            </strong>
          </td>
          <td>
            <span style="font-size:0.75rem; font-weight:700; padding:2px 6px; border-radius:4px; background:#F1F5F9; color:#0F172A; display:block; text-align:center; margin-bottom:2px;">
              ${order.paymentMethod || 'COD'}
            </span>
            <small style="display:block; text-align:center; font-weight:700; color:${isPaid ? 'var(--color-success)' : '#D97706'};">
              ${isPaid ? '✓ Paid' : 'Pending'}
            </small>
          </td>
          <td>
            <div style="font-size:0.82rem; font-weight:700; color:#0F172A;">
              ${order.assignedRider ? `🚚 ${order.assignedRider.name}` : '<span style="color:#D97706; font-size:0.76rem;">⚡ Unassigned</span>'}
            </div>
            ${order.assignedRider?.phone ? `<a href="tel:${order.assignedRider.phone}" style="color:#059669; font-size:0.75rem; display:block; text-decoration:none; font-weight:600;">📞 ${order.assignedRider.phone}</a>` : ''}
            <select class="form-select" style="font-size:0.72rem; padding:2px 4px; margin-top:3px; border-radius:4px; max-width:130px; height:auto; background:#F8FAFC;" onchange="window.stockManager.assignOrderToRider('${order.orderId}', this.value)">
              <option value="">-- Assign Rider --</option>
              <option value="PROVIDER-CARGO" ${order.assignedRider && order.assignedRider.id === 'PROVIDER-CARGO' ? 'selected' : ''}>Nepal Can Move (Cargo)</option>
              ${this.logisticsCrew.map(r => `
                <option value="${r.id}" ${order.assignedRider && (order.assignedRider.id === r.id || order.assignedRider.name === r.name) ? 'selected' : ''}>${r.name} (${r.status})</option>
              `).join('')}
            </select>
          </td>
          <td style="text-align:center;">
            <span class="badge-order-status ${statusLower}">${status}</span>
          </td>
          <td>
            <div style="display:flex; gap:0.35rem; justify-content:center; flex-wrap:wrap;">
              <button class="btn-stock-adjust" style="background:#0F172A;" onclick="window.stockManager.openOrderDetailsModal('${order.orderId}')" title="View Order & Track Package">
                👁️ View
              </button>
              <button class="btn-stock-adjust" style="background:var(--color-exide-red);" onclick="window.stockManager.printCommercialInvoice('${order.orderId}')" title="Print VAT Bill">
                🖨️ Bill
              </button>
              <button class="btn-stock-adjust" style="background:#0047BA;" onclick="window.stockManager.printShippingParcelLabel('${order.orderId}')" title="Print Shipping Parcel Label">
                🏷️ Label
              </button>
              ${statusLower !== 'delivered' ? `
                <button class="btn-stock-adjust" style="background:var(--color-success);" onclick="window.stockManager.advanceOrderStatus('${order.orderId}')" title="Advance Stage">
                  ⏩ Next
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  renderSettingsUI() {
    const container = document.getElementById('admin-settings-container');
    if (!container) return;

    const crewHtml = this.logisticsCrew.map((rider, idx) => `
      <div class="logistics-rider-card" style="background:#FFFFFF; border:1.5px solid #E2E8F0; border-radius:12px; padding:1rem; margin-bottom:0.75rem; box-shadow:0 1px 3px rgba(0,0,0,0.04); display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:0.6rem;">
        <div style="display:flex; align-items:flex-start; gap:0.75rem;">
          <div style="width:42px; height:42px; border-radius:10px; background:#EFF6FF; border:1px solid #BFDBFE; display:flex; align-items:center; justify-content:center; font-size:1.3rem; flex-shrink:0;">
            ${rider.vehicleType.includes('Motorbike') ? '🏍️' : '🚚'}
          </div>
          <div>
            <div style="display:flex; align-items:center; gap:0.4rem; flex-wrap:wrap;">
              <strong style="font-size:0.95rem; color:#0F172A;">${rider.name}</strong>
              <span style="font-size:0.7rem; font-weight:800; padding:2px 6px; border-radius:4px; background:${rider.status === 'Available' ? '#DCFCE7' : (rider.status === 'On Delivery' ? '#FEF3C7' : '#F1F5F9')}; color:${rider.status === 'Available' ? '#166534' : (rider.status === 'On Delivery' ? '#92400E' : '#475569')};">
                ${rider.status === 'Available' ? '● Available' : (rider.status === 'On Delivery' ? '🚚 On Delivery' : '○ Off Duty')}
              </span>
            </div>
            <div style="font-size:0.8rem; color:#475569; margin-top:2px;">
              <span>🚘 ${rider.vehicleType}</span> • <span style="font-weight:700; color:#0F172A;">${rider.plateNumber}</span>
            </div>
            <div style="font-size:0.76rem; color:#64748B; margin-top:2px;">
              📍 Coverage: ${rider.territory}
            </div>
          </div>
        </div>

        <div style="display:flex; gap:0.4rem; align-items:center; width:100%; justify-content:flex-end; padding-top:0.4rem; border-top:1px dashed #F1F5F9;">
          <a href="tel:${rider.phone}" class="btn" style="background:#10B981; color:#fff; font-size:0.78rem; padding:0.35rem 0.75rem; border-radius:6px; text-decoration:none; display:inline-flex; align-items:center; gap:4px; font-weight:700;">
            📞 Call ${rider.phone}
          </a>
          <button type="button" class="btn" onclick="window.stockManager.deleteLogisticsCrewMember('${rider.id}')" style="background:#FEE2E2; color:#DC2626; border:1px solid #FECACA; font-size:0.78rem; padding:0.35rem 0.65rem; border-radius:6px; cursor:pointer;" title="Remove crew member">
            🗑️
          </button>
        </div>
      </div>
    `).join('');

    container.innerHTML = `
      <div style="max-width:880px; margin:0 auto; display:grid; grid-template-columns:1fr; gap:1.5rem;">
        
        <!-- 1. Assigned Logistics & Delivery Crew (Mobile-Focused) -->
        <div style="background:#fff; border:1.5px solid #E2E8F0; border-radius:14px; padding:1.25rem; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; flex-wrap:wrap; gap:0.5rem;">
            <div>
              <h3 style="font-size:1.1rem; font-weight:800; color:#0F172A; margin:0; display:flex; align-items:center; gap:0.4rem;">
                <span>🚚 Assigned Logistics & Delivery Crew</span>
                <span style="font-size:0.72rem; background:#EFF6FF; color:#1D4ED8; padding:2px 8px; border-radius:12px; font-weight:800;">${this.logisticsCrew.length} Active Riders</span>
              </h3>
              <p style="font-size:0.78rem; color:#64748B; margin:3px 0 0 0;">
                Assign technicians and delivery riders for doorstep fitting across Kathmandu Valley, Butwal & regional corridors.
              </p>
            </div>
            <button type="button" class="btn btn-outline-primary" onclick="const f = document.getElementById('add-rider-inline-form'); f.style.display = f.style.display === 'none' ? 'block' : 'none';" style="font-size:0.8rem; padding:0.4rem 0.8rem; border-radius:8px;">
              + Add New Rider
            </button>
          </div>

          <!-- Add Rider Mobile-Friendly Form -->
          <form id="add-rider-inline-form" style="display:none; background:#F8FAFC; border:1.5px dashed #CBD5E1; border-radius:10px; padding:1rem; margin-bottom:1rem;" onsubmit="event.preventDefault(); window.stockManager.addLogisticsCrewMember({
            name: document.getElementById('new-rider-name').value,
            phone: document.getElementById('new-rider-phone').value,
            vehicleType: document.getElementById('new-rider-vehicle').value,
            plateNumber: document.getElementById('new-rider-plate').value,
            territory: document.getElementById('new-rider-territory').value,
            status: document.getElementById('new-rider-status').value
          }); this.reset(); this.style.display='none';">
            <h4 style="font-size:0.9rem; font-weight:800; color:#0F172A; margin:0 0 0.75rem 0;">Register Logistics Crew Member</h4>
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:0.65rem; margin-bottom:0.75rem;">
              <div>
                <label class="form-label" style="font-size:0.76rem; font-weight:700;">Full Name *</label>
                <input type="text" id="new-rider-name" class="form-input" placeholder="e.g. Bikram Thapa" required style="font-size:0.85rem;">
              </div>
              <div>
                <label class="form-label" style="font-size:0.76rem; font-weight:700;">Nepal Mobile (+977) *</label>
                <input type="tel" id="new-rider-phone" class="form-input" placeholder="98XXXXXXXX" required style="font-size:0.85rem;">
              </div>
              <div>
                <label class="form-label" style="font-size:0.76rem; font-weight:700;">Vehicle Type</label>
                <select id="new-rider-vehicle" class="form-select" style="font-size:0.85rem;">
                  <option value="Delivery Van">Delivery Van</option>
                  <option value="Motorbike Express">Motorbike Express</option>
                  <option value="Commercial Pickup">Commercial Pickup</option>
                  <option value="Electric Scooter">Electric Scooter</option>
                </select>
              </div>
              <div>
                <label class="form-label" style="font-size:0.76rem; font-weight:700;">Number Plate</label>
                <input type="text" id="new-rider-plate" class="form-input" placeholder="e.g. BA 2 CHA 4521" style="font-size:0.85rem;">
              </div>
              <div>
                <label class="form-label" style="font-size:0.76rem; font-weight:700;">Assigned Route / Territory</label>
                <input type="text" id="new-rider-territory" class="form-input" placeholder="e.g. Kathmandu Valley Central" style="font-size:0.85rem;">
              </div>
              <div>
                <label class="form-label" style="font-size:0.76rem; font-weight:700;">Initial Status</label>
                <select id="new-rider-status" class="form-select" style="font-size:0.85rem;">
                  <option value="Available">Available</option>
                  <option value="On Delivery">On Delivery</option>
                  <option value="Off Duty">Off Duty</option>
                </select>
              </div>
            </div>
            <div style="display:flex; justify-content:flex-end; gap:0.5rem;">
              <button type="button" class="btn" onclick="document.getElementById('add-rider-inline-form').style.display='none';" style="font-size:0.8rem; padding:0.4rem 0.75rem;">Cancel</button>
              <button type="submit" class="btn btn-primary" style="font-size:0.8rem; padding:0.4rem 0.9rem;">Save Logistics Rider</button>
            </div>
          </form>

          <!-- Rider List Container -->
          <div class="logistics-riders-list" style="margin-top:0.75rem;">
            ${crewHtml || '<p style="text-align:center; color:#64748B; font-size:0.85rem; padding:1.5rem;">No logistics crew members registered yet.</p>'}
          </div>
        </div>

        <!-- 2. Commercial & ERP Store Parameters -->
        <div style="background:#fff; border:1.5px solid #E2E8F0; border-radius:14px; padding:1.25rem; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
          <h3 style="font-size:1.1rem; font-weight:800; color:#0F172A; margin:0 0 0.35rem 0;">
            ⚙️ Commercial Store & Rebate Rates
          </h3>
          <p style="font-size:0.78rem; color:#64748B; margin:0 0 1.25rem 0;">
            Configure official scrap battery exchange rates, store hotline, and IRD VAT details.
          </p>

          <form onsubmit="event.preventDefault(); window.stockManager.updateSettings({
            scrapRatePerAh: Number(document.getElementById('erp-set-scrap-rate').value),
            storePhone: document.getElementById('erp-set-phone').value.trim(),
            headOffice: document.getElementById('erp-set-hq').value.trim(),
            vatNumber: document.getElementById('erp-set-vat').value.trim()
          });">
            <div class="form-group" style="margin-bottom:1rem;">
              <label class="form-label" style="font-weight:700; font-size:0.84rem;">
                ♻️ Scrap Battery Trade-In Rebate Rate (NPR per Ah) *
              </label>
              <div style="display:flex; align-items:center; gap:0.5rem;">
                <input type="number" id="erp-set-scrap-rate" class="form-input" style="width:140px; font-weight:800; font-size:1.1rem; color:var(--color-exide-red);" value="${this.settings.scrapRatePerAh}" min="10" max="100" required>
                <span style="font-size:0.88rem; font-weight:700; color:#475569;">NPR / Ah</span>
              </div>
              <small style="color:#64748B; display:block; margin-top:0.25rem; font-size:0.75rem;">
                Multiplies customer's old scrap capacity (e.g. 150Ah × NPR ${this.settings.scrapRatePerAh} = NPR ${(150 * this.settings.scrapRatePerAh).toLocaleString()} instant deduction).
              </small>
            </div>

            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:0.85rem; margin-bottom:1.25rem;">
              <div class="form-group">
                <label class="form-label" style="font-size:0.82rem; font-weight:700;">Official Store Contact Hotline *</label>
                <input type="text" id="erp-set-phone" class="form-input" value="${this.settings.storePhone}" required style="font-size:0.88rem;">
              </div>

              <div class="form-group">
                <label class="form-label" style="font-size:0.82rem; font-weight:700;">IRD Nepal VAT / PAN Registration *</label>
                <input type="text" id="erp-set-vat" class="form-input" value="${this.settings.vatNumber}" required style="font-size:0.88rem;">
              </div>
            </div>

            <div class="form-group" style="margin-bottom:1.25rem;">
              <label class="form-label" style="font-size:0.82rem; font-weight:700;">Official Head Office Location *</label>
              <input type="text" id="erp-set-hq" class="form-input" value="${this.settings.headOffice}" required style="font-size:0.88rem;">
            </div>

            <div style="display:flex; justify-content:flex-end;">
              <button type="submit" class="btn btn-primary" style="padding:0.6rem 1.25rem; font-weight:800; font-size:0.88rem;">
                Save Commercial Settings
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  renderAuditLogsTable() {
    const logsContainer = document.getElementById('admin-audit-logs-body');
    if (!logsContainer) return;

    if (this.auditLogs.length === 0) {
      logsContainer.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:2rem; color:#64748B;">No audit trail recorded.</td></tr>`;
      return;
    }

    logsContainer.innerHTML = this.auditLogs.slice(0, 50).map(log => `
      <tr>
        <td style="font-family:monospace; font-size:0.8rem; color:#64748B;">${log.timestamp}</td>
        <td><strong style="color:var(--color-exide-blue);">${log.sku}</strong></td>
        <td>
          <span style="font-size:0.75rem; font-weight:700; padding:2px 6px; border-radius:4px; background:${log.action.includes('RESTOCK') ? 'var(--color-success-bg)' : (log.action.includes('DEDUCT') ? 'var(--color-danger-bg)' : '#EFF6FF')}; color:${log.action.includes('RESTOCK') ? 'var(--color-success)' : (log.action.includes('DEDUCT') ? 'var(--color-danger)' : 'var(--color-exide-blue)')}">
            ${log.action}
          </span>
        </td>
        <td style="font-weight:700;">
          ${log.previousStock} → <span style="color:var(--color-exide-red);">${log.newStock}</span> (${log.action.includes('RESTOCK') ? '+' : '-'}${log.quantity})
        </td>
        <td style="font-size:0.85rem; color:#334155;">${log.reason}</td>
        <td style="font-size:0.8rem; color:#64748B;">${log.user}</td>
      </tr>
    `).join('');
  }

  promptStockModal(productId, suggestedQty) {
    const item = this.inventory.find(p => p.id === productId);
    if (!item) return;

    const modal = document.getElementById('stock-adjust-modal');
    if (!modal) return;

    document.getElementById('adjust-product-title').textContent = `${item.name} (${item.sku})`;
    document.getElementById('adjust-current-stock').textContent = item.stock;
    document.getElementById('adjust-product-id').value = productId;
    document.getElementById('adjust-qty-input').value = Math.abs(suggestedQty);
    document.getElementById('adjust-action-type').value = suggestedQty > 0 ? 'add' : 'deduct';
    document.getElementById('adjust-reason-input').value = suggestedQty > 0 ? 'Supplier shipment batch received' : 'Damaged / store internal transfer';

    modal.classList.add('open');
  }

  submitStockAdjustment() {
    const productId = document.getElementById('adjust-product-id').value;
    const actionType = document.getElementById('adjust-action-type').value;
    const qty = parseInt(document.getElementById('adjust-qty-input').value, 10);
    const reason = document.getElementById('adjust-reason-input').value.trim();

    if (isNaN(qty) || qty <= 0) {
      showToast('Please enter a valid positive quantity', 'warning');
      return;
    }

    const delta = actionType === 'add' ? qty : -qty;
    this.adjustStock(productId, delta, reason);
    document.getElementById('stock-adjust-modal').classList.remove('open');
  }

  resetDemoData() {
    if (confirm('Are you sure you want to reset inventory to original default stock data?')) {
      localStorage.removeItem(this.storageKey);
      localStorage.removeItem(this.logsKey);
      localStorage.removeItem(this.ordersKey);
      localStorage.removeItem(this.settingsKey);
      this.loadSettings();
      this.loadData();
      this.loadOrders();
      this.renderAdminUI();
      if (window.renderProductsCatalog) window.renderProductsCatalog();
      showToast('Inventory & ERP reset to default factory data', 'info');
    }
  }

  exportToCSV() {
    let csv = "SKU,Product Name,Brand,Category,Cost Price (NPR),Selling Price (NPR),Margin (NPR),Current Stock,Min Threshold,Status,Valuation (NPR)\n";
    this.inventory.forEach(item => {
      const margin = item.price - item.costPrice;
      const status = item.stock === 0 ? 'Out of Stock' : (item.stock <= item.minStock ? 'Low Stock' : 'In Stock');
      const val = item.costPrice * item.stock;
      csv += `"${item.sku}","${item.name.replace(/"/g, '""')}","${item.brand}","${item.categories.join('; ')}",${item.costPrice},${item.price},${margin},${item.stock},${item.minStock},"${status}",${val}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `ExideWholesale_Inventory_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Inventory report downloaded as CSV', 'success');
  }
}

// ==========================================================================
// Global Rich Text Editor Formatting, Multi-Media & Table Tools
// ==========================================================================
window.formatDescText = function(command, value = null) {
  const editor = document.getElementById('new-detailed-desc-editor');
  if (editor) editor.focus();
  document.execCommand(command, false, value);
  const hidden = document.getElementById('new-detailed-desc');
  if (hidden && editor) hidden.value = editor.innerHTML;
};

window.formatDescHeading = function(val) {
  const editor = document.getElementById('new-detailed-desc-editor');
  if (!editor) return;
  editor.focus();
  if (val === 'p' || val === 'h3' || val === 'h4') {
    document.execCommand('formatBlock', false, `<${val}>`);
  } else if (val === 'lead') {
    document.execCommand('formatBlock', false, '<p>');
  }
  const hidden = document.getElementById('new-detailed-desc');
  if (hidden) hidden.value = editor.innerHTML;
};

window.formatDescFontSize = function(size) {
  const editor = document.getElementById('new-detailed-desc-editor');
  if (editor) editor.focus();
  document.execCommand('fontSize', false, size);
  const hidden = document.getElementById('new-detailed-desc');
  if (hidden && editor) hidden.value = editor.innerHTML;
};

window.insertDescLink = function() {
  const url = prompt('Enter web link URL (https://...):');
  if (url) {
    const editor = document.getElementById('new-detailed-desc-editor');
    if (editor) editor.focus();
    document.execCommand('createLink', false, url);
    const hidden = document.getElementById('new-detailed-desc');
    if (hidden && editor) hidden.value = editor.innerHTML;
  }
};

// Insert multiple media files directly into product description editor
window.insertDescMediaFiles = function(fileList) {
  if (!fileList || fileList.length === 0) return;
  const files = Array.from(fileList);
  const editor = document.getElementById('new-detailed-desc-editor');
  if (!editor) return;
  editor.focus();

  let loadedCount = 0;
  const total = files.length;

  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = function(e) {
      const dataUrl = e.target.result;
      let htmlSnippet = '';
      if (file.type.startsWith('video/')) {
        htmlSnippet = `
          <div class="desc-media-embed" style="margin:0.75rem 0;">
            <video src="${dataUrl}" controls style="max-width:100%; border-radius:8px; display:block; border:1px solid #CBD5E1;"></video>
            <div style="font-size:0.75rem; color:#64748B; margin-top:3px;">🎬 ${file.name}</div>
          </div><p><br></p>`;
      } else {
        htmlSnippet = `
          <div class="desc-media-embed" style="margin:0.75rem 0;">
            <img src="${dataUrl}" alt="${file.name}" style="max-width:100%; height:auto; border-radius:8px; display:block; border:1px solid #CBD5E1;">
            <div style="font-size:0.75rem; color:#64748B; margin-top:3px;">📷 ${file.name}</div>
          </div><p><br></p>`;
      }

      const sel = window.getSelection();
      let inserted = false;
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        if (editor.contains(range.commonAncestorContainer)) {
          range.deleteContents();
          const temp = document.createElement('div');
          temp.innerHTML = htmlSnippet;
          const frag = document.createDocumentFragment();
          let n;
          while ((n = temp.firstChild)) frag.appendChild(n);
          range.insertNode(frag);
          inserted = true;
        }
      }
      if (!inserted) {
        editor.innerHTML += htmlSnippet;
      }

      loadedCount++;
      const hidden = document.getElementById('new-detailed-desc');
      if (hidden && editor) hidden.value = editor.innerHTML;
      if (loadedCount === total) {
        if (typeof showToast === 'function') {
          showToast(`Inserted ${total} media file(s) into product description!`, 'success');
        }
      }
    };
    reader.readAsDataURL(file);
  });
};

window.insertDescMediaFile = function(file) {
  if (file) window.insertDescMediaFiles([file]);
};

// ==========================================================================
// PRODUCT DESCRIPTION TABLE GENERATION & MANIPULATION
// ==========================================================================
function getActiveTableInDescEditor() {
  const editor = document.getElementById('new-detailed-desc-editor');
  if (!editor) return null;
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0) {
    let node = sel.anchorNode;
    while (node && node !== editor) {
      if (node.nodeName === 'TABLE') return node;
      node = node.parentNode;
    }
  }
  const tables = editor.querySelectorAll('table');
  return tables.length > 0 ? tables[tables.length - 1] : null;
}

window.openDescTableModal = function() {
  const modal = document.getElementById('desc-table-modal');
  if (modal) {
    modal.classList.add('open');
    window.updateDescTablePreview();
  }
};

window.closeDescTableModal = function() {
  const modal = document.getElementById('desc-table-modal');
  if (modal) modal.classList.remove('open');
};

window.applyTablePreset = function(preset) {
  document.querySelectorAll('.table-preset-btn').forEach(btn => btn.classList.remove('active'));
  const targetBtn = document.getElementById(`preset-${preset}`);
  if (targetBtn) targetBtn.classList.add('active');

  const colsInput = document.getElementById('desc-table-cols');
  const rowsInput = document.getElementById('desc-table-rows');
  const styleSelect = document.getElementById('desc-table-style');
  const captionInput = document.getElementById('desc-table-caption');
  const headerCheck = document.getElementById('desc-table-has-header');
  const zebraCheck = document.getElementById('desc-table-zebra');

  if (preset === 'tech-specs') {
    if (colsInput) colsInput.value = 2;
    if (rowsInput) rowsInput.value = 4;
    if (styleSelect) styleSelect.value = 'desc-table-blue';
    if (captionInput) captionInput.value = 'Technical Specifications';
    if (headerCheck) headerCheck.checked = true;
    if (zebraCheck) zebraCheck.checked = true;
  } else if (preset === 'comparison') {
    if (colsInput) colsInput.value = 3;
    if (rowsInput) rowsInput.value = 4;
    if (styleSelect) styleSelect.value = 'desc-table-slate';
    if (captionInput) captionInput.value = 'Model Feature & Performance Comparison';
    if (headerCheck) headerCheck.checked = true;
    if (zebraCheck) zebraCheck.checked = true;
  } else if (preset === 'warranty') {
    if (colsInput) colsInput.value = 2;
    if (rowsInput) rowsInput.value = 3;
    if (styleSelect) styleSelect.value = 'desc-table-red';
    if (captionInput) captionInput.value = 'Warranty & In-Box Package Details';
    if (headerCheck) headerCheck.checked = true;
    if (zebraCheck) zebraCheck.checked = false;
  } else if (preset === 'simple-grid') {
    if (colsInput) colsInput.value = 2;
    if (rowsInput) rowsInput.value = 2;
    if (styleSelect) styleSelect.value = 'desc-table-gray';
    if (captionInput) captionInput.value = '';
    if (headerCheck) headerCheck.checked = true;
    if (zebraCheck) zebraCheck.checked = true;
  }
  window.updateDescTablePreview();
};

window.updateDescTablePreview = function() {
  const previewBox = document.getElementById('desc-table-preview-box');
  if (!previewBox) return;

  const cols = Math.max(1, Math.min(8, parseInt(document.getElementById('desc-table-cols')?.value || 2)));
  const rows = Math.max(1, Math.min(20, parseInt(document.getElementById('desc-table-rows')?.value || 4)));
  const styleClass = document.getElementById('desc-table-style')?.value || 'desc-table-blue';
  const caption = document.getElementById('desc-table-caption')?.value.trim() || '';
  const hasHeader = document.getElementById('desc-table-has-header')?.checked ?? true;
  const isZebra = document.getElementById('desc-table-zebra')?.checked ?? true;

  let html = `<table class="desc-table ${styleClass} ${isZebra ? 'zebra' : ''}" style="width:100%; border-collapse:collapse;">`;
  if (caption) {
    html += `<caption>${caption}</caption>`;
  }
  if (hasHeader) {
    html += `<thead><tr>`;
    for (let c = 1; c <= cols; c++) {
      html += `<th>${c === 1 ? 'Specification' : (c === 2 ? 'Details / Value' : `Col ${c}`)}</th>`;
    }
    html += `</tr></thead>`;
  }
  html += `<tbody>`;
  for (let r = 1; r <= rows; r++) {
    html += `<tr>`;
    for (let c = 1; c <= cols; c++) {
      html += `<td>${c === 1 ? `Parameter ${r}` : `Value ${r}`}</td>`;
    }
    html += `</tr>`;
  }
  html += `</tbody></table>`;
  previewBox.innerHTML = html;
};

window.insertDescTableFromModal = function() {
  const cols = Math.max(1, Math.min(8, parseInt(document.getElementById('desc-table-cols')?.value || 2)));
  const rows = Math.max(1, Math.min(20, parseInt(document.getElementById('desc-table-rows')?.value || 4)));
  const styleClass = document.getElementById('desc-table-style')?.value || 'desc-table-blue';
  const caption = document.getElementById('desc-table-caption')?.value.trim() || '';
  const hasHeader = document.getElementById('desc-table-has-header')?.checked ?? true;
  const isZebra = document.getElementById('desc-table-zebra')?.checked ?? true;

  let tableHtml = `<div class="desc-table-wrapper"><table class="desc-table ${styleClass} ${isZebra ? 'zebra' : ''}">`;
  if (caption) {
    tableHtml += `<caption>${caption}</caption>`;
  }
  if (hasHeader) {
    tableHtml += `<thead><tr>`;
    for (let c = 1; c <= cols; c++) {
      tableHtml += `<th contenteditable="true">${c === 1 ? 'Specification / Feature' : (c === 2 ? 'Details / Value' : `Header ${c}`)}</th>`;
    }
    tableHtml += `</tr></thead>`;
  }
  tableHtml += `<tbody>`;
  for (let r = 1; r <= rows; r++) {
    tableHtml += `<tr>`;
    for (let c = 1; c <= cols; c++) {
      tableHtml += `<td contenteditable="true">${c === 1 ? `Feature ${r}` : `Specification ${r}`}</td>`;
    }
    tableHtml += `</tr>`;
  }
  tableHtml += `</tbody></table></div><p><br></p>`;

  const editor = document.getElementById('new-detailed-desc-editor');
  if (editor) {
    editor.focus();
    const sel = window.getSelection();
    let inserted = false;
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (editor.contains(range.commonAncestorContainer)) {
        range.deleteContents();
        const temp = document.createElement('div');
        temp.innerHTML = tableHtml;
        const frag = document.createDocumentFragment();
        let node;
        while ((node = temp.firstChild)) {
          frag.appendChild(node);
        }
        range.insertNode(frag);
        inserted = true;
      }
    }
    if (!inserted) {
      editor.innerHTML += tableHtml;
    }

    const hidden = document.getElementById('new-detailed-desc');
    if (hidden) hidden.value = editor.innerHTML;
  }

  window.closeDescTableModal();
  if (typeof showToast === 'function') {
    showToast('Table inserted into description! Click any cell to edit details.', 'success');
  }
};

window.addDescTableRow = function() {
  const table = getActiveTableInDescEditor();
  if (!table) {
    if (typeof showToast === 'function') showToast('No table found. Please click or insert a table first.', 'warning');
    return;
  }
  const tbody = table.querySelector('tbody') || table;
  const firstRow = table.querySelector('tr');
  const colsCount = firstRow ? firstRow.cells.length : 2;
  
  const newRow = document.createElement('tr');
  for (let i = 0; i < colsCount; i++) {
    const td = document.createElement('td');
    td.contentEditable = "true";
    td.textContent = (i === 0 ? 'New Feature' : 'New Value');
    newRow.appendChild(td);
  }
  tbody.appendChild(newRow);

  const editor = document.getElementById('new-detailed-desc-editor');
  const hidden = document.getElementById('new-detailed-desc');
  if (hidden && editor) hidden.value = editor.innerHTML;
  if (typeof showToast === 'function') showToast('Row added to table', 'info');
};

window.deleteDescTableRow = function() {
  const table = getActiveTableInDescEditor();
  if (!table) return;
  const sel = window.getSelection();
  let targetRow = null;
  if (sel && sel.rangeCount > 0) {
    let node = sel.anchorNode;
    while (node && node !== table) {
      if (node.nodeName === 'TR') { targetRow = node; break; }
      node = node.parentNode;
    }
  }
  const tbody = table.querySelector('tbody') || table;
  const rows = tbody.querySelectorAll('tr');
  if (!targetRow || (targetRow.parentNode && targetRow.parentNode.nodeName === 'THEAD')) {
    if (rows.length > 0) targetRow = rows[rows.length - 1];
  }
  if (targetRow && rows.length > 1) {
    targetRow.remove();
    const editor = document.getElementById('new-detailed-desc-editor');
    const hidden = document.getElementById('new-detailed-desc');
    if (hidden && editor) hidden.value = editor.innerHTML;
    if (typeof showToast === 'function') showToast('Row deleted from table', 'info');
  } else {
    if (typeof showToast === 'function') showToast('Cannot delete the only row', 'warning');
  }
};

window.addDescTableColumn = function() {
  const table = getActiveTableInDescEditor();
  if (!table) {
    if (typeof showToast === 'function') showToast('No table found in description. Please click or insert a table first.', 'warning');
    return;
  }
  const theadRow = table.querySelector('thead tr');
  if (theadRow) {
    const th = document.createElement('th');
    th.contentEditable = "true";
    th.textContent = `Header ${theadRow.cells.length + 1}`;
    theadRow.appendChild(th);
  }
  const tbodyRows = table.querySelectorAll('tbody tr');
  tbodyRows.forEach((tr, idx) => {
    const td = document.createElement('td');
    td.contentEditable = "true";
    td.textContent = `Data`;
    tr.appendChild(td);
  });
  const editor = document.getElementById('new-detailed-desc-editor');
  const hidden = document.getElementById('new-detailed-desc');
  if (hidden && editor) hidden.value = editor.innerHTML;
  if (typeof showToast === 'function') showToast('Column added to table', 'info');
};

window.deleteDescTableColumn = function() {
  const table = getActiveTableInDescEditor();
  if (!table) return;
  const theadRow = table.querySelector('thead tr');
  const tbodyRows = table.querySelectorAll('tbody tr');
  const cols = theadRow ? theadRow.cells.length : (tbodyRows[0] ? tbodyRows[0].cells.length : 0);
  if (cols <= 1) {
    if (typeof showToast === 'function') showToast('Cannot delete the last remaining column', 'warning');
    return;
  }
  if (theadRow && theadRow.cells.length > 0) {
    theadRow.deleteCell(-1);
  }
  tbodyRows.forEach(tr => {
    if (tr.cells.length > 0) tr.deleteCell(-1);
  });
  const editor = document.getElementById('new-detailed-desc-editor');
  const hidden = document.getElementById('new-detailed-desc');
  if (hidden && editor) hidden.value = editor.innerHTML;
  if (typeof showToast === 'function') showToast('Column deleted from table', 'info');
};

window.deleteDescTable = function() {
  const table = getActiveTableInDescEditor();
  if (!table) {
    if (typeof showToast === 'function') showToast('No table selected in description', 'warning');
    return;
  }
  if (confirm('Are you sure you want to delete this table from the product description?')) {
    const wrapper = table.closest('.desc-table-wrapper');
    if (wrapper) wrapper.remove();
    else table.remove();
    const editor = document.getElementById('new-detailed-desc-editor');
    const hidden = document.getElementById('new-detailed-desc');
    if (hidden && editor) hidden.value = editor.innerHTML;
    if (typeof showToast === 'function') showToast('Table deleted from description', 'info');
  }
};

// Global Shipping Parcel Label Dispatcher
window.printShippingParcelLabel = function(orderOrId) {
  if (window.stockManager && typeof window.stockManager.printShippingParcelLabel === 'function') {
    return window.stockManager.printShippingParcelLabel(orderOrId);
  }
  if (window.erpApp && typeof window.erpApp.printPackingSlipModal === 'function') {
    const id = typeof orderOrId === 'object' ? (orderOrId.orderId || orderOrId.id) : orderOrId;
    return window.erpApp.printPackingSlipModal(id);
  }
};
