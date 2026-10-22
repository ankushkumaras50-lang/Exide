// Vercel Serverless Function: Staff Invitations & RBAC Role Management
// Exide Battery Wholesale & AET Official Partner
const db = require('../db.js');

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

  const action = req.query.action || body.action || (req.method === 'GET' ? 'list' : '');

  try {
    // ------------------------------------------------------------------------
    // 1. LIST STAFF & INVITATIONS
    // ------------------------------------------------------------------------
    if (action === 'list' || req.method === 'GET') {
      const users = db.getUsers().map(u => ({
        id: u.id,
        username: u.username,
        email: u.email,
        fullName: u.fullName,
        role: u.role,
        permissions: u.permissions,
        phone: u.phone,
        active: u.active,
        createdAt: u.createdAt
      }));

      const invitations = db.getInvitations();

      return res.status(200).json({
        success: true,
        staff: users,
        invitations: invitations
      });
    }

    // ------------------------------------------------------------------------
    // 2. CREATE STAFF INVITATION
    // ------------------------------------------------------------------------
    if (action === 'invite') {
      const { email, role, createdBy } = body;
      if (!email || !email.includes('@')) {
        return res.status(400).json({ success: false, message: 'Valid email address is required.' });
      }

      const validRoles = ['SuperAdmin', 'StoreManager', 'InventoryStaff', 'DeliveryRider'];
      if (role && !validRoles.includes(role)) {
        return res.status(400).json({ success: false, message: 'Invalid staff role specified.' });
      }

      const invite = db.createStaffInvitation(email, role || 'InventoryStaff', createdBy || 'SuperAdmin');

      return res.status(201).json({
        success: true,
        message: `Staff invitation created for ${email}`,
        invitation: invite,
        activationLink: `/index.html?activate_invite=${invite.token}`
      });
    }

    // ------------------------------------------------------------------------
    // 3. ACTIVATE STAFF INVITATION
    // ------------------------------------------------------------------------
    if (action === 'activate') {
      const { token, fullName, password, phone } = body;
      if (!token || !fullName || !password) {
        return res.status(400).json({
          success: false,
          message: 'Invitation token, Full Name, and Password are required.'
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 6 characters long.'
        });
      }

      const result = db.activateStaffInvitation(token, fullName, password, phone);
      if (!result.success) {
        return res.status(400).json(result);
      }

      return res.status(200).json({
        success: true,
        message: 'Account activated successfully! You can now log in to the ERP portal.',
        user: {
          id: result.user.id,
          username: result.user.username,
          email: result.user.email,
          fullName: result.user.fullName,
          role: result.user.role
        }
      });
    }

    // ------------------------------------------------------------------------
    // 4. TOGGLE STAFF STATUS (Activate / Deactivate)
    // ------------------------------------------------------------------------
    if (action === 'toggle-status') {
      const { userId, active } = body;
      const users = db.getUsers();
      const user = users.find(u => u.id === userId);
      if (!user) {
        return res.status(404).json({ success: false, message: 'Staff member not found.' });
      }

      if (user.role === 'SuperAdmin') {
        return res.status(403).json({ success: false, message: 'Cannot deactivate the primary SuperAdmin account.' });
      }

      user.active = active !== undefined ? !!active : !user.active;
      db.saveUsers(users);

      return res.status(200).json({
        success: true,
        message: `Staff status updated to ${user.active ? 'Active' : 'Deactivated'}`,
        user: { id: user.id, username: user.username, active: user.active }
      });
    }

    return res.status(405).json({ success: false, message: 'Invalid action or method' });
  } catch (err) {
    console.error('Staff API Error:', err);
    return res.status(500).json({ success: false, message: 'Staff API server error: ' + err.message });
  }
};
