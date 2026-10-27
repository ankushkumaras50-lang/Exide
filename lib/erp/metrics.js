// Vercel Serverless Function: Authoritative ERP Business Metrics & KPIs
// Exide Battery Wholesale & AET Official Partner
const db = require('../../db/client.js');
const { verifyJwt, extractToken } = require('../auth/token.js');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // 1. Authenticate ERP Staff Session
    const token = extractToken(req);
    const session = verifyJwt(token, true);

    if (!session || !session.userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Access to ERP metrics is restricted.'
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
    const canViewFinancials = db.hasPermission(callerRole, 'reports_financial') || callerRole === 'super_admin' || callerRole === 'accountant';

    // 2. Fetch Authoritative Data
    const products = db.getProducts();
    const orders = db.getOrders();
    const profiles = db.getProfiles();

    // 3. Compute Product & Inventory Metrics
    let totalSKUs = 0;
    let totalUnits = 0;
    let inventoryValuationCost = 0;
    let inventoryValuationRetail = 0;
    let lowStockCount = 0;
    const lowStockAlerts = [];

    products.forEach(p => {
      if (p.is_active !== false && p.isActive !== false) {
        totalSKUs++;
        const stock = parseInt(p.stock, 10) || 0;
        const cost = parseFloat(p.costPrice || p.cost_price || 0);
        const retail = parseFloat(p.price || p.retail_price || 0);
        const minStock = parseInt(p.minStock || p.reorder_threshold || 5, 10);

        totalUnits += stock;
        inventoryValuationCost += (cost * stock);
        inventoryValuationRetail += (retail * stock);

        if (stock <= minStock) {
          lowStockCount++;
          lowStockAlerts.push({
            id: p.id,
            sku: p.sku,
            name: p.name,
            brand: p.brand,
            currentStock: stock,
            threshold: minStock,
            status: stock === 0 ? 'OUT_OF_STOCK' : 'LOW_STOCK'
          });
        }
      }
    });

    // 4. Compute Sales & Revenue Metrics (Server-Calculated)
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const currentYearMonth = now.toISOString().slice(0, 7); // YYYY-MM

    let dailyRevenue = 0;
    let monthlyRevenue = 0;
    let totalRevenue = 0;
    let totalCogs = 0;
    let pendingOrdersCount = 0;
    let confirmedOrdersCount = 0;
    let deliveredOrdersCount = 0;
    let totalReceivables = 0;

    orders.forEach(o => {
      const orderDateStr = (o.date || o.createdAt || '').slice(0, 10);
      const grandTotal = parseFloat(o.pricing?.grandTotal || o.calculations?.grandTotal || 0);
      const isConfirmed = ['Confirmed', 'Processing', 'Dispatched', 'Delivered', 'confirmed', 'processing', 'out_for_delivery', 'delivered'].includes(o.status || o.orderStatus);

      if (isConfirmed) {
        totalRevenue += grandTotal;

        if (orderDateStr === todayStr) {
          dailyRevenue += grandTotal;
        }
        if (orderDateStr.startsWith(currentYearMonth)) {
          monthlyRevenue += grandTotal;
        }

        // Calculate Cost of Goods Sold (COGS) if authorized
        if (Array.isArray(o.items)) {
          o.items.forEach(it => {
            const p = products.find(prod => prod.id === it.id || prod.sku === it.sku);
            const cost = p ? parseFloat(p.costPrice || p.cost_price || 0) : 0;
            const qty = parseInt(it.quantity, 10) || 1;
            totalCogs += (cost * qty);
          });
        }

        if (['Pending Cash Collection', 'unpaid', 'partially_paid'].includes(o.paymentStatus)) {
          totalReceivables += grandTotal;
        }
      }

      const st = String(o.status || o.orderStatus || '').toLowerCase();
      if (st === 'pending' || st === 'draft') pendingOrdersCount++;
      else if (st === 'confirmed' || st === 'processing') confirmedOrdersCount++;
      else if (st === 'delivered') deliveredOrdersCount++;
    });

    const estimatedGrossProfit = Math.max(0, totalRevenue - totalCogs);
    const grossProfitMargin = totalRevenue > 0 ? ((estimatedGrossProfit / totalRevenue) * 100).toFixed(1) : 0;

    // 5. Recent Activity Log (Filtered & Anonymized for Role)
    const auditFile = require('path').join(__dirname, '..', '..', 'data', 'audit_logs.json');
    let recentActivity = [];
    try {
      const fs = require('fs');
      if (fs.existsSync(auditFile)) {
        recentActivity = JSON.parse(fs.readFileSync(auditFile, 'utf8')).slice(0, 15);
      }
    } catch (e) {}

    // Format response conforming to permission rules
    const responseData = {
      success: true,
      role: callerRole,
      timestamp: new Date().toISOString(),
      timezone: 'Asia/Kathmandu',
      currency: 'NPR',
      inventory: {
        totalSKUs,
        totalUnitsInStock: totalUnits,
        lowStockCount,
        lowStockAlerts: lowStockAlerts.slice(0, 10),
        retailValuationNPR: Math.round(inventoryValuationRetail),
        // REDACT COST PRICE IF NOT AUTHORIZED (Sales Staff cannot see purchase valuation)
        costValuationNPR: canViewCosts ? Math.round(inventoryValuationCost) : null
      },
      sales: {
        dailySalesNPR: Math.round(dailyRevenue),
        monthlySalesNPR: Math.round(monthlyRevenue),
        totalSalesNPR: Math.round(totalRevenue),
        pendingOrders: pendingOrdersCount,
        confirmedOrders: confirmedOrdersCount,
        deliveredOrders: deliveredOrdersCount,
        outstandingReceivablesNPR: Math.round(totalReceivables)
      },
      profitability: canViewFinancials ? {
        grossProfitEstimateNPR: Math.round(estimatedGrossProfit),
        grossMarginPercentage: Number(grossProfitMargin),
        costOfGoodsSoldNPR: Math.round(totalCogs)
      } : null,
      recentActivity: recentActivity.map(a => ({
        id: a.id,
        action: a.action,
        entity: a.entityName,
        timestamp: a.timestamp
      }))
    };

    return res.status(200).json(responseData);

  } catch (err) {
    console.error('ERP Metrics Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to compute ERP business metrics: ' + err.message
    });
  }
};
