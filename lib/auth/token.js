// Exide Battery Wholesale & AET Official Partner
// Cryptographic JWT Token Engine for Customer & ERP Staff Sessions
const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'exide_battery_erp_secret_key_2026';
const CUSTOMER_SECRET = process.env.CUSTOMER_JWT_SECRET || 'exide_customer_secret_key_2026';

function base64UrlEncode(str) {
  return Buffer.from(str).toString('base64url');
}

function base64UrlDecode(str) {
  return Buffer.from(str, 'base64url').toString('utf8');
}

/**
 * Generate signed JWT
 */
function signJwt(payload, isStaff = false, expiresInMs = 24 * 60 * 60 * 1000) {
  const secret = isStaff ? JWT_SECRET : CUSTOMER_SECRET;
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const exp = Date.now() + expiresInMs;
  const body = base64UrlEncode(JSON.stringify({ ...payload, exp }));
  const signature = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

/**
 * Verify and decode JWT
 */
function verifyJwt(token, isStaff = false) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [header, body, signature] = parts;
  const secret = isStaff ? JWT_SECRET : CUSTOMER_SECRET;
  const expectedSig = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');

  if (signature !== expectedSig) {
    // If checking as customer failed, test staff secret in case of cross-session check
    if (!isStaff) {
      const staffSig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
      if (signature !== staffSig) return null;
    } else {
      // If checking as staff failed, test customer secret so caller can detect 403 Forbidden vs 401 Unauthenticated
      const custSig = crypto.createHmac('sha256', CUSTOMER_SECRET).update(`${header}.${body}`).digest('base64url');
      if (signature !== custSig) return null;
    }
  }

  try {
    const payload = JSON.parse(base64UrlDecode(body));
    if (payload.exp && Date.now() > payload.exp) {
      return null; // Expired
    }
    return payload;
  } catch (e) {
    return null;
  }
}

/**
 * Extract token from HTTP Authorization header
 */
function extractToken(req) {
  const authHeader = req.headers['authorization'] || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  return req.query?.token || (req.body && req.body.token) || null;
}

module.exports = {
  signJwt,
  verifyJwt,
  extractToken
};
