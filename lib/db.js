// Exide Battery Wholesale & AET Official Partner
// Database Proxy Layer for Backward-Compatible Serverless Imports
// Delegates directly to authoritative db/client.js
const client = require('../db/client.js');

module.exports = {
  // Products & Inventory
  getProducts: client.getProducts,
  saveProducts: client.saveProducts,
  getProductById: client.getProductById,
  decrementStock: (productId, qtyToDeduct) => {
    try {
      client.executeStockMovement(productId, 'wh-ktm-central', 'SALES_DEDUCTION', -Math.abs(qtyToDeduct), 'SALES_ORDER', 'legacy', 'Checkout stock deduction', 'system');
      return true;
    } catch (e) {
      return false;
    }
  },

  // Orders & Invoicing
  getOrders: client.getOrders,
  saveOrder: (order) => {
    const orders = client.getOrders();
    const target = order.orderId || order.id;
    const existingIdx = orders.findIndex(o => 
      (target && (o.orderId === target || o.id === target)) || 
      (order.invoiceNumber && o.invoiceNumber === order.invoiceNumber)
    );
    if (existingIdx >= 0) {
      orders[existingIdx] = { ...orders[existingIdx], ...order };
    } else {
      orders.unshift(order);
    }
    client.saveOrders(orders);
    return orders[existingIdx >= 0 ? existingIdx : 0];
  },
  findOrderById: client.findOrderById,
  generateInvoiceNumber: client.generateInvoiceNumber,

  // RBAC Users & Staff Profiles
  getUsers: () => client.getProfiles().map(p => ({
    id: p.id,
    username: p.email || p.phone,
    email: p.email,
    fullName: p.fullName,
    role: client.normalizeRole(p.role) === 'super_admin' ? 'SuperAdmin' :
          client.normalizeRole(p.role) === 'inventory_manager' ? 'StoreManager' :
          client.normalizeRole(p.role) === 'delivery_rider' ? 'DeliveryRider' : 'Customer',
    permissions: client.ROLE_PERMISSIONS[client.normalizeRole(p.role)] || ['*'],
    passwordHash: p.passwordHash,
    passwordSalt: p.passwordSalt,
    phone: p.phone,
    active: p.isActive !== false,
    createdAt: p.createdAt
  })),
  saveUsers: (users) => {
    users.forEach(u => {
      let existing = client.findProfileById(u.id);
      if (existing) {
        existing = { ...existing, ...u };
        client.saveProfile(existing);
      }
    });
    return true;
  },
  findUserByUsernameOrEmail: (identifier) => {
    const profile = client.findProfileByIdentifier(identifier);
    if (!profile) return null;
    return {
      id: profile.id,
      username: profile.email || profile.phone,
      email: profile.email,
      fullName: profile.fullName,
      role: client.normalizeRole(profile.role) === 'super_admin' ? 'SuperAdmin' :
            client.normalizeRole(profile.role) === 'inventory_manager' ? 'StoreManager' :
            client.normalizeRole(profile.role) === 'delivery_rider' ? 'DeliveryRider' : 'Customer',
      permissions: client.ROLE_PERMISSIONS[client.normalizeRole(profile.role)] || ['*'],
      passwordHash: profile.passwordHash,
      passwordSalt: profile.passwordSalt,
      phone: profile.phone,
      active: profile.isActive !== false,
      createdAt: profile.createdAt
    };
  },

  // Password Hashing
  hashPassword: client.hashPassword,
  verifyPassword: client.verifyPassword,

  // Staff Invitations & Permissions
  getRolePermissions: (role) => client.ROLE_PERMISSIONS[client.normalizeRole(role)] || ['records_read']
};
