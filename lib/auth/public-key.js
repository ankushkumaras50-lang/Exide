// Vercel Serverless Function: Expose System Public Key for Verification
const fs = require('fs');
const path = require('path');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  let publicKey = process.env.VERCEL_PUBLIC_KEY || '';
  if (!publicKey) {
    try {
      const keyPath = path.join(__dirname, '..', '..', 'keys', 'vercel_public.pem');
      if (fs.existsSync(keyPath)) {
        publicKey = fs.readFileSync(keyPath, 'utf8');
      }
    } catch (e) {}
  }

  return res.status(200).json({
    success: true,
    algorithm: 'RS256 / RSA',
    format: 'PKCS#8 PEM',
    publicKey: publicKey.trim(),
    purpose: 'Vercel Deployment, Token Signature Verification & Webhook Authentication'
  });
};
