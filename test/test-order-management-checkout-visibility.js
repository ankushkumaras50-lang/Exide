const assert = require('assert');
const fs = require('fs');
const path = require('path');
const db = require('../db/client.js');

console.log('======================================================');
console.log('🧪 TESTING ORDER MANAGEMENT CHECKOUT VISIBILITY & MODAL PERSISTENCE');
console.log('======================================================\n');

async function runTests() {
  // Test 1: Checkout API handles items flexibly (by ID, SKU, or item metadata)
  console.log('📦 1. Testing Checkout Order Placement with Catalog & Metadata Items:');
  const ordersHandler = require('../api/orders.js');

  const testCustomer = {
    fullName: 'Shyam Sundar Sharma',
    phone: '9841998877',
    district: 'Kathmandu',
    city: 'Kathmandu',
    ward: '03',
    deliveryAddress: 'Lazimpat, Near Radisson Hotel',
    landmark: 'Behind Embassy'
  };

  const testReq = {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: {
      customer: testCustomer,
      items: [
        {
          id: 'exide-battery-150-invamaster',
          sku: 'EX-IMTT1500',
          name: 'Exide 150 Ah Invamaster Tubular Battery - IMTT1500',
          price: 34000,
          quantity: 1
        }
      ],
      paymentMethod: 'COD',
      notes: 'Customer urgent inverter replacement'
    }
  };

  let resData = null;
  let resStatus = 0;
  const mockRes = {
    setHeader: () => {},
    status: function(code) { resStatus = code; return this; },
    json: function(data) { resData = data; return this; }
  };

  await ordersHandler(testReq, mockRes);
  assert.strictEqual(resStatus, 201, 'Expected HTTP 201 Created');
  assert.strictEqual(resData.success, true, 'Expected success = true');
  assert.ok(resData.order, 'Expected order object returned');
  const createdOrder = resData.order;
  console.log(`  ✅ PASS: Storefront checkout created Order #${createdOrder.orderId}`);

  // Test 2: Order is persisted in db.getOrders()
  console.log('\n🗄️ 2. Verifying Order Persistence in Server Ledger:');
  const allOrders = db.getOrders();
  const foundOrder = allOrders.find(o => o.orderId === createdOrder.orderId || o.id === createdOrder.orderId);
  assert.ok(foundOrder, `Order #${createdOrder.orderId} should exist in db.getOrders()`);
  assert.strictEqual(foundOrder.customer.fullName, 'Shyam Sundar Sharma');
  console.log(`  ✅ PASS: Order #${createdOrder.orderId} verified in server database`);

  // Test 3: ERP Order Ingestion / Sync Endpoint (POST /api/erp/orders)
  console.log('\n🔄 3. Testing ERP Ingestion & Client Sync (POST /api/erp/orders):');
  const erpOrdersHandler = require('../lib/erp/orders.js');
  const { signJwt } = require('../lib/auth/token.js');
  const adminToken = signJwt({ userId: 'staff_superadmin_01', role: 'super_admin' }, '8h');

  const clientCheckoutOrder = {
    orderId: 'EXD-CLIENT-' + Math.floor(100000 + Math.random() * 900000),
    invoiceNumber: 'INV-CLIENT-9912',
    date: new Date().toISOString(),
    customer: {
      fullName: 'Anita Gurung (Client Offline Checkout)',
      phone: '9801122334',
      district: 'Lalitpur',
      deliveryAddress: 'Jhamsikhel, Ward 03'
    },
    items: [
      {
        id: 'exide-matrix-car-battery',
        sku: 'EX-MTX80',
        name: 'Exide Matrix 12V 80Ah Car Battery',
        price: 19800,
        quantity: 1
      }
    ],
    pricing: {
      rawSubtotal: 19800,
      grandTotal: 19800,
      vatAmount: 2278
    },
    paymentMethod: 'COD',
    paymentStatus: 'PENDING',
    status: 'CONFIRMED'
  };

  let erpSyncData = null;
  let erpSyncStatus = 0;
  const mockErpRes = {
    setHeader: () => {},
    status: function(code) { erpSyncStatus = code; return this; },
    json: function(data) { erpSyncData = data; return this; }
  };

  await erpOrdersHandler({
    method: 'POST',
    headers: { 'authorization': `Bearer ${adminToken}`, 'content-type': 'application/json' },
    body: { orders: [clientCheckoutOrder] }
  }, mockErpRes);

  assert.strictEqual(erpSyncStatus, 200, 'Expected HTTP 200 from ERP order ingest');
  assert.strictEqual(erpSyncData.success, true, 'Expected sync success = true');
  console.log(`  ✅ PASS: Successfully ingested client checkout order #${clientCheckoutOrder.orderId}`);

  // Test 4: Verify ERP GET Returns Both Storefront & Ingested Orders
  console.log('\n📋 4. Verifying ERP Query Retrieves All Checkout Orders:');
  let erpListData = null;
  let erpListStatus = 0;
  const mockListRes = {
    setHeader: () => {},
    status: function(code) { erpListStatus = code; return this; },
    json: function(data) { erpListData = data; return this; }
  };

  await erpOrdersHandler({
    method: 'GET',
    headers: { 'authorization': `Bearer ${adminToken}` },
    query: { status: 'all' }
  }, mockListRes);

  assert.strictEqual(erpListStatus, 200);
  assert.ok(erpListData.orders.some(o => o.orderId === createdOrder.orderId), 'Storefront order must be returned in ERP list');
  assert.ok(erpListData.orders.some(o => o.orderId === clientCheckoutOrder.orderId), 'Ingested client order must be returned in ERP list');
  console.log(`  ✅ PASS: Both orders retrieved in ERP list (Total orders: ${erpListData.totalOrders})`);

  // Test 5: Verify Order State Progression in ERP
  console.log('\n🚚 5. Testing Order Fulfillment Pipeline Progression:');
  let updateData = null;
  let updateStatus = 0;
  const mockUpdateRes = {
    setHeader: () => {},
    status: function(code) { updateStatus = code; return this; },
    json: function(data) { updateData = data; return this; }
  };

  await erpOrdersHandler({
    method: 'PUT',
    headers: { 'authorization': `Bearer ${adminToken}`, 'content-type': 'application/json' },
    body: {
      orderId: createdOrder.orderId,
      status: 'SHIPPED',
      assignedRider: 'Bikash Shrestha (+977 9812345678 - Lalitpur)',
      dispatchVehicle: 'Ba 3 Pa 9120',
      trackingNote: 'Order dispatched with Multimeter test kit'
    }
  }, mockUpdateRes);

  assert.strictEqual(updateStatus, 200);
  assert.strictEqual(updateData.order.status, 'SHIPPED');
  assert.strictEqual(updateData.order.assignedRider, 'Bikash Shrestha (+977 9812345678 - Lalitpur)');
  console.log(`  ✅ PASS: Order #${createdOrder.orderId} successfully transitioned to SHIPPED with assigned rider`);

  console.log('\n======================================================');
  console.log('🏁 ALL TESTS PASSED: ORDER VISIBILITY & WORKFLOW VERIFIED');
  console.log('======================================================\n');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

