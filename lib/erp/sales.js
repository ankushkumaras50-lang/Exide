// Vercel Serverless Function: Sales Orders, Quotations & Nepal IRD 13% Tax Invoicing
// Exide Battery Wholesale & AET Official Partner
const db = require('../../db/client.js');
const { verifyJwt, extractToken } = require('../auth/token.js');

const SELLER_DETAILS = {
  name: 'EXIDE BATTERY WHOLESALE (AET Official Partner)',
  pan: '609823412',
  address: 'Bijulibazar, opposite Sunrise City Home, Kathmandu, Nepal',
  phone: '+977 9705997260',
  email: 'batterymartbtl@gmail.com',
  ward: '10',
  city: 'Kathmandu',
  district: 'Kathmandu'
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // 1. Authenticate Staff Session
  const token = extractToken(req);
  const session = verifyJwt(token, true);

  if (!session || !session.userId) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Access to sales orders and invoicing is restricted.'
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

  const canManageSales = db.hasPermission(callerRole, 'sales_write') || callerRole === 'super_admin' || callerRole === 'sales_staff';
  const query = req.query || {};

  try {
    // ------------------------------------------------------------------------
    // GET: Query Sales Orders & Invoices
    // ------------------------------------------------------------------------
    if (req.method === 'GET') {
      const { id, invoice, status, phone, search } = query;
      const orders = db.getOrders();

      if (id || invoice) {
        const target = id || invoice;
        const found = db.findOrderById(target);
        if (!found) {
          return res.status(404).json({ success: false, message: 'Sales order / invoice not found.' });
        }
        return res.status(200).json({ success: true, order: found });
      }

      let filtered = [...orders];

      if (status && status !== 'all') {
        filtered = filtered.filter(o => o.status && o.status.toUpperCase() === status.toUpperCase());
      }

      if (phone) {
        const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);
        filtered = filtered.filter(o => o.customer && o.customer.phone && o.customer.phone.includes(cleanPhone));
      }

      if (search) {
        const q = search.trim().toLowerCase();
        filtered = filtered.filter(o =>
          (o.orderId && o.orderId.toLowerCase().includes(q)) ||
          (o.invoiceNumber && o.invoiceNumber.toLowerCase().includes(q)) ||
          (o.customer && o.customer.fullName && o.customer.fullName.toLowerCase().includes(q)) ||
          (o.customer && o.customer.phone && o.customer.phone.includes(q)) ||
          (o.customer && o.customer.pan && o.customer.pan.includes(q))
        );
      }

      return res.status(200).json({
        success: true,
        count: filtered.length,
        totalOrders: orders.length,
        orders: filtered
      });
    }

    // ------------------------------------------------------------------------
    // POST: Create Sales Order / Quotation / Tax Invoice
    // ------------------------------------------------------------------------
    if (req.method === 'POST') {
      if (!canManageSales) {
        return res.status(403).json({
          success: false,
          message: 'Permission denied. Account lacks sales order write privileges.'
        });
      }

      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch(e) { body = {}; }
      }
      body = body || {};

      const { customer, items, orderType, paymentMethod, paymentStatus, scrapExchange, notes, couponDiscount } = body;

      if (!customer || !customer.fullName || !customer.phone) {
        return res.status(400).json({
          success: false,
          message: 'Customer Name and Mobile Phone are required.'
        });
      }

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'At least one line item is required for the sales order.'
        });
      }

      const isQuotation = String(orderType || '').toUpperCase() === 'QUOTATION';
      const cleanCustomerPhone = String(customer.phone).replace(/\D/g, '').slice(-10);

      // 1. Verify Products and Stock Availability
      const allProducts = db.getProducts();
      const verifiedItems = [];
      let rawSubtotal = 0;

      for (const item of items) {
        const prod = allProducts.find(p => p.id === item.productId || p.sku === item.sku);
        if (!prod) {
          return res.status(400).json({
            success: false,
            message: `Product "${item.sku || item.productId}" not found in catalog.`
          });
        }

        const qty = parseInt(item.quantity, 10);
        if (isNaN(qty) || qty <= 0) {
          return res.status(400).json({
            success: false,
            message: `Invalid quantity for product ${prod.name}.`
          });
        }

        // If this is a confirmed sale (not quotation), strictly enforce stock on hand
        if (!isQuotation) {
          const onHand = parseInt(prod.stock, 10) || 0;
          if (onHand < qty) {
            return res.status(400).json({
              success: false,
              message: `Insufficient stock for "${prod.name}" (${prod.sku}). Available: ${onHand} units, Requested: ${qty} units.`
            });
          }
        }

        const unitPrice = parseFloat(item.unitPrice || prod.price || 0);
        const lineTotal = unitPrice * qty;
        rawSubtotal += lineTotal;

        verifiedItems.push({
          productId: prod.id,
          id: prod.id,
          sku: prod.sku,
          name: prod.name,
          brand: prod.brand,
          capacity: prod.capacity || '',
          warranty: prod.warranty || '36 Months Official Warranty',
          price: unitPrice,
          unitPrice: unitPrice,
          quantity: qty,
          itemTotal: lineTotal,
          lineTotal: lineTotal,
          image: prod.image || 'assets/logo.png'
        });
      }

      // 2. Compute Battery Trade-In Scrap Rebate (NPR 35 / Ah)
      let scrapExchangeDeduction = 0;
      let scrapRecord = null;

      if (scrapExchange && (scrapExchange.capacityAh || scrapExchange.scrapBatteryAh)) {
        const ah = parseFloat(scrapExchange.capacityAh || scrapExchange.scrapBatteryAh || 0);
        const rate = parseFloat(scrapExchange.scrapRate || 35.00);

        if (ah > 0) {
          scrapExchangeDeduction = Math.round(ah * rate);
          const exchangeNumber = db.generateExchangeNumber();

          scrapRecord = {
            id: `exc_${exchangeNumber.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${Date.now().toString(36).slice(-4)}`,
            exchangeNumber,
            customerName: String(customer.fullName).trim(),
            customerPhone: cleanCustomerPhone,
            oldBrand: scrapExchange.oldBrand || 'Exide / Generic Lead-Acid',
            batteryType: scrapExchange.batteryType || 'Tubular / Inverter Lead Acid',
            capacityAh: ah,
            scrapRatePerAh: rate,
            rebateAmount: scrapExchangeDeduction,
            physicalCondition: scrapExchange.physicalCondition || 'INTACT',
            dispositionStatus: 'HOLDING_YARD',
            receivedDate: new Date().toISOString(),
            receivedBy: session.userId,
            createdAt: new Date().toISOString()
          };

          const exchanges = db.getExchanges();
          exchanges.unshift(scrapRecord);
          db.saveExchanges(exchanges);
        }
      }

      // 3. Official Nepal IRD VAT & Financial Calculations
      const discount = Math.max(0, parseFloat(couponDiscount) || 0);
      const deliveryFee = 0; // Free Kathmandu doorstep delivery
      const netTaxableBase = Math.max(0, rawSubtotal - scrapExchangeDeduction - discount);
      const vatRate = 13.00;
      const vatAmount = Math.round(netTaxableBase * 0.13);
      const grandTotal = netTaxableBase + vatAmount + deliveryFee;

      // 4. Generate Sequential Invoice Number & Order ID
      const invoiceNumber = db.generateInvoiceNumber();
      const orderId = 'EXD-' + Math.floor(100000 + Math.random() * 900000);
      const trackingNumber = 'NP-EXD-' + Math.floor(10000 + Math.random() * 90000);

      // 5. Decrement Stock from Ledger atomically (if confirmed sale)
      const movements = [];
      if (!isQuotation) {
        for (const vItem of verifiedItems) {
          const moveRes = db.executeStockMovement(
            vItem.productId,
            'wh-ktm-central',
            'SALES_DISPATCH',
            -vItem.quantity,
            'SALES_INVOICE',
            invoiceNumber,
            `Customer sale order dispatch (${orderId}) to ${customer.fullName}`,
            session.userId
          );
          movements.push(moveRes);
        }
      }

      // 6. Assemble Complete Order & Tax Invoice Object
      const now = new Date();
      const orderDateFormatted = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ', ' +
                                 now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

      const newOrder = {
        orderId,
        id: orderId,
        invoiceNumber,
        trackingNumber,
        orderType: isQuotation ? 'QUOTATION' : (orderType || 'SALE'),
        date: now.toISOString(),
        orderDate: orderDateFormatted,
        orderDateFormatted,
        seller: SELLER_DETAILS,
        customer: {
          fullName: String(customer.fullName).trim(),
          phone: cleanCustomerPhone,
          email: customer.email ? String(customer.email).trim().toLowerCase() : '',
          pan: customer.pan ? String(customer.pan).trim() : '',
          district: customer.district || 'Kathmandu',
          city: customer.city || 'Kathmandu',
          ward: customer.ward || '10',
          address: customer.address || customer.deliveryAddress || 'Bijulibazar, Kathmandu',
          deliveryAddress: customer.deliveryAddress || customer.address || 'Bijulibazar, Kathmandu',
          assignedRider: 'Standard Kathmandu Express'
        },
        items: verifiedItems,
        pricing: {
          rawSubtotal,
          scrapExchangeDeduction,
          couponDiscount: discount,
          deliveryFee,
          taxableAmount: netTaxableBase,
          vatPercentage: vatRate,
          vatAmount,
          grandTotal,
          currency: 'NPR'
        },
        calculations: {
          rawSubtotal,
          scrapExchangeDeduction,
          scrapBatteryAh: scrapRecord ? scrapRecord.capacityAh : 0,
          scrapRate: scrapRecord ? scrapRecord.scrapRatePerAh : 35,
          finalDelivery: deliveryFee,
          taxableAmount: netTaxableBase,
          vatAmount,
          grandTotal
        },
        scrapExchangeRecord: scrapRecord ? {
          exchangeId: scrapRecord.id,
          exchangeNumber: scrapRecord.exchangeNumber,
          capacityAh: scrapRecord.capacityAh,
          rebateAmount: scrapRecord.rebateAmount
        } : null,
        status: isQuotation ? 'QUOTATION' : 'CONFIRMED',
        paymentMethod: paymentMethod || 'CASH_ON_DELIVERY',
        paymentStatus: paymentStatus || (paymentMethod === 'CASH_ON_DELIVERY' ? 'PENDING' : 'PAID'),
        notes: notes ? String(notes).trim() : '',
        stockMovements: movements,
        issuedBy: session.userId,
        createdAt: now.toISOString()
      };

      const orders = db.getOrders();
      orders.unshift(newOrder);
      db.saveOrders(orders);

      db.logAuditEvent(session.userId, isQuotation ? 'CREATE_QUOTATION' : 'CREATE_SALES_INVOICE', 'orders', orderId, null, {
        invoiceNumber,
        customer: customer.fullName,
        grandTotal,
        itemsCount: verifiedItems.length
      });

      return res.status(201).json({
        success: true,
        message: isQuotation ? `Quotation ${orderId} generated successfully.` : `Tax Invoice ${invoiceNumber} issued successfully.`,
        orderId,
        invoiceNumber,
        order: newOrder
      });
    }

    // ------------------------------------------------------------------------
    // PUT: Update Order Status / Process Delivery or Cancellation
    // ------------------------------------------------------------------------
    if (req.method === 'PUT') {
      if (!canManageSales) {
        return res.status(403).json({ success: false, message: 'Permission denied.' });
      }

      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch(e) { body = {}; }
      }
      body = body || {};

      const { id, orderId, invoiceNumber, status, paymentStatus } = body;
      const target = id || orderId || invoiceNumber;

      if (!target) {
        return res.status(400).json({ success: false, message: 'Order ID or Invoice Number is required.' });
      }

      const orders = db.getOrders();
      const index = orders.findIndex(o => o.orderId === target || o.id === target || o.invoiceNumber === target);

      if (index === -1) {
        return res.status(404).json({ success: false, message: 'Order not found.' });
      }

      const existing = orders[index];
      const prevStatus = existing.status;
      const newStatus = status ? status.toUpperCase() : prevStatus;

      // If cancelling a previously confirmed sale, reverse stock deductions
      if (newStatus === 'CANCELLED' && prevStatus !== 'CANCELLED' && existing.orderType !== 'QUOTATION') {
        for (const item of existing.items) {
          try {
            db.executeStockMovement(
              item.productId || item.id,
              'wh-ktm-central',
              'SALES_RETURN',
              item.quantity,
              'SALES_INVOICE_CANCEL',
              existing.invoiceNumber || existing.orderId,
              `Restock cancelled sales order ${existing.orderId}`,
              session.userId
            );
          } catch(e) {
            console.error('Error restoring stock for cancelled order:', e.message);
          }
        }
      }

      existing.status = newStatus;
      if (paymentStatus) existing.paymentStatus = paymentStatus.toUpperCase();
      existing.updatedAt = new Date().toISOString();

      orders[index] = existing;
      db.saveOrders(orders);

      db.logAuditEvent(session.userId, 'UPDATE_ORDER_STATUS', 'orders', existing.orderId, { previousStatus: prevStatus }, { newStatus, paymentStatus: existing.paymentStatus });

      return res.status(200).json({
        success: true,
        message: `Order ${existing.orderId} status updated to ${newStatus}.`,
        order: existing
      });
    }

    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  } catch (err) {
    console.error('Sales API Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error processing sales operation: ' + err.message
    });
  }
};
