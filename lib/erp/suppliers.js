// Vercel Serverless Function: Authorized Battery Suppliers Directory
// Exide Battery Wholesale & AET Official Partner
const db = require('../../db/client.js');
const { verifyJwt, extractToken } = require('../auth/token.js');

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
      message: 'Authentication required. Access to supplier directory is restricted.'
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

  const canManageSuppliers = db.hasPermission(callerRole, 'purchases_write') || callerRole === 'super_admin' || callerRole === 'inventory_manager';
  const query = req.query || {};

  try {
    // ------------------------------------------------------------------------
    // GET: Query Suppliers Directory
    // ------------------------------------------------------------------------
    if (req.method === 'GET') {
      const { id, search, status } = query;
      const suppliers = db.getSuppliers();

      if (id) {
        const found = db.findSupplierById(id);
        if (!found) {
          return res.status(404).json({ success: false, message: 'Supplier not found' });
        }
        return res.status(200).json({ success: true, supplier: found });
      }

      let filtered = [...suppliers];

      if (status && status !== 'all') {
        filtered = filtered.filter(s => s.status && s.status.toLowerCase() === status.toLowerCase());
      }

      if (search) {
        const q = search.trim().toLowerCase();
        filtered = filtered.filter(s =>
          (s.name && s.name.toLowerCase().includes(q)) ||
          (s.contactPerson && s.contactPerson.toLowerCase().includes(q)) ||
          (s.pan && s.pan.includes(q)) ||
          (s.city && s.city.toLowerCase().includes(q)) ||
          (s.phone && s.phone.includes(q))
        );
      }

      return res.status(200).json({
        success: true,
        count: filtered.length,
        totalSuppliers: suppliers.length,
        suppliers: filtered
      });
    }

    // ------------------------------------------------------------------------
    // POST: Create New Authorized Supplier
    // ------------------------------------------------------------------------
    if (req.method === 'POST') {
      if (!canManageSuppliers) {
        return res.status(403).json({
          success: false,
          message: 'Permission denied. Only Inventory Managers and SuperAdmin can manage suppliers.'
        });
      }

      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch(e) { body = {}; }
      }
      body = body || {};

      const { name, contactPerson, email, phone, pan, address, city, country, paymentTerms, categories } = body;

      if (!name || !phone) {
        return res.status(400).json({
          success: false,
          message: 'Supplier Name and Contact Phone are required.'
        });
      }

      const cleanName = String(name).trim();
      const suppliers = db.getSuppliers();

      if (pan && suppliers.some(s => s.pan && s.pan === String(pan).trim())) {
        return res.status(409).json({
          success: false,
          message: `A supplier with PAN "${pan}" already exists in the directory.`
        });
      }

      const slug = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 15);
      const newSupplier = {
        id: `sup_${slug}_${Date.now().toString(36).slice(-4)}`,
        name: cleanName,
        contactPerson: contactPerson ? String(contactPerson).trim() : '',
        email: email ? String(email).trim().toLowerCase() : '',
        phone: String(phone).trim(),
        pan: pan ? String(pan).trim() : '',
        address: address ? String(address).trim() : '',
        city: city ? String(city).trim() : 'Kathmandu',
        country: country ? String(country).trim() : 'Nepal',
        paymentTerms: paymentTerms || 'Net 30',
        categories: Array.isArray(categories) ? categories : ['Battery Manufacturer'],
        status: 'ACTIVE',
        createdAt: new Date().toISOString()
      };

      suppliers.push(newSupplier);
      db.saveSuppliers(suppliers);

      db.logAuditEvent(session.userId, 'CREATE_SUPPLIER', 'suppliers', newSupplier.id, null, { name: cleanName, pan: newSupplier.pan });

      return res.status(201).json({
        success: true,
        message: `Supplier "${cleanName}" added successfully.`,
        supplier: newSupplier
      });
    }

    // ------------------------------------------------------------------------
    // PUT: Update Existing Supplier
    // ------------------------------------------------------------------------
    if (req.method === 'PUT') {
      if (!canManageSuppliers) {
        return res.status(403).json({
          success: false,
          message: 'Permission denied. Only Inventory Managers and SuperAdmin can update suppliers.'
        });
      }

      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch(e) { body = {}; }
      }
      body = body || {};

      const { id } = body;
      if (!id) {
        return res.status(400).json({ success: false, message: 'Supplier ID is required.' });
      }

      const suppliers = db.getSuppliers();
      const index = suppliers.findIndex(s => s.id === id);
      if (index === -1) {
        return res.status(404).json({ success: false, message: 'Supplier not found.' });
      }

      const existing = suppliers[index];
      const updated = {
        ...existing,
        name: body.name ? String(body.name).trim() : existing.name,
        contactPerson: body.contactPerson !== undefined ? String(body.contactPerson).trim() : existing.contactPerson,
        email: body.email !== undefined ? String(body.email).trim().toLowerCase() : existing.email,
        phone: body.phone ? String(body.phone).trim() : existing.phone,
        pan: body.pan !== undefined ? String(body.pan).trim() : existing.pan,
        address: body.address !== undefined ? String(body.address).trim() : existing.address,
        city: body.city !== undefined ? String(body.city).trim() : existing.city,
        paymentTerms: body.paymentTerms || existing.paymentTerms,
        status: body.status || existing.status,
        updatedAt: new Date().toISOString()
      };

      suppliers[index] = updated;
      db.saveSuppliers(suppliers);

      db.logAuditEvent(session.userId, 'UPDATE_SUPPLIER', 'suppliers', id, existing, updated);

      return res.status(200).json({
        success: true,
        message: `Supplier "${updated.name}" updated successfully.`,
        supplier: updated
      });
    }

    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  } catch (err) {
    console.error('Suppliers API Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error processing supplier operation: ' + err.message
    });
  }
};
