// Vercel Serverless Function: Admin Session Verification
const crypto = require('crypto');

function verifyToken(token) {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;
    const secret = process.env.JWT_SECRET || 'exide_battery_erp_secret_key_2026';
    const expectedSig = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
    if (signature !== expectedSig) return null;

    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload.exp && Date.now() > payload.exp) {
      return null; // Expired
    }
    return payload;
  } catch (e) {
    return null;
  }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : (req.query.token || (req.body && req.body.token));

    const payload = verifyToken(token);
    if (!payload || payload.role !== 'admin') {
      return res.status(401).json({ success: false, authenticated: false, message: 'Invalid or expired admin session' });
    }

    return res.status(200).json({
      success: true,
      authenticated: true,
      admin: {
        username: payload.user,
        role: payload.role,
        name: payload.name
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, authenticated: false, message: 'Verification error' });
  }
};
