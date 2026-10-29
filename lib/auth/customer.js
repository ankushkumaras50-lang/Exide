// Vercel Serverless Function: Genuine Customer Authentication & Email Verification
// Exide Battery Wholesale & AET Official Partner
const crypto = require('crypto');
const db = require('../../db/client.js');
const { signJwt, verifyJwt, extractToken } = require('./token.js');

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

  const query = req.query || {};
  const action = query.action || body.action || (req.method === 'GET' ? 'verify' : 'login');
  const ipAddress = (req.headers && req.headers['x-forwarded-for']) || req.socket?.remoteAddress || '';

  try {
    // ------------------------------------------------------------------------
    // 1. VERIFY CUSTOMER SESSION
    // ------------------------------------------------------------------------
    if (action === 'verify' || req.method === 'GET') {
      const token = extractToken(req);
      const payload = verifyJwt(token, false);
      if (!payload || !payload.userId) {
        return res.status(401).json({
          success: false,
          authenticated: false,
          message: 'Invalid or expired customer session'
        });
      }

      const profile = db.findProfileById(payload.userId);
      if (!profile || !profile.isActive) {
        return res.status(401).json({
          success: false,
          authenticated: false,
          message: 'Customer profile not found or inactive'
        });
      }

      return res.status(200).json({
        success: true,
        authenticated: true,
        customer: {
          id: profile.id,
          phone: profile.phone,
          email: profile.email,
          fullName: profile.fullName,
          district: profile.district,
          city: profile.city,
          address: profile.address,
          isEmailVerified: !!profile.isEmailVerified,
          isPhoneVerified: !!profile.isPhoneVerified,
          role: profile.role
        }
      });
    }

    // ------------------------------------------------------------------------
    // 2. REGISTER NEW CUSTOMER
    // ------------------------------------------------------------------------
    if (action === 'register') {
      const { fullName, phone, email, password, district, city, address } = body;

      if (!fullName || (!phone && !email) || !password) {
        return res.status(400).json({
          success: false,
          message: 'Full Name, Phone/Email, and Password are required.'
        });
      }

      let cleanPhone = null;
      if (phone) {
        cleanPhone = String(phone).replace(/\D/g, '').slice(-10);
        if (cleanPhone.length < 10) {
          return res.status(400).json({
            success: false,
            message: 'Please provide a valid 10-digit Nepal mobile number (e.g. 98XXXXXXXX).'
          });
        }
      }

      const cleanEmail = email ? String(email).trim().toLowerCase() : null;

      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 6 characters long.'
        });
      }

      // Check existing accounts
      if (cleanPhone && db.findProfileByPhone(cleanPhone)) {
        return res.status(409).json({
          success: false,
          message: 'An account with this mobile number already exists. Please sign in.'
        });
      }
      if (cleanEmail && db.findProfileByEmail(cleanEmail)) {
        return res.status(409).json({
          success: false,
          message: 'An account with this email address already exists. Please sign in.'
        });
      }

      const verificationToken = crypto.randomBytes(20).toString('hex');

      const profile = db.createProfile({
        email: cleanEmail,
        phone: cleanPhone,
        fullName: fullName.trim(),
        password: password,
        district: district || 'Kathmandu',
        city: city || 'Kathmandu',
        address: address ? address.trim() : 'Kathmandu, Nepal',
        isEmailVerified: false,
        isPhoneVerified: false,
        emailVerificationToken: verificationToken,
        role: 'customer'
      });

      const token = signJwt({
        userId: profile.id,
        email: profile.email,
        phone: profile.phone,
        fullName: profile.fullName,
        role: 'customer',
        isEmailVerified: false,
        isPhoneVerified: false
      }, false, 30 * 24 * 60 * 60 * 1000);

      db.logAuditEvent(profile.id, 'CUSTOMER_REGISTER', 'profiles', profile.id, null, { email: cleanEmail, phone: cleanPhone }, ipAddress);

      return res.status(201).json({
        success: true,
        message: 'Account registered successfully!',
        token: token,
        verificationLink: `/login?verify_email=${verificationToken}`,
        customer: {
          id: profile.id,
          fullName: profile.fullName,
          phone: profile.phone,
          email: profile.email,
          district: profile.district,
          city: profile.city,
          address: profile.address,
          isEmailVerified: false,
          isPhoneVerified: false,
          role: profile.role
        }
      });
    }

    // ------------------------------------------------------------------------
    // 3. LOGIN EXISTING CUSTOMER
    // ------------------------------------------------------------------------
    if (action === 'login') {
      const { identifier, password } = body;

      if (!identifier || !password) {
        return res.status(400).json({
          success: false,
          message: 'Phone/Email and Password are required.'
        });
      }

      const cleanIdentifier = String(identifier).trim();
      const user = db.findProfileByIdentifier(cleanIdentifier);

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

      const token = signJwt({
        userId: user.id,
        email: user.email,
        phone: user.phone,
        fullName: user.fullName,
        role: user.role || 'customer',
        isEmailVerified: !!user.isEmailVerified,
        isPhoneVerified: !!user.isPhoneVerified
      }, false, 30 * 24 * 60 * 60 * 1000);

      db.logAuditEvent(user.id, 'CUSTOMER_LOGIN', 'profiles', user.id, null, { identifier: cleanIdentifier }, ipAddress);

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
          city: user.city || 'Kathmandu',
          address: user.address || 'Kathmandu, Nepal',
          isEmailVerified: !!user.isEmailVerified,
          isPhoneVerified: !!user.isPhoneVerified,
          role: user.role
        }
      });
    }

    // ------------------------------------------------------------------------
    // 4. VERIFY EMAIL CONFIRMATION
    // ------------------------------------------------------------------------
    if (action === 'verify-email') {
      const { token } = body;
      if (!token) {
        return res.status(400).json({ success: false, message: 'Verification token is required.' });
      }

      const profiles = db.getProfiles();
      const user = profiles.find(u => u.emailVerificationToken === token);
      if (!user) {
        return res.status(404).json({ success: false, message: 'Invalid or expired email verification link.' });
      }

      user.isEmailVerified = true;
      user.emailVerificationToken = null;
      db.saveProfile(user);

      return res.status(200).json({
        success: true,
        message: `Email ${user.email} verified successfully!`
      });
    }

    // ------------------------------------------------------------------------
    // 5. UPDATE CUSTOMER PROFILE & E-COMMERCE DETAILS
    // ------------------------------------------------------------------------
    if (action === 'update-profile' || action === 'update') {
      const { 
        id, email, phone, fullName, alternatePhone, 
        province, district, city, ward, address, landmark, deliveryNotes, 
        companyName, panNumber, vehicleType, vehicleModel, batteryAh,
        savedPaymentMethods
      } = body;

      // Identify user from JWT token or passed ID/email/phone
      let userId = null;
      const token = extractToken(req);
      if (token) {
        const payload = verifyJwt(token, false);
        if (payload && payload.userId) userId = payload.userId;
      }
      if (!userId && id) userId = id;

      let user = null;
      if (userId) user = db.findProfileById(userId);
      if (!user && email) user = db.findProfileByEmail(email);
      if (!user && phone) user = db.findProfileByPhone(phone);

      if (!user) {
        user = db.createProfile({
          id: userId || ('CUST-' + Date.now().toString(36).toUpperCase()),
          email: email ? String(email).trim().toLowerCase() : null,
          phone: phone ? String(phone).replace(/\D/g, '').slice(-10) : null,
          fullName: (fullName || 'Valued Customer').trim(),
          role: 'customer'
        });
      }

      if (fullName) user.fullName = String(fullName).trim();
      if (phone) user.phone = String(phone).replace(/\D/g, '').slice(-10);
      if (alternatePhone !== undefined) user.alternatePhone = String(alternatePhone || '').replace(/\D/g, '').slice(-10);
      if (province !== undefined) user.province = String(province || '').trim();
      if (district !== undefined) user.district = String(district || '').trim();
      if (city !== undefined) user.city = String(city || '').trim();
      if (ward !== undefined) user.ward = String(ward || '').trim();
      if (address !== undefined) user.address = String(address || '').trim();
      if (landmark !== undefined) user.landmark = String(landmark || '').trim();
      if (deliveryNotes !== undefined) user.deliveryNotes = String(deliveryNotes || '').trim();
      if (companyName !== undefined) user.companyName = String(companyName || '').trim();
      if (panNumber !== undefined) user.panNumber = String(panNumber || '').trim();
      if (vehicleType !== undefined) user.vehicleType = String(vehicleType || '').trim();
      if (vehicleModel !== undefined) user.vehicleModel = String(vehicleModel || '').trim();
      if (batteryAh !== undefined) user.batteryAh = String(batteryAh || '').trim();
      if (savedPaymentMethods !== undefined) user.savedPaymentMethods = Array.isArray(savedPaymentMethods) ? savedPaymentMethods : [];

      user.updatedAt = new Date().toISOString();
      db.saveProfile(user);

      db.logAuditEvent(user.id, 'CUSTOMER_UPDATE_PROFILE', 'profiles', user.id, null, {
        fullName: user.fullName,
        phone: user.phone,
        district: user.district
      }, ipAddress);

      const updatedToken = signJwt({
        userId: user.id,
        email: user.email,
        phone: user.phone,
        fullName: user.fullName,
        role: user.role || 'customer',
        isEmailVerified: !!user.isEmailVerified,
        isPhoneVerified: !!user.isPhoneVerified
      }, false, 30 * 24 * 60 * 60 * 1000);

      return res.status(200).json({
        success: true,
        message: 'Customer profile updated successfully!',
        token: updatedToken,
        customer: user
      });
    }

    return res.status(400).json({ success: false, message: 'Invalid action specified' });
  } catch (err) {
    console.error('Customer Auth Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Customer auth server error: ' + err.message
    });
  }
};
