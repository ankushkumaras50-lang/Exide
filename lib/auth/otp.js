// Vercel Serverless Function: Nepal Mobile (+977) Phone OTP Authentication & Linking
// Exide Battery Wholesale & AET Official Partner
const https = require('https');
const db = require('../../db/client.js');
const { signJwt, verifyJwt, extractToken } = require('./token.js');

/**
 * Validate and normalize Nepal mobile number
 * Supported prefixes: 98 (NTC/Ncell), 97 (Ncell/NTC 4G), 96 (SmartCell)
 */
function normalizeNepalPhone(phone) {
  if (!phone) return null;
  let clean = String(phone).replace(/\D/g, '');
  if (clean.startsWith('977')) {
    clean = clean.slice(3);
  }
  if (clean.startsWith('0')) {
    clean = clean.slice(1);
  }
  if (clean.length === 10 && /^(98|97|96)\d{8}$/.test(clean)) {
    return clean;
  }
  return null;
}

/**
 * Dispatch SMS via configured Nepal / International SMS Provider
 */
async function dispatchSms(phone, otpCode) {
  const sparrowToken = process.env.SPARROW_SMS_TOKEN;
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioAuth = process.env.TWILIO_AUTH_TOKEN;

  const smsText = `Your Exide Battery Wholesale Nepal verification code is: ${otpCode}. Valid for 5 minutes. Do not share with anyone.`;

  // 1. Sparrow SMS (Nepal Official Gateway)
  if (sparrowToken) {
    return new Promise((resolve) => {
      const postData = JSON.stringify({
        token: sparrowToken,
        from: process.env.SPARROW_SMS_FROM || 'ThePowerHouse',
        to: phone,
        text: smsText
      });
      const req = https.request({
        hostname: 'api.sparrowsms.com',
        path: '/v2/sms/',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      }, (res) => {
        resolve(res.statusCode === 200);
      });
      req.on('error', () => resolve(false));
      req.write(postData);
      req.end();
    });
  }

  // 2. Twilio Gateway
  if (twilioSid && twilioAuth) {
    return new Promise((resolve) => {
      const authHeader = 'Basic ' + Buffer.from(`${twilioSid}:${twilioAuth}`).toString('base64');
      const postData = `To=%2B977${phone}&From=${encodeURIComponent(process.env.TWILIO_PHONE_NUMBER || '')}&Body=${encodeURIComponent(smsText)}`;

      const req = https.request({
        hostname: 'api.twilio.com',
        path: `/2010-04-01/Accounts/${twilioSid}/Messages.json`,
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData)
        }
      }, (res) => {
        resolve(res.statusCode === 201 || res.statusCode === 200);
      });
      req.on('error', () => resolve(false));
      req.write(postData);
      req.end();
    });
  }

  return null; // No SMS gateway configured
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed. Use POST.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  body = body || {};

  const query = req.query || {};
  const action = query.action || body.action || 'request';
  const rawPhone = body.phone || query.phone;
  const ipAddress = (req.headers && req.headers['x-forwarded-for']) || req.socket?.remoteAddress || '';

  try {
    // ------------------------------------------------------------------------
    // ACTION 1: REQUEST OTP
    // ------------------------------------------------------------------------
    if (action === 'request') {
      const cleanPhone = normalizeNepalPhone(rawPhone);
      if (!cleanPhone) {
        return res.status(400).json({
          success: false,
          message: 'Please enter a valid 10-digit Nepal mobile number starting with 98, 97, or 96 (e.g. 98XXXXXXXX).'
        });
      }

      // Check cooldown & rate limit
      const otpResult = db.createOtpRequest(cleanPhone, ipAddress);
      if (!otpResult.success) {
        return res.status(429).json(otpResult);
      }

      // Attempt SMS dispatch
      const smsSent = await dispatchSms(cleanPhone, otpResult.rawOtp);

      const isDevOrTest = process.env.NODE_ENV !== 'production' || process.env.ALLOW_TEST_OTP === 'true';

      if (smsSent === null) {
        // No SMS Gateway configured in environment
        if (!isDevOrTest) {
          return res.status(503).json({
            success: false,
            message: 'Nepal SMS gateway provider is not configured in this environment. Please sign in using Google OAuth or contact Exide customer support (+977 9705997260).'
          });
        }
        // In dev / test mode: return controlled verification code for automated test runners
        return res.status(200).json({
          success: true,
          message: `OTP generated for +977-${cleanPhone}. (Dev test mode active)`,
          cooldownSeconds: 60,
          expiresInSeconds: otpResult.expiresInSeconds,
          testVerificationCode: otpResult.rawOtp
        });
      }

      if (!smsSent) {
        return res.status(502).json({
          success: false,
          message: 'Failed to deliver SMS to +977-' + cleanPhone + '. Please check network connectivity or try again.'
        });
      }

      return res.status(200).json({
        success: true,
        message: `OTP verification code sent via SMS to +977-${cleanPhone}.`,
        cooldownSeconds: 60,
        expiresInSeconds: otpResult.expiresInSeconds
      });
    }

    // ------------------------------------------------------------------------
    // ACTION 2: VERIFY OTP & SIGN IN
    // ------------------------------------------------------------------------
    if (action === 'verify') {
      const cleanPhone = normalizeNepalPhone(rawPhone);
      const otp = body.otp || body.code;

      if (!cleanPhone || !otp) {
        return res.status(400).json({
          success: false,
          message: 'Mobile number and 6-digit OTP code are required.'
        });
      }

      const verifyResult = db.verifyOtpRequest(cleanPhone, otp);
      if (!verifyResult.success) {
        return res.status(401).json(verifyResult);
      }

      // Look up or provision profile
      let profile = db.findProfileByPhone(cleanPhone);
      if (profile) {
        profile.isPhoneVerified = true;
        db.saveProfile(profile);
      } else {
        profile = db.createProfile({
          phone: cleanPhone,
          fullName: `Customer (${cleanPhone.slice(-4)})`,
          email: `${cleanPhone}@customer.exidebattery.com.np`,
          authProvider: 'phone_otp',
          isPhoneVerified: true,
          role: 'customer'
        });
      }

      // Issue signed session token
      const sessionToken = signJwt({
        userId: profile.id,
        email: profile.email,
        phone: profile.phone,
        fullName: profile.fullName,
        role: profile.role || 'customer',
        authProvider: 'phone_otp',
        isPhoneVerified: true
      }, false, 30 * 24 * 60 * 60 * 1000);

      db.logAuditEvent(profile.id, 'LOGIN_PHONE_OTP', 'profiles', profile.id, null, { phone: cleanPhone }, ipAddress);

      return res.status(200).json({
        success: true,
        message: `Welcome, ${profile.fullName}! Mobile number verified successfully.`,
        token: sessionToken,
        customer: {
          id: profile.id,
          phone: profile.phone,
          email: profile.email,
          fullName: profile.fullName,
          district: profile.district || 'Kathmandu',
          city: profile.city || 'Kathmandu',
          address: profile.address || 'Kathmandu, Nepal',
          isPhoneVerified: true,
          isEmailVerified: !!profile.isEmailVerified,
          role: profile.role
        }
      });
    }

    // ------------------------------------------------------------------------
    // ACTION 3: LINK VERIFIED PHONE NUMBER TO EXISTING GOOGLE ACCOUNT
    // ------------------------------------------------------------------------
    if (action === 'link') {
      const token = extractToken(req);
      const session = verifyJwt(token, false);
      if (!session || !session.userId) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized. You must be signed in to link a mobile number.'
        });
      }

      const cleanPhone = normalizeNepalPhone(rawPhone);
      const otp = body.otp || body.code;

      if (!cleanPhone || !otp) {
        return res.status(400).json({
          success: false,
          message: 'Mobile number and OTP code are required for linking.'
        });
      }

      // Verify OTP code
      const verifyResult = db.verifyOtpRequest(cleanPhone, otp);
      if (!verifyResult.success) {
        return res.status(401).json(verifyResult);
      }

      // Check if phone already claimed by ANOTHER profile
      const existing = db.findProfileByPhone(cleanPhone);
      if (existing && existing.id !== session.userId) {
        return res.status(409).json({
          success: false,
          message: 'This mobile number is already linked to another customer account. Cannot automatically merge accounts.'
        });
      }

      const currentProfile = db.findProfileById(session.userId);
      if (!currentProfile) {
        return res.status(404).json({ success: false, message: 'User profile not found.' });
      }

      currentProfile.phone = cleanPhone;
      currentProfile.isPhoneVerified = true;
      db.saveProfile(currentProfile);

      db.logAuditEvent(currentProfile.id, 'ACCOUNT_LINK_PHONE', 'profiles', currentProfile.id, null, { phone: cleanPhone }, ipAddress);

      // Re-issue updated token
      const updatedToken = signJwt({
        userId: currentProfile.id,
        email: currentProfile.email,
        phone: currentProfile.phone,
        fullName: currentProfile.fullName,
        role: currentProfile.role,
        authProvider: currentProfile.authProvider,
        isPhoneVerified: true,
        isEmailVerified: !!currentProfile.isEmailVerified
      }, false, 30 * 24 * 60 * 60 * 1000);

      return res.status(200).json({
        success: true,
        message: `Mobile number +977-${cleanPhone} linked successfully to your account!`,
        token: updatedToken,
        customer: currentProfile
      });
    }

    return res.status(400).json({ success: false, message: 'Invalid action specified' });

  } catch (err) {
    console.error('OTP API Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error processing OTP request: ' + err.message
    });
  }
};
