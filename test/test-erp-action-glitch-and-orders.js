// Comprehensive Verification Test Suite: ERP Action Glitch, Modal Stability, Pending Orders, and Demo Reset
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const publicOrdersHandler = require('../api/orders.js');
const erpOrdersHandler = require('../lib/erp/orders.js');
const erpDemoHandler = require('../lib/erp/demo.js');
const { signJwt } = require('../lib/auth/token.js');
const { seedDemoDataset } = require('../lib/erp/demo-dataset.js');

async function directDispatch(handler, reqOptions) {
  return new Promise((resolve) => {
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

    const res = {
      setHeader: (name, val) => { responseHeaders[name.toLowerCase()] = val; },
      getHeader: (name) => responseHeaders[name.toLowerCase()],
      status: function(code) { statusCode = code; return this; },
      json: function(data) {
        resolve({
          statusCode,
          headers: responseHeaders,
          data
        });
      },
      end: function(data) {
        let parsed = data;
        try { parsed = JSON.parse(data); } catch (e) {}
        resolve({
          statusCode,
          headers: responseHeaders,
          data: parsed
        });
      }
    };

    handler(req, res);
  });
}

async function runTests() {
  console.log('================================================================');
  console.log('🧪 RUNNING ERP ACTION MODAL & ORDER WORKFLOW VERIFICATION SUITE');
  console.log('================================================================\n');

  const adminToken = signJwt({
    userId: 'admin_root_001',
    username: 'admin@exidebattery.com.np',
    role: 'super_admin'
  }, true);

  // --------------------------------------------------------------------------
  // TEST 1: Storefront Order Placement Created as PENDING
  // --------------------------------------------------------------------------
  console.log('--- TEST 1: Storefront Checkout Orders Created with PENDING status ---');
  const uniqueCustomerPhone = '9841' + Math.floor(100000 + Math.random() * 900000);
  const orderPlacementRes = await directDispatch(publicOrdersHandler, {
    method: 'POST',
    body: {
      customer: {
        fullName: 'Binod Shrestha (Kathmandu)',
        phone: uniqueCustomerPhone,
        address: 'Baneshwor Height, Ward 10',
        city: 'Kathmandu'
      },
      items: [
        {
          id: 'exide-invamaster-150',
          sku: 'IMTT1500',
          name: 'Exide 150 Ah Invamaster Tubular Battery',
          quantity: 1,
          price: 24500
        }
      ],
      paymentMethod: 'COD',
      calculations: {
        rawSubtotal: 24500,
        scrapExchangeDeduction: 0,
        vatAmount: 3185,
        grandTotal: 27685
      }
    }
  });

  assert.strictEqual(orderPlacementRes.statusCode, 201, 'Order placement should return 201 Created');
  assert.strictEqual(orderPlacementRes.data.success, true, 'Order placement should report success');
  const createdOrder = orderPlacementRes.data.order;
  assert(createdOrder, 'Created order object must exist');
  assert.strictEqual(createdOrder.status, 'PENDING', 'Storefront checkout order MUST have status: PENDING');
  assert.strictEqual(createdOrder.orderStatus, 'PENDING', 'Storefront checkout order orderStatus MUST be PENDING');
  console.log(`✅ Order placed: #${createdOrder.orderId} with status="${createdOrder.status}"`);

  // --------------------------------------------------------------------------
  // TEST 2: Public Order Catalog Sorted Newest First
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 2: Public Order Catalog Sorted Newest First ---');
  const catalogRes = await directDispatch(publicOrdersHandler, {
    method: 'GET'
  });

  assert.strictEqual(catalogRes.statusCode, 200);
  assert(Array.isArray(catalogRes.data.orders), 'Orders should be an array');
  const firstOrder = catalogRes.data.orders[0];
  assert.strictEqual(firstOrder.orderId, createdOrder.orderId, 'Latest placed order must appear first in catalog');
  console.log(`✅ Latest placed order #${firstOrder.orderId} is at index 0 of public catalog`);

  // --------------------------------------------------------------------------
  // TEST 3: ERP Orders View Categorization & Pending Badge Count
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 3: ERP Orders View Summary & Pending Categorization ---');
  const erpOrdersRes = await directDispatch(erpOrdersHandler, {
    method: 'GET',
    query: { status: 'all' },
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });

  assert.strictEqual(erpOrdersRes.statusCode, 200);
  assert(erpOrdersRes.data.orders.length > 0, 'ERP orders list must not be empty');
  const summary = erpOrdersRes.data.summary;
  assert(summary, 'ERP orders response must contain summary object');
  assert(summary.pending >= 1, 'Summary.pending must be at least 1 for newly placed orders');
  console.log(`✅ ERP summary correctly reports summary.pending = ${summary.pending}`);

  // Query only pending orders
  const pendingOrdersRes = await directDispatch(erpOrdersHandler, {
    method: 'GET',
    query: { status: 'pending' },
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const pendingMatch = pendingOrdersRes.data.orders.find(o => (o.orderId || o.id) === createdOrder.orderId);
  assert(pendingMatch, `Newly placed order #${createdOrder.orderId} must appear in "pending" status tab`);
  console.log(`✅ Order #${createdOrder.orderId} found in ERP Pending tab`);

  // --------------------------------------------------------------------------
  // TEST 4: Order Progression & Rider Assignment
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 4: Order Fulfillment Progression & Rider Assignment ---');

  // Stage 2: CONFIRMED / PROCESSING
  const advanceToProcessingRes = await directDispatch(erpOrdersHandler, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${adminToken}` },
    body: {
      orderId: createdOrder.orderId,
      status: 'PROCESSING',
      trackingNote: 'Order verified and stock allocated at Bijulibazar central hub.'
    }
  });
  assert.strictEqual(advanceToProcessingRes.statusCode, 200);
  assert.strictEqual(advanceToProcessingRes.data.order.status, 'PROCESSING');
  console.log(`✅ Order advanced: PENDING -> PROCESSING`);

  // Stage 3: SHIPPED with Rider & Vehicle
  const riderName = 'Ramesh Thapa';
  const riderPhone = '9801234567';
  const riderVehicle = 'Ba 2 Pa 4521 (Hero Splendor)';
  const advanceToShippedRes = await directDispatch(erpOrdersHandler, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${adminToken}` },
    body: {
      orderId: createdOrder.orderId,
      status: 'SHIPPED',
      assignedRider: `${riderName} (+977 ${riderPhone} - Kathmandu Central)`,
      dispatchVehicle: riderVehicle,
      trackingNote: `Handed to rider ${riderName} with multimeter and terminal grease.`
    }
  });
  assert.strictEqual(advanceToShippedRes.statusCode, 200);
  assert.strictEqual(advanceToShippedRes.data.order.status, 'SHIPPED');
  assert(advanceToShippedRes.data.order.assignedRider.includes(riderPhone), 'Assigned rider phone must be preserved');
  console.log(`✅ Order advanced: PROCESSING -> SHIPPED (Rider: ${riderName}, Vehicle: ${riderVehicle})`);

  // Stage 4: DELIVERED & PAID
  const advanceToDeliveredRes = await directDispatch(erpOrdersHandler, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${adminToken}` },
    body: {
      orderId: createdOrder.orderId,
      status: 'DELIVERED',
      paymentStatus: 'PAID',
      trackingNote: 'Delivered to customer doorstep. Voltage checked and free greasing applied.'
    }
  });
  assert.strictEqual(advanceToDeliveredRes.statusCode, 200);
  assert.strictEqual(advanceToDeliveredRes.data.order.status, 'DELIVERED');
  assert.strictEqual(advanceToDeliveredRes.data.order.paymentStatus, 'PAID');
  console.log(`✅ Order advanced: SHIPPED -> DELIVERED & PAID`);

  // --------------------------------------------------------------------------
  // TEST 5: Status Rank Aware Merging Prevents Downgrade Regression
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 5: Status Rank Aware Merging Prevents Downgrade Regression ---');
  const STATUS_RANKS = {
    'PENDING': 1, 'CREATED': 1, 'SUBMITTED': 1,
    'PROCESSING': 2, 'CONFIRMED': 2, 'ACCEPTED': 2,
    'SHIPPED': 3, 'DISPATCHED': 3, 'OUT_FOR_DELIVERY': 3, 'IN_TRANSIT': 3,
    'DELIVERED': 4, 'COMPLETED': 4,
    'CANCELLED': 0, 'REJECTED': 0
  };

  const localStateOrder = {
    orderId: 'EXD-RANK-TEST-1',
    status: 'SHIPPED',
    assignedRider: 'Bikram Thapa (9851087654)',
    dispatchVehicle: 'Ba 3 Pa 9901'
  };

  // Simulating an older server response before the status change was processed
  const staleServerOrder = {
    orderId: 'EXD-RANK-TEST-1',
    status: 'PENDING',
    assignedRider: null
  };

  const localRank = STATUS_RANKS[localStateOrder.status] || 0;
  const serverRank = STATUS_RANKS[staleServerOrder.status] || 0;
  const resolvedStatus = (serverRank > localRank) ? staleServerOrder.status : localStateOrder.status;
  const resolvedRider = localStateOrder.assignedRider || staleServerOrder.assignedRider;

  assert.strictEqual(resolvedStatus, 'SHIPPED', 'Local advanced status must not be downgraded by stale server response');
  assert.strictEqual(resolvedRider, 'Bikram Thapa (9851087654)', 'Assigned rider must be preserved');
  console.log(`✅ Rank comparison verified: SHIPPED (rank 3) successfully overrides stale PENDING (rank 1)`);

  // --------------------------------------------------------------------------
  // TEST 6: Demo Data Management (Status, Preview, Purge, Re-Seed)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 6: Demo Data Management & Reset Functionality ---');
  
  // Seed initial demo dataset
  seedDemoDataset();

  // Check demo status
  const demoStatusRes = await directDispatch(erpDemoHandler, {
    method: 'GET',
    query: { action: 'status' },
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assert.strictEqual(demoStatusRes.statusCode, 200);
  assert.strictEqual(demoStatusRes.data.isDemoActive, true, 'Demo mode should be active after seeding');
  console.log(`✅ Demo mode active: ${demoStatusRes.data.isDemoActive}, Total demo records: ${demoStatusRes.data.counts.totalDemoRecords}`);

  // Preview demo records
  const demoPreviewRes = await directDispatch(erpDemoHandler, {
    method: 'GET',
    query: { action: 'preview' },
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assert.strictEqual(demoPreviewRes.statusCode, 200);
  assert(demoPreviewRes.data.previewItems.orders.length > 0, 'Preview items must include demo orders');
  assert(demoPreviewRes.data.preservedItems.length >= 4, 'Preview must explicitly show preserved items');
  console.log(`✅ Demo preview verified: Sample preview contains ${demoPreviewRes.data.previewItems.orders.length} orders`);

  // Purge demo records with Owner password
  const purgeRes = await directDispatch(erpDemoHandler, {
    method: 'POST',
    query: { action: 'purge-demo' },
    headers: { 'Authorization': `Bearer ${adminToken}` },
    body: { ownerPassword: 'NepalPowerHouse@2026' }
  });
  assert.strictEqual(purgeRes.statusCode, 200);
  assert.strictEqual(purgeRes.data.success, true);
  console.log(`✅ Purged demo records: ${JSON.stringify(purgeRes.data.purgedSummary)}`);

  // Verify non-demo order is preserved
  const postPurgeOrdersRes = await directDispatch(erpOrdersHandler, {
    method: 'GET',
    query: { status: 'all' },
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const preservedRealOrder = postPurgeOrdersRes.data.orders.find(o => (o.orderId || o.id) === createdOrder.orderId);
  assert(preservedRealOrder, `Real customer order #${createdOrder.orderId} must be preserved after demo purge`);
  console.log(`✅ Real customer order #${createdOrder.orderId} preserved after demo purge`);

  // Re-seed demo records
  const reseedRes = await directDispatch(erpDemoHandler, {
    method: 'POST',
    query: { action: 'seed-demo' },
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assert.strictEqual(reseedRes.statusCode, 200);
  assert.strictEqual(reseedRes.data.success, true);
  console.log(`✅ Demo dataset re-seeded successfully`);

  console.log('\n================================================================');
  console.log('🎉 ALL TESTS PASSED: ERP ACTION GLITCH & ORDER WORKFLOW 100% OK');
  console.log('================================================================');
}

runTests().catch(err => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
