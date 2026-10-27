// Vercel Serverless Function: Scrap Battery Buyback & Trade-In Yard Management
// Exide Battery Wholesale & AET Official Partner
const db = require('../../db/client.js');
const { verifyJwt, extractToken } = require('../auth/token.js');

const SCRAP_RATE_DEFAULT = 35.00; // NPR 35.00 per Ampere-hour (Ah)

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
      message: 'Authentication required. Access to battery exchanges is restricted.'
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

  const canManageExchanges = db.hasPermission(callerRole, 'battery_exchange_create') || db.hasPermission(callerRole, 'battery_exchange_manage') || db.hasPermission(callerRole, 'sales_write') || callerRole === 'super_admin';
  const query = req.query || {};

  try {
    // ------------------------------------------------------------------------
    // GET: Query Scrap Battery Exchanges & Recycling Yard
    // ------------------------------------------------------------------------
    if (req.method === 'GET') {
      const { id, number, status, search } = query;
      const exchanges = db.getExchanges();

      if (id || number) {
        const target = id || number;
        const found = db.findExchangeById(target);
        if (!found) {
          return res.status(404).json({ success: false, message: 'Exchange record not found.' });
        }
        return res.status(200).json({ success: true, exchange: found });
      }

      let filtered = [...exchanges];

      if (status && status !== 'all') {
        filtered = filtered.filter(e => e.dispositionStatus && e.dispositionStatus.toUpperCase() === status.toUpperCase());
      }

      if (search) {
        const q = search.trim().toLowerCase();
        filtered = filtered.filter(e =>
          (e.exchangeNumber && e.exchangeNumber.toLowerCase().includes(q)) ||
          (e.customerName && e.customerName.toLowerCase().includes(q)) ||
          (e.customerPhone && e.customerPhone.includes(q)) ||
          (e.oldBrand && e.oldBrand.toLowerCase().includes(q))
        );
      }

      // Compute Scrap Yard Aggregate KPIs
      let totalAhVolume = 0;
      let totalRebateDisbursed = 0;
      let holdingYardCount = 0;

      filtered.forEach(e => {
        const ah = parseFloat(e.capacityAh || 0);
        const rebate = parseFloat(e.rebateAmount || 0);
        totalAhVolume += ah;
        totalRebateDisbursed += rebate;
        if (e.dispositionStatus === 'HOLDING_YARD') holdingYardCount++;
      });

      return res.status(200).json({
        success: true,
        count: filtered.length,
        summary: {
          totalBatteries: filtered.length,
          holdingYardCount,
          totalAhVolume,
          totalRebateDisbursedNPR: totalRebateDisbursed,
          scrapRatePerAh: SCRAP_RATE_DEFAULT,
          currency: 'NPR'
        },
        exchanges: filtered
      });
    }

    // ------------------------------------------------------------------------
    // POST: Record Standalone Scrap Battery Buyback / Direct Trade-In
    // ------------------------------------------------------------------------
    if (req.method === 'POST') {
      if (!canManageExchanges) {
        return res.status(403).json({
          success: false,
          message: 'Permission denied. Account lacks trade-in management privileges.'
        });
      }

      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch(e) { body = {}; }
      }
      body = body || {};

      const { customerName, customerPhone, oldBrand, batteryType, capacityAh, scrapRate, physicalCondition, notes, paymentMode } = body;

      if (!customerName || !customerPhone || !capacityAh) {
        return res.status(400).json({
          success: false,
          message: 'Customer Name, Contact Phone, and Battery Capacity (Ah) are required.'
        });
      }

      const ah = parseFloat(capacityAh);
      if (isNaN(ah) || ah <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Capacity (Ah) must be a positive number.'
        });
      }

      const rate = parseFloat(scrapRate || SCRAP_RATE_DEFAULT);
      const rebateAmount = Math.round(ah * rate);
      const exchangeNumber = db.generateExchangeNumber();
      const cleanPhone = String(customerPhone).replace(/\D/g, '').slice(-10);

      const record = {
        id: `exc_${exchangeNumber.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${Date.now().toString(36).slice(-4)}`,
        exchangeNumber,
        customerName: String(customerName).trim(),
        customerPhone: cleanPhone,
        oldBrand: oldBrand ? String(oldBrand).trim() : 'Generic Lead-Acid',
        batteryType: batteryType || 'Inverter Tubular',
        capacityAh: ah,
        scrapRatePerAh: rate,
        rebateAmount,
        physicalCondition: physicalCondition || 'INTACT',
        paymentMode: paymentMode || 'CASH_DISBURSEMENT',
        dispositionStatus: 'HOLDING_YARD',
        notes: notes ? String(notes).trim() : 'Direct scrap buyback at Bijulibazar depot',
        receivedDate: new Date().toISOString(),
        receivedBy: session.userId,
        createdAt: new Date().toISOString()
      };

      const exchanges = db.getExchanges();
      exchanges.unshift(record);
      db.saveExchanges(exchanges);

      db.logAuditEvent(session.userId, 'CREATE_SCRAP_EXCHANGE', 'exchanges', record.id, null, {
        exchangeNumber,
        customer: customerName,
        capacityAh: ah,
        rebateAmount
      });

      return res.status(201).json({
        success: true,
        message: `Scrap battery registered successfully with ${exchangeNumber}. Total Rebate: NPR ${rebateAmount.toLocaleString()}`,
        exchange: record
      });
    }

    // ------------------------------------------------------------------------
    // PUT: Update Disposition Status (e.g. Sent to Lead Smelter / Recycler)
    // ------------------------------------------------------------------------
    if (req.method === 'PUT') {
      if (!canManageExchanges) {
        return res.status(403).json({ success: false, message: 'Permission denied.' });
      }

      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch(e) { body = {}; }
      }
      body = body || {};

      const { id, exchangeNumber, dispositionStatus, smelterPartner, consignmentRef } = body;
      const target = id || exchangeNumber;

      if (!target) {
        return res.status(400).json({ success: false, message: 'Exchange ID or Exchange Number is required.' });
      }

      const exchanges = db.getExchanges();
      const index = exchanges.findIndex(e => e.id === target || e.exchangeNumber === target);

      if (index === -1) {
        return res.status(404).json({ success: false, message: 'Exchange record not found.' });
      }

      const existing = exchanges[index];
      const prevStatus = existing.dispositionStatus;
      const newStatus = (dispositionStatus || prevStatus).toUpperCase();

      existing.dispositionStatus = newStatus;
      if (smelterPartner) existing.smelterPartner = String(smelterPartner).trim();
      if (consignmentRef) existing.consignmentRef = String(consignmentRef).trim();
      existing.updatedAt = new Date().toISOString();

      exchanges[index] = existing;
      db.saveExchanges(exchanges);

      db.logAuditEvent(session.userId, 'UPDATE_EXCHANGE_DISPOSITION', 'exchanges', existing.id, { previousStatus: prevStatus }, { newStatus });

      return res.status(200).json({
        success: true,
        message: `Exchange ${existing.exchangeNumber} status updated to ${newStatus}.`,
        exchange: existing
      });
    }

    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  } catch (err) {
    console.error('Exchanges API Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error processing scrap exchange: ' + err.message
    });
  }
};
