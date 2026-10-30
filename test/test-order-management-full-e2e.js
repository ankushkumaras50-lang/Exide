const assert = require('assert');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { signJwt } = require('../lib/auth/token.js');

console.log('================================================================');
console.log('🧪 RUNNING FULL END-TO-END ORDER MANAGEMENT TEST');
console.log('================================================================\n');

function httpRequest(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body), raw: body });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

async function run() {
  const uniqueNum = Math.floor(100000 + Math.random() * 900000);
  const testCustomer = {
    fullName: `Ramesh Karki (E2E Test ${uniqueNum})`,
    phone: '9841556677',
    district: 'Kathmandu',
    city: 'Kathmandu',
    ward: '10',
    deliveryAddress: 'Bijulibazar, Anamnagar',
    notes: 'Urgent wholesale delivery'
  };

  const testItems = [
    {
      id: 'exide-battery-150-invamaster',
      sku: 'EX-IMTT1500',
      name: 'Exide 150 Ah Invamaster Tubular Battery',
      price: 34000,
      quantity: 1
    }
  ];

  // --------------------------------------------------------------------------
  // STEP 1: Storefront Checkout calls POST /api/orders
  // --------------------------------------------------------------------------
  console.log('1️⃣ Step 1: Placing Order from Cart Checkout (/api/orders)...');
  const checkoutPayload = {
    customer: testCustomer,
    items: testItems,
    paymentMethod: 'COD',
    notes: testCustomer.notes
  };

  const checkoutRes = await httpRequest({
    hostname: '127.0.0.1',
    port: 3000,
    path: '/api/orders',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, checkoutPayload);

  assert.strictEqual(checkoutRes.status, 201, `Checkout expected HTTP 201, got ${checkoutRes.status}`);
  assert.strictEqual(checkoutRes.data.success, true, 'Checkout expected success: true');
  const placedOrder = checkoutRes.data.order;
  assert.ok(placedOrder, 'Expected order object from checkout');
  console.log(`   ✅ Placed Order #${placedOrder.orderId} (Invoice: ${placedOrder.invoiceNumber})`);

  // --------------------------------------------------------------------------
  // STEP 2: Secondary Storefront Sync to /api/erp/orders
  // --------------------------------------------------------------------------
  console.log('\n2️⃣ Step 2: Ingesting into ERP Ledger (/api/erp/orders)...');
  const erpSyncRes = await httpRequest({
    hostname: '127.0.0.1',
    port: 3000,
    path: '/api/erp/orders',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { order: placedOrder });

  assert.strictEqual(erpSyncRes.status, 200, `ERP sync expected HTTP 200, got ${erpSyncRes.status}`);
  assert.strictEqual(erpSyncRes.data.success, true, 'ERP sync expected success: true');
  console.log(`   ✅ Successfully synced into ERP server ledger: ${erpSyncRes.data.message}`);

  // --------------------------------------------------------------------------
  // STEP 3: Querying Order Management List (/api/erp/orders)
  // --------------------------------------------------------------------------
  console.log('\n3️⃣ Step 3: Fetching ERP Order Management Table (/api/erp/orders)...');
  const adminToken = signJwt({ userId: 'staff_superadmin_01', role: 'super_admin' }, true);
  const erpListRes = await httpRequest({
    hostname: '127.0.0.1',
    port: 3000,
    path: '/api/erp/orders?status=all',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });

  assert.strictEqual(erpListRes.status, 200, `ERP list expected HTTP 200, got ${erpListRes.status}`);
  assert.ok(Array.isArray(erpListRes.data.orders), 'Expected array of orders');
  const foundInErp = erpListRes.data.orders.find(o => o.orderId === placedOrder.orderId || o.id === placedOrder.orderId);
  assert.ok(foundInErp, `Order #${placedOrder.orderId} MUST be present in ERP orders table!`);
  console.log(`   ✅ Order #${placedOrder.orderId} confirmed present in ERP Orders View!`);
  console.log(`   Customer: ${foundInErp.customer?.fullName}, Status: ${foundInErp.status}, Total: NPR ${foundInErp.grandTotal}`);

  // --------------------------------------------------------------------------
  // STEP 4: Storefront Public API query (/api/orders)
  // --------------------------------------------------------------------------
  console.log('\n4️⃣ Step 4: Fetching Public Storefront Orders (/api/orders)...');
  const publicListRes = await httpRequest({
    hostname: '127.0.0.1',
    port: 3000,
    path: '/api/orders',
    method: 'GET'
  });

  assert.strictEqual(publicListRes.status, 200, `Public list expected HTTP 200, got ${publicListRes.status}`);
  const foundInPublic = publicListRes.data.orders.find(o => o.orderId === placedOrder.orderId || o.id === placedOrder.orderId);
  assert.ok(foundInPublic, `Order #${placedOrder.orderId} MUST be present in Public orders list!`);
  console.log(`   ✅ Order #${placedOrder.orderId} verified in Storefront Orders API`);

  // --------------------------------------------------------------------------
  // STEP 5: Order Processing & Status Advancement (PATCH /api/orders)
  // --------------------------------------------------------------------------
  console.log('\n5️⃣ Step 5: Updating Order Status (Dispatched with Rider)...');
  const updateRes = await httpRequest({
    hostname: '127.0.0.1',
    port: 3000,
    path: '/api/orders',
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
  }, {
    orderId: placedOrder.orderId,
    status: 'SHIPPED',
    assignedRider: {
      name: 'Bikram Thapa',
      phone: '9851087654',
      vehicle: 'Delivery Van (BA 2 CHA 4521)'
    },
    trackingNote: 'Dispatched from Bijulibazar central warehouse'
  });

  assert.strictEqual(updateRes.status, 200, 'Update expected HTTP 200');
  assert.strictEqual(updateRes.data.order.status, 'SHIPPED');
  console.log(`   ✅ Order #${placedOrder.orderId} status advanced to: ${updateRes.data.order.status}`);
  console.log(`   Assigned Rider: ${updateRes.data.order.assignedRider.name} (${updateRes.data.order.assignedRider.phone})`);

  // --------------------------------------------------------------------------
  // STEP 6: Verify Persistence After Status Update
  // --------------------------------------------------------------------------
  console.log('\n6️⃣ Step 6: Verifying Updated Order State in Server Database...');
  const verifyRes = await httpRequest({
    hostname: '127.0.0.1',
    port: 3000,
    path: `/api/orders?orderId=${placedOrder.orderId}`,
    method: 'GET'
  });

  assert.strictEqual(verifyRes.status, 200, 'Order lookup expected HTTP 200');
  assert.strictEqual(verifyRes.data.order.status, 'SHIPPED');
  console.log(`   ✅ Verified persisted status is SHIPPED in database`);

  console.log('\n🎉 ALL 6 END-TO-END TESTS PASSED SUCCESSFULLY! ✓\n');
}

run().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
