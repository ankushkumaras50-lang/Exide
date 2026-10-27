// Vercel Serverless Function: Transactional Stock Ledger & Movement Management
// Exide Battery Wholesale & AET Official Partner
const db = require('../../db/client.js');
const { verifyJwt, extractToken } = require('../auth/token.js');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // 1. Authenticate ERP Staff Session
  const token = extractToken(req);
  const session = verifyJwt(token, true);

  if (!session || !session.userId) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Access to stock ledger is restricted.'
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

  const canWriteInventory = db.hasPermission(callerRole, 'inventory_write') || callerRole === 'super_admin';
  const query = req.query || {};

  try {
    // ------------------------------------------------------------------------
    // GET: Query Stock Balances or Movement Ledger
    // ------------------------------------------------------------------------
    if (req.method === 'GET') {
      const view = query.view || 'balances';

      if (view === 'ledger' || view === 'movements') {
        const auditFile = require('path').join(__dirname, '..', '..', 'data', 'audit_logs.json');
        let movements = [];
        try {
          const fs = require('fs');
          if (fs.existsSync(auditFile)) {
            const logs = JSON.parse(fs.readFileSync(auditFile, 'utf8'));
            movements = logs.filter(l => l.action.includes('STOCK') || l.entityName === 'stock_movement' || l.action === 'OPENING_BALANCE' || l.action === 'RESTOCK');
          }
        } catch(e) {}

        const limit = Math.min(200, parseInt(query.limit, 10) || 50);
        return res.status(200).json({
          success: true,
          count: movements.length,
          movements: movements.slice(0, limit)
        });
      }

      // Default: Stock Balances
      const products = db.getProducts();
      const balances = products.map(p => {
        const onHand = parseInt(p.stock, 10) || 0;
        const reserved = parseInt(p.reservedStock, 10) || 0;
        const available = Math.max(0, onHand - reserved);
        const threshold = parseInt(p.minStock, 10) || 5;

        let status = 'IN_STOCK';
        if (onHand === 0) status = 'OUT_OF_STOCK';
        else if (available <= threshold) status = 'LOW_STOCK';

        return {
          productId: p.id,
          sku: p.sku,
          name: p.name,
          brand: p.brand,
          capacity: p.capacity,
          warehouse: 'Bijulibazar Central (KTM-01)',
          stockOnHand: onHand,
          stockReserved: reserved,
          availableStock: available,
          reorderThreshold: threshold,
          status: status,
          lastUpdated: p.updatedAt || p.createdAt || new Date().toISOString()
        };
      });

      return res.status(200).json({
        success: true,
        count: balances.length,
        balances
      });
    }

    // ------------------------------------------------------------------------
    // POST: Execute Atomic Stock Movement / Adjustment
    // ------------------------------------------------------------------------
    if (req.method === 'POST') {
      if (!canWriteInventory) {
        return res.status(403).json({
          success: false,
          message: 'Permission denied. Only Inventory Managers and SuperAdmins can adjust stock.'
        });
      }

      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch(e) { body = {}; }
      }
      body = body || {};

      const { productId, sku, adjustmentType, quantity, reason, referenceNumber, warehouseId } = body;
      const targetId = productId || sku;

      if (!targetId || !quantity) {
        return res.status(400).json({
          success: false,
          message: 'Product ID/SKU and Quantity are required.'
        });
      }

      const qty = parseInt(quantity, 10);
      if (isNaN(qty) || qty === 0) {
        return res.status(400).json({ success: false, message: 'Quantity must be a non-zero integer.' });
      }

      const type = String(adjustmentType || 'AUDIT_ADJUSTMENT').toUpperCase();
      let signedQty = qty;

      if (['DEDUCT', 'DAMAGE_WRITE_OFF', 'AUDIT_DEDUCT', 'RETURN_SUPPLIER'].includes(type)) {
        signedQty = -Math.abs(qty);
      } else if (['RECEIVE', 'RESTOCK', 'AUDIT_ADD', 'PURCHASE_RECEIPT'].includes(type)) {
        signedQty = Math.abs(qty);
      }

      const movementType = signedQty > 0 ? 'AUDIT_ADJUSTMENT_ADD' : 'AUDIT_ADJUSTMENT_DEDUCT';
      const warehouse = warehouseId || 'wh-ktm-central';

      // Atomic Execution via Database Ledger Client
      try {
        const movementResult = db.executeStockMovement(
          targetId,
          warehouse,
          movementType,
          signedQty,
          'MANUAL_AUDIT_ADJUSTMENT',
          referenceNumber || ('REF-' + Date.now().toString(36).toUpperCase()),
          reason || 'Authorized stock count adjustment',
          session.userId
        );

        return res.status(200).json({
          success: true,
          message: `Stock successfully adjusted for ${movementResult.sku}. New Stock on Hand: ${movementResult.newStock} units.`,
          movement: movementResult
        });
      } catch (stockErr) {
        return res.status(400).json({
          success: false,
          message: stockErr.message
        });
      }
    }

    return res.status(405).json({ success: false, message: 'Method Not Allowed' });

  } catch (err) {
    console.error('Inventory API Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error processing stock operation: ' + err.message
    });
  }
};
