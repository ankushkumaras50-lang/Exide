// Vercel Serverless Function: Professional E-Commerce Order Management Module
// Exide Battery Wholesale & AET Official Partner (Flipkart / Amazon Seller Hub Style)
const db = require('../../db/client.js');
const { verifyJwt, extractToken } = require('../auth/token.js');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // ------------------------------------------------------------------------
  // 1. Authenticate Staff Session (with Resilient Local / Fallback Support)
  // ------------------------------------------------------------------------
  const token = extractToken(req);
  let session = verifyJwt(token, true);

  // Fallback: decode mock JWT or client admin token if present
  if (!session && token && token.startsWith('mock_jwt_')) {
    try {
      const b64 = token.split('_')[2];
      session = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
    } catch(e) {
      session = null;
    }
  }

  // POST: Allow storefront checkout order ingestion directly without strict staff barrier
  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) { body = {}; }
    }
    body = body || {};

    const incomingOrders = Array.isArray(body.orders) ? body.orders : (body.order ? [body.order] : (body.orderId || body.id ? [body] : []));
    if (incomingOrders.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid order records provided to ingest.' });
    }

    const existingOrders = db.getOrders();
    let addedCount = 0;
    let updatedCount = 0;

    for (const inc of incomingOrders) {
      const orderIdVal = inc.orderId || inc.id || ('EXD-' + Math.floor(100000 + Math.random() * 900000));
      const idx = existingOrders.findIndex(o => o.orderId === orderIdVal || o.id === orderIdVal || (inc.invoiceNumber && o.invoiceNumber === inc.invoiceNumber));

      if (idx !== -1) {
        // Merge without losing existing customer or item details
        existingOrders[idx] = {
          ...existingOrders[idx],
          ...inc,
          orderId: orderIdVal,
          id: orderIdVal,
          updatedAt: new Date().toISOString()
        };
        updatedCount++;
      } else {
        // Add new order record
        const newOrder = {
          ...inc,
          orderId: orderIdVal,
          id: orderIdVal,
          invoiceNumber: inc.invoiceNumber || db.generateInvoiceNumber(),
          date: inc.date || new Date().toISOString(),
          status: inc.status || inc.orderStatus || 'CONFIRMED',
          orderStatus: inc.orderStatus || inc.status || 'CONFIRMED',
          paymentStatus: inc.paymentStatus || (String(inc.paymentMethod || '').toUpperCase().includes('COD') ? 'PENDING' : 'PAID'),
          createdAt: inc.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        existingOrders.unshift(newOrder);
        addedCount++;
      }
    }

    db.saveOrders(existingOrders);

    return res.status(200).json({
      success: true,
      message: `Successfully synced ${incomingOrders.length} order(s): ${addedCount} added, ${updatedCount} updated.`,
      totalOrders: existingOrders.length
    });
  }

  if (!session || !session.userId) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Access to ERP order management is restricted.'
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

  const canManageOrders = db.hasPermission(callerRole, 'sales_write') ||
    ['super_admin', 'inventory_manager', 'sales_staff', 'delivery_rider'].includes(callerRole);

  const query = req.query || {};

  try {
    // ------------------------------------------------------------------------
    // GET: Query Orders with Metrics, Status Filters, & Search
    // ------------------------------------------------------------------------
    if (req.method === 'GET') {
      const { id, orderId, invoice, status, paymentMethod, dateRange, rider, search } = query;
      const allOrders = db.getOrders();

      // Normalize orders for consistent schema
      const normalizedOrders = allOrders.map(o => {
        const orderIdVal = o.orderId || o.id || 'EXD-000000';
        const st = String(o.status || o.orderStatus || 'CONFIRMED').toUpperCase();
        const payStatus = String(o.paymentStatus || (o.paymentMethod === 'cod' || o.paymentMethod === 'CASH_ON_DELIVERY' ? 'PENDING' : 'PAID')).toUpperCase();
        const total = parseFloat(o.pricing?.grandTotal || o.calculations?.grandTotal || o.grandTotal || 0);

        return {
          ...o,
          orderId: orderIdVal,
          id: orderIdVal,
          status: st,
          orderStatus: st,
          paymentStatus: payStatus,
          grandTotal: total
        };
      });

      // Single order lookup
      const targetSingle = id || orderId || invoice;
      if (targetSingle) {
        const found = normalizedOrders.find(o =>
          o.orderId === targetSingle ||
          o.id === targetSingle ||
          o.invoiceNumber === targetSingle
        );
        if (!found) {
          return res.status(404).json({ success: false, message: `Order #${targetSingle} not found.` });
        }
        return res.status(200).json({ success: true, order: found });
      }

      // Compute Global Summary Metrics
      const summary = {
        totalOrders: normalizedOrders.length,
        pending: 0,
        processing: 0,
        shipped: 0,
        delivered: 0,
        cancelled: 0,
        totalRevenue: 0,
        pendingValue: 0
      };

      normalizedOrders.forEach(o => {
        const st = o.status;
        const amt = o.grandTotal || 0;

        if (st === 'PENDING' || st === 'CREATED' || st === 'SUBMITTED') {
          summary.pending++;
          summary.pendingValue += amt;
        } else if (st === 'PROCESSING' || st === 'CONFIRMED' || st === 'ACCEPTED') {
          summary.processing++;
          summary.totalRevenue += amt;
        } else if (st === 'SHIPPED' || st === 'OUT_FOR_DELIVERY' || st === 'IN_TRANSIT' || st === 'DISPATCHED') {
          summary.shipped++;
          summary.totalRevenue += amt;
        } else if (st === 'DELIVERED' || st === 'COMPLETED') {
          summary.delivered++;
          summary.totalRevenue += amt;
        } else if (st === 'CANCELLED' || st === 'REJECTED' || st === 'RETURNED') {
          summary.cancelled++;
        } else {
          summary.processing++;
          summary.totalRevenue += amt;
        }
      });

      // Filter by Status Tab
      let filtered = [...normalizedOrders];

      if (status && status !== 'all') {
        const filterStatus = status.toUpperCase();
        if (filterStatus === 'PENDING') {
          filtered = filtered.filter(o => ['PENDING', 'CREATED', 'SUBMITTED'].includes(o.status));
        } else if (filterStatus === 'PROCESSING' || filterStatus === 'CONFIRMED') {
          filtered = filtered.filter(o => ['PROCESSING', 'CONFIRMED', 'ACCEPTED'].includes(o.status));
        } else if (filterStatus === 'SHIPPED') {
          filtered = filtered.filter(o => ['SHIPPED', 'OUT_FOR_DELIVERY', 'IN_TRANSIT', 'DISPATCHED'].includes(o.status));
        } else if (filterStatus === 'DELIVERED') {
          filtered = filtered.filter(o => ['DELIVERED', 'COMPLETED'].includes(o.status));
        } else if (filterStatus === 'CANCELLED') {
          filtered = filtered.filter(o => ['CANCELLED', 'REJECTED', 'RETURNED'].includes(o.status));
        } else {
          filtered = filtered.filter(o => o.status === filterStatus);
        }
      }

      // Filter by Payment Method
      if (paymentMethod && paymentMethod !== 'all') {
        const pmLower = paymentMethod.toLowerCase();
        filtered = filtered.filter(o => {
          const m = String(o.paymentMethod || '').toLowerCase();
          return m.includes(pmLower);
        });
      }

      // Filter by Assigned Rider
      if (rider && rider !== 'all') {
        const rLower = rider.toLowerCase();
        filtered = filtered.filter(o => {
          const assigned = String(o.assignedRider || o.customer?.assignedRider || '').toLowerCase();
          return assigned.includes(rLower);
        });
      }

      // Filter by Date Range
      if (dateRange && dateRange !== 'all') {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        filtered = filtered.filter(o => {
          const orderDate = new Date(o.date || o.createdAt || 0);
          if (dateRange === 'today') {
            return orderDate >= startOfToday;
          } else if (dateRange === 'yesterday') {
            const yesterday = new Date(startOfToday.getTime() - 86400000);
            return orderDate >= yesterday && orderDate < startOfToday;
          } else if (dateRange === 'week' || dateRange === 'last7days') {
            const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
            return orderDate >= sevenDaysAgo;
          } else if (dateRange === 'month' || dateRange === 'last30days') {
            const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
            return orderDate >= thirtyDaysAgo;
          }
          return true;
        });
      }

      // Filter by Search Query
      if (search && search.trim()) {
        const q = search.trim().toLowerCase();
        const qDigits = q.replace(/\D/g, '');
        filtered = filtered.filter(o => {
          const oId = String(o.orderId || '').toLowerCase();
          const inv = String(o.invoiceNumber || '').toLowerCase();
          const cName = String(o.customer?.fullName || '').toLowerCase();
          const cPhone = String(o.customer?.phone || '').replace(/\D/g, '');
          const cCity = String(o.customer?.city || o.customer?.district || '').toLowerCase();
          const cAddress = String(o.customer?.deliveryAddress || o.customer?.address || '').toLowerCase();
          const cPan = String(o.customer?.pan || '').toLowerCase();
          const itemsText = Array.isArray(o.items) ? o.items.map(i => `${i.name || ''} ${i.sku || ''}`).join(' ').toLowerCase() : '';

          return oId.includes(q) ||
            inv.includes(q) ||
            cName.includes(q) ||
            (qDigits.length > 0 && cPhone.includes(qDigits)) ||
            cCity.includes(q) ||
            cAddress.includes(q) ||
            cPan.includes(q) ||
            itemsText.includes(q);
        });
      }

      // Sort newest first
      filtered.sort((a, b) => {
        const dateA = new Date(a.date || a.createdAt || 0).getTime();
        const dateB = new Date(b.date || b.createdAt || 0).getTime();
        return dateB - dateA;
      });

      return res.status(200).json({
        success: true,
        count: filtered.length,
        totalOrders: allOrders.length,
        summary,
        orders: filtered
      });
    }

    // ------------------------------------------------------------------------
    // PUT / PATCH: Update Order Status, Assign Rider, or Cancel with Restock
    // ------------------------------------------------------------------------
    if (req.method === 'PUT' || req.method === 'PATCH') {
      if (!canManageOrders) {
        return res.status(403).json({
          success: false,
          message: 'Permission denied. Account lacks order management privileges.'
        });
      }

      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (e) { body = {}; }
      }
      body = body || {};

      const { id, orderId, invoiceNumber, status, orderStatus, assignedRider, paymentStatus, trackingNote, dispatchVehicle, deliveryNotes } = body;
      const target = id || orderId || invoiceNumber;

      if (!target) {
        return res.status(400).json({
          success: false,
          message: 'Order ID or Invoice Number is required to update order.'
        });
      }

      const orders = db.getOrders();
      const index = orders.findIndex(o => o.orderId === target || o.id === target || o.invoiceNumber === target);

      if (index === -1) {
        return res.status(404).json({
          success: false,
          message: `Order #${target} not found.`
        });
      }

      const existing = orders[index];
      const prevStatus = String(existing.status || existing.orderStatus || 'CONFIRMED').toUpperCase();
      const newStatus = status ? String(status).toUpperCase() : (orderStatus ? String(orderStatus).toUpperCase() : prevStatus);

      // If cancelling an order that decremented stock, restore stock back to warehouse
      if (newStatus === 'CANCELLED' && prevStatus !== 'CANCELLED' && existing.orderType !== 'QUOTATION' && Array.isArray(existing.items)) {
        for (const item of existing.items) {
          try {
            db.executeStockMovement(
              item.productId || item.id,
              'wh-ktm-central',
              'SALES_RETURN',
              item.quantity || 1,
              'SALES_ORDER_CANCEL',
              existing.invoiceNumber || existing.orderId,
              `Restock cancelled web order ${existing.orderId}`,
              session.userId
            );
          } catch (e) {
            console.error('Error restoring stock for cancelled order:', e.message);
          }
        }
      }

      // Update Order Fields
      existing.status = newStatus;
      existing.orderStatus = newStatus;

      if (paymentStatus) {
        existing.paymentStatus = String(paymentStatus).toUpperCase();
      }

      if (assignedRider !== undefined) {
        existing.assignedRider = assignedRider;
        if (!existing.customer) existing.customer = {};
        existing.customer.assignedRider = typeof assignedRider === 'object' && assignedRider ? assignedRider.name : assignedRider;
      }

      if (dispatchVehicle) {
        existing.dispatchVehicle = dispatchVehicle;
      }

      if (deliveryNotes) {
        existing.deliveryNotes = deliveryNotes;
      }

      // Add to tracking history timeline
      if (!Array.isArray(existing.trackingHistory)) {
        existing.trackingHistory = [];
      }

      const now = new Date();
      existing.trackingHistory.push({
        step: newStatus,
        time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        date: now.toISOString(),
        note: trackingNote || `Status updated to ${newStatus} by staff ${session.userId}`,
        updatedBy: session.userId
      });

      existing.updatedAt = now.toISOString();
      orders[index] = existing;
      db.saveOrders(orders);

      db.logAuditEvent(
        session.userId,
        'UPDATE_ORDER_STATUS',
        'orders',
        existing.orderId || target,
        { previousStatus: prevStatus },
        { newStatus, paymentStatus: existing.paymentStatus, assignedRider: existing.assignedRider }
      );

      return res.status(200).json({
        success: true,
        message: `Order #${existing.orderId || target} successfully updated to ${newStatus}.`,
        order: existing
      });
    }

    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  } catch (err) {
    console.error('ERP Orders API Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error processing order management: ' + err.message
    });
  }
};

