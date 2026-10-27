// Vercel Serverless Function: Protected ERP Product Catalogue Management
// Exide Battery Wholesale & AET Official Partner
const db = require('../../db/client.js');
const { verifyJwt, extractToken } = require('../auth/token.js');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // 1. Authenticate ERP Staff Session
  const token = extractToken(req);
  const session = verifyJwt(token, true);

  if (!session || !session.userId) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Access to ERP product management is restricted.'
    });
  }

  const callerRole = db.normalizeRole(session.role);
  const validStaffRoles = ['super_admin', 'inventory_manager', 'sales_staff', 'accountant', 'delivery_rider', 'viewer'];

  if (!validStaffRoles.includes(callerRole)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Account does not possess staff privileges.'
    });
  }

  const canViewCosts = db.hasPermission(callerRole, 'cost_price_view') || callerRole === 'super_admin';
  const canWriteInventory = db.hasPermission(callerRole, 'inventory_write') || callerRole === 'super_admin';

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch(e) { body = {}; }
  }
  body = body || {};

  const query = req.query || {};

  try {
    // ------------------------------------------------------------------------
    // GET: List Products with Search, Filtering & Cost Redaction
    // ------------------------------------------------------------------------
    if (req.method === 'GET') {
      const { id, sku, brand, category, status, search } = query;
      const products = db.getProducts();

      if (id || sku) {
        const prod = products.find(p => p.id === (id || sku) || p.sku === (id || sku));
        if (!prod) {
          return res.status(404).json({ success: false, message: 'Product not found' });
        }
        const sanitized = { ...prod };
        if (!canViewCosts) {
          sanitized.costPrice = null;
          delete sanitized.cost_price;
        }
        return res.status(200).json({ success: true, product: sanitized });
      }

      let filtered = products;

      if (brand && brand !== 'all') {
        filtered = filtered.filter(p => p.brand && p.brand.toLowerCase() === brand.toLowerCase());
      }

      if (category && category !== 'all') {
        filtered = filtered.filter(p => {
          const cats = Array.isArray(p.categories) ? p.categories : [p.category || ''];
          return cats.some(c => c.toLowerCase() === category.toLowerCase());
        });
      }

      if (status) {
        if (status === 'in_stock') filtered = filtered.filter(p => (p.stock || 0) > (p.minStock || 5));
        else if (status === 'low_stock') filtered = filtered.filter(p => (p.stock || 0) <= (p.minStock || 5) && (p.stock || 0) > 0);
        else if (status === 'out_of_stock') filtered = filtered.filter(p => (p.stock || 0) === 0);
      }

      if (search) {
        const q = search.trim().toLowerCase();
        filtered = filtered.filter(p =>
          (p.sku && p.sku.toLowerCase().includes(q)) ||
          (p.name && p.name.toLowerCase().includes(q)) ||
          (p.brand && p.brand.toLowerCase().includes(q)) ||
          (p.capacity && p.capacity.toLowerCase().includes(q))
        );
      }

      // Format & redact cost price if not authorized
      const sanitizedList = filtered.map(p => {
        const item = { ...p };
        if (!canViewCosts) {
          item.costPrice = null;
          delete item.cost_price;
        }
        return item;
      });

      return res.status(200).json({
        success: true,
        count: sanitizedList.length,
        totalCatalog: products.length,
        canViewCostPrice: canViewCosts,
        products: sanitizedList
      });
    }

    // ------------------------------------------------------------------------
    // POST: Create New SKU (Strictly Inventory Managers & SuperAdmin)
    // ------------------------------------------------------------------------
    if (req.method === 'POST') {
      if (!canWriteInventory) {
        return res.status(403).json({
          success: false,
          message: 'Permission denied. Only Inventory Managers and SuperAdmins can create SKUs.'
        });
      }

      const { sku, name, brand, category, capacity, costPrice, price, wholesalePrice, stock, minStock, warranty, image, description } = body;

      if (!sku || !name || !brand || !price) {
        return res.status(400).json({
          success: false,
          message: 'SKU Code, Product Name, Brand, and Selling Retail Price are required.'
        });
      }

      const cleanSku = String(sku).trim().toUpperCase();
      const products = db.getProducts();

      if (products.some(p => p.sku && p.sku.toUpperCase() === cleanSku)) {
        return res.status(409).json({
          success: false,
          message: `Product with SKU code "${cleanSku}" already exists in the catalog.`
        });
      }

      const id = 'prod_' + cleanSku.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '_' + Date.now().toString(36).slice(-4);
      const openingStock = Math.max(0, parseInt(stock, 10) || 0);
      const cost = Math.max(0, parseFloat(costPrice) || 0);
      const retailPrice = Math.max(0, parseFloat(price) || 0);

      const newProduct = {
        id: id,
        sku: cleanSku,
        name: String(name).trim(),
        brand: String(brand).trim(),
        brandSlug: String(brand).trim().toLowerCase(),
        categories: [category || 'inverter-battery'],
        capacity: capacity ? String(capacity).trim() : '',
        warranty: warranty ? String(warranty).trim() : '36 Months Official Warranty',
        costPrice: cost,
        price: retailPrice,
        wholesalePrice: wholesalePrice ? parseFloat(wholesalePrice) : Math.round(retailPrice * 0.90),
        stock: 0,
        minStock: Math.max(1, parseInt(minStock, 10) || 5),
        image: image || 'assets/logo.png',
        description: description ? String(description).trim() : '',
        featured: !!body.featured,
        isActive: true,
        createdAt: new Date().toISOString()
      };

      products.unshift(newProduct);
      db.saveProducts(products);

      // Record opening balance in stock ledger
      if (openingStock > 0) {
        const moveRes = db.executeStockMovement(newProduct.id, 'wh-ktm-central', 'OPENING_BALANCE', openingStock, 'INVENTORY_INIT', 'INIT-001', 'Initial SKU Creation Opening Stock', session.userId);
        newProduct.stock = moveRes.newStock;
      }

      db.logAuditEvent(session.userId, 'CREATE_PRODUCT_SKU', 'products', newProduct.id, null, { sku: cleanSku, name: newProduct.name, openingStock });

      return res.status(201).json({
        success: true,
        message: `Product SKU "${cleanSku}" created successfully.`,
        product: newProduct
      });
    }

    // ------------------------------------------------------------------------
    // PUT: Update Product SKU
    // ------------------------------------------------------------------------
    if (req.method === 'PUT') {
      if (!canWriteInventory) {
        return res.status(403).json({
          success: false,
          message: 'Permission denied. Only Inventory Managers and SuperAdmins can edit products.'
        });
      }

      const { id, sku, name, brand, category, capacity, costPrice, price, wholesalePrice, minStock, warranty, image, description } = body;
      const targetIdentifier = id || sku;

      if (!targetIdentifier) {
        return res.status(400).json({ success: false, message: 'Product ID or SKU is required.' });
      }

      const products = db.getProducts();
      const prod = products.find(p => p.id === targetIdentifier || p.sku === targetIdentifier);

      if (!prod) {
        return res.status(404).json({ success: false, message: 'Product not found in catalog.' });
      }

      const oldState = { name: prod.name, price: prod.price, costPrice: prod.costPrice };

      if (name) prod.name = String(name).trim();
      if (brand) { prod.brand = String(brand).trim(); prod.brandSlug = String(brand).toLowerCase(); }
      if (category) prod.categories = [category];
      if (capacity !== undefined) prod.capacity = String(capacity).trim();
      if (warranty !== undefined) prod.warranty = String(warranty).trim();
      if (price !== undefined) prod.price = Math.max(0, parseFloat(price) || 0);
      if (costPrice !== undefined && canViewCosts) prod.costPrice = Math.max(0, parseFloat(costPrice) || 0);
      if (wholesalePrice !== undefined) prod.wholesalePrice = Math.max(0, parseFloat(wholesalePrice) || 0);
      if (minStock !== undefined) prod.minStock = Math.max(1, parseInt(minStock, 10) || 5);
      if (image) prod.image = String(image).trim();
      if (description !== undefined) prod.description = String(description).trim();
      prod.updatedAt = new Date().toISOString();

      db.saveProducts(products);

      db.logAuditEvent(session.userId, 'UPDATE_PRODUCT_SKU', 'products', prod.id, oldState, { name: prod.name, price: prod.price, costPrice: prod.costPrice });

      return res.status(200).json({
        success: true,
        message: `Product SKU "${prod.sku}" updated successfully.`,
        product: prod
      });
    }

    // ------------------------------------------------------------------------
    // DELETE: Toggle Active Status (Soft Delete)
    // ------------------------------------------------------------------------
    if (req.method === 'DELETE') {
      if (!canWriteInventory) {
        return res.status(403).json({ success: false, message: 'Permission denied.' });
      }

      const { id } = query;
      const products = db.getProducts();
      const prod = products.find(p => p.id === id || p.sku === id);

      if (!prod) {
        return res.status(404).json({ success: false, message: 'Product not found.' });
      }

      prod.isActive = prod.isActive === false ? true : false;
      prod.updatedAt = new Date().toISOString();
      db.saveProducts(products);

      db.logAuditEvent(session.userId, 'TOGGLE_PRODUCT_STATUS', 'products', prod.id, null, { isActive: prod.isActive });

      return res.status(200).json({
        success: true,
        message: `Product SKU "${prod.sku}" status set to ${prod.isActive ? 'Active' : 'Inactive'}.`,
        product: prod
      });
    }

    return res.status(405).json({ success: false, message: 'Method Not Allowed' });

  } catch (err) {
    console.error('ERP Products API Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error processing product request: ' + err.message
    });
  }
};
