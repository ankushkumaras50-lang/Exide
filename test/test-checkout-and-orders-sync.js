// End-to-End Test Suite: Checkout Address Mode & ERP Order Management Quick Sync
const assert = require('assert');
const db = require('../lib/db.js');
const erpOrdersHandler = require('../lib/erp/orders.js');
const { signJwt } = require('../lib/auth/token.js');

console.log('\n======================================================');
console.log('🧪 TESTING CART CHECKOUT ADDRESS & ORDER MANAGEMENT SYNC');
console.log('======================================================\n');

let passedTests = 0;
let totalTests = 0;

function test(description, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ PASS: ${description}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${description}`);
    console.error(`     Error: ${err.message}`);
  }
}

async function asyncTest(description, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✅ PASS: ${description}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${description}`);
    console.error(`     Error: ${err.message}`);
  }
}

(async () => {
  // 1. Order Creation & Retrieval
  const testOrderId = 'ORD-SYNC-' + Date.now();
  const testPhone = '9841999888';

  const newOrder = {
    orderId: testOrderId,
    id: testOrderId,
    invoiceNumber: 'INV-2026-SYNC01',
    date: new Date().toISOString(),
    status: 'PENDING',
    orderStatus: 'PENDING',
    paymentStatus: 'PENDING',
    paymentMethod: 'COD',
    customer: {
      fullName: 'Rohan Karmacharya',
      phone: testPhone,
      email: 'rohan.sync@test.com',
      address: 'Bijulibazar Tole 4',
      city: 'Kathmandu',
      district: 'Kathmandu',
      province: 'Bagmati',
      ward: '10'
    },
    items: [
      { id: 'exide-inv-150', name: 'Exide Inva Master 150Ah', quantity: 1, unitPrice: 22500 }
    ],
    pricing: {
      rawSubtotal: 22500,
      scrapExchangeDeduction: 0,
      vatAmount: 2588,
      deliveryFee: 0,
      grandTotal: 22500
    }
  };

  test('Save new order into database', () => {
    const saved = db.saveOrder(newOrder);
    assert.strictEqual(saved.orderId, testOrderId);
  });

  test('Lookup order by phone number matches test order', () => {
    const orders = db.getOrders();
    const customerOrders = orders.filter(o => o.customer && String(o.customer.phone).replace(/\D/g, '') === testPhone);
    assert.ok(customerOrders.length >= 1);
    assert.strictEqual(customerOrders[0].orderId, testOrderId);
  });

  // 2. Staff Authentication & Proceed Workflow
  const staffToken = signJwt({ userId: 'staff_superadmin_01', role: 'super_admin' }, true);

  function createMockRes() {
    return {
      statusCode: 200,
      headers: {},
      body: null,
      setHeader(k, v) { this.headers[k] = v; },
      status(code) { this.statusCode = code; return this; },
      json(data) { this.body = data; return this; },
      end() { return this; }
    };
  }

  // Stage 1: PENDING -> PROCESSING
  await asyncTest('Proceed Order: PENDING -> PROCESSING (Fulfillment Confirmation)', async () => {
    const req = {
      method: 'PUT',
      headers: { authorization: `Bearer ${staffToken}` },
      body: {
        orderId: testOrderId,
        status: 'PROCESSING',
        assignedRider: 'Standard Kathmandu Express',
        trackingNote: 'Order verified and reserved at central store.'
      }
    };
    const res = createMockRes();
    await erpOrdersHandler(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.order.status, 'PROCESSING');
  });

  // Stage 2: PROCESSING -> SHIPPED
  await asyncTest('Proceed Order: PROCESSING -> SHIPPED (Dispatch with Rider)', async () => {
    const req = {
      method: 'PUT',
      headers: { authorization: `Bearer ${staffToken}` },
      body: {
        orderId: testOrderId,
        status: 'SHIPPED',
        assignedRider: 'Bikash Shrestha (+977 9812345678)',
        dispatchVehicle: 'Ba 4 Pa 9012 Scooter',
        trackingNote: 'Handed over to technician for doorstep fitting.'
      }
    };
    const res = createMockRes();
    await erpOrdersHandler(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.order.status, 'SHIPPED');
    assert.strictEqual(res.body.order.assignedRider, 'Bikash Shrestha (+977 9812345678)');
  });

  // Stage 3: SHIPPED -> DELIVERED & PAID
  await asyncTest('Proceed Order: SHIPPED -> DELIVERED (Doorstep Handover & Reconcile COD)', async () => {
    const req = {
      method: 'PUT',
      headers: { authorization: `Bearer ${staffToken}` },
      body: {
        orderId: testOrderId,
        status: 'DELIVERED',
        paymentStatus: 'PAID',
        trackingNote: 'Installed and voltage calibrated. COD payment collected.'
      }
    };
    const res = createMockRes();
    await erpOrdersHandler(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.order.status, 'DELIVERED');
    assert.strictEqual(res.body.order.paymentStatus, 'PAID');
  });

  // 3. Quick Sync: Verified order reflect in customer orders
  test('Customer Order Sync: Live state matches DELIVERED & PAID', () => {
    const freshOrders = db.getOrders();
    const updated = freshOrders.find(o => o.orderId === testOrderId);
    assert.ok(updated);
    assert.strictEqual(updated.status, 'DELIVERED');
    assert.strictEqual(updated.paymentStatus, 'PAID');
    assert.ok(Array.isArray(updated.trackingHistory));
    assert.ok(updated.trackingHistory.length >= 3);
  });

  console.log('\n======================================================');
  console.log(`🏁 ORDER SYNC TEST RESULTS: ${passedTests} PASSED, ${totalTests - passedTests} FAILED`);
  console.log('======================================================\n');

  if (passedTests < totalTests) {
    process.exit(1);
  }
})();

