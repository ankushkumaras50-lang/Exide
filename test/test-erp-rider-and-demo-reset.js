// Automated Integration & Verification Test Suite
// Order Management Rider Assignment & "Settings -> Demo Data & Reset"
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const http = require('http');

const { seedDemoDataset } = require('../lib/erp/demo-dataset.js');
const db = require('../db/client.js');
const { signJwt } = require('../lib/auth/token.js');

const ordersHandler = require('../lib/erp/orders.js');
const demoHandler = require('../lib/erp/demo.js');
const publicOrdersHandler = require('../api/orders.js');

async function directDispatch(handler, reqOptions) {
  return new Promise((resolve, reject) => {
    const headers = {};
    if (reqOptions.headers) {
      Object.keys(reqOptions.headers).forEach(k => {
        headers[k.toLowerCase()] = reqOptions.headers[k];
      });
    }

    const req = {
      method: reqOptions.method || 'GET',
      url: reqOptions.path || '/',
      headers: headers,
      body: reqOptions.body || {},
      query: reqOptions.query || {}
    };

    let statusCode = 200;
    const responseHeaders = {};
    let responseBody = '';

    const res = {
      setHeader: (name, val) => { responseHeaders[name.toLowerCase()] = val; },
      getHeader: (name) => responseHeaders[name.toLowerCase()],
      status: function(code) { statusCode = code; return this; },
      json: function(data) {
        responseBody = JSON.stringify(data);
        resolve({
          statusCode,
          headers: responseHeaders,
          data
        });
      },
      end: function(data) {
        if (data) responseBody = data;
        let parsed = null;
        try { parsed = JSON.parse(responseBody); } catch (e) { parsed = responseBody; }
        resolve({
          statusCode,
          headers: responseHeaders,
          data: parsed
        });
      }
    };

    try {
      handler(req, res).catch(reject);
    } catch (e) {
      reject(e);
    }
  });
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('🧪 RUNNING ERP RIDER ASSIGNMENT & DEMO DATA RESET TEST SUITE');
  console.log('================================================================\n');

  // Generate valid SuperAdmin Token
  const ownerToken = signJwt({
    userId: 'usr_superadmin_01',
    username: 'admin@exidebattery.com.np',
    role: 'super_admin',
    permissions: ['*']
  }, true);

  // --------------------------------------------------------------------------
  // TEST 1: Seed Multi-Period Demo Dataset with Reconciled Financials
  // --------------------------------------------------------------------------
  console.log('--- TEST 1: Seed Initial Demo Dataset (Multi-Period & Reconciled) ---');
  const seedCounts = seedDemoDataset();
  console.log('Seeded counts:', seedCounts);
  assert(seedCounts.orders >= 6, 'Should seed at least 6 multi-period demo orders');
  assert(seedCounts.expenses >= 10, 'Should seed multi-period demo expenses');
  assert(seedCounts.tasks >= 5, 'Should seed demo tasks');
  assert(seedCounts.aiReports >= 2, 'Should seed demo AI reports');

  // Verify internal financial consistency of demo orders
  const orders = db.getOrders();
  const demoOrders = orders.filter(o => o.isDemo === true);
  console.log(`Found ${demoOrders.length} demo orders in database.`);

  for (const o of demoOrders) {
    const p = o.pricing || {};
    const expectedTaxable = Math.max(0, (p.rawSubtotal || 0) - (p.scrapExchangeDeduction || 0) - (p.couponDiscount || 0));
    assert.strictEqual(p.taxableAmount, expectedTaxable, `Taxable amount for #${o.orderId} should reconcile with subtotal - scrap`);
    assert(p.grandTotal > 0, `Grand total for #${o.orderId} must be positive`);
    assert(o.isDemo === true, `Order #${o.orderId} must have isDemo: true flag`);
  }
  console.log('✓ TEST 1 PASSED: Initial demo dataset is internally consistent and multi-period.\n');

  // --------------------------------------------------------------------------
  // TEST 2: Demo Status & Preview Endpoint (Settings -> Demo Data & Reset)
  // --------------------------------------------------------------------------
  console.log('--- TEST 2: Check Demo Status & Preview ---');
  const statusRes = await directDispatch(demoHandler, {
    method: 'GET',
    query: { action: 'status' },
    headers: { 'Authorization': `Bearer ${ownerToken}` }
  });

  assert.strictEqual(statusRes.statusCode, 200);
  assert.strictEqual(statusRes.data.isDemoActive, true);
  console.log('Status result: isDemoActive =', statusRes.data.isDemoActive, 'Total demo records:', statusRes.data.counts.totalDemoRecords);

  const previewRes = await directDispatch(demoHandler, {
    method: 'GET',
    query: { action: 'preview' },
    headers: { 'Authorization': `Bearer ${ownerToken}` }
  });

  assert.strictEqual(previewRes.statusCode, 200);
  assert(previewRes.data.previewItems.orders.length > 0, 'Preview must include sample demo orders');
  assert(previewRes.data.preservedItems.length >= 4, 'Preview must explicitly list preserved non-demo items');
  console.log('✓ TEST 2 PASSED: Demo status and preview API correctly reports records.\n');

  // --------------------------------------------------------------------------
  // TEST 3: Create Real Storefront Customer Order (Non-Demo)
  // --------------------------------------------------------------------------
  console.log('--- TEST 3: Create Real Storefront Customer Order (Non-Demo) ---');
  const realOrderRes = await directDispatch(publicOrdersHandler, {
    method: 'POST',
    body: {
      customer: {
        fullName: 'Bikash Shrestha (Real Customer)',
        phone: '9841998877',
        district: 'Kathmandu',
        city: 'Teku',
        ward: '12',
        deliveryAddress: 'Teku Central Power Line'
      },
      items: [
        { id: 'exide-battery-150-invamaster', quantity: 1 }
      ],
      paymentMethod: 'COD'
    }
  });

  assert(realOrderRes.statusCode === 200 || realOrderRes.statusCode === 201, 'Order creation should return 200 or 201');
  const realOrder = realOrderRes.data.order;
  assert(realOrder && realOrder.orderId, 'Order must be generated');
  assert.strictEqual(realOrder.isDemo, false, 'Real storefront orders MUST have isDemo: false');
  console.log(`Created real order: #${realOrder.orderId} (isDemo: ${realOrder.isDemo})`);
  console.log('✓ TEST 3 PASSED: Real orders have isDemo: false.\n');

  // --------------------------------------------------------------------------
  // TEST 4: Assign Delivery Rider & Proceed Fulfillment in ERP
  // --------------------------------------------------------------------------
  console.log('--- TEST 4: Delivery Rider Assignment & Fulfillment Progression ---');
  const riderAssignmentRes = await directDispatch(ordersHandler, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${ownerToken}` },
    body: {
      orderId: realOrder.orderId,
      status: 'PROCESSING',
      assignedRider: 'Ramesh Thapa (+977 9801234567 - Kathmandu Central / Bijulibazar)',
      dispatchVehicle: 'Ba 2 Pa 4521 (Hero Splendor)',
      trackingNote: 'Order packed and assigned to lead rider Ramesh Thapa with voltage test kit.'
    }
  });

  assert.strictEqual(riderAssignmentRes.statusCode, 200);
  const updatedOrder = riderAssignmentRes.data.order;
  assert.strictEqual(updatedOrder.status, 'PROCESSING');
  assert(updatedOrder.assignedRider.includes('Ramesh Thapa'), 'assignedRider must include rider name');
  assert(updatedOrder.customer && updatedOrder.customer.assignedRider.includes('Ramesh Thapa'), 'customer.assignedRider must be updated');
  assert(updatedOrder.dispatchRider && updatedOrder.dispatchRider.name.includes('Ramesh Thapa'), 'dispatchRider object must be populated');
  assert.strictEqual(updatedOrder.dispatchVehicle, 'Ba 2 Pa 4521 (Hero Splendor)');
  console.log(`Assigned rider: ${updatedOrder.assignedRider} | Vehicle: ${updatedOrder.dispatchVehicle}`);

  // Advance to SHIPPED
  const shipRes = await directDispatch(ordersHandler, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${ownerToken}` },
    body: {
      orderId: realOrder.orderId,
      status: 'SHIPPED',
      trackingNote: 'Handed over to rider. Out for doorstep delivery.'
    }
  });
  assert.strictEqual(shipRes.statusCode, 200);
  assert.strictEqual(shipRes.data.order.status, 'SHIPPED');

  // Advance to DELIVERED & Paid
  const deliverRes = await directDispatch(ordersHandler, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${ownerToken}` },
    body: {
      orderId: realOrder.orderId,
      status: 'DELIVERED',
      paymentStatus: 'PAID',
      trackingNote: 'Customer accepted battery. Voltage calibrated. COD collected.'
    }
  });
  assert.strictEqual(deliverRes.statusCode, 200);
  assert.strictEqual(deliverRes.data.order.status, 'DELIVERED');
  assert.strictEqual(deliverRes.data.order.paymentStatus, 'PAID');
  console.log('✓ TEST 4 PASSED: Rider assignment & 4-stage fulfillment progression succeeded.\n');

  // --------------------------------------------------------------------------
  // TEST 5: Owner Password Verification Security on Destructive Operations
  // --------------------------------------------------------------------------
  console.log('--- TEST 5: Owner Authentication Security Check ---');
  const invalidPwdRes = await directDispatch(demoHandler, {
    method: 'POST',
    query: { action: 'purge-demo' },
    headers: { 'Authorization': `Bearer ${ownerToken}` },
    body: { ownerPassword: 'WrongPassword123' }
  });
  assert.strictEqual(invalidPwdRes.statusCode, 403, 'Must reject with 403 on invalid owner password');
  console.log('Correctly rejected invalid password with 403 Forbidden.');
  console.log('✓ TEST 5 PASSED: Unauthorized purge prevented.\n');

  // --------------------------------------------------------------------------
  // TEST 6: Execute "Remove Demo Data Only" (Requirement 3)
  // --------------------------------------------------------------------------
  console.log('--- TEST 6: Execute Remove Demo Data Only ---');
  const purgeRes = await directDispatch(demoHandler, {
    method: 'POST',
    query: { action: 'purge-demo' },
    headers: { 'Authorization': `Bearer ${ownerToken}` },
    body: { ownerPassword: 'NepalPowerHouse@2026' }
  });

  assert.strictEqual(purgeRes.statusCode, 200);
  console.log('Purge summary:', purgeRes.data.purgedSummary);
  assert(purgeRes.data.purgedSummary.orders > 0, 'Must have purged demo orders');

  // Verify that real order was PRESERVED
  const ordersAfterPurge = db.getOrders();
  const preservedReal = ordersAfterPurge.find(o => o.orderId === realOrder.orderId);
  assert(preservedReal, 'Real non-demo customer order MUST be preserved after demo purge!');
  assert.strictEqual(preservedReal.status, 'DELIVERED');

  // Verify that NO demo orders remain
  const remainingDemo = ordersAfterPurge.filter(o => o.isDemo === true);
  assert.strictEqual(remainingDemo.length, 0, 'Zero demo orders must remain after purge!');

  // Check demo status after purge
  const statusAfterPurge = await directDispatch(demoHandler, {
    method: 'GET',
    query: { action: 'status' },
    headers: { 'Authorization': `Bearer ${ownerToken}` }
  });
  assert.strictEqual(statusAfterPurge.data.isDemoActive, false, 'Demo mode must be inactive');
  assert.strictEqual(statusAfterPurge.data.demoPurged, true, 'demoPurged flag must be permanently true');
  console.log('✓ TEST 6 PASSED: Demo records cleanly purged while real orders and catalog are preserved.\n');

  // --------------------------------------------------------------------------
  // TEST 7: Disaster Recovery Backup Generation (Requirement 4)
  // --------------------------------------------------------------------------
  console.log('--- TEST 7: Full System Backup Generation ---');
  const backupRes = await directDispatch(demoHandler, {
    method: 'POST',
    query: { action: 'backup' },
    headers: { 'Authorization': `Bearer ${ownerToken}` }
  });

  assert.strictEqual(backupRes.statusCode, 200);
  assert(backupRes.data.backup, 'Backup data must be returned');
  assert(Array.isArray(backupRes.data.backup.products), 'Backup must include products');
  assert(Array.isArray(backupRes.data.backup.orders), 'Backup must include orders');
  assert(backupRes.data.filename.endsWith('.json'), 'Backup filename must be valid JSON name');
  console.log(`Generated backup: ${backupRes.data.filename}`);
  console.log('✓ TEST 7 PASSED: Disaster recovery snapshot created.\n');

  // Cleanup temporary test order so database remains clean
  const cleanedOrders = db.getOrders().filter(o => (o.orderId || o.id) !== realOrder.orderId);
  db.saveOrders(cleanedOrders);

  console.log('================================================================');
  console.log('🎉 ALL TESTS PASSED! ERP RIDER & DEMO RESET VERIFIED 100%');
  console.log('================================================================');
}

runTestSuite().catch(err => {
  console.error('❌ TEST FAILED:', err);
  process.exit(1);
});
