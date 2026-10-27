// Vercel Serverless Function: Purchase Orders & Inward Goods Receipt (GRN)
// Exide Battery Wholesale & AET Official Partner
const db = require('../../db/client.js');
const { verifyJwt, extractToken } = require('../auth/token.js');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // 1. Authenticate Staff Session
  const token = extractToken(req);
  const session = verifyJwt(token, true);

  if (!session || !session.userId) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Access to purchase orders is restricted.'
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

  const canManagePurchases = db.hasPermission(callerRole, 'purchases_write') || callerRole === 'super_admin' || callerRole === 'inventory_manager';
  const query = req.query || {};

  try {
    // ------------------------------------------------------------------------
    // GET: Query Purchase Orders & GRNs
    // ------------------------------------------------------------------------
    if (req.method === 'GET') {
      const { id, po, supplierId, status, search } = query;
      const purchases = db.getPurchases();

      if (id || po) {
        const target = id || po;
        const found = db.findPurchaseById(target);
        if (!found) {
          return res.status(404).json({ success: false, message: 'Purchase order not found.' });
        }
        return res.status(200).json({ success: true, purchaseOrder: found });
      }

      let filtered = [...purchases];

      if (supplierId && supplierId !== 'all') {
        filtered = filtered.filter(p => p.supplierId === supplierId);
      }

      if (status && status !== 'all') {
        filtered = filtered.filter(p => p.status && p.status.toUpperCase() === status.toUpperCase());
      }

      if (search) {
        const q = search.trim().toLowerCase();
        filtered = filtered.filter(p =>
          (p.poNumber && p.poNumber.toLowerCase().includes(q)) ||
          (p.supplierName && p.supplierName.toLowerCase().includes(q)) ||
          (p.notes && p.notes.toLowerCase().includes(q))
        );
      }

      return res.status(200).json({
        success: true,
        count: filtered.length,
        totalPurchases: purchases.length,
        purchases: filtered
      });
    }

    // ------------------------------------------------------------------------
    // POST: Create PO or Execute Inward Goods Receipt (GRN)
    // ------------------------------------------------------------------------
    if (req.method === 'POST') {
      if (!canManagePurchases) {
        return res.status(403).json({
          success: false,
          message: 'Permission denied. Only Inventory Managers and SuperAdmin can manage purchase orders and GRN.'
        });
      }

      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch(e) { body = {}; }
      }
      body = body || {};

      const action = (query.action || body.action || 'create').toLowerCase();

      // ----------------------------------------------------------------------
      // SUB-ACTION 1: Inward Goods Receipt (GRN) with Stock Ledger Increment
      // ----------------------------------------------------------------------
      if (action === 'receive' || action === 'grn') {
        const { purchaseId, poNumber, receivedItems, warehouseId, notes, invoiceRef } = body;
        const targetRef = purchaseId || poNumber;

        if (!targetRef) {
          return res.status(400).json({ success: false, message: 'Purchase Order ID or PO Number is required.' });
        }

        const purchases = db.getPurchases();
        const poIndex = purchases.findIndex(p => p.id === targetRef || p.poNumber === targetRef);

        if (poIndex === -1) {
          return res.status(404).json({ success: false, message: `Purchase order ${targetRef} not found.` });
        }

        const po = purchases[poIndex];
        if (po.status === 'COMPLETED') {
          return res.status(400).json({ success: false, message: 'This purchase order has already been fully received.' });
        }
        if (po.status === 'CANCELLED') {
          return res.status(400).json({ success: false, message: 'Cannot receive goods for a cancelled purchase order.' });
        }

        if (!Array.isArray(receivedItems) || receivedItems.length === 0) {
          return res.status(400).json({ success: false, message: 'At least one item must be received.' });
        }

        const warehouse = warehouseId || 'wh-ktm-central';
        const grnNumber = 'GRN-' + Date.now().toString(36).toUpperCase();
        const movementResults = [];

        // Atomically increment stock for each received SKU
        for (const rItem of receivedItems) {
          const targetId = rItem.productId || rItem.sku;
          const qty = parseInt(rItem.quantityReceived || rItem.quantity, 10);

          if (!targetId || isNaN(qty) || qty <= 0) {
            continue;
          }

          // Execute atomic stock movement (PURCHASE_RECEIPT)
          const moveRes = db.executeStockMovement(
            targetId,
            warehouse,
            'PURCHASE_RECEIPT',
            qty,
            'PURCHASE_ORDER',
            po.poNumber,
            `Inward GRN receipt (${grnNumber}) for PO ${po.poNumber}`,
            session.userId
          );

          movementResults.push({
            productId: targetId,
            quantityReceived: qty,
            newStock: moveRes.newStock
          });

          // Update received quantity on the PO line item
          const lineItem = po.items.find(i => i.productId === targetId || i.sku === targetId);
          if (lineItem) {
            lineItem.receivedQty = (lineItem.receivedQty || 0) + qty;
          }

          // Optional: update product costPrice if landed unit cost provided
          if (rItem.unitLandedCost && parseFloat(rItem.unitLandedCost) > 0) {
            const allProducts = db.getProducts();
            const prod = allProducts.find(p => p.id === targetId || p.sku === targetId);
            if (prod) {
              prod.costPrice = parseFloat(rItem.unitLandedCost);
              prod.updatedAt = new Date().toISOString();
              db.saveProducts(allProducts);
            }
          }
        }

        // Determine if PO is now fully received or partially received
        const allReceived = po.items.every(i => (i.receivedQty || 0) >= (i.orderedQty || i.quantity || 0));
        po.status = allReceived ? 'COMPLETED' : 'PARTIALLY_RECEIVED';
        po.updatedAt = new Date().toISOString();

        if (!Array.isArray(po.grns)) po.grns = [];
        po.grns.push({
          grnNumber,
          receivedDate: new Date().toISOString(),
          receivedBy: session.userId,
          warehouse,
          items: movementResults,
          notes: notes || '',
          invoiceRef: invoiceRef || ''
        });

        purchases[poIndex] = po;
        db.savePurchases(purchases);

        db.logAuditEvent(session.userId, 'EXECUTE_GRN', 'purchases', po.id, { previousStatus: po.status }, { grnNumber, movements: movementResults });

        return res.status(200).json({
          success: true,
          message: `GRN ${grnNumber} processed successfully. Stock updated for ${movementResults.length} SKUs.`,
          grnNumber,
          purchaseOrder: po,
          movements: movementResults
        });
      }

      // ----------------------------------------------------------------------
      // SUB-ACTION 2: Create New Purchase Order (PO)
      // ----------------------------------------------------------------------
      const { supplierId, items, expectedDeliveryDate, notes, paymentTerms } = body;

      if (!supplierId) {
        return res.status(400).json({ success: false, message: 'Supplier is required.' });
      }

      const supplier = db.findSupplierById(supplierId);
      if (!supplier) {
        return res.status(404).json({ success: false, message: `Supplier with ID ${supplierId} not found.` });
      }

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, message: 'At least one line item is required for the PO.' });
      }

      const products = db.getProducts();
      let subtotal = 0;
      const verifiedItems = [];

      for (const item of items) {
        const prod = products.find(p => p.id === item.productId || p.sku === item.sku);
        if (!prod) {
          return res.status(400).json({ success: false, message: `Product ${item.sku || item.productId} not found in catalog.` });
        }

        const qty = parseInt(item.quantity || item.orderedQty, 10);
        if (isNaN(qty) || qty <= 0) {
          return res.status(400).json({ success: false, message: `Invalid quantity for ${prod.name}.` });
        }

        const cost = parseFloat(item.unitCost || prod.costPrice || 0);
        const lineTotal = cost * qty;
        subtotal += lineTotal;

        verifiedItems.push({
          productId: prod.id,
          sku: prod.sku,
          name: prod.name,
          brand: prod.brand,
          capacity: prod.capacity || '',
          orderedQty: qty,
          receivedQty: 0,
          unitCost: cost,
          totalCost: lineTotal
        });
      }

      const vatRate = 13.00;
      const vatAmount = Math.round(subtotal * 0.13);
      const grandTotal = subtotal + vatAmount;

      const poNumber = db.generatePoNumber();
      const newPo = {
        id: `po_${poNumber.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${Date.now().toString(36).slice(-4)}`,
        poNumber,
        supplierId: supplier.id,
        supplierName: supplier.name,
        supplierPan: supplier.pan,
        supplierPhone: supplier.phone,
        status: 'ORDERED',
        orderDate: new Date().toISOString(),
        expectedDeliveryDate: expectedDeliveryDate || new Date(Date.now() + 7 * 86400000).toISOString(),
        paymentTerms: paymentTerms || supplier.paymentTerms || 'Net 30',
        items: verifiedItems,
        pricing: {
          subtotal,
          vatRate,
          vatAmount,
          grandTotal,
          currency: 'NPR'
        },
        notes: notes ? String(notes).trim() : 'Official procurement order for Kathmandu depot stock.',
        grns: [],
        createdBy: session.userId,
        createdAt: new Date().toISOString()
      };

      const purchases = db.getPurchases();
      purchases.unshift(newPo);
      db.savePurchases(purchases);

      db.logAuditEvent(session.userId, 'CREATE_PURCHASE_ORDER', 'purchases', newPo.id, null, { poNumber, supplier: supplier.name, grandTotal });

      return res.status(201).json({
        success: true,
        message: `Purchase Order ${poNumber} generated successfully.`,
        purchaseOrder: newPo
      });
    }

    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  } catch (err) {
    console.error('Purchases API Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error processing purchase operation: ' + err.message
    });
  }
};
