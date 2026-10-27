// Vercel Serverless Function: Secure ERP Staff & Admin Authentication
// Exide Battery Wholesale & AET Official Partner
const db = require('../../db/client.js');
const { signJwt } = require('./token.js');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed. Use POST.' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) { body = {}; }
    }
    body = body || {};

    const { username, password } = body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username/Email and Password are required'
      });
    }

    const cleanUser = String(username).trim();
    const cleanPass = String(password).trim();

    // Look up staff user in authoritative database
    const user = db.findProfileByIdentifier(cleanUser);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. Staff account not found.'
      });
    }

    if (user.isActive === false || user.active === false) {
      return res.status(403).json({
        success: false,
        message: 'This staff account has been deactivated. Please contact your SuperAdmin.'
      });
    }

    const normalizedRole = db.normalizeRole(user.role);
    const validStaffRoles = ['super_admin', 'inventory_manager', 'sales_staff', 'accountant', 'delivery_rider', 'viewer'];

    if (!validStaffRoles.includes(normalizedRole)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Account does not possess staff or administrative privileges.'
      });
    }

    // Verify salted cryptographic hash
    const isMatch = db.verifyPassword(cleanPass, user.passwordHash, user.passwordSalt);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. Password verification failed.'
      });
    }

    // Get permissions from role matrix
    const permissions = db.ROLE_PERMISSIONS[normalizedRole] || ['records_read'];

    // Generate JWT token with role and permissions
    const token = signJwt({
      userId: user.id,
      username: user.email || user.phone,
      email: user.email,
      fullName: user.fullName,
      role: normalizedRole,
      permissions: permissions
    }, true, 24 * 60 * 60 * 1000); // 24 hours valid

    // Log login audit event
    db.logAuditEvent(
      user.id,
      'STAFF_LOGIN',
      'profiles',
      user.id,
      null,
      { role: normalizedRole },
      req.headers['x-forwarded-for'] || req.socket?.remoteAddress || ''
    );

    return res.status(200).json({
      success: true,
      message: `Welcome back, ${user.fullName}!`,
      token: token,
      admin: {
        id: user.id,
        username: user.email || user.phone,
        email: user.email,
        name: user.fullName,
        role: normalizedRole,
        permissions: permissions
      }
    });
  } catch (err) {
    console.error('ERP Staff Login Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server authentication error: ' + err.message
    });
  }
};
