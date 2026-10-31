const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('======================================================');
console.log('🧪 VERIFYING FRONTEND ENHANCEMENTS & USER REQUIREMENTS');
console.log('======================================================\n');

// 1. Verify HTML Structure
console.log('📄 1. Inspecting index.html Elements:');
const indexHtml = fs.readFileSync('index.html', 'utf8');

assert.ok(indexHtml.includes('id="catalog-grid-search-input"'), 'Search box directly above products grid must exist in index.html');
console.log('  ✅ PASS: Found #catalog-grid-search-input above products grid');

assert.ok(indexHtml.includes('id="catalog-load-more-slot"'), 'Dedicated slot #catalog-load-more-slot must exist in index.html');
console.log('  ✅ PASS: Found #catalog-load-more-slot in index.html');

assert.ok(indexHtml.includes('id="brands-grid-container"'), '#brands-grid-container must exist in index.html');
assert.ok(indexHtml.includes('brand-card-item'), 'Initial brands must be pre-rendered in #brands-grid-container');
console.log('  ✅ PASS: Found pre-rendered brand cards in #brands-grid-container');

assert.ok(indexHtml.includes('id="categories-grid-container"'), '#categories-grid-container must exist in index.html');
assert.ok(indexHtml.includes('category-card'), 'Initial categories must be pre-rendered in #categories-grid-container');
console.log('  ✅ PASS: Found pre-rendered category cards in #categories-grid-container');

assert.ok(indexHtml.includes('class="customer-profile-modal-box"'), 'customer-profile-modal-box must exist');
assert.ok(!indexHtml.includes('auth-modal-content customer-profile-modal-box'), 'auth-modal-content must NOT be present on customer-profile-modal-box');
console.log('  ✅ PASS: customer-profile-modal-box freed from auth-modal-content clip');

// 2. Verify CSS Rules
console.log('\n🎨 2. Inspecting css/style.css Rules:');
const styleCss = fs.readFileSync('css/style.css', 'utf8');

assert.ok(styleCss.includes('.catalog-live-search-bar'), '.catalog-live-search-bar styles must exist in style.css');
assert.ok(styleCss.includes('.catalog-load-more-box'), '.catalog-load-more-box styles must exist in style.css');
assert.ok(styleCss.includes('.btn-load-more-products'), '.btn-load-more-products styles must exist in style.css');
console.log('  ✅ PASS: Catalog live search bar and load more button styles verified');

assert.ok(styleCss.includes('#customer-profile-modal-overlay .customer-profile-modal-box'), 'Universal scrollability rules for customer profile exist');
assert.ok(!styleCss.includes('body.search-mode-active #brands-section'), '#brands-section must not be hidden when searching');
assert.ok(!styleCss.includes('body.search-mode-active #categories-section'), '#categories-section must not be hidden when searching');
console.log('  ✅ PASS: Verified brands and categories sections remain accessible during search');

// 3. Verify JavaScript Logic in App Context
console.log('\n⚙️ 3. Simulating Runtime JS Pagination, Search & Cart:');

// Create lightweight DOM mock
class MockElement {
  constructor(id = '', tag = 'div') {
    this.id = id;
    this.tagName = tag.toUpperCase();
    this.children = [];
    this._innerHTML = '';
    this.style = {};
    const classes = new Set();
    this.classList = {
      add: (c) => classes.add(c),
      remove: (c) => classes.delete(c),
      contains: (c) => classes.has(c),
      toggle: (c, force) => {
        const shouldAdd = force !== undefined ? !!force : !classes.has(c);
        if (shouldAdd) classes.add(c);
        else classes.delete(c);
      }
    };
    this.attributes = {};
    this.listeners = {};
    this.value = '';
    this.disabled = false;
    this.appendChild = () => {};
    this.removeChild = () => {};
    this.remove = () => {};
  }

  get innerHTML() { return this._innerHTML; }
  set innerHTML(val) { this._innerHTML = val; }
  get textContent() { return this._innerHTML.replace(/<[^>]*>/g, ''); }
  set textContent(val) { this._innerHTML = val; }

  setAttribute(k, v) { this.attributes[k] = v; }
  getAttribute(k) { return this.attributes[k]; }
  addEventListener(evt, cb) {
    if (!this.listeners[evt]) this.listeners[evt] = [];
    this.listeners[evt].push(cb);
  }
  dispatchEvent(evt) {
    const list = this.listeners[evt.type] || [];
    list.forEach(cb => cb(evt));
  }
  getBoundingClientRect() { return { top: 100, height: 50 }; }
  scrollIntoView() {}
}

const elements = new Map();
function getEl(id) {
  if (!elements.has(id)) {
    elements.set(id, new MockElement(id));
  }
  return elements.get(id);
}

// Pre-create required elements
[
  'products-catalog-grid',
  'catalog-products-count',
  'search-results-banner-slot',
  'catalog-load-more-slot',
  'catalog-grid-search-input',
  'catalog-grid-search-clear',
  'catalog-search-input',
  'global-search-input',
  'global-search-dropdown',
  'search-clear-btn',
  'brands-grid-container',
  'categories-grid-container',
  'customer-profile-modal-overlay',
  'quickview-modal-overlay',
  'header-cart-count'
].forEach(id => getEl(id));

const mockDocument = {
  getElementById: (id) => getEl(id),
  querySelectorAll: () => [],
  querySelector: (sel) => {
    if (sel.startsWith('#')) return getEl(sel.slice(1));
    return new MockElement();
  },
  createElement: (tag) => new MockElement('', tag),
  body: new MockElement('body'),
  documentElement: new MockElement('html'),
  addEventListener: () => {}
};

const sandbox = {
  window: null,
  location: { hash: '', search: '', pathname: '/' },
  document: mockDocument,
  console: console,
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => {},
  setTimeout: (fn) => fn(),
  setInterval: () => {},
  URLSearchParams: class {
    constructor() {}
    get() { return null; }
  },
  URL: URL,
  localStorage: {
    data: {},
    getItem(k) { return this.data[k] || null; },
    setItem(k, v) { this.data[k] = String(v); },
    removeItem(k) { delete this.data[k]; }
  }
};
sandbox.window = sandbox;

// Load scripts in order: products-data -> stock-management -> cart-checkout -> app
const vmContext = vm.createContext(sandbox);

vm.runInContext(fs.readFileSync('js/products-data.js', 'utf8'), vmContext);
vm.runInContext(fs.readFileSync('js/stock-management.js', 'utf8'), vmContext);
vm.runInContext(fs.readFileSync('js/cart-checkout.js', 'utf8'), vmContext);
vm.runInContext(fs.readFileSync('js/app.js', 'utf8'), vmContext);

// Initialize system instances
sandbox.window.stockManager = new sandbox.window.StockManagementSystem();
sandbox.window.cartSystem = new sandbox.window.CartSystem();

assert.ok(sandbox.window.productsCatalog.length >= 286, 'Catalog must contain 286+ products');
console.log(`  ✅ PASS: Products Catalog loaded with ${sandbox.window.productsCatalog.length} products`);

// Test Initial Products Pagination (24 items max initially)
sandbox.window.renderProductsCatalog();
const gridEl = getEl('products-catalog-grid');
const cardCount = (gridEl.innerHTML.match(/class="product-card"/g) || []).length;
assert.strictEqual(cardCount, 24, `Initial page MUST render exactly 24 products, got ${cardCount}`);
console.log(`  ✅ PASS: Initial render sliced to 24 products (User requirement: 20 to 25 products)`);

// Test Load More Button
const loadMoreSlotEl = getEl('catalog-load-more-slot');
assert.ok(loadMoreSlotEl.innerHTML.includes('Load More Products'), 'Load More Products button must be rendered');
console.log('  ✅ PASS: "Load More Products" button active with batch progression');

// Test Load More Click Progression
sandbox.window.loadMoreCatalogProducts();
const cardCountAfterMore = (gridEl.innerHTML.match(/class="product-card"/g) || []).length;
assert.strictEqual(cardCountAfterMore, 48, `After clicking Load More, 48 products must be rendered, got ${cardCountAfterMore}`);
console.log('  ✅ PASS: loadMoreCatalogProducts() successfully increments to 48 products');

// Test Grid Search Input
sandbox.window.initCatalogFilters();
const gridSearchInput = getEl('catalog-grid-search-input');
gridSearchInput.value = 'Exide';
gridSearchInput.dispatchEvent({ type: 'input', target: gridSearchInput });

const exideCards = (gridEl.innerHTML.match(/class="product-card"/g) || []).length;
assert.ok(exideCards > 0 && exideCards <= 24, 'Search for Exide must return relevant results');
console.log(`  ✅ PASS: Searching for "Exide" filtered to ${exideCards} matching products on 1st page`);

// Test Add to Cart functionality
const testProd = sandbox.window.productsCatalog[0];
const fakeBtn = new MockElement('btn-fake');
sandbox.window.handleAddToCart(testProd.id, fakeBtn);

const cartItems = sandbox.window.cartSystem.items;
assert.ok(cartItems.length > 0, 'Cart must contain added item');
assert.strictEqual(cartItems[0].id, testProd.id, 'Cart item ID must match added product');
console.log(`  ✅ PASS: handleAddToCart successfully added "${testProd.name}" to cart`);

// Test Brands Grid Rendering
sandbox.window.renderBrandsGrid();
const brandsContainer = getEl('brands-grid-container');
const brandCards = (brandsContainer.innerHTML.match(/class="brand-card-item/g) || []).length;
assert.strictEqual(brandCards, 16, `Brands grid must render 16 brands, got ${brandCards}`);
console.log(`  ✅ PASS: renderBrandsGrid() populated ${brandCards} associated brand cards`);

// Test Categories Grid Rendering
sandbox.window.renderCategoriesGrid();
const catContainer = getEl('categories-grid-container');
const catCards = (catContainer.innerHTML.match(/class="category-card"/g) || []).length;
assert.strictEqual(catCards, 12, `Categories grid must render 12 categories, got ${catCards}`);
console.log(`  ✅ PASS: renderCategoriesGrid() populated ${catCards} power solution categories`);

console.log('\n🎉 ALL 4 USER REQUIREMENTS VERIFIED & WORKING PERFECTLY! ✓\n');
