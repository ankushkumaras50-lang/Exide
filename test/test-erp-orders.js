// Automated Test Suite: Commercial ERP Orders Management Module
// Exide Battery Wholesale & AET Official Partner
const assert = require('assert');
const ordersHandler = require('../lib/erp/orders.js');
const db = require('../db/client.js');
const { signJwt } = require('../lib/auth/token.js');

let passedTests = 0;
let failedTests = 0;

function test(description, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${description}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${description}`);
    console.error(`     Error: ${err.message}`);
    failedTests++;
  }
}

async function testAsync(description, fn) {
  try {
    await fn();
    console.log(`  ✅ PASS: ${description}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${description}`);
    console.error(`     Error: ${err.message}`);
    failedTests++;
  }
}

function mockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    data: null,
    setHeader(k, v) { this.headers[k] = v; return this; },
    status(code) { this.statusCode = code; return this; },
    json(data) { this.data = data; return this; },
    end() { return this; }
  };
  return res;
}

async function run() {
  console.log('\n======================================================');
  console.log('🛍️ EXIDE ERP ORDER MANAGEMENT TEST SUITE');
  console.log('======================================================\n');

  const adminToken = signJwt({ userId: 'admin_test_user', role: 'super_admin', username: 'admin' }, true);
  const managerToken = signJwt({ userId: 'mgr_test_user', role: 'inventory_manager', username: 'manager' }, true);
  const salesToken = signJwt({ userId: 'sales_test_user', role: 'sales_staff', username: 'sales' }, true);
  const customerToken = signJwt({ userId: 'cust_test_user', phone: '9809163454', fullName: 'Sunil Yadav', role: 'customer' }, false);

  // 1. RBAC Security
  console.log('🛡️ 1. Order Management RBAC Security:');

  await testAsync('Orders GET: Unauthenticated request rejected (401)', async () => {
    const req = { method: 'GET', headers: {} };
    const res = mockRes();
    await ordersHandler(req, res);
    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(res.data.success, false);
  });

  await testAsync('Orders GET: Customer token denied access (403)', async () => {
    const req = { method: 'GET', headers: { authorization: `Bearer ${customerToken}` } };
    const res = mockRes();
    await ordersHandler(req, res);
    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(res.data.success, false);
  });

  await testAsync('Orders GET: SuperAdmin successfully retrieves orders list (200)', async () => {
    const req = { method: 'GET', headers: { authorization: `Bearer ${adminToken}` }, query: {} };
    const res = mockRes();
    await ordersHandler(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.data.success, true);
    assert(Array.isArray(res.data.orders), 'Orders should be an array');
    assert(typeof res.data.summary === 'object', 'Summary metrics should be present');
    assert(typeof res.data.summary.totalOrders === 'number', 'Total orders count required');
  });

  await testAsync('Orders GET: Sales Staff successfully retrieves orders list (200)', async () => {
    const req = { method: 'GET', headers: { authorization: `Bearer ${salesToken}` }, query: {} };
    const res = mockRes();
    await ordersHandler(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.data.success, true);
  });

  // 2. Summary KPI Metrics & Status Filtering
  console.log('\n📊 2. Order Summary Metrics & Status Filtering:');

  let testOrderId = null;

  await testAsync('Orders GET: Returns global KPI summary with active counts', async () => {
    const req = { method: 'GET', headers: { authorization: `Bearer ${managerToken}` }, query: {} };
    const res = mockRes();
    await ordersHandler(req, res);
    const summary = res.data.summary;
    assert(summary.totalOrders >= 1, `Expected at least 1 order, found ${summary.totalOrders}`);
    assert(typeof summary.totalRevenue === 'number', 'Total revenue must be numeric');
    if (res.data.orders.length > 0) {
      testOrderId = res.data.orders[0].orderId || res.data.orders[0].id;
    }
  });

  await testAsync('Orders GET: Filter by status=all returns full order set', async () => {
    const req = { method: 'GET', headers: { authorization: `Bearer ${adminToken}` }, query: { status: 'all' } };
    const res = mockRes();
    await ordersHandler(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert(res.data.count === res.data.totalOrders, 'Status all should return all orders');
  });

  await testAsync('Orders GET: Search query filters orders accurately', async () => {
    const req = { method: 'GET', headers: { authorization: `Bearer ${adminToken}` }, query: { search: 'EXD' } };
    const res = mockRes();
    await ordersHandler(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert(Array.isArray(res.data.orders));
    if (res.data.orders.length > 0) {
      assert(res.data.orders.every(o => (o.orderId || '').includes('EXD') || (o.invoiceNumber || '').includes('EXD') || JSON.stringify(o).includes('EXD')));
    }
  });

  // 3. Status Transitions, Driver Assignment & Fulfillment
  console.log('\n🚚 3. Order Status Transitions & Delivery Driver Assignment:');

  // Create a dedicated test order to transition through workflow
  const sampleOrder = {
    orderId: 'EXD-TEST-' + Math.floor(100000 + Math.random() * 900000),
    invoiceNumber: 'INV-TEST-' + Math.floor(1000 + Math.random() * 9000),
    status: 'PENDING',
    paymentMethod: 'CASH_ON_DELIVERY',
    paymentStatus: 'PENDING',
    date: new Date().toISOString(),
    customer: {
      fullName: 'Aayush Maharjan',
      phone: '9841234567',
      address: 'Patan Dhoka, Lalitpur',
      city: 'Lalitpur',
      ward: '3'
    },
    items: [
      {
        productId: 'prod_test-exp-mvrwto5e_to5g',
        name: 'Exide Enterprise Inverter Battery 180Ah',
        quantity: 1,
        unitPrice: 28500
      }
    ],
    pricing: {
      rawSubtotal: 28500,
      scrapExchangeDeduction: 0,
      vatAmount: 3705,
      grandTotal: 32205
    }
  };

  const existingOrders = db.getOrders();
  existingOrders.unshift(sampleOrder);
  db.saveOrders(existingOrders);

  await testAsync('Orders PUT: Updates status to CONFIRMED / PROCESSING (200)', async () => {
    const req = {
      method: 'PUT',
      headers: { authorization: `Bearer ${salesToken}` },
      body: {
        orderId: sampleOrder.orderId,
        status: 'CONFIRMED',
        trackingNote: 'Order verified via phone with buyer Aayush'
      }
    };
    const res = mockRes();
    await ordersHandler(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.order.status, 'CONFIRMED');
    assert(res.data.order.trackingHistory.length > 0, 'Tracking history should be updated');
  });

  await testAsync('Orders PUT: Assigns delivery rider & dispatch vehicle (200)', async () => {
    const req = {
      method: 'PUT',
      headers: { authorization: `Bearer ${adminToken}` },
      body: {
        orderId: sampleOrder.orderId,
        status: 'SHIPPED',
        assignedRider: 'Bikash Shrestha (+977 9812345678 - Lalitpur & Patan)',
        dispatchVehicle: 'Ba 2 Ja 5542 Scooter',
        trackingNote: 'Dispatched from Bijulibazar warehouse'
      }
    };
    const res = mockRes();
    await ordersHandler(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.data.order.status, 'SHIPPED');
    assert.strictEqual(res.data.order.assignedRider, 'Bikash Shrestha (+977 9812345678 - Lalitpur & Patan)');
    assert.strictEqual(res.data.order.dispatchVehicle, 'Ba 2 Ja 5542 Scooter');
  });

  await testAsync('Orders PUT: Marks order as DELIVERED & payment as PAID (200)', async () => {
    const req = {
      method: 'PUT',
      headers: { authorization: `Bearer ${adminToken}` },
      body: {
        orderId: sampleOrder.orderId,
        status: 'DELIVERED',
        paymentStatus: 'PAID',
        trackingNote: 'Delivered, terminal greased, and payment collected'
      }
    };
    const res = mockRes();
    await ordersHandler(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.data.order.status, 'DELIVERED');
    assert.strictEqual(res.data.order.paymentStatus, 'PAID');
  });

  // 4. Single Order Retrieval
  console.log('\n🔍 4. Single Order Query & Details:');

  await testAsync('Orders GET: Retrieves specific order by ID (200)', async () => {
    const req = {
      method: 'GET',
      headers: { authorization: `Bearer ${salesToken}` },
      query: { id: sampleOrder.orderId }
    };
    const res = mockRes();
    await ordersHandler(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.data.order.orderId, sampleOrder.orderId);
    assert.strictEqual(res.data.order.customer.fullName, 'Aayush Maharjan');
    assert.strictEqual(res.data.order.status, 'DELIVERED');
  });

  console.log('\n======================================================');
  console.log(`🏁 ORDER MANAGEMENT TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('======================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

run();
