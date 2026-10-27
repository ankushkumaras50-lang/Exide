// Vercel Serverless Function: Customer & Staff Session Verification & Profile Management
// Exide Battery Wholesale & AET Official Partner
const db = require('../../db/client.js');
const { verifyJwt, extractToken, signJwt } = require('./token.js');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({
      success: false,
      authenticated: false,
      message: 'No authorization session token provided.'
    });
  }

  // Check token against customer and staff secrets
  let payload = verifyJwt(token, false) || verifyJwt(token, true);
  if (!payload || !payload.userId) {
    return res.status(401).json({
      success: false,
      authenticated: false,
      message: 'Session has expired or is invalid. Please sign in again.'
    });
  }

  const profile = db.findProfileById(payload.userId);
  if (!profile || !profile.isActive) {
    return res.status(401).json({
      success: false,
      authenticated: false,
      message: 'Account not found or has been deactivated.'
    });
  }

  // --------------------------------------------------------------------------
  // 1. GET CURRENT SESSION & PROFILE
  // --------------------------------------------------------------------------
  if (req.method === 'GET') {
    return res.status(200).json({
      success: true,
      authenticated: true,
      user: {
        id: profile.id,
        email: profile.email,
        phone: profile.phone,
        fullName: profile.fullName,
        avatarUrl: profile.avatarUrl || '',
        role: profile.role || 'customer',
        permissions: db.ROLE_PERMISSIONS[profile.role] || ['orders_own_read', 'profile_manage'],
        district: profile.district || 'Kathmandu',
        city: profile.city || 'Kathmandu',
        ward: profile.ward || '10',
        address: profile.address || 'Kathmandu, Nepal',
        isEmailVerified: !!profile.isEmailVerified,
        isPhoneVerified: !!profile.isPhoneVerified,
        createdAt: profile.createdAt
      }
    });
  }

  // --------------------------------------------------------------------------
  // 2. UPDATE PROFILE DETAILS (Address, Phone, Name)
  // --------------------------------------------------------------------------
  if (req.method === 'PUT' || req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch(e) { body = {}; }
    }
    body = body || {};

    const { fullName, district, city, ward, address, deliveryNotes } = body;

    if (fullName) profile.fullName = String(fullName).trim();
    if (district) profile.district = String(district).trim();
    if (city) profile.city = String(city).trim();
    if (ward) profile.ward = String(ward).trim();
    if (address) profile.address = String(address).trim();
    if (deliveryNotes) profile.deliveryNotes = String(deliveryNotes).trim();

    db.saveProfile(profile);

    return res.status(200).json({
      success: true,
      message: 'Profile details updated successfully.',
      user: {
        id: profile.id,
        email: profile.email,
        phone: profile.phone,
        fullName: profile.fullName,
        district: profile.district,
        city: profile.city,
        ward: profile.ward,
        address: profile.address,
        isEmailVerified: profile.isEmailVerified,
        isPhoneVerified: profile.isPhoneVerified
      }
    });
  }

  return res.status(405).json({ success: false, message: 'Method Not Allowed' });
};
