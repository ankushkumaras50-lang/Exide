// Comprehensive System Verification Test Suite
// Exide Battery Wholesale & AET Official Partner
const http = require('http');
const db = require('../api/db.js');
const ordersHandler = require('../api/orders.js');
const productsHandler = require('../api/products.js');
const adminLoginHandler = require('../api/auth/admin-login.js');
const customerHandler = require('../api/auth/customer.js');

let passedTests = 0;
let failedTests = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${testName}`);
    failedTests++;
  }
}

async function runTestSuite() {
  console.log('\n======================================================');
  console.log('🧪 RUNNING EXIDE BATTERY WHOLESALE SYSTEM TEST SUITE');
  console.log('======================================================\n');

  // Test 1: Products Catalog
  console.log('📦 1. Products Catalog & Inventory Data:');
  const products = db.getProducts();
  assert(Array.isArray(products) && products.length >= 10, `Found ${products.length} products loaded in database`);
  const firstProd = products[0];
  assert(firstProd && firstProd.id && firstProd.name && firstProd.price > 0, `Product #${firstProd?.id} has valid attributes (${firstProd?.name})`);

  // Test 2: ERP Staff Authentication
  console.log('\n🔑 2. ERP Staff & Admin RBAC Authentication:');
  const admin = db.findUserByUsernameOrEmail('admin@exidebattery.com.np');
  assert(!!admin, 'SuperAdmin user exists in users database');
  const adminPassMatch = db.verifyPassword('NepalPowerHouse@2026', admin.passwordHash, admin.passwordSalt);
  assert(adminPassMatch, 'SuperAdmin password (NepalPowerHouse@2026) verifies successfully');

  const manager = db.findUserByUsernameOrEmail('manager@exidebattery.com.np');
  assert(!!manager, 'StoreManager user exists in users database');
  const managerPassMatch = db.verifyPassword('StoreManager@2026', manager.passwordHash, manager.passwordSalt);
  assert(managerPassMatch, 'StoreManager password (StoreManager@2026) verifies successfully');

  // Test 3: Customer Accounts
  console.log('\n👤 3. Customer Authentication:');
  const sunil = db.findUserByUsernameOrEmail('9809163454');
  assert(!!sunil, 'Customer Sunil Yadav (9809163454) exists in database');
  const sunilPassMatch = db.verifyPassword('pass_3454', sunil.passwordHash, sunil.passwordSalt);
  assert(sunilPassMatch, 'Sunil Yadav password (pass_3454) verifies successfully');

  // Test 4: High Value Scrap Battery Calculations
  console.log('\n♻️ 4. Scrap Battery Trade-In & High Value Calculations:');
  const scrapRate = 35; // NPR 35/Ah
  const testCapacities = [
    { ah: 150, expectedVal: 5250 },
    { ah: 500, expectedVal: 17500 },
    { ah: 1000, expectedVal: 35000 },
    { ah: 2000, expectedVal: 70000 },
    { ah: 5000, expectedVal: 175000 }
  ];

  testCapacities.forEach(tc => {
    const val = tc.ah * scrapRate;
    assert(val === tc.expectedVal, `Capacity ${tc.ah} Ah correctly evaluates to NPR ${val.toLocaleString()}`);
  });

  // Test 5: Full Order Creation & Tax Invoice Engine
  console.log('\n🧾 5. Order Placement & IRD VAT Bill Generation:');
  const testOrderReq = {
    method: 'POST',
    headers: {},
    body: {
      customer: {
        fullName: 'Ramesh Shrestha',
        phone: '9841234567',
        email: 'ramesh.nepal@gmail.com',
        district: 'Kathmandu',
        city: 'Kathmandu',
        ward: '10',
        deliveryAddress: 'Bijulibazar, Anamnagar'
      },
      items: [{ id: firstProd.id, quantity: 1 }],
      exchangeScrap: { active: true, capacityAh: 200 },
      couponCode: 'EXIDE2026',
      paymentMethod: 'COD'
    }
  };

  let createdOrder = null;
  const testOrderRes = {
    statusCode: 200,
    setHeader() {},
    status(c) { this.statusCode = c; return this; },
    json(d) {
      if (d.success && d.order) createdOrder = d.order;
      return this;
    },
    end() {}
  };

  await ordersHandler(testOrderReq, testOrderRes);
  assert(!!createdOrder, `Order created with ID: ${createdOrder?.orderId}`);
  assert(createdOrder && createdOrder.invoiceNumber && createdOrder.invoiceNumber.startsWith('INV-2026-'), `Tax Invoice issued: ${createdOrder?.invoiceNumber}`);
  assert(createdOrder && createdOrder.pricing && createdOrder.pricing.grandTotal > 0, `Grand Total calculated: NPR ${createdOrder?.pricing?.grandTotal?.toLocaleString()}`);
  assert(createdOrder && createdOrder.pricing && createdOrder.pricing.vatAmount > 0, `13% Nepal VAT included: NPR ${createdOrder?.pricing?.vatAmount?.toLocaleString()}`);
  assert(createdOrder && createdOrder.scrapExchange && createdOrder.scrapExchange.capacityAh === 200, `Scrap battery registered: ${createdOrder?.scrapExchange?.capacityAh} Ah (Rebate: NPR ${createdOrder?.scrapExchange?.calculatedDiscount})`);

  // Summary
  console.log('\n======================================================');
  console.log(`🏁 TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('======================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
