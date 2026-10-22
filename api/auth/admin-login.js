// Vercel Serverless Function: Secure ERP Staff & Admin Authentication
// Exide Battery Wholesale & AET Official Partner
const crypto = require('crypto');
const db = require('../db.js');

const JWT_SECRET = process.env.JWT_SECRET || 'exide_battery_erp_secret_key_2026';

function generateToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({
    ...payload,
    exp: Date.now() + 24 * 60 * 60 * 1000 // 24 hours valid
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
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

    // Look up user in persistent database
    const user = db.findUserByUsernameOrEmail(cleanUser);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. User account not found.'
      });
    }

    if (!user.active) {
      return res.status(403).json({
        success: false,
        message: 'This staff account has been deactivated. Please contact your SuperAdmin.'
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

    // Generate JWT token with role and permissions
    const token = generateToken({
      userId: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      permissions: user.permissions || db.getRolePermissions(user.role)
    });

    return res.status(200).json({
      success: true,
      message: `Welcome back, ${user.fullName}!`,
      token: token,
      admin: {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.fullName,
        role: user.role,
        permissions: user.permissions || db.getRolePermissions(user.role)
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
