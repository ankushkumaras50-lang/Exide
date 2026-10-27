// Comprehensive Test Suite for ERP Phase 4: Suppliers, Purchases, Sales & Battery Exchanges
// Exide Battery Wholesale & AET Official Partner
const suppliersHandler = require('../lib/erp/suppliers.js');
const purchasesHandler = require('../lib/erp/purchases.js');
const salesHandler = require('../lib/erp/sales.js');
const exchangesHandler = require('../lib/erp/exchanges.js');
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

async function runSalesPurchasesTests() {
  console.log('\n======================================================');
  console.log('🏭 EXIDE ERP PHASE 4: PURCHASES, SALES & TRADE-IN');
  console.log('======================================================\n');

  // Pre-generate tokens
  const superAdminToken = signJwt({ userId: 'usr_super_admin', email: 'admin@exidebattery.com.np', role: 'super_admin' }, true);
  const invManagerToken = signJwt({ userId: 'usr_inv_manager', email: 'manager@exidebattery.com.np', role: 'inventory_manager' }, true);
  const salesStaffToken = signJwt({ userId: 'usr_sales_staff', email: 'sales@exidebattery.com.np', role: 'sales_staff' }, true);
  const customerToken   = signJwt({ userId: 'usr_cust_test', phone: '9801234567', role: 'customer' }, false);

  // --------------------------------------------------------------------------
  // TEST 1: Authorized Battery Suppliers Directory
  // --------------------------------------------------------------------------
  console.log('🏭 1. Suppliers Directory & Permissions:');

  // 1a. Unauthenticated access blocked
  const unauthSupRes = mockRes();
  await suppliersHandler({ method: 'GET', headers: {}, query: {} }, unauthSupRes);
  assert(unauthSupRes.statusCode === 401, 'Suppliers: Unauthenticated GET rejected (401)');

  // 1b. Customer access blocked
  const custSupRes = mockRes();
  await suppliersHandler({ method: 'GET', headers: { authorization: `Bearer ${customerToken}` }, query: {} }, custSupRes);
  assert(custSupRes.statusCode === 403, 'Suppliers: Customer role denied access (403)');

  // 1c. SuperAdmin fetches supplier list
  const listSupRes = mockRes();
  await suppliersHandler({ method: 'GET', headers: { authorization: `Bearer ${superAdminToken}` }, query: {} }, listSupRes);
  assert(listSupRes.statusCode === 200 && listSupRes.data.success, 'Suppliers: SuperAdmin retrieves directory list');
  assert(listSupRes.data.suppliers.length >= 5, 'Suppliers: Contains at least 5 authorized battery partners');

  // 1d. Create new supplier
  const newPan = '30' + Math.floor(1000000 + Math.random() * 9000000);
  const createSupRes = mockRes();
  await suppliersHandler({
    method: 'POST',
    headers: { authorization: `Bearer ${invManagerToken}` },
    body: {
      name: 'Amaron Nepal Industrial Supply',
      contactPerson: 'Bimal Pandey',
      email: 'bimal@amaron.com.np',
      phone: '+977-1-4781290',
      pan: newPan,
      address: 'Balkumari, Lalitpur',
      city: 'Lalitpur',
      paymentTerms: 'Net 30'
    }
  }, createSupRes);
  assert(createSupRes.statusCode === 201 && createSupRes.data.success, 'Suppliers: Inventory Manager successfully adds supplier (201)');

  // 1e. Duplicate PAN rejected
  const dupSupRes = mockRes();
  await suppliersHandler({
    method: 'POST',
    headers: { authorization: `Bearer ${invManagerToken}` },
    body: { name: 'Amaron Clone', phone: '+977-1-4781290', pan: newPan }
  }, dupSupRes);
  assert(dupSupRes.statusCode === 409, 'Suppliers: Duplicate PAN registration rejected (409)');

  // --------------------------------------------------------------------------
  // TEST 2: Purchase Orders & Goods Received Notes (GRN)
  // --------------------------------------------------------------------------
  console.log('\n📥 2. Procurement (PO) & Inward Stock Receipts (GRN):');

  // Grab a product from DB to test purchasing
  const allProducts = db.getProducts();
  const testProduct = allProducts[0];
  const initialStock = testProduct.stock || 0;

  // 2a. Create Purchase Order
  const createPoRes = mockRes();
  await purchasesHandler({
    method: 'POST',
    headers: { authorization: `Bearer ${invManagerToken}` },
    body: {
      supplierId: 'sup_exide_ind',
      items: [
        {
          productId: testProduct.id,
          sku: testProduct.sku,
          orderedQty: 20,
          unitCost: 18000
        }
      ],
      notes: 'Urgent restocking for Kathmandu central distribution'
    }
  }, createPoRes);
  assert(createPoRes.statusCode === 201 && createPoRes.data.success, 'Purchases: PO generated successfully (201)');
  const createdPo = createPoRes.data.purchaseOrder;
  assert(createdPo.poNumber && createdPo.poNumber.startsWith('PO-2026-'), 'Purchases: Valid sequential PO number assigned');
  assert(createdPo.status === 'ORDERED', 'Purchases: PO initial status is ORDERED');

  // 2b. Execute GRN (Goods Received Note) with atomic stock increment
  const grnRes = mockRes();
  await purchasesHandler({
    method: 'POST',
    headers: { authorization: `Bearer ${invManagerToken}` },
    query: { action: 'receive' },
    body: {
      poNumber: createdPo.poNumber,
      receivedItems: [
        {
          productId: testProduct.id,
          quantityReceived: 20,
          unitLandedCost: 18000
        }
      ],
      notes: 'Received in full at Bijulibazar depot'
    }
  }, grnRes);
  assert(grnRes.statusCode === 200 && grnRes.data.success, 'Purchases: GRN processed successfully (200)');
  assert(grnRes.data.purchaseOrder.status === 'COMPLETED', 'Purchases: PO status updated to COMPLETED');

  // Verify stock incremented by 20 in database
  const updatedProductAfterGrn = db.getProductById(testProduct.id);
  assert(updatedProductAfterGrn.stock === initialStock + 20, `Purchases: Product stock atomically increased from ${initialStock} to ${initialStock + 20}`);

  // --------------------------------------------------------------------------
  // TEST 3: Sales Orders, IRD 13% Tax Invoices & Stock Decrement
  // --------------------------------------------------------------------------
  console.log('\n🧾 3. Sales Invoices, Stock Decrement & IRD VAT:');

  const stockBeforeSale = updatedProductAfterGrn.stock;

  // 3a. Successful Sale with Scrap Battery Exchange (NPR 35 / Ah)
  const saleRes = mockRes();
  await salesHandler({
    method: 'POST',
    headers: { authorization: `Bearer ${salesStaffToken}` },
    body: {
      orderType: 'SALE',
      customer: {
        fullName: 'Krishna Prasad Sharma',
        phone: '9851098765',
        email: 'krishna.sharma@yahoo.com',
        pan: '500123987',
        district: 'Kathmandu',
        city: 'Kathmandu',
        address: 'Baneshwor Chowk'
      },
      items: [
        {
          productId: testProduct.id,
          sku: testProduct.sku,
          quantity: 2,
          unitPrice: testProduct.price || 25000
        }
      ],
      scrapExchange: {
        hasExchange: true,
        capacityAh: 150,
        scrapRate: 35,
        oldBrand: 'Exide IT500',
        batteryType: 'Tubular',
        physicalCondition: 'INTACT'
      },
      paymentMethod: 'CASH_ON_DELIVERY',
      paymentStatus: 'PENDING'
    }
  }, saleRes);

  assert(saleRes.statusCode === 201 && saleRes.data.success, 'Sales: Sales Order and IRD Tax Invoice created (201)');
  const order = saleRes.data.order;
  assert(order.invoiceNumber && order.invoiceNumber.startsWith('INV-2026-'), 'Sales: Sequential Nepal IRD Invoice issued');
  assert(order.seller.pan === '609823412', 'Sales: Official Seller PAN (609823412) included');

  // Verify 150 Ah * NPR 35 = NPR 5,250 rebate
  assert(order.pricing.scrapExchangeDeduction === 5250, 'Sales: Scrap battery trade-in deduction is exactly NPR 5,250 (150Ah x NPR 35)');

  // Verify 13% VAT calculation
  const expectedTaxable = Math.max(0, (testProduct.price * 2) - 5250);
  const expectedVat = Math.round(expectedTaxable * 0.13);
  assert(order.pricing.vatAmount === expectedVat, `Sales: 13% Nepal VAT accurately calculated (NPR ${expectedVat})`);

  // Verify stock decremented by 2 in database
  const updatedProductAfterSale = db.getProductById(testProduct.id);
  assert(updatedProductAfterSale.stock === stockBeforeSale - 2, `Sales: Stock atomically decremented from ${stockBeforeSale} to ${stockBeforeSale - 2}`);

  // 3b. Prevent Overselling (Insufficient Stock Rejection)
  const overSaleRes = mockRes();
  await salesHandler({
    method: 'POST',
    headers: { authorization: `Bearer ${salesStaffToken}` },
    body: {
      orderType: 'SALE',
      customer: { fullName: 'Big Buyer', phone: '9841000000' },
      items: [
        {
          productId: testProduct.id,
          sku: testProduct.sku,
          quantity: updatedProductAfterSale.stock + 100 // Impossible quantity
        }
      ]
    }
  }, overSaleRes);
  assert(overSaleRes.statusCode === 400 && !overSaleRes.data.success, 'Sales: Overselling request strictly rejected with 400 Insufficient Stock');

  // 3c. Order Cancellation restores stock to warehouse
  const cancelRes = mockRes();
  await salesHandler({
    method: 'PUT',
    headers: { authorization: `Bearer ${superAdminToken}` },
    body: {
      orderId: order.orderId,
      status: 'CANCELLED'
    }
  }, cancelRes);
  assert(cancelRes.statusCode === 200 && cancelRes.data.success, 'Sales: Order cancellation accepted (200)');
  const productAfterCancel = db.getProductById(testProduct.id);
  assert(productAfterCancel.stock === updatedProductAfterSale.stock + 2, 'Sales: Cancelled order stock returned to warehouse ledger');

  // --------------------------------------------------------------------------
  // TEST 4: Scrap Battery Exchanges & Recycling Yard
  // --------------------------------------------------------------------------
  console.log('\n♻️ 4. Scrap Battery Buyback & Recycling Yard:');

  // 4a. Get exchanges list and KPIs
  const getExcRes = mockRes();
  await exchangesHandler({ method: 'GET', headers: { authorization: `Bearer ${invManagerToken}` }, query: {} }, getExcRes);
  assert(getExcRes.statusCode === 200 && getExcRes.data.success, 'Exchanges: Yard inventory retrieved (200)');
  assert(getExcRes.data.summary.totalAhVolume >= 150, 'Exchanges: Aggregate Ah volume computed');
  assert(getExcRes.data.summary.scrapRatePerAh === 35, 'Exchanges: Scrap rate confirmed at NPR 35.00/Ah');

  // 4b. Record Direct Customer Scrap Walk-in Buyback
  const walkinRes = mockRes();
  await exchangesHandler({
    method: 'POST',
    headers: { authorization: `Bearer ${salesStaffToken}` },
    body: {
      customerName: 'Deepak Thapa',
      customerPhone: '9803112233',
      oldBrand: 'Luminous Solar',
      batteryType: 'Tubular 200Ah',
      capacityAh: 200,
      scrapRate: 35,
      physicalCondition: 'INTACT',
      notes: 'Customer replaced with Exide 220Ah'
    }
  }, walkinRes);
  assert(walkinRes.statusCode === 201 && walkinRes.data.success, 'Exchanges: Direct buyback recorded (201)');
  assert(walkinRes.data.exchange.rebateAmount === 7000, 'Exchanges: 200 Ah evaluates to exactly NPR 7,000 rebate');

  // 4c. Update Yard Disposition Status (Dispatched to Smelter)
  const dispRes = mockRes();
  await exchangesHandler({
    method: 'PUT',
    headers: { authorization: `Bearer ${invManagerToken}` },
    body: {
      exchangeNumber: walkinRes.data.exchange.exchangeNumber,
      dispositionStatus: 'CONSIGNMENT_SMELTER',
      smelterPartner: 'Birgunj Eco-Lead Smelting Industries Ltd.',
      consignmentRef: 'CONSIGN-2026-BTL-01'
    }
  }, dispRes);
  assert(dispRes.statusCode === 200 && dispRes.data.exchange.dispositionStatus === 'CONSIGNMENT_SMELTER', 'Exchanges: Disposition updated to CONSIGNMENT_SMELTER');

  console.log('\n======================================================');
  console.log(`📊 PHASE 4 TEST RUNNER SUMMARY:`);
  console.log(`   Passed: ${passed}`);
  console.log(`   Failed: ${failed}`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runSalesPurchasesTests().catch(err => {
    console.error('Fatal Test Runner Error:', err);
    process.exit(1);
  });
}

module.exports = { runSalesPurchasesTests };
