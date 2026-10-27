#!/usr/bin/env node
// Secure Administrative Provisioning Script
// Exide Battery Wholesale & AET Official Partner
// Usage: node scripts/seed-superadmin.js [email] [password] [phone] [fullName]

const db = require('../db/client.js');

const args = process.argv.slice(2);
const email = (args[0] || process.env.INITIAL_SUPERADMIN_EMAIL || 'admin@exidebattery.com.np').trim().toLowerCase();
const password = args[1] || process.env.INITIAL_SUPERADMIN_PASSWORD || 'NepalPowerHouse@2026';
const phone = (args[2] || '9705997260').replace(/\D/g, '').slice(-10);
const fullName = args[3] || 'Executive Super Administrator';

console.log('========================================================');
console.log('🔑 PROVISIONING SUPERADMINISTRATOR FOR EXIDE NEPAL ERP');
console.log('========================================================');

if (password.length < 8) {
  console.error('❌ Error: SuperAdmin password must be at least 8 characters long.');
  process.exit(1);
}

const existing = db.findProfileByEmail(email);
const { hash, salt } = db.hashPassword(password);

if (existing) {
  existing.role = 'super_admin';
  existing.fullName = fullName;
  existing.phone = phone;
  existing.passwordHash = hash;
  existing.passwordSalt = salt;
  existing.isActive = true;
  existing.isEmailVerified = true;
  existing.isPhoneVerified = true;
  db.saveProfile(existing);

  db.logAuditEvent(existing.id, 'SUPERADMIN_PROVISIONED_UPDATE', 'profiles', existing.id, null, { email, role: 'super_admin' });
  console.log(`✅ Existing account "${email}" elevated to SuperAdmin.`);
} else {
  const profile = db.createProfile({
    email,
    phone,
    fullName,
    password,
    role: 'super_admin',
    isEmailVerified: true,
    isPhoneVerified: true
  });

  db.logAuditEvent(profile.id, 'SUPERADMIN_PROVISIONED_NEW', 'profiles', profile.id, null, { email, role: 'super_admin' });
  console.log(`✅ New SuperAdmin provisioned successfully for "${email}".`);
}

console.log(`\nAccount Details:`);
console.log(`- Email / Username : ${email}`);
console.log(`- Role             : super_admin (Full capabilities '*')`);
console.log(`- Phone            : +977-${phone}`);
console.log(`- Status           : Active`);
console.log('========================================================\n');
