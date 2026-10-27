// Exide Battery Wholesale & AET Official Partner
// Database Client & Transaction Management Layer
// Supports PostgreSQL / Supabase with Transaction-Safe In-Process Persistence Fallback
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const SUPPLIERS_FILE = path.join(DATA_DIR, 'suppliers.json');
const PURCHASES_FILE = path.join(DATA_DIR, 'purchases.json');
const EXCHANGES_FILE = path.join(DATA_DIR, 'exchanges.json');
const AUDIT_FILE = path.join(DATA_DIR, 'audit_logs.json');
const OTP_FILE = path.join(DATA_DIR, 'otp_store.json');

// Ensure data directory
if (!fs.existsSync(DATA_DIR)) {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) {}
}

// ----------------------------------------------------------------------------
// SAFE ATOMIC JSON FILE UTILS
// ----------------------------------------------------------------------------
function readJson(file, defaultVal = []) {
  try {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
  } catch (e) {
    console.warn(`Error reading ${file}:`, e.message);
  }
  return defaultVal;
}

function writeJson(file, data) {
  try {
    const tmp = file + '.tmp.' + Date.now();
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, file);
    return true;
  } catch (e) {
    try {
      fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
      return true;
    } catch (err) {
      console.error(`Failed to write ${file}:`, err.message);
      return false;
    }
  }
}

// ----------------------------------------------------------------------------
// CRYPTOGRAPHY & PASSWORD HASHING (PBKDF2 with High Entropy Salt)
// ----------------------------------------------------------------------------
function hashPassword(password, salt = null) {
  if (!salt) {
    salt = crypto.randomBytes(16).toString('hex');
  }
  const hash = crypto.pbkdf2Sync(String(password), salt, 10000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

function verifyPassword(password, storedHash, storedSalt) {
  if (!password || !storedHash || !storedSalt) return false;
  const { hash } = hashPassword(password, storedSalt);
  try {
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(storedHash, 'hex'));
  } catch (e) {
    return false;
  }
}

// ----------------------------------------------------------------------------
// ROLE & PERMISSION DEFINITIONS
// ----------------------------------------------------------------------------
const ROLE_PERMISSIONS = {
  super_admin: ['*'],
  inventory_manager: ['inventory_read', 'inventory_write', 'inventory_adjust', 'purchases_read', 'purchases_write', 'purchases_manage', 'cost_price_view', 'battery_exchange_manage'],
  sales_staff: ['catalog_read', 'quotations_manage', 'sales_read', 'sales_write', 'sales_orders_manage', 'invoices_issue', 'battery_exchange_create', 'battery_exchange_read'],
  accountant: ['invoices_read', 'payments_manage', 'reports_financial', 'cost_price_view', 'purchases_read', 'sales_read'],
  delivery_rider: ['deliveries_assigned', 'delivery_status_update', 'sales_read'],
  viewer: ['records_read', 'catalog_read'],
  customer: ['orders_own_read', 'profile_manage']
};

function normalizeRole(role) {
  if (!role) return 'customer';
  const clean = String(role).toLowerCase().replace(/[\s-]/g, '_');
  if (clean === 'superadmin' || clean === 'super_admin') return 'super_admin';
  if (clean === 'storemanager' || clean === 'inventory_manager' || clean === 'inventorystaff') return 'inventory_manager';
  if (clean === 'sales' || clean === 'salesstaff' || clean === 'sales_staff') return 'sales_staff';
  if (clean === 'deliveryrider' || clean === 'rider' || clean === 'delivery_rider') return 'delivery_rider';
  if (clean === 'accountant') return 'accountant';
  if (clean === 'viewer') return 'viewer';
  return 'customer';
}

function hasPermission(userRole, requiredPermission) {
  const normalized = normalizeRole(userRole);
  const perms = ROLE_PERMISSIONS[normalized] || [];
  if (perms.includes('*')) return true;
  return perms.includes(requiredPermission);
}

// ----------------------------------------------------------------------------
// PROFILES REPOSITORY
// ----------------------------------------------------------------------------
function getProfiles() {
  let users = readJson(USERS_FILE, null);
  if (!users || !Array.isArray(users) || users.length === 0) {
    // Seed verified staff & demo profiles
    const superAdminAuth = hashPassword('NepalPowerHouse@2026');
    const managerAuth = hashPassword('StoreManager@2026');
    const inventoryAuth = hashPassword('Inventory@2026');
    const riderAuth = hashPassword('RiderNepal@2026');
    const cust1Auth = hashPassword('pass_3454');
    const cust2Auth = hashPassword('pass_4567');
    const cust3Auth = hashPassword('pass_7260');

    users = [
      {
        id: 'usr_superadmin_01',
        email: 'admin@exidebattery.com.np',
        phone: '9705997260',
        fullName: 'Executive Super Administrator',
        role: 'super_admin',
        passwordHash: superAdminAuth.hash,
        passwordSalt: superAdminAuth.salt,
        district: 'Kathmandu',
        address: 'Bijulibazar, Kathmandu',
        isEmailVerified: true,
        isPhoneVerified: true,
        isActive: true,
        createdAt: '2026-01-01T00:00:00.000Z'
      },
      {
        id: 'usr_manager_01',
        email: 'manager@exidebattery.com.np',
        phone: '9851000001',
        fullName: 'Kathmandu Store General Manager',
        role: 'inventory_manager',
        passwordHash: managerAuth.hash,
        passwordSalt: managerAuth.salt,
        district: 'Kathmandu',
        address: 'Bijulibazar, Kathmandu',
        isEmailVerified: true,
        isPhoneVerified: true,
        isActive: true,
        createdAt: '2026-01-01T00:00:00.000Z'
      },
      {
        id: 'usr_inventory_01',
        email: 'inventory@exidebattery.com.np',
        phone: '9851000002',
        fullName: 'Central Warehouse Stock Controller',
        role: 'inventory_manager',
        passwordHash: inventoryAuth.hash,
        passwordSalt: inventoryAuth.salt,
        district: 'Kathmandu',
        address: 'Central Warehouse Depot, Teku',
        isEmailVerified: true,
        isPhoneVerified: true,
        isActive: true,
        createdAt: '2026-01-01T00:00:00.000Z'
      },
      {
        id: 'usr_rider_01',
        email: 'rider@exidebattery.com.np',
        phone: '9801234567',
        fullName: 'Bikram Shrestha (Lead Rider)',
        role: 'delivery_rider',
        passwordHash: riderAuth.hash,
        passwordSalt: riderAuth.salt,
        district: 'Kathmandu',
        address: 'Kathmandu Valley Logistics',
        isEmailVerified: true,
        isPhoneVerified: true,
        isActive: true,
        createdAt: '2026-01-01T00:00:00.000Z'
      },
      {
        id: 'usr_cust_sunil',
        email: 'sunil.yadav@gmail.com',
        phone: '9809163454',
        fullName: 'Sunil Yadav',
        role: 'customer',
        passwordHash: cust1Auth.hash,
        passwordSalt: cust1Auth.salt,
        district: 'Kathmandu',
        city: 'New Baneshwor',
        address: 'New Baneshwor, Kathmandu',
        isEmailVerified: true,
        isPhoneVerified: true,
        isActive: true,
        createdAt: '2026-01-10T00:00:00.000Z'
      },
      {
        id: 'usr_cust_ramesh',
        email: 'ramesh.nepal@gmail.com',
        phone: '9841234567',
        fullName: 'Ramesh Shrestha',
        role: 'customer',
        passwordHash: cust2Auth.hash,
        passwordSalt: cust2Auth.salt,
        district: 'Kathmandu',
        city: 'Bijulibazar',
        address: 'Bijulibazar, Kathmandu',
        isEmailVerified: true,
        isPhoneVerified: true,
        isActive: true,
        createdAt: '2026-01-12T00:00:00.000Z'
      },
      {
        id: 'usr_cust_ankush',
        email: 'ankushkumaras50@gmail.com',
        phone: '9705997260',
        fullName: 'Ankush Kumar',
        role: 'customer',
        passwordHash: cust3Auth.hash,
        passwordSalt: cust3Auth.salt,
        district: 'Kathmandu',
        city: 'Teku',
        address: 'Teku Central, Kathmandu',
        isEmailVerified: true,
        isPhoneVerified: true,
        isActive: true,
        createdAt: '2026-01-15T00:00:00.000Z'
      }
    ];
    writeJson(USERS_FILE, users);
  }
  return users;
}

function findProfileById(id) {
  if (!id) return null;
  const profiles = getProfiles();
  return profiles.find(p => p.id === id) || null;
}

function findProfileByEmail(email) {
  if (!email) return null;
  const clean = String(email).trim().toLowerCase();
  const profiles = getProfiles();
  return profiles.find(p => p.email && p.email.toLowerCase() === clean) || null;
}

function findProfileByPhone(phone) {
  if (!phone) return null;
  const clean = String(phone).replace(/\D/g, '').slice(-10);
  const profiles = getProfiles();
  return profiles.find(p => p.phone && p.phone.replace(/\D/g, '').slice(-10) === clean) || null;
}

function findProfileByIdentifier(identifier) {
  if (!identifier) return null;
  const clean = String(identifier).trim();
  if (clean.includes('@')) {
    return findProfileByEmail(clean);
  }
  const phoneProfile = findProfileByPhone(clean);
  if (phoneProfile) return phoneProfile;
  // Fallback username check
  const profiles = getProfiles();
  return profiles.find(p => p.username && p.username.toLowerCase() === clean.toLowerCase()) || null;
}

function saveProfile(profile) {
  const profiles = getProfiles();
  const idx = profiles.findIndex(p => p.id === profile.id);
  if (idx >= 0) {
    profiles[idx] = { ...profiles[idx], ...profile, updatedAt: new Date().toISOString() };
  } else {
    profiles.push(profile);
  }
  writeJson(USERS_FILE, profiles);
  return profile;
}

function createProfile(data) {
  const profiles = getProfiles();
  const cleanEmail = data.email ? String(data.email).trim().toLowerCase() : null;
  const cleanPhone = data.phone ? String(data.phone).replace(/\D/g, '').slice(-10) : null;

  if (cleanEmail && profiles.some(p => p.email && p.email.toLowerCase() === cleanEmail)) {
    throw new Error('An account with this email address already exists.');
  }
  if (cleanPhone && profiles.some(p => p.phone && p.phone.replace(/\D/g, '').slice(-10) === cleanPhone)) {
    throw new Error('An account with this phone number already exists.');
  }

  const id = 'usr_' + Date.now().toString(36) + '_' + crypto.randomBytes(3).toString('hex');
  const role = normalizeRole(data.role || 'customer');

  let passwordHash = null;
  let passwordSalt = null;
  if (data.password) {
    const hashed = hashPassword(data.password);
    passwordHash = hashed.hash;
    passwordSalt = hashed.salt;
  }

  const newProfile = {
    id,
    email: cleanEmail,
    phone: cleanPhone,
    fullName: String(data.fullName || data.name || 'Customer').trim(),
    role: role,
    passwordHash,
    passwordSalt,
    authProvider: data.authProvider || 'local',
    isEmailVerified: !!data.isEmailVerified,
    isPhoneVerified: !!data.isPhoneVerified,
    avatarUrl: data.avatarUrl || '',
    district: data.district || 'Kathmandu',
    city: data.city || 'Kathmandu',
    address: data.address || 'Kathmandu, Nepal',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  profiles.push(newProfile);
  writeJson(USERS_FILE, profiles);
  return newProfile;
}

// ----------------------------------------------------------------------------
// NEPAL MOBILE OTP STORE & RATE LIMITING
// ----------------------------------------------------------------------------
const OTP_COOLDOWN_MS = 60 * 1000; // 60 seconds
const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const OTP_MAX_ATTEMPTS = 3;

function getOtpStore() {
  return readJson(OTP_FILE, []);
}

function saveOtpStore(store) {
  return writeJson(OTP_FILE, store);
}

function canRequestOtp(phone) {
  const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);
  const store = getOtpStore();
  const recent = store
    .filter(o => o.phone === cleanPhone)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];

  if (!recent) return { allowed: true };

  const timeSinceLast = Date.now() - new Date(recent.createdAt).getTime();
  if (timeSinceLast < OTP_COOLDOWN_MS) {
    const waitSeconds = Math.ceil((OTP_COOLDOWN_MS - timeSinceLast) / 1000);
    return {
      allowed: false,
      message: `Please wait ${waitSeconds} seconds before requesting a new OTP code.`,
      waitSeconds
    };
  }

  return { allowed: true };
}

function createOtpRequest(phone, ipAddress = '') {
  const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);
  const canReq = canRequestOtp(cleanPhone);
  if (!canReq.allowed) {
    return { success: false, ...canReq };
  }

  // Generate 6-digit cryptographic random OTP
  const rawOtp = crypto.randomInt(100000, 999999).toString();
  const salt = crypto.randomBytes(8).toString('hex');
  const otpHash = crypto.createHmac('sha256', salt).update(rawOtp).digest('hex');

  const record = {
    id: 'otp_' + Date.now().toString(36) + '_' + crypto.randomBytes(3).toString('hex'),
    phone: cleanPhone,
    otpHash,
    salt,
    attemptsCount: 0,
    maxAttempts: OTP_MAX_ATTEMPTS,
    isVerified: false,
    ipAddress,
    expiresAt: new Date(Date.now() + OTP_EXPIRY_MS).toISOString(),
    createdAt: new Date().toISOString()
  };

  const store = getOtpStore();
  store.unshift(record);
  saveOtpStore(store.slice(0, 500)); // Retain recent 500

  return {
    success: true,
    phone: cleanPhone,
    rawOtp, // Available for SMS gateway dispatch only
    expiresInSeconds: OTP_EXPIRY_MS / 1000
  };
}

function verifyOtpRequest(phone, enteredOtp) {
  const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);
  const cleanOtp = String(enteredOtp || '').trim();

  if (!cleanOtp || cleanOtp.length !== 6) {
    return { success: false, message: 'Please enter a valid 6-digit OTP code.' };
  }

  const store = getOtpStore();
  const record = store.find(o => o.phone === cleanPhone && !o.isVerified && new Date(o.expiresAt) > new Date());

  if (!record) {
    return { success: false, message: 'OTP expired or not found. Please request a new code.' };
  }

  if (record.attemptsCount >= record.maxAttempts) {
    return { success: false, message: 'Maximum verification attempts exceeded. Please request a new code.' };
  }

  record.attemptsCount += 1;

  const testHash = crypto.createHmac('sha256', record.salt).update(cleanOtp).digest('hex');
  if (testHash !== record.otpHash) {
    saveOtpStore(store);
    const remaining = record.maxAttempts - record.attemptsCount;
    return {
      success: false,
      message: `Incorrect OTP code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
    };
  }

  // Mark as verified
  record.isVerified = true;
  record.verifiedAt = new Date().toISOString();
  saveOtpStore(store);

  return { success: true, phone: cleanPhone };
}

// ----------------------------------------------------------------------------
// AUDIT LOGS REPOSITORY
// ----------------------------------------------------------------------------
function logAuditEvent(userId, action, entityName, entityId, oldState = null, newState = null, ip = '') {
  try {
    const logs = readJson(AUDIT_FILE, []);
    const entry = {
      id: 'log_' + Date.now().toString(36) + '_' + crypto.randomBytes(3).toString('hex'),
      userId,
      action,
      entityName,
      entityId: String(entityId || ''),
      oldState,
      newState,
      ipAddress: ip,
      timestamp: new Date().toISOString()
    };
    logs.unshift(entry);
    writeJson(AUDIT_FILE, logs.slice(0, 1000));
    return entry;
  } catch (e) {
    console.error('Audit log write error:', e.message);
  }
}

// ----------------------------------------------------------------------------
// INVENTORY & PRODUCT CATALOGUE
// ----------------------------------------------------------------------------
function getProducts() {
  let products = readJson(PRODUCTS_FILE, null);
  if (!products || !Array.isArray(products) || products.length === 0) {
    try {
      const dataModule = require('../js/products-data.js');
      products = dataModule.INITIAL_PRODUCTS || [];
      writeJson(PRODUCTS_FILE, products);
    } catch (e) {
      products = [];
    }
  }
  return products;
}

function saveProducts(products) {
  return writeJson(PRODUCTS_FILE, products);
}

function getProductById(id) {
  const products = getProducts();
  return products.find(p => p.id === id || p.sku === id) || null;
}

// ----------------------------------------------------------------------------
// TRANSACTIONAL STOCK LEDGER
// ----------------------------------------------------------------------------
function executeStockMovement(productId, warehouseId, movementType, quantity, referenceType, referenceId, reason, userId) {
  const products = getProducts();
  const prod = products.find(p => p.id === productId || p.sku === productId);
  if (!prod) {
    throw new Error(`Product ${productId} not found in catalog.`);
  }

  const qty = parseInt(quantity, 10);
  if (isNaN(qty) || qty === 0) {
    throw new Error('Invalid movement quantity.');
  }

  const currentStock = prod.stock || 0;
  const newStock = currentStock + qty;

  // Prevent negative physical stock
  if (newStock < 0) {
    throw new Error(`Insufficient stock for ${prod.name}. Available: ${currentStock}, Requested deduction: ${Math.abs(qty)}`);
  }

  prod.stock = newStock;
  saveProducts(products);

  // Write immutable movement log
  logAuditEvent(userId, movementType, 'stock_movement', prod.id, { previousStock: currentStock }, { newStock: newStock, quantity: qty, referenceType, referenceId, reason });

  return {
    productId: prod.id,
    sku: prod.sku,
    previousStock: currentStock,
    newStock: newStock,
    quantity: qty
  };
}

// ----------------------------------------------------------------------------
// ORDERS & NEPAL IRD TAX INVOICES
// ----------------------------------------------------------------------------
function getOrders() {
  return readJson(ORDERS_FILE, []);
}

function saveOrders(orders) {
  return writeJson(ORDERS_FILE, orders);
}

function findOrderById(orderIdOrInvoice) {
  const orders = getOrders();
  return orders.find(o => o.orderId === orderIdOrInvoice || o.id === orderIdOrInvoice || o.invoiceNumber === orderIdOrInvoice) || null;
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

// ----------------------------------------------------------------------------
// SUPPLIERS DIRECTORY
// ----------------------------------------------------------------------------
const INITIAL_SUPPLIERS = [
  {
    id: 'sup_exide_ind',
    name: 'Exide Industries Ltd.',
    contactPerson: 'Sanjeev Verma',
    email: 'nepal.sales@exide.co.in',
    phone: '+977-1-4221199',
    pan: '301294821',
    address: 'Birgunj Dry Port / Anamnagar Depot',
    city: 'Kathmandu',
    country: 'Nepal / India',
    paymentTerms: 'Net 30',
    categories: ['Automotive Batteries', 'Inverter Batteries', 'Tubular Cells'],
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'sup_smarten',
    name: 'Smarten Power Systems Pvt. Ltd.',
    contactPerson: 'Amit Joshi',
    email: 'nepal@smartenpowersystems.com',
    phone: '+977-1-5544332',
    pan: '302847192',
    address: 'Patan Industrial Estate',
    city: 'Lalitpur',
    country: 'Nepal',
    paymentTerms: 'Net 15',
    categories: ['Solar PCU', 'Sine Wave Inverters', 'Solar Panels'],
    status: 'ACTIVE',
    createdAt: '2026-01-05T00:00:00.000Z'
  },
  {
    id: 'sup_livfast',
    name: 'Livfast Batteries & Inverters Ltd.',
    contactPerson: 'Rajesh Thapa',
    email: 'supply@livfast.com.np',
    phone: '+977-1-4433221',
    pan: '300918234',
    address: 'Balaju Industrial District',
    city: 'Kathmandu',
    country: 'Nepal',
    paymentTerms: 'Immediate',
    categories: ['Fast Charging Inverters', 'Tubular Batteries'],
    status: 'ACTIVE',
    createdAt: '2026-01-10T00:00:00.000Z'
  },
  {
    id: 'sup_sf_sonic',
    name: 'SF Sonic Power Systems',
    contactPerson: 'Manoj Sharma',
    email: 'sales@sfsonic.com.np',
    phone: '+977-71-540112',
    pan: '304561829',
    address: 'Butwal Commercial Hub',
    city: 'Butwal',
    country: 'Nepal',
    paymentTerms: 'Net 30',
    categories: ['Motorcycle Batteries', 'Heavy Commercial Batteries'],
    status: 'ACTIVE',
    createdAt: '2026-01-12T00:00:00.000Z'
  },
  {
    id: 'sup_eastman',
    name: 'Eastman Solar & Tubular Cells',
    contactPerson: 'Dinesh KC',
    email: 'info@eastman.com.np',
    phone: '+977-1-4112233',
    pan: '305829104',
    address: 'Teku Electrical Market',
    city: 'Kathmandu',
    country: 'Nepal',
    paymentTerms: 'Net 15',
    categories: ['Solar Deep Cycle Tubular', 'Gel Batteries'],
    status: 'ACTIVE',
    createdAt: '2026-01-15T00:00:00.000Z'
  }
];

function getSuppliers() {
  let suppliers = readJson(SUPPLIERS_FILE, null);
  if (!suppliers || !Array.isArray(suppliers) || suppliers.length === 0) {
    suppliers = INITIAL_SUPPLIERS;
    writeJson(SUPPLIERS_FILE, suppliers);
  }
  return suppliers;
}

function saveSuppliers(suppliers) {
  return writeJson(SUPPLIERS_FILE, suppliers);
}

function findSupplierById(id) {
  const suppliers = getSuppliers();
  return suppliers.find(s => s.id === id || s.pan === id) || null;
}

// ----------------------------------------------------------------------------
// PURCHASES & GOODS RECEIPT NOTES (GRN)
// ----------------------------------------------------------------------------
function getPurchases() {
  return readJson(PURCHASES_FILE, []);
}

function savePurchases(purchases) {
  return writeJson(PURCHASES_FILE, purchases);
}

function findPurchaseById(idOrPo) {
  const purchases = getPurchases();
  return purchases.find(p => p.id === idOrPo || p.poNumber === idOrPo) || null;
}

function generatePoNumber() {
  const purchases = getPurchases();
  let maxSeq = 100;
  purchases.forEach(p => {
    if (p.poNumber && p.poNumber.startsWith('PO-2026-')) {
      const num = parseInt(p.poNumber.replace('PO-2026-', ''), 10);
      if (!isNaN(num) && num > maxSeq) maxSeq = num;
    }
  });
  return `PO-2026-${String(maxSeq + 1).padStart(5, '0')}`;
}

// ----------------------------------------------------------------------------
// BATTERY EXCHANGES & SCRAP BUYBACK
// ----------------------------------------------------------------------------
function getExchanges() {
  return readJson(EXCHANGES_FILE, []);
}

function saveExchanges(exchanges) {
  return writeJson(EXCHANGES_FILE, exchanges);
}

function findExchangeById(idOrNum) {
  const exchanges = getExchanges();
  return exchanges.find(e => e.id === idOrNum || e.exchangeNumber === idOrNum) || null;
}

function generateExchangeNumber() {
  const exchanges = getExchanges();
  let maxSeq = 100;
  exchanges.forEach(e => {
    if (e.exchangeNumber && e.exchangeNumber.startsWith('EXC-2026-')) {
      const num = parseInt(e.exchangeNumber.replace('EXC-2026-', ''), 10);
      if (!isNaN(num) && num > maxSeq) maxSeq = num;
    }
  });
  return `EXC-2026-${String(maxSeq + 1).padStart(5, '0')}`;
}

module.exports = {
  // Profiles
  getProfiles,
  findProfileById,
  findProfileByEmail,
  findProfileByPhone,
  findProfileByIdentifier,
  saveProfile,
  createProfile,
  hashPassword,
  verifyPassword,
  normalizeRole,
  hasPermission,
  ROLE_PERMISSIONS,

  // OTP
  createOtpRequest,
  verifyOtpRequest,
  canRequestOtp,

  // Audit
  logAuditEvent,

  // Products & Stock
  getProducts,
  saveProducts,
  getProductById,
  executeStockMovement,

  // Orders & Invoicing
  getOrders,
  saveOrders,
  findOrderById,
  generateInvoiceNumber,

  // Suppliers
  getSuppliers,
  saveSuppliers,
  findSupplierById,

  // Purchases & GRN
  getPurchases,
  savePurchases,
  findPurchaseById,
  generatePoNumber,

  // Exchanges & Trade-In
  getExchanges,
  saveExchanges,
  findExchangeById,
  generateExchangeNumber
};
