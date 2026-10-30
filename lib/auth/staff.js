// Vercel Serverless Function: Secure Staff Invitations & RBAC Role Management
// Exide Battery Wholesale & AET Official Partner
const crypto = require('crypto');
const db = require('../../db/client.js');
const { verifyJwt, extractToken } = require('./token.js');

const INVITATIONS_FILE = require('path').join(__dirname, '..', '..', 'data', 'invitations.json');

function getInvitations() {
  try {
    const fs = require('fs');
    if (fs.existsSync(INVITATIONS_FILE)) {
      return JSON.parse(fs.readFileSync(INVITATIONS_FILE, 'utf8'));
    }
  } catch (e) {}
  return [];
}

function saveInvitations(invites) {
  try {
    const fs = require('fs');
    fs.writeFileSync(INVITATIONS_FILE, JSON.stringify(invites, null, 2), 'utf8');
    return true;
  } catch (e) {
    return false;
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

  const query = req.query || {};
  const action = query.action || body.action || (req.method === 'GET' ? 'list' : '');

  try {
    // ------------------------------------------------------------------------
    // 1. ACTIVATE INVITATION (Public token link)
    // ------------------------------------------------------------------------
    if (action === 'activate') {
      const { token, fullName, password, phone } = body;
      if (!token || !fullName || !password) {
        return res.status(400).json({
          success: false,
          message: 'Invitation token, Full Name, and Password are required.'
        });
      }

      if (password.length < 8) {
        return res.status(400).json({
          success: false,
          message: 'Staff password must be at least 8 characters long.'
        });
      }

      const invitations = getInvitations();
      const invite = invitations.find(i => i.token === token && i.status === 'pending');
      if (!invite) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired staff invitation link.'
        });
      }

      if (new Date(invite.expiresAt) < new Date()) {
        invite.status = 'expired';
        saveInvitations(invitations);
        return res.status(400).json({
          success: false,
          message: 'This staff invitation has expired. Please contact your SuperAdmin.'
        });
      }

      // Check if profile already exists for this email
      let user = db.findProfileByEmail(invite.email);
      if (user) {
        // Upgrade existing user to staff role
        const hashed = db.hashPassword(password);
        user.fullName = fullName.trim();
        user.role = invite.role;
        user.passwordHash = hashed.hash;
        user.passwordSalt = hashed.salt;
        if (phone) user.phone = phone.replace(/\D/g, '').slice(-10);
        user.isActive = true;
        db.saveProfile(user);
      } else {
        user = db.createProfile({
          email: invite.email,
          fullName: fullName.trim(),
          password: password,
          phone: phone ? phone.replace(/\D/g, '').slice(-10) : null,
          role: invite.role,
          authProvider: 'local',
          isEmailVerified: true
        });
      }

      invite.status = 'accepted';
      invite.acceptedAt = new Date().toISOString();
      invite.userId = user.id;
      saveInvitations(invitations);

      db.logAuditEvent(user.id, 'STAFF_INVITATION_ACTIVATED', 'profiles', user.id, null, { email: invite.email, role: invite.role });

      return res.status(200).json({
        success: true,
        message: 'Account activated successfully! You can now log in to the ERP portal.',
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role
        }
      });
    }

    // ------------------------------------------------------------------------
    // MANDATORY AUTHENTICATION CHECK FOR ADMIN OPERATIONS
    // ------------------------------------------------------------------------
    const callerToken = extractToken(req);
    const session = verifyJwt(callerToken, true);

    if (!session || !session.userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Only authorized staff may access this endpoint.'
      });
    }

    const callerRole = db.normalizeRole(session.role);
    const isSuperAdmin = callerRole === 'super_admin';

    // ------------------------------------------------------------------------
    // 2. LIST STAFF & INVITATIONS
    // ------------------------------------------------------------------------
    if (action === 'list' || req.method === 'GET') {
      const allProfiles = db.getProfiles();
      const staffList = allProfiles
        .filter(p => ['super_admin', 'inventory_manager', 'sales_staff', 'accountant', 'delivery_rider', 'viewer'].includes(db.normalizeRole(p.role)))
        .map(u => ({
          id: u.id,
          email: u.email,
          fullName: u.fullName,
          role: db.normalizeRole(u.role),
          permissions: db.ROLE_PERMISSIONS[db.normalizeRole(u.role)] || [],
          phone: u.phone,
          active: u.isActive !== false,
          createdAt: u.createdAt
        }));

      const invitations = isSuperAdmin ? getInvitations() : [];

      return res.status(200).json({
        success: true,
        staff: staffList,
        invitations: invitations
      });
    }

    // ------------------------------------------------------------------------
    // 3. CREATE STAFF INVITATION (Strict Authorization)
    // ------------------------------------------------------------------------
    if (action === 'invite') {
      const { email, role } = body;
      if (!email || !email.includes('@')) {
        return res.status(400).json({ success: false, message: 'Valid email address is required.' });
      }

      const validRoles = ['super_admin', 'inventory_manager', 'sales_staff', 'accountant', 'delivery_rider', 'viewer'];
      const targetRole = db.normalizeRole(role || 'inventory_manager');

      if (!validRoles.includes(targetRole)) {
        return res.status(400).json({ success: false, message: 'Invalid staff role specified.' });
      }

      // Security Check: Only SuperAdmin can invite other SuperAdmins or Accountants
      if (targetRole === 'super_admin' && !isSuperAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Permission denied. Only SuperAdmin can invite administrative accounts.'
        });
      }

      // General staff invitations require SuperAdmin or StoreManager
      if (!isSuperAdmin && callerRole !== 'inventory_manager') {
        return res.status(403).json({
          success: false,
          message: 'Permission denied. You do not possess staff invitation privileges.'
        });
      }

      const cleanEmail = email.trim().toLowerCase();
      const invitations = getInvitations();
      const token = crypto.randomBytes(24).toString('hex');

      const newInvite = {
        id: 'INVITE-' + Date.now().toString(36).toUpperCase(),
        email: cleanEmail,
        role: targetRole,
        token: token,
        createdBy: session.userId,
        status: 'pending',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
      };

      const existingIdx = invitations.findIndex(i => i.email === cleanEmail && i.status === 'pending');
      if (existingIdx >= 0) {
        invitations[existingIdx] = newInvite;
      } else {
        invitations.push(newInvite);
      }

      saveInvitations(invitations);

      db.logAuditEvent(session.userId, 'CREATE_STAFF_INVITATION', 'staff_invitations', newInvite.id, null, { email: cleanEmail, role: targetRole });

      return res.status(201).json({
        success: true,
        message: `Staff invitation created for ${cleanEmail} as ${targetRole}`,
        invitation: newInvite,
        activationLink: `/erp/login?activate_invite=${newInvite.token}`
      });
    }

    // ------------------------------------------------------------------------
    // 4. TOGGLE STAFF STATUS (Strictly SuperAdmin)
    // ------------------------------------------------------------------------
    if (action === 'toggle-status') {
      if (!isSuperAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Permission denied. Only SuperAdmin can modify staff active status.'
        });
      }

      const { userId, active } = body;
      const profile = db.findProfileById(userId);
      if (!profile) {
        return res.status(404).json({ success: false, message: 'Staff member not found.' });
      }

      if (profile.id === session.userId) {
        return res.status(403).json({ success: false, message: 'Cannot deactivate your own active SuperAdmin account.' });
      }

      profile.isActive = active !== undefined ? !!active : !profile.isActive;
      db.saveProfile(profile);

      db.logAuditEvent(session.userId, 'TOGGLE_STAFF_STATUS', 'profiles', profile.id, null, { isActive: profile.isActive });

      return res.status(200).json({
        success: true,
        message: `Staff account status updated to ${profile.isActive ? 'Active' : 'Deactivated'}`,
        user: { id: profile.id, email: profile.email, active: profile.isActive }
      });
    }

    // ------------------------------------------------------------------------
    // 5. DIRECT STAFF ASSIGNMENT (Name, Username, Role, Password)
    // ------------------------------------------------------------------------
    if (action === 'create' || action === 'assign') {
      if (!isSuperAdmin && callerRole !== 'inventory_manager') {
        return res.status(403).json({
          success: false,
          message: 'Permission denied. Only SuperAdmin and Store Managers can assign new staff.'
        });
      }

      const { fullName, username, email, phone, role, password } = body;

      if (!fullName || !password) {
        return res.status(400).json({
          success: false,
          message: 'Full Name and Password are required to assign a staff member.'
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Staff password must be at least 6 characters.'
        });
      }

      const validRoles = ['super_admin', 'inventory_manager', 'sales_staff', 'accountant', 'delivery_rider', 'viewer'];
      const targetRole = db.normalizeRole(role || 'sales_staff');

      if (!validRoles.includes(targetRole)) {
        return res.status(400).json({ success: false, message: 'Invalid staff role specified.' });
      }

      if (targetRole === 'super_admin' && !isSuperAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Permission denied. Only SuperAdmin can create SuperAdmin accounts.'
        });
      }

      const cleanUser = username ? String(username).trim().toLowerCase() : (email ? email.split('@')[0].toLowerCase() : `staff_${Date.now().toString(36)}`);
      const cleanEmail = email ? String(email).trim().toLowerCase() : `${cleanUser}@staff.exidebattery.com.np`;
      const cleanPhone = phone ? String(phone).replace(/\D/g, '').slice(-10) : null;

      // Check for duplicate username or email
      const allProfiles = db.getProfiles();
      const existing = allProfiles.find(p => 
        (p.username && p.username.toLowerCase() === cleanUser) ||
        (cleanEmail && p.email && p.email.toLowerCase() === cleanEmail)
      );

      if (existing) {
        return res.status(400).json({
          success: false,
          message: `An account with this username (${cleanUser}) or email already exists.`
        });
      }

      const newStaff = db.createProfile({
        fullName: fullName.trim(),
        username: cleanUser,
        email: cleanEmail,
        phone: cleanPhone,
        role: targetRole,
        password: password,
        authProvider: 'local',
        isEmailVerified: true,
        isPhoneVerified: true
      });

      // Ensure username is explicitly persisted
      newStaff.username = cleanUser;
      db.saveProfile(newStaff);

      db.logAuditEvent(session.userId, 'STAFF_USER_ASSIGNED', 'profiles', newStaff.id, null, {
        username: cleanUser,
        fullName: fullName.trim(),
        role: targetRole,
        assignedBy: session.userId
      });

      return res.status(201).json({
        success: true,
        message: `Staff member ${fullName.trim()} (@${cleanUser}) successfully assigned as ${targetRole}!`,
        staff: {
          id: newStaff.id,
          fullName: newStaff.fullName,
          username: newStaff.username,
          email: newStaff.email,
          phone: newStaff.phone,
          role: newStaff.role,
          active: true
        }
      });
    }

    return res.status(405).json({ success: false, message: 'Invalid action or method' });
  } catch (err) {
    console.error('Staff API Error:', err);
    return res.status(500).json({ success: false, message: 'Staff API server error: ' + err.message });
  }
};
