// ============================================================================
// EXIDE BATTERY WHOLESALE NEPAL & ERP
// test/test-supabase-integration.js: Supabase Client & Schema Compatibility Suite
// ============================================================================
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');

async function runSupabaseTests() {
  console.log('\n======================================================');
  console.log('⚡ EXIDE ERP PHASE 5: SUPABASE INTEGRATION TEST SUITE');
  console.log('======================================================\n');

  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (e) {
      console.error(`  ❌ FAIL: ${name} -> ${e.message}`);
      failed++;
    }
  }

  async function testAsync(name, fn) {
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (e) {
      console.error(`  ❌ FAIL: ${name} -> ${e.message}`);
      failed++;
    }
  }

  // 1. Client Configuration & Module Export
  console.log('🔌 1. Supabase Client Configuration:');
  const supabaseModule = require('../js/supabase-client.js');

  test('Supabase URL is valid HTTPS endpoint', () => {
    assert(supabaseModule.SUPABASE_URL.startsWith('https://upplcvxeaazdujlnwejz.supabase.co'), 'Invalid URL');
  });

  test('Supabase Anon Key is present and format is valid JWT', () => {
    assert(typeof supabaseModule.SUPABASE_ANON_KEY === 'string', 'Key missing');
    assert(supabaseModule.SUPABASE_ANON_KEY.split('.').length === 3, 'Key is not valid JWT token format');
  });

  test('Supabase client successfully initialized in Node/Browser environment', () => {
    assert(supabaseModule.supabaseClient, 'Supabase client failed to instantiate');
    assert(typeof supabaseModule.supabaseClient.from === 'function', 'client.from query builder missing');
  });

  // 2. Products Data & Backward Compatibility
  console.log('\n📦 2. Storefront Catalog & Schema Compatibility:');
  const productsData = require('../js/products-data.js');

  test('INITIAL_PRODUCTS catalog contains all master items', () => {
    assert(Array.isArray(productsData.INITIAL_PRODUCTS), 'INITIAL_PRODUCTS is not array');
    assert(productsData.INITIAL_PRODUCTS.length >= 14, `Expected >= 14 products, got ${productsData.INITIAL_PRODUCTS.length}`);
  });

  test('BRANDS_LIST contains top Nepal battery brands', () => {
    assert(Array.isArray(productsData.BRANDS_LIST), 'BRANDS_LIST missing');
    assert(productsData.BRANDS_LIST.some(b => b.slug === 'exide'), 'Exide brand missing');
    assert(productsData.BRANDS_LIST.some(b => b.slug === 'amaron-quanta'), 'Amaron missing');
  });

  test('CATEGORIES_LIST contains all essential power classifications', () => {
    assert(Array.isArray(productsData.CATEGORIES_LIST), 'CATEGORIES_LIST missing');
    assert(productsData.CATEGORIES_LIST.some(c => c.id === 'inverter-battery'), 'inverter-battery missing');
    assert(productsData.CATEGORIES_LIST.some(c => c.id === 'car-battery'), 'car-battery missing');
  });

  test('NEPAL_LOCATIONS contains Bagmati Head Office and official branches', () => {
    assert(productsData.NEPAL_LOCATIONS && productsData.NEPAL_LOCATIONS.outlets, 'NEPAL_LOCATIONS outlets missing');
    assert(productsData.NEPAL_LOCATIONS.outlets.some(o => o.city.includes('Bijulibazar')), 'Head office missing');
  });

  test('VEHICLE_DATABASE contains car and bike battery lookup tables', () => {
    assert(productsData.VEHICLE_DATABASE && productsData.VEHICLE_DATABASE.cars, 'cars db missing');
    assert(productsData.VEHICLE_DATABASE.bikes, 'bikes db missing');
  });

  test('loadProductsFromSupabase function is defined and callable', () => {
    assert(typeof productsData.loadProductsFromSupabase === 'function', 'loadProductsFromSupabase missing');
  });

  // 3. HTML Script Tag Ordering
  console.log('\n🌐 3. Storefront & ERP Portal HTML Script Linkage:');

  const indexHtml = fs.readFileSync(path.join(ROOT_DIR, 'index.html'), 'utf8');
  test('index.html imports Supabase CDN before products-data.js', () => {
    const cdnPos = indexHtml.indexOf('@supabase/supabase-js');
    const clientPos = indexHtml.indexOf('js/supabase-client.js');
    const prodPos = indexHtml.indexOf('js/products-data.js');
    assert(cdnPos !== -1, 'Supabase CDN missing from index.html');
    assert(clientPos !== -1, 'supabase-client.js missing from index.html');
    assert(cdnPos < clientPos, 'CDN must come before supabase-client.js');
    assert(clientPos < prodPos, 'supabase-client.js must come before products-data.js');
  });

  const erpHtml = fs.readFileSync(path.join(ROOT_DIR, 'erp', 'index.html'), 'utf8');
  test('erp/index.html imports Supabase CDN and root-relative scripts', () => {
    const cdnPos = erpHtml.indexOf('@supabase/supabase-js');
    const clientPos = erpHtml.indexOf('/js/supabase-client.js');
    const prodPos = erpHtml.indexOf('/js/products-data.js');
    assert(cdnPos !== -1, 'Supabase CDN missing from erp/index.html');
    assert(clientPos !== -1, 'Root-relative /js/supabase-client.js missing from erp/index.html');
    assert(prodPos !== -1, 'Root-relative /js/products-data.js missing from erp/index.html');
    assert(cdnPos < clientPos, 'CDN must precede client config in ERP');
    assert(clientPos < prodPos, 'Client config must precede products-data in ERP');
  });

  // 4. SQL Schema Mapping Validation
  console.log('\n🗄️ 4. Production SQL Schema Alignment:');
  const schemaSql = fs.readFileSync(path.join(ROOT_DIR, 'db', 'migrations', '001_initial_schema.sql'), 'utf8');

  test('SQL schema contains all required Supabase tables', () => {
    const requiredTables = [
      'profiles', 'user_roles', 'categories', 'products',
      'warehouses', 'stock_balances', 'stock_movements',
      'suppliers', 'purchase_orders', 'sales_orders', 'invoices',
      'battery_exchanges'
    ];
    for (const table of requiredTables) {
      assert(schemaSql.includes(`CREATE TABLE IF NOT EXISTS ${table}`), `Table ${table} missing in SQL schema`);
    }
  });

  // 5. Live Orders & Invoicing Sync Engine
  console.log('\n⚡ 5. Live Orders & Invoicing Sync Engine:');
  const syncEngine = require('../lib/supabase-sync.js');

  test('mapOrderStatus maps delivery states accurately', () => {
    assert.strictEqual(syncEngine.mapOrderStatus('CONFIRMED'), 'confirmed');
    assert.strictEqual(syncEngine.mapOrderStatus('Processing'), 'processing');
    assert.strictEqual(syncEngine.mapOrderStatus('Out for Delivery'), 'out_for_delivery');
    assert.strictEqual(syncEngine.mapOrderStatus('Delivered'), 'delivered');
    assert.strictEqual(syncEngine.mapOrderStatus('Cancelled'), 'cancelled');
  });

  test('mapPaymentMethod maps Nepal payment gateways', () => {
    assert.strictEqual(syncEngine.mapPaymentMethod('eSewa Mobile Wallet'), 'ESEWA');
    assert.strictEqual(syncEngine.mapPaymentMethod('Khalti Digital Wallet'), 'KHALTI');
    assert.strictEqual(syncEngine.mapPaymentMethod('Fonepay Dynamic QR'), 'FONEPAY');
    assert.strictEqual(syncEngine.mapPaymentMethod('Direct Bank Transfer'), 'BANK_TRANSFER');
    assert.strictEqual(syncEngine.mapPaymentMethod('Cash on Delivery (COD)'), 'COD');
  });

  test('mapPaymentStatus maps payment conditions', () => {
    assert.strictEqual(syncEngine.mapPaymentStatus('PAID'), 'paid');
    assert.strictEqual(syncEngine.mapPaymentStatus('UNPAID'), 'unpaid');
    assert.strictEqual(syncEngine.mapPaymentStatus('PARTIAL'), 'partially_paid');
  });

  await testAsync('syncOrderToSupabase handles order mapping safely without exception', async () => {
    const mockOrder = {
      orderId: 'EXD-TEST-9988',
      invoiceNumber: 'INV-2026-9999',
      status: 'confirmed',
      paymentMethod: 'ESEWA',
      paymentStatus: 'paid',
      grandTotal: 34000,
      subtotal: 34000,
      tax: 3911,
      taxableAmount: 30089,
      customer: { name: 'Sunil Test', phone: '9809163454', address: 'Baneshwor, KTM' },
      items: [{ id: 'exide-battery-150-invamaster', qty: 1, price: 34000 }]
    };
    const res = await syncEngine.syncOrderToSupabase(mockOrder);
    assert(res !== undefined, 'syncOrderToSupabase returned undefined');
  });

  console.log('\n======================================================');
  console.log(`📊 SUPABASE TEST RUNNER SUMMARY:`);
  console.log(`   Passed: ${passed}`);
  console.log(`   Failed: ${failed}`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runSupabaseTests().catch(err => {
    console.error('Fatal Test Runner Error:', err);
    process.exit(1);
  });
}

module.exports = { runSupabaseTests };
