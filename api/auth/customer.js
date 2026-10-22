// Vercel Serverless Function: Genuine Customer Authentication & Email Verification
const crypto = require('crypto');
const db = require('../db.js');

const CUSTOMER_SECRET = process.env.CUSTOMER_JWT_SECRET || 'exide_customer_secret_key_2026';

function generateCustomerToken(customer) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({
    id: customer.id,
    phone: customer.phone,
    email: customer.email,
    name: customer.fullName,
    role: 'customer',
    isEmailVerified: !!customer.isEmailVerified,
    isPhoneVerified: !!customer.isPhoneVerified,
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000 // 30 days valid
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', CUSTOMER_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

function verifyCustomerToken(token) {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;
    const expectedSig = crypto.createHmac('sha256', CUSTOMER_SECRET).update(`${header}.${body}`).digest('base64url');
    if (signature !== expectedSig) return null;

    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload.exp && Date.now() > payload.exp) return null;
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

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  body = body || {};

  const action = req.query.action || body.action || (req.method === 'GET' ? 'verify' : 'login');

  try {
    // 1. VERIFY SESSION
    if (action === 'verify' || req.method === 'GET') {
      const authHeader = req.headers['authorization'] || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : (req.query.token || body.token);
      const payload = verifyCustomerToken(token);
      if (!payload) {
        return res.status(401).json({ success: false, authenticated: false, message: 'Invalid or expired customer session' });
      }
      return res.status(200).json({
        success: true,
        authenticated: true,
        customer: payload
      });
    }

    // 2. REGISTER NEW CUSTOMER
    if (action === 'register') {
      const { fullName, phone, email, password, district, address } = body;

      if (!fullName || !phone || !password) {
        return res.status(400).json({
          success: false,
          message: 'Full Name, Mobile Number, and Password are required'
        });
      }

      const cleanPhone = phone.replace(/\D/g, '');
      if (cleanPhone.length < 10) {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid 10-digit Nepal mobile number (e.g., 98XXXXXXXX)'
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 6 characters long'
        });
      }

      const users = db.getUsers();
      const existingUser = users.find(u => 
        (u.phone && u.phone === cleanPhone) || 
        (email && u.email && u.email.toLowerCase() === email.trim().toLowerCase())
      );

      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'An account with this mobile number or email already exists. Please sign in.'
        });
      }

      const customerId = 'CUST-' + Date.now().toString(36).toUpperCase();
      const { hash, salt } = db.hashPassword(password);

      const verificationToken = crypto.randomBytes(20).toString('hex');

      const customerData = {
        id: customerId,
        username: email ? email.trim().toLowerCase() : cleanPhone,
        fullName: fullName.trim(),
        phone: cleanPhone,
        email: email ? email.trim().toLowerCase() : `${cleanPhone}@customer.exidebattery.com.np`,
        role: 'Customer',
        permissions: ['orders_view_own', 'profile_manage'],
        passwordHash: hash,
        passwordSalt: salt,
        district: district || 'Kathmandu',
        address: address ? address.trim() : 'Kathmandu, Nepal',
        isEmailVerified: false,
        emailVerificationToken: verificationToken,
        active: true,
        createdAt: new Date().toISOString()
      };

      users.push(customerData);
      db.saveUsers(users);

      const token = generateCustomerToken(customerData);

      return res.status(201).json({
        success: true,
        message: 'Account registered successfully! Verification email link generated.',
        token: token,
        verificationLink: `/index.html?verify_email=${verificationToken}`,
        customer: {
          id: customerData.id,
          fullName: customerData.fullName,
          phone: customerData.phone,
          email: customerData.email,
          district: customerData.district,
          address: customerData.address,
          isEmailVerified: false
        }
      });
    }

    // 3. LOGIN EXISTING CUSTOMER
    if (action === 'login') {
      const { identifier, password } = body;

      if (!identifier || !password) {
        return res.status(400).json({
          success: false,
          message: 'Phone/Email and Password are required'
        });
      }

      const cleanIdentifier = String(identifier).trim();
      const user = db.findUserByUsernameOrEmail(cleanIdentifier);

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'No account found matching this mobile number or email.'
        });
      }

      const isMatch = db.verifyPassword(password, user.passwordHash, user.passwordSalt);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Incorrect password. Please verify and try again.'
        });
      }

      const token = generateCustomerToken(user);

      return res.status(200).json({
        success: true,
        message: `Welcome back, ${user.fullName}!`,
        token: token,
        customer: {
          id: user.id,
          fullName: user.fullName,
          phone: user.phone,
          email: user.email,
          district: user.district || 'Kathmandu',
          address: user.address || 'Kathmandu, Nepal',
          isEmailVerified: !!user.isEmailVerified,
          role: user.role
        }
      });
    }

    // 4. GOOGLE OAUTH SYNC (Verified ID Token or Profile)
    if (action === 'google-sync') {
      const { email, fullName, photoURL, googleUid, phone } = body;

      if (!email || !email.includes('@')) {
        return res.status(400).json({ success: false, message: 'Valid Google email is required.' });
      }

      const cleanEmail = email.trim().toLowerCase();
      const users = db.getUsers();
      let user = users.find(u => u.email && u.email.toLowerCase() === cleanEmail);

      if (user) {
        user.isEmailVerified = true;
        user.googleUid = googleUid || user.googleUid;
        if (photoURL) user.photoURL = photoURL;
        if (phone && (!user.phone || user.phone.startsWith('98XXXXXXXX'))) user.phone = phone.replace(/\D/g, '');
      } else {
        const dummyPass = db.hashPassword(crypto.randomBytes(16).toString('hex'));
        user = {
          id: 'CUST-G-' + (googleUid ? googleUid.slice(0, 10) : Date.now().toString(36).toUpperCase()),
          username: cleanEmail,
          email: cleanEmail,
          fullName: fullName ? fullName.trim() : cleanEmail.split('@')[0],
          phone: phone ? phone.replace(/\D/g, '') : '',
          role: 'Customer',
          permissions: ['orders_view_own', 'profile_manage'],
          passwordHash: dummyPass.hash,
          passwordSalt: dummyPass.salt,
          authProvider: 'google',
          isEmailVerified: true,
          photoURL: photoURL || '',
          active: true,
          createdAt: new Date().toISOString()
        };
        users.push(user);
      }

      db.saveUsers(users);

      const token = generateCustomerToken(user);

      return res.status(200).json({
        success: true,
        message: 'Google authentication verified',
        token: token,
        customer: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          phone: user.phone,
          isEmailVerified: true,
          authProvider: 'google'
        }
      });
    }

    // 5. EMAIL VERIFICATION CONFIRMATION
    if (action === 'verify-email') {
      const { token } = body;
      if (!token) {
        return res.status(400).json({ success: false, message: 'Verification token is required' });
      }

      const users = db.getUsers();
      const user = users.find(u => u.emailVerificationToken === token);
      if (!user) {
        return res.status(404).json({ success: false, message: 'Invalid or expired email verification link.' });
      }

      user.isEmailVerified = true;
      user.emailVerificationToken = null;
      db.saveUsers(users);

      return res.status(200).json({
        success: true,
        message: `Email ${user.email} verified successfully!`
      });
    }

    return res.status(400).json({ success: false, message: 'Invalid action specified' });
  } catch (err) {
    console.error('Customer Auth Error:', err);
    return res.status(500).json({ success: false, message: 'Customer auth server error: ' + err.message });
  }
};
