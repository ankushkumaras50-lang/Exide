// Vercel Serverless Function: Admin & Staff Session Verification
// Exide Battery Wholesale & AET Official Partner
const db = require('../../db/client.js');
const { verifyJwt, extractToken } = require('./token.js');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({
        success: false,
        authenticated: false,
        message: 'No admin session token provided'
      });
    }

    const payload = verifyJwt(token, true);
    if (!payload || !payload.userId) {
      return res.status(401).json({
        success: false,
        authenticated: false,
        message: 'Invalid or expired admin session'
      });
    }

    const normalizedRole = db.normalizeRole(payload.role);
    const validStaffRoles = ['super_admin', 'inventory_manager', 'sales_staff', 'accountant', 'delivery_rider', 'viewer'];

    if (!validStaffRoles.includes(normalizedRole)) {
      return res.status(403).json({
        success: false,
        authenticated: false,
        message: 'Insufficient privileges for ERP administration'
      });
    }

    // Verify user is still active in database
    const profile = db.findProfileById(payload.userId);
    if (!profile || profile.isActive === false || profile.active === false) {
      return res.status(403).json({
        success: false,
        authenticated: false,
        message: 'Staff account has been deactivated'
      });
    }

    return res.status(200).json({
      success: true,
      authenticated: true,
      admin: {
        id: profile.id,
        username: profile.email || profile.phone,
        email: profile.email,
        name: profile.fullName,
        role: normalizedRole,
        permissions: payload.permissions || db.ROLE_PERMISSIONS[normalizedRole] || []
      }
    });
  } catch (err) {
    console.error('Admin verification error:', err);
    return res.status(500).json({
      success: false,
      authenticated: false,
      message: 'Verification server error: ' + err.message
    });
  }
};
