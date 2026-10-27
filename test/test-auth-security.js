// Dedicated Security & Authentication Test Suite
// Exide Battery Wholesale & AET Official Partner
const googleHandler = require('../lib/auth/google.js');
const otpHandler = require('../lib/auth/otp.js');
const staffHandler = require('../lib/auth/staff.js');
const sessionHandler = require('../lib/auth/session.js');
const adminLoginHandler = require('../lib/auth/admin-login.js');
const adminVerifyHandler = require('../lib/auth/admin-verify.js');
const { signJwt, verifyJwt } = require('../lib/auth/token.js');
const db = require('../db/client.js');

let passed = 0;
let failed = 0;

function assert(cond, name) {
  if (cond) {
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${name}`);
    failed++;
  }
}

function mockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    data: null,
    setHeader(k, v) { this.headers[k] = v; return this; },
    status(c) { this.statusCode = c; return this; },
    json(d) { this.data = d; return this; },
    end() { return this; }
  };
  return res;
}

async function runAuthSecurityTests() {
  console.log('\n======================================================');
  console.log('🔒 EXIDE NEPAL AUTHENTICATION & SECURITY TEST SUITE');
  console.log('======================================================\n');

  // --------------------------------------------------------------------------
  // TEST 1: Google OAuth Flow & Profile Provisioning
  // --------------------------------------------------------------------------
  console.log('🌐 1. Google OAuth Authentication & Profile Sync:');
  const googleReq = {
    method: 'POST',
    headers: {},
    body: {
      profile: {
        email: 'test.customer.nepal@gmail.com',
        fullName: 'Bikash Adhikari',
        photoURL: 'https://lh3.googleusercontent.com/test-bikash.png',
        googleUid: 'goog_sub_992102910'
      }
    }
  };
  const googleRes = mockRes();
  await googleHandler(googleReq, googleRes);

  assert(googleRes.statusCode === 200, 'Google sign-in returns HTTP 200');
  assert(googleRes.data && googleRes.data.success, 'Google sign-in reports success = true');
  assert(googleRes.data && googleRes.data.token, 'Google sign-in returns signed JWT session token');
  assert(googleRes.data && googleRes.data.customer && googleRes.data.customer.isEmailVerified, 'Customer email verified flag set to true');

  const customerToken = googleRes.data.token;
  const verifiedCustomerSession = verifyJwt(customerToken, false);
  assert(verifiedCustomerSession && verifiedCustomerSession.email === 'test.customer.nepal@gmail.com', 'Customer token decodes correctly with matching email');

  // --------------------------------------------------------------------------
  // TEST 2: Nepal Mobile Phone (+977) OTP Generation & Cooldown
  // --------------------------------------------------------------------------
  console.log('\n📱 2. Nepal Mobile (+977) OTP Generation & Rate Limiting:');

  // Valid Nepal Numbers
  const testPhone = '9801' + Math.floor(100000 + Math.random() * 900000);
  const otpReq1 = {
    method: 'POST',
    headers: {},
    body: { action: 'request', phone: `+977-${testPhone}` }
  };
  const otpRes1 = mockRes();
  await otpHandler(otpReq1, otpRes1);

  assert(otpRes1.statusCode === 200, 'Valid +977-98XXXXXXXX mobile returns HTTP 200');
  assert(otpRes1.data && otpRes1.data.success, 'OTP request successful');
  assert(otpRes1.data && otpRes1.data.cooldownSeconds === 60, '60-second resend cooldown returned');

  const testOtpCode = otpRes1.data.testVerificationCode;
  assert(testOtpCode && testOtpCode.length === 6, 'Generated OTP code is 6 digits');

  // Cooldown Enforcement: Requesting again immediately should be rejected with HTTP 429
  const otpReqCooldown = {
    method: 'POST',
    headers: {},
    body: { action: 'request', phone: testPhone }
  };
  const otpResCooldown = mockRes();
  await otpHandler(otpReqCooldown, otpResCooldown);

  assert(otpResCooldown.statusCode === 429, 'Immediate second OTP request rejected with HTTP 429 (Rate Limited)');
  assert(otpResCooldown.data && !otpResCooldown.data.allowed, 'Rate limiter reports allowed = false');

  // Invalid Nepal Number format rejection
  const otpReqInvalid = {
    method: 'POST',
    headers: {},
    body: { action: 'request', phone: '1234567890' } // Not starting with 98, 97, 96
  };
  const otpResInvalid = mockRes();
  await otpHandler(otpReqInvalid, otpResInvalid);

  assert(otpResInvalid.statusCode === 400, 'Invalid Nepal prefix rejected with HTTP 400');

  // --------------------------------------------------------------------------
  // TEST 3: OTP Verification & Attempt Limits
  // --------------------------------------------------------------------------
  console.log('\n🔢 3. OTP Verification & Attempt Limits:');

  // Attempt with incorrect OTP
  const otpReqWrong = {
    method: 'POST',
    headers: {},
    body: { action: 'verify', phone: testPhone, otp: '000000' }
  };
  const otpResWrong = mockRes();
  await otpHandler(otpReqWrong, otpResWrong);

  assert(otpResWrong.statusCode === 401, 'Incorrect OTP rejected with HTTP 401');
  assert(otpResWrong.data && otpResWrong.data.message.includes('attempt'), 'Returns remaining attempts notice');

  // Correct OTP verification
  const otpReqCorrect = {
    method: 'POST',
    headers: {},
    body: { action: 'verify', phone: testPhone, otp: testOtpCode }
  };
  const otpResCorrect = mockRes();
  await otpHandler(otpReqCorrect, otpResCorrect);

  assert(otpResCorrect.statusCode === 200, 'Correct OTP code verified successfully with HTTP 200');
  assert(otpResCorrect.data && otpResCorrect.data.token, 'OTP verification issues signed customer session token');
  assert(otpResCorrect.data && otpResCorrect.data.customer.isPhoneVerified, 'Profile marked as phone verified');

  // --------------------------------------------------------------------------
  // TEST 4: Account Linking (Link Verified Phone to Google Profile)
  // --------------------------------------------------------------------------
  console.log('\n🔗 4. Account Linking (Phone Number to Google Account):');

  // Request OTP for fresh phone number
  const linkReqPhone = '9851' + Math.floor(100000 + Math.random() * 900000);
  const otpLinkReq = {
    method: 'POST',
    headers: {},
    body: { action: 'request', phone: linkReqPhone }
  };
  const otpLinkRes = mockRes();
  await otpHandler(otpLinkReq, otpLinkRes);
  const linkOtpCode = otpLinkRes.data.testVerificationCode;

  // Link to logged-in Google customer
  const linkReq = {
    method: 'POST',
    headers: { authorization: `Bearer ${customerToken}` },
    body: { action: 'link', phone: linkReqPhone, otp: linkOtpCode }
  };
  const linkRes = mockRes();
  await otpHandler(linkReq, linkRes);

  assert(linkRes.statusCode === 200, 'Linking phone to authenticated Google account returns HTTP 200');
  assert(linkRes.data && linkRes.data.customer && linkRes.data.customer.phone === linkReqPhone, 'Profile updated with linked Nepal phone number');
  assert(linkRes.data.customer.isPhoneVerified, 'Linked phone marked as verified');

  // --------------------------------------------------------------------------
  // TEST 5: RBAC Authorization & Privilege Escalation Prevention
  // --------------------------------------------------------------------------
  console.log('\n🛡️ 5. ERP RBAC Security & Privilege Escalation Prevention:');

  // 5A. Unauthenticated caller attempting to create a staff invitation
  const unauthInviteReq = {
    method: 'POST',
    headers: {}, // NO Authorization header
    body: { action: 'invite', email: 'attacker@evil.com', role: 'super_admin' }
  };
  const unauthInviteRes = mockRes();
  await staffHandler(unauthInviteReq, unauthInviteRes);

  assert(unauthInviteRes.statusCode === 401, 'Unauthenticated staff invitation blocked with HTTP 401');

  // 5B. Customer token attempting staff invitation
  const custInviteReq = {
    method: 'POST',
    headers: { authorization: `Bearer ${customerToken}` },
    body: { action: 'invite', email: 'attacker@evil.com', role: 'super_admin' }
  };
  const custInviteRes = mockRes();
  await staffHandler(custInviteReq, custInviteRes);

  assert(custInviteRes.statusCode === 401 || custInviteRes.statusCode === 403, 'Customer token attempting staff invitation blocked with HTTP 401/403');

  // 5C. Authenticate real SuperAdmin
  const adminLoginReq = {
    method: 'POST',
    headers: {},
    body: { username: 'admin@exidebattery.com.np', password: 'NepalPowerHouse@2026' }
  };
  const adminLoginRes = mockRes();
  await adminLoginHandler(adminLoginReq, adminLoginRes);

  assert(adminLoginRes.statusCode === 200, 'SuperAdmin login returns HTTP 200');
  assert(adminLoginRes.data && adminLoginRes.data.token, 'SuperAdmin login returns signed staff token');
  const superAdminToken = adminLoginRes.data.token;

  // 5D. Verify SuperAdmin Token via admin-verify
  const adminVerifyReq = {
    method: 'GET',
    headers: { authorization: `Bearer ${superAdminToken}` },
    query: {}
  };
  const adminVerifyRes = mockRes();
  await adminVerifyHandler(adminVerifyReq, adminVerifyRes);

  assert(adminVerifyRes.statusCode === 200, 'SuperAdmin session verifies successfully on admin-verify endpoint');
  assert(adminVerifyRes.data && adminVerifyRes.data.admin.role === 'super_admin', 'Admin verify returns role = super_admin');

  // 5E. Authorized SuperAdmin creating a legitimate staff invitation
  const authInviteReq = {
    method: 'POST',
    headers: { authorization: `Bearer ${superAdminToken}` },
    body: { action: 'invite', email: 'warehouse.staff@exidebattery.com.np', role: 'inventory_manager' }
  };
  const authInviteRes = mockRes();
  await staffHandler(authInviteReq, authInviteRes);

  assert(authInviteRes.statusCode === 201, 'SuperAdmin successfully creates staff invitation (HTTP 201)');
  assert(authInviteRes.data && authInviteRes.data.invitation && authInviteRes.data.invitation.role === 'inventory_manager', 'Invitation issued with role = inventory_manager');

  // Summary
  console.log('\n======================================================');
  console.log(`🏁 AUTH SECURITY TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAuthSecurityTests().catch(err => {
  console.error('Security test failed:', err);
  process.exit(1);
});
