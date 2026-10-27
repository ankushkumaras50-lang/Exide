// Comprehensive ERP Inventory, Stock Ledger & Role Access Test Suite
// Exide Battery Wholesale & AET Official Partner
const metricsHandler = require('../lib/erp/metrics.js');
const productsHandler = require('../lib/erp/products.js');
const inventoryHandler = require('../lib/erp/inventory.js');
const { signJwt } = require('../lib/auth/token.js');
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

async function runErpInventoryTests() {
  console.log('\n======================================================');
  console.log('📦 EXIDE NEPAL ERP INVENTORY & LEDGER TEST SUITE');
  console.log('======================================================\n');

  // Pre-generate tokens with different roles
  const superAdminToken = signJwt({ userId: 'usr_super_admin', email: 'admin@exidebattery.com.np', role: 'super_admin' }, true);
  const invManagerToken = signJwt({ userId: 'usr_inv_manager', email: 'manager@exidebattery.com.np', role: 'inventory_manager' }, true);
  const salesStaffToken = signJwt({ userId: 'usr_sales_staff', email: 'sales@exidebattery.com.np', role: 'sales_staff' }, true);
  const customerToken   = signJwt({ userId: 'usr_cust_test', phone: '9801234567', role: 'customer' }, false);

  // --------------------------------------------------------------------------
  // TEST 1: ERP Metrics & Role-Based Cost Price Redaction
  // --------------------------------------------------------------------------
  console.log('📊 1. ERP Executive Metrics & Redaction:');

  // 1a. Unauthenticated access blocked
  const unauthReq = { method: 'GET', headers: {}, query: {} };
  const unauthRes = mockRes();
  await metricsHandler(unauthReq, unauthRes);
  assert(unauthRes.statusCode === 401, 'Metrics: Unauthenticated request rejected (401)');

  // 1b. Customer / unauthorized role blocked
  const custReq = { method: 'GET', headers: { authorization: `Bearer ${customerToken}` }, query: {} };
  const custRes = mockRes();
  await metricsHandler(custReq, custRes);
  assert(custRes.statusCode === 403, 'Metrics: Customer role denied access to ERP (403)');

  // 1c. SuperAdmin view: cost valuations & profit visible
  const adminReq = { method: 'GET', headers: { authorization: `Bearer ${superAdminToken}` }, query: {} };
  const adminRes = mockRes();
  await metricsHandler(adminReq, adminRes);
  assert(adminRes.statusCode === 200 && adminRes.data.success, 'Metrics: SuperAdmin view succeeds (200)');
  assert(typeof adminRes.data.inventory.costValuationNPR === 'number', 'Metrics: SuperAdmin can see costValuationNPR');
  assert(adminRes.data.profitability !== null && typeof adminRes.data.profitability.grossProfitEstimateNPR === 'number', 'Metrics: SuperAdmin can see gross profitability');

  // 1d. Sales Staff view: cost valuations & profit REDACTED
  const salesReq = { method: 'GET', headers: { authorization: `Bearer ${salesStaffToken}` }, query: {} };
  const salesRes = mockRes();
  await metricsHandler(salesReq, salesRes);
  assert(salesRes.statusCode === 200 && salesRes.data.success, 'Metrics: Sales Staff view succeeds (200)');
  assert(salesRes.data.inventory.costValuationNPR === null, 'Metrics: Sales Staff costValuationNPR is strictly null (redacted)');
  assert(salesRes.data.profitability === null, 'Metrics: Sales Staff profitability estimate is strictly null (redacted)');
  assert(typeof salesRes.data.inventory.retailValuationNPR === 'number', 'Metrics: Sales Staff can still view retail valuation');

  // --------------------------------------------------------------------------
  // TEST 2: Product Catalogue Management & Permissions
  // --------------------------------------------------------------------------
  console.log('\n🏷️ 2. Product Catalogue Endpoints:');

  // 2a. Unauthenticated product list blocked
  const unauthProdReq = { method: 'GET', headers: {}, query: {} };
  const unauthProdRes = mockRes();
  await productsHandler(unauthProdReq, unauthProdRes);
  assert(unauthProdRes.statusCode === 401, 'Products: Unauthenticated GET rejected (401)');

  // 2b. SuperAdmin product list contains costPrice
  const adminProdReq = { method: 'GET', headers: { authorization: `Bearer ${superAdminToken}` }, query: {} };
  const adminProdRes = mockRes();
  await productsHandler(adminProdReq, adminProdRes);
  assert(adminProdRes.statusCode === 200 && adminProdRes.data.products.length > 0, 'Products: SuperAdmin retrieves catalog list');
  const sampleProductAdmin = adminProdRes.data.products[0];
  assert(sampleProductAdmin.costPrice !== undefined && sampleProductAdmin.costPrice !== null, 'Products: SuperAdmin sees costPrice');

  // 2c. Sales Staff product list has costPrice redacted
  const salesProdReq = { method: 'GET', headers: { authorization: `Bearer ${salesStaffToken}` }, query: {} };
  const salesProdRes = mockRes();
  await productsHandler(salesProdReq, salesProdRes);
  assert(salesProdRes.statusCode === 200, 'Products: Sales staff retrieves catalog list');
  const sampleProductSales = salesProdRes.data.products[0];
  assert(sampleProductSales.costPrice === null, 'Products: Sales staff costPrice is strictly null (redacted)');

  // 2d. Sales Staff attempting to create product rejected (403)
  const salesCreateReq = {
    method: 'POST',
    headers: { authorization: `Bearer ${salesStaffToken}` },
    body: { name: 'Illegal Battery', sku: 'ILLEGAL-01', price: 10000 }
  };
  const salesCreateRes = mockRes();
  await productsHandler(salesCreateReq, salesCreateRes);
  assert(salesCreateRes.statusCode === 403, 'Products: Sales staff prohibited from creating SKU (403)');

  // 2e. SuperAdmin creates new SKU with opening stock
  const testSku = 'TEST-EXP-' + Date.now().toString(36).toUpperCase();
  const adminCreateReq = {
    method: 'POST',
    headers: { authorization: `Bearer ${superAdminToken}` },
    body: {
      name: 'Exide Enterprise Inverter Battery 180Ah',
      sku: testSku,
      brand: 'Exide',
      category: 'Inverter Batteries',
      capacity: '180Ah',
      voltage: '12V',
      warrantyMonths: 48,
      price: 28500,
      costPrice: 21500,
      stock: 25,
      minStock: 5,
      description: 'Tubular heavy-duty inverter battery for continuous Kathmandu power backup.'
    }
  };
  const adminCreateRes = mockRes();
  await productsHandler(adminCreateReq, adminCreateRes);
  assert(adminCreateRes.statusCode === 201 && adminCreateRes.data.success, 'Products: SuperAdmin successfully created new SKU (201)');
  const createdProd = adminCreateRes.data.product;
  assert(createdProd.sku === testSku && createdProd.stock === 25, 'Products: Product created with correct SKU and opening stock of 25 units');

  // --------------------------------------------------------------------------
  // TEST 3: Stock Balances, Movements & Ledger Integrity
  // --------------------------------------------------------------------------
  console.log('\n📋 3. Stock Balances & Movement Ledger:');

  // 3a. Get stock balances
  const balReq = { method: 'GET', headers: { authorization: `Bearer ${invManagerToken}` }, query: {} };
  const balRes = mockRes();
  await inventoryHandler(balReq, balRes);
  assert(balRes.statusCode === 200 && balRes.data.balances.length > 0, 'Inventory: Balances returned with status tags');
  const targetBalance = balRes.data.balances.find(b => b.sku === testSku);
  assert(targetBalance && targetBalance.stockOnHand === 25, 'Inventory: Created SKU reflects 25 units in stock balances');

  // 3b. Sales Staff prohibited from adjusting stock
  const salesAdjustReq = {
    method: 'POST',
    headers: { authorization: `Bearer ${salesStaffToken}` },
    body: { productId: testSku, adjustmentType: 'AUDIT_ADD', quantity: 5 }
  };
  const salesAdjustRes = mockRes();
  await inventoryHandler(salesAdjustReq, salesAdjustRes);
  assert(salesAdjustRes.statusCode === 403, 'Inventory: Sales Staff prohibited from manual stock adjustments (403)');

  // 3c. Inventory Manager increases stock (RESTOCK / AUDIT_ADD)
  const invAddReq = {
    method: 'POST',
    headers: { authorization: `Bearer ${invManagerToken}` },
    body: {
      productId: testSku,
      adjustmentType: 'RESTOCK',
      quantity: 10,
      reason: 'Inward shipment from Birgunj dry port',
      referenceNumber: 'GRN-TEST-101'
    }
  };
  const invAddRes = mockRes();
  await inventoryHandler(invAddReq, invAddRes);
  assert(invAddRes.statusCode === 200 && invAddRes.data.success, 'Inventory: Stock INCREASE executed (200)');
  assert(invAddRes.data.movement.newStock === 35, 'Inventory: Stock increased from 25 to 35 units');

  // 3d. Inventory Manager decreases stock (DAMAGE_WRITE_OFF / DEDUCT)
  const invDeductReq = {
    method: 'POST',
    headers: { authorization: `Bearer ${invManagerToken}` },
    body: {
      productId: testSku,
      adjustmentType: 'DAMAGE_WRITE_OFF',
      quantity: 3,
      reason: 'Acid leak during transit to Butwal depot',
      referenceNumber: 'DMG-TEST-202'
    }
  };
  const invDeductRes = mockRes();
  await inventoryHandler(invDeductReq, invDeductRes);
  assert(invDeductRes.statusCode === 200 && invDeductRes.data.success, 'Inventory: Stock DEDUCT executed (200)');
  assert(invDeductRes.data.movement.newStock === 32, 'Inventory: Stock decreased from 35 to 32 units');

  // 3e. Overselling / Negative Stock Prevention
  const overDeductReq = {
    method: 'POST',
    headers: { authorization: `Bearer ${invManagerToken}` },
    body: {
      productId: testSku,
      adjustmentType: 'DEDUCT',
      quantity: 50, // Available is only 32
      reason: 'Attempted invalid deduction beyond stock on hand'
    }
  };
  const overDeductRes = mockRes();
  await inventoryHandler(overDeductReq, overDeductRes);
  assert(overDeductRes.statusCode === 400 && !overDeductRes.data.success, 'Inventory: Negative stock rejected with 400 Insufficient Stock');

  // 3f. Audit Log / Ledger Movements History
  const ledgerReq = {
    method: 'GET',
    headers: { authorization: `Bearer ${invManagerToken}` },
    query: { view: 'movements', limit: 20 }
  };
  const ledgerRes = mockRes();
  await inventoryHandler(ledgerReq, ledgerRes);
  assert(ledgerRes.statusCode === 200 && ledgerRes.data.success, 'Inventory: Movement ledger history retrieved (200)');
  assert(Array.isArray(ledgerRes.data.movements) && ledgerRes.data.movements.length > 0, 'Inventory: Ledger contains recorded stock adjustments');

  console.log('\n======================================================');
  console.log(`📊 ERP TEST RUNNER SUMMARY:`);
  console.log(`   Passed: ${passed}`);
  console.log(`   Failed: ${failed}`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runErpInventoryTests().catch(err => {
    console.error('Fatal Test Runner Error:', err);
    process.exit(1);
  });
}

module.exports = { runErpInventoryTests };
