// Vercel Serverless Function: Consolidated Auth Gateway
// Exide Battery Wholesale & AET Official Partner
const url = require('url');

const handlers = {
  'google': require('../lib/auth/google.js'),
  'otp': require('../lib/auth/otp.js'),
  'admin-login': require('../lib/auth/admin-login.js'),
  'admin-verify': require('../lib/auth/admin-verify.js'),
  'customer': require('../lib/auth/customer.js'),
  'session': require('../lib/auth/session.js'),
  'staff': require('../lib/auth/staff.js'),
  'public-key': require('../lib/auth/public-key.js')
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Idempotency-Key');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const parsed = url.parse(req.url, true);
  let action = req.query?.action || parsed.query?.action;

  // 1. If passed via __subpath rewrite query parameter
  if (!action && (req.query?.__subpath || parsed.query?.__subpath)) {
    const rawSub = req.query?.__subpath || parsed.query?.__subpath;
    action = String(rawSub).split('/')[0];
  }

  // 2. Fallback to parsing pathname (e.g. /api/auth/admin-login)
  if (!action) {
    const rawPath = parsed.pathname || req.url || '';
    const match = rawPath.match(/\/api\/auth\/([^\/\?#]+)/);
    if (match) {
      action = match[1];
    }
  }

  // 3. Fallback to Vercel x-matched-path header
  if (!action && req.headers && req.headers['x-matched-path']) {
    const match = String(req.headers['x-matched-path']).match(/\/api\/auth\/([^\/\?#]+)/);
    if (match) {
      action = match[1];
    }
  }

  // Clean and trim action string
  if (action) {
    action = String(action).trim();
  }

  // Support clean query action without file extension
  if (action && action.endsWith('.js')) {
    action = action.slice(0, -3).trim();
  }

  const handler = handlers[action];
  if (handler) {
    return handler(req, res);
  }

  return res.status(404).json({
    success: false,
    message: `Authentication endpoint "${action || 'unknown'}" not found.`,
    availableEndpoints: Object.keys(handlers)
  });
};
