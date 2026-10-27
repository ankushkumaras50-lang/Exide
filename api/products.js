// Vercel Serverless Function: Products Catalog & Live Inventory Management
// Exide Battery Wholesale & AET Official Partner
const db = require('../lib/db.js');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      const { id } = req.query;
      if (id) {
        const prod = db.getProductById(id);
        if (!prod) return res.status(404).json({ success: false, message: 'Product not found' });
        return res.status(200).json({ success: true, product: prod });
      }

      const products = db.getProducts();
      return res.status(200).json({
        success: true,
        count: products.length,
        products: products
      });
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (e) { body = {}; }
      }

      if (body && Array.isArray(body.products)) {
        db.saveProducts(body.products);
        return res.status(200).json({
          success: true,
          message: 'Inventory synced successfully',
          count: body.products.length
        });
      }

      return res.status(400).json({ success: false, message: 'Invalid products payload' });
    }

    if (req.method === 'PUT') {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (e) { body = {}; }
      }

      const { id, stock, price } = body;
      if (!id) return res.status(400).json({ success: false, message: 'Product ID is required' });

      const products = db.getProducts();
      const prod = products.find(p => p.id === id);
      if (!prod) return res.status(404).json({ success: false, message: 'Product not found' });

      if (stock !== undefined) prod.stock = Math.max(0, parseInt(stock, 10) || 0);
      if (price !== undefined) prod.price = Math.max(0, parseInt(price, 10) || 0);

      db.saveProducts(products);
      return res.status(200).json({ success: true, message: 'Product updated', product: prod });
    }

    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  } catch (err) {
    console.error('Products API Error:', err);
    return res.status(500).json({ success: false, message: 'Products API server error: ' + err.message });
  }
};
