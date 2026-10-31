// Vercel Serverless Function: Consolidated ERP Gateway
// Exide Battery Wholesale & AET Official Partner
const url = require('url');

const handlers = {
  'metrics': require('../lib/erp/metrics.js'),
  'products': require('../lib/erp/products.js'),
  'inventory': require('../lib/erp/inventory.js'),
  'orders': require('../lib/erp/orders.js'),
  'purchases': require('../lib/erp/purchases.js'),
  'sales': require('../lib/erp/sales.js'),
  'suppliers': require('../lib/erp/suppliers.js'),
  'exchanges': require('../lib/erp/exchanges.js'),
  'staff': require('../lib/auth/staff.js'),
  'demo': require('../lib/erp/demo.js')
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Idempotency-Key');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const parsed = url.parse(req.url, true);
  let moduleName = req.query?.module || parsed.query?.module;

  // 1. If passed via __subpath rewrite query parameter
  if (!moduleName && (req.query?.__subpath || parsed.query?.__subpath)) {
    const rawSub = req.query?.__subpath || parsed.query?.__subpath;
    moduleName = String(rawSub).split('/')[0];
  }

  // 2. Fallback to parsing pathname (e.g. /api/erp/metrics)
  if (!moduleName) {
    const rawPath = parsed.pathname || req.url || '';
    const match = rawPath.match(/\/api\/erp\/([^\/\?#]+)/);
    if (match) {
      moduleName = match[1];
    }
  }

  // 3. Fallback to Vercel x-matched-path header
  if (!moduleName && req.headers && req.headers['x-matched-path']) {
    const match = String(req.headers['x-matched-path']).match(/\/api\/erp\/([^\/\?#]+)/);
    if (match) {
      moduleName = match[1];
    }
  }

  // Clean and trim module name
  if (moduleName) {
    moduleName = String(moduleName).trim();
  }

  if (moduleName && moduleName.endsWith('.js')) {
    moduleName = moduleName.slice(0, -3).trim();
  }

  const handler = handlers[moduleName];
  if (handler) {
    return handler(req, res);
  }

  return res.status(404).json({
    success: false,
    message: `ERP endpoint "${moduleName || 'unknown'}" not found.`,
    availableModules: Object.keys(handlers)
  });
};
