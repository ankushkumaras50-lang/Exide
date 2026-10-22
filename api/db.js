// Exide Battery Wholesale & AET Official Partner
// Persistent Database & Security Layer for Serverless Endpoints
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const INVITATIONS_FILE = path.join(DATA_DIR, 'invitations.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {
    console.warn('Unable to create data directory:', e.message);
  }
}

// Helper for safe JSON reading with fallback
function readJsonSafe(filePath, defaultVal) {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.warn(`Error reading ${filePath}:`, err.message);
  }
  return defaultVal;
}

// Helper for atomic writing
function writeJsonSafe(filePath, data) {
  try {
    const tempFile = filePath + '.tmp.' + Date.now();
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tempFile, filePath);
    return true;
  } catch (err) {
    console.warn(`Error writing ${filePath}:`, err.message);
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
      return true;
    } catch (e) {
      return false;
    }
  }
}

// Password Hashing with Salt & PBKDF2
function hashPassword(password, salt = null) {
  if (!salt) {
    salt = crypto.randomBytes(16).toString('hex');
  }
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

function verifyPassword(password, storedHash, storedSalt) {
  if (!password || !storedHash || !storedSalt) return false;
  const { hash } = hashPassword(password, storedSalt);
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(storedHash, 'hex'));
}

// --------------------------------------------------------------------------
// 1. PRODUCTS & INVENTORY
// --------------------------------------------------------------------------
function getProducts() {
  let products = readJsonSafe(PRODUCTS_FILE, null);
  if (!products || !Array.isArray(products) || products.length === 0) {
    try {
      const dataModule = require('../js/products-data.js');
      products = dataModule.INITIAL_PRODUCTS || [];
      writeJsonSafe(PRODUCTS_FILE, products);
    } catch (e) {
      products = [];
    }
  }
  return products;
}

function saveProducts(products) {
  return writeJsonSafe(PRODUCTS_FILE, products);
}

function getProductById(productId) {
  const products = getProducts();
  return products.find(p => p.id === productId) || null;
}

function decrementStock(productId, qtyToDeduct) {
  const products = getProducts();
  const prod = products.find(p => p.id === productId);
  if (!prod) return false;
  prod.stock = Math.max(0, (prod.stock || 0) - qtyToDeduct);
  saveProducts(products);
  return true;
}

// --------------------------------------------------------------------------
// 2. ORDERS & INVOICES
// --------------------------------------------------------------------------
function getOrders() {
  return readJsonSafe(ORDERS_FILE, []);
}

function saveOrder(order) {
  const orders = getOrders();
  const existingIdx = orders.findIndex(o => o.orderId === order.orderId || o.invoiceNumber === order.invoiceNumber);
  if (existingIdx >= 0) {
    orders[existingIdx] = order;
  } else {
    orders.unshift(order);
  }
  writeJsonSafe(ORDERS_FILE, orders);
  return order;
}

function findOrderById(orderIdOrInvoice) {
  const orders = getOrders();
  return orders.find(o => o.orderId === orderIdOrInvoice || o.invoiceNumber === orderIdOrInvoice) || null;
}

function generateInvoiceNumber() {
  const orders = getOrders();
  let maxSeq = 1000;
  orders.forEach(o => {
    if (o.invoiceNumber && o.invoiceNumber.startsWith('INV-2026-')) {
      const num = parseInt(o.invoiceNumber.replace('INV-2026-', ''), 10);
      if (!isNaN(num) && num > maxSeq) maxSeq = num;
    }
  });
  return `INV-2026-${String(maxSeq + 1).padStart(5, '0')}`;
}

// --------------------------------------------------------------------------
// 3. RBAC USERS & STAFF MANAGEMENT
// --------------------------------------------------------------------------
function getUsers() {
  let users = readJsonSafe(USERS_FILE, null);
  if (!users || !Array.isArray(users) || users.length === 0) {
    // Initialize default secure SuperAdmin and Staff accounts
    // Default initial password setup with high entropy salt
    const adminAuth = hashPassword('NepalPowerHouse@2026');
    const managerAuth = hashPassword('StoreManager@2026');
    const inventoryAuth = hashPassword('Inventory@2026');
    const riderAuth = hashPassword('RiderNepal@2026');

    users = [
      {
        id: 'USER-SUPERADMIN-001',
        username: 'admin@exidebattery.com.np',
        email: 'admin@exidebattery.com.np',
        fullName: 'Executive Super Administrator',
        role: 'SuperAdmin',
        permissions: ['*'],
        passwordHash: adminAuth.hash,
        passwordSalt: adminAuth.salt,
        phone: '9705997260',
        active: true,
        createdAt: new Date().toISOString()
      },
      {
        id: 'USER-MANAGER-001',
        username: 'manager@exidebattery.com.np',
        email: 'manager@exidebattery.com.np',
        fullName: 'Kathmandu Store General Manager',
        role: 'StoreManager',
        permissions: ['inventory_read', 'inventory_write', 'orders_all', 'logistics_manage', 'reports_view'],
        passwordHash: managerAuth.hash,
        passwordSalt: managerAuth.salt,
        phone: '9851000001',
        active: true,
        createdAt: new Date().toISOString()
      },
      {
        id: 'USER-INVENTORY-001',
        username: 'inventory@exidebattery.com.np',
        email: 'inventory@exidebattery.com.np',
        fullName: 'Central Warehouse Stock Controller',
        role: 'InventoryStaff',
        permissions: ['inventory_read', 'inventory_write', 'serials_verify', 'batch_adjust'],
        passwordHash: inventoryAuth.hash,
        passwordSalt: inventoryAuth.salt,
        phone: '9851000002',
        active: true,
        createdAt: new Date().toISOString()
      },
      {
        id: 'USER-RIDER-001',
        username: 'rider@exidebattery.com.np',
        email: 'rider@exidebattery.com.np',
        fullName: 'Bikram Shrestha (Lead Rider)',
        role: 'DeliveryRider',
        permissions: ['deliveries_assigned', 'payment_collect', 'status_update'],
        passwordHash: riderAuth.hash,
        passwordSalt: riderAuth.salt,
        phone: '9801234567',
        active: true,
        createdAt: new Date().toISOString()
      }
    ];
    writeJsonSafe(USERS_FILE, users);
  }
  return users;
}

function saveUsers(users) {
  return writeJsonSafe(USERS_FILE, users);
}

function findUserByUsernameOrEmail(identifier) {
  if (!identifier) return null;
  const clean = String(identifier).trim().toLowerCase();
  const users = getUsers();
  return users.find(u => 
    (u.username && u.username.toLowerCase() === clean) || 
    (u.email && u.email.toLowerCase() === clean) ||
    (u.phone && u.phone === clean.replace(/\D/g, ''))
  ) || null;
}

// --------------------------------------------------------------------------
// 4. STAFF INVITATIONS
// --------------------------------------------------------------------------
function getInvitations() {
  return readJsonSafe(INVITATIONS_FILE, []);
}

function createStaffInvitation(email, role, createdBy = 'SuperAdmin') {
  const invitations = getInvitations();
  const cleanEmail = email.trim().toLowerCase();
  const token = crypto.randomBytes(24).toString('hex');

  const newInvite = {
    id: 'INVITE-' + Date.now().toString(36).toUpperCase(),
    email: cleanEmail,
    role: role || 'InventoryStaff',
    token: token,
    createdBy: createdBy,
    status: 'pending', // 'pending' | 'accepted' | 'revoked'
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
  };

  // Replace any existing pending invite for this email
  const existingIdx = invitations.findIndex(i => i.email === cleanEmail && i.status === 'pending');
  if (existingIdx >= 0) {
    invitations[existingIdx] = newInvite;
  } else {
    invitations.push(newInvite);
  }

  writeJsonSafe(INVITATIONS_FILE, invitations);
  return newInvite;
}

function activateStaffInvitation(token, fullName, password, phone = '') {
  const invitations = getInvitations();
  const invite = invitations.find(i => i.token === token && i.status === 'pending');
  if (!invite) {
    return { success: false, message: 'Invalid or expired staff invitation link.' };
  }

  if (new Date(invite.expiresAt) < new Date()) {
    invite.status = 'expired';
    writeJsonSafe(INVITATIONS_FILE, invitations);
    return { success: false, message: 'This staff invitation has expired. Please contact your SuperAdmin.' };
  }

  const { hash, salt } = hashPassword(password);
  const users = getUsers();

  const newUser = {
    id: 'USER-' + Date.now().toString(36).toUpperCase(),
    username: invite.email,
    email: invite.email,
    fullName: fullName.trim(),
    role: invite.role,
    permissions: getRolePermissions(invite.role),
    passwordHash: hash,
    passwordSalt: salt,
    phone: phone.trim() || '98XXXXXXXX',
    active: true,
    createdAt: new Date().toISOString()
  };

  users.push(newUser);
  saveUsers(users);

  invite.status = 'accepted';
  invite.acceptedAt = new Date().toISOString();
  invite.userId = newUser.id;
  writeJsonSafe(INVITATIONS_FILE, invitations);

  return { success: true, user: newUser };
}

function getRolePermissions(role) {
  switch (role) {
    case 'SuperAdmin':
      return ['*'];
    case 'StoreManager':
      return ['inventory_read', 'inventory_write', 'orders_all', 'logistics_manage', 'reports_view'];
    case 'InventoryStaff':
      return ['inventory_read', 'inventory_write', 'serials_verify', 'batch_adjust'];
    case 'DeliveryRider':
      return ['deliveries_assigned', 'payment_collect', 'status_update'];
    case 'Customer':
    default:
      return ['orders_view_own', 'profile_manage'];
  }
}

module.exports = {
  getProducts,
  saveProducts,
  getProductById,
  decrementStock,
  getOrders,
  saveOrder,
  findOrderById,
  generateInvoiceNumber,
  getUsers,
  saveUsers,
  findUserByUsernameOrEmail,
  hashPassword,
  verifyPassword,
  getInvitations,
  createStaffInvitation,
  activateStaffInvitation,
  getRolePermissions
};
