// Exide Battery Wholesale & AET Official Partner - Main Application Logic & Storefront
// Interactive UI, catalog filtering, load calculator, warranty checker, and modals

document.addEventListener('DOMContentLoaded', () => {
  // Initialize systems
  window.stockManager = new StockManagementSystem();
  window.cartSystem = new CartSystem();

  initHeroRotator();
  initScrollSpy();
  initVehicleFinder();
  initCatalogFilters();
  initLoadCalculator();
  initWarrantyChecker();
  initQuickViewModal();
  initGlobalSearch();
  initOutlets();
  renderProductsCatalog();
  renderBrandsGrid();
  renderCategoriesGrid();
});

// ==========================================================================
// CORE HELPERS & SMART SEARCH RELEVANCE ENGINE
// ==========================================================================
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
window.escapeHtml = escapeHtml;

function getSearchRelevanceScore(product, query) {
  if (!query || !product) return 0;
  const q = query.trim().toLowerCase();
  const qTokens = q.split(/\s+/).filter(Boolean);
  if (qTokens.length === 0) return 0;

  const sku = (product.sku || '').toLowerCase();
  const name = (product.name || '').toLowerCase();
  const brand = (product.brand || '').toLowerCase();
  const capacity = (product.capacity || '').toLowerCase();
  const warranty = (product.warranty || '').toLowerCase();
  const type = (product.type || '').toLowerCase();
  const desc = (product.description || '').toLowerCase();
  const cats = Array.isArray(product.categories) ? product.categories.map(c => c.toLowerCase()).join(' ') : '';

  let score = 0;

  // Exact SKU / Model Match (highest priority - top relevance)
  if (sku === q) score += 2000;
  else if (sku.startsWith(q)) score += 1200;
  else if (sku.includes(q)) score += 700;

  // Exact Name Match
  if (name === q) score += 1800;
  else if (name.startsWith(q)) score += 1000;
  else if (name.includes(q)) score += 600;

  // Token matches across fields
  let allTokensMatch = true;
  for (const token of qTokens) {
    let tokenMatched = false;
    if (sku.includes(token)) { score += 400; tokenMatched = true; }
    if (name.includes(token)) { score += 300; tokenMatched = true; }
    if (capacity.includes(token)) { score += 280; tokenMatched = true; }
    if (brand.includes(token)) { score += 200; tokenMatched = true; }
    if (type.includes(token)) { score += 180; tokenMatched = true; }
    if (cats.includes(token)) { score += 150; tokenMatched = true; }
    if (warranty.includes(token)) { score += 120; tokenMatched = true; }
    if (desc.includes(token)) { score += 60; tokenMatched = true; }

    if (!tokenMatched) {
      allTokensMatch = false;
    }
  }

  // Bonus when all search tokens match
  if (allTokensMatch && qTokens.length > 1) {
    score += 500;
  }

  // In-stock availability bonus
  if (score > 0 && product.stock > 0) {
    score += 40;
  }

  return score;
}
window.getSearchRelevanceScore = getSearchRelevanceScore;

function highlightSearchMatch(text, query) {
  if (!text) return '';
  if (!query || !query.trim()) return escapeHtml(text);
  const qTokens = query.trim().split(/\s+/).filter(Boolean);
  if (qTokens.length === 0) return escapeHtml(text);

  let escaped = escapeHtml(text);
  for (const token of qTokens) {
    const escapedToken = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedToken})`, 'gi');
    escaped = escaped.replace(regex, '<mark>$1</mark>');
  }
  return escaped;
}
window.highlightSearchMatch = highlightSearchMatch;

// Expose handleAddToCart globally for direct search dropdown interactions
window.quickAddToCart = function(productId, btnEl) {
  handleAddToCart(productId, btnEl);
};

// ==========================================================================
// 1. HERO TEXT ROTATOR
// ==========================================================================
function initHeroRotator() {
  const rotatorEl = document.getElementById('hero-rotator-text');
  if (!rotatorEl) return;

  const words = ['World', 'Future', 'Success', 'Every Journey', 'Home & Business'];
  let idx = 0;

  setInterval(() => {
    idx = (idx + 1) % words.length;
    rotatorEl.style.opacity = '0';
    rotatorEl.style.transform = 'translateY(8px)';

    setTimeout(() => {
      rotatorEl.textContent = words[idx];
      rotatorEl.style.opacity = '1';
      rotatorEl.style.transform = 'translateY(0)';
    }, 280);
  }, 2800);
}

// ==========================================================================
// 1B. NAVIGATION SCROLLSPY
// ==========================================================================
function initScrollSpy() {
  const sections = [
    { id: 'hero', href: '#' },
    { id: 'products-section', href: '#products-section' },
    { id: 'brands-section', href: '#brands-section' },
    { id: 'categories-section', href: '#categories-section' },
    { id: 'finder-section', href: '#finder-section' },
    { id: 'calculator-section', href: '#calculator-section' },
    { id: 'warranty-section', href: '#warranty-section' },
    { id: 'outlets-section', href: '#outlets-section' }
  ];

  const navItems = document.querySelectorAll('.nav-link-item');

  function updateActiveNav() {
    const scrollPos = window.scrollY + 180;
    let currentId = 'hero';

    for (let i = sections.length - 1; i >= 0; i--) {
      const el = document.getElementById(sections[i].id);
      if (el && el.offsetTop <= scrollPos) {
        currentId = sections[i].id;
        break;
      }
    }

    navItems.forEach(item => {
      const link = item.querySelector('a');
      if (!link) return;
      const href = link.getAttribute('href');
      const isMatch = (currentId === 'hero' && (href === '#' || href === '#hero')) || href === `#${currentId}`;
      item.classList.toggle('active', isMatch);
      link.setAttribute('aria-current', isMatch ? 'page' : 'false');
    });

    // Mobile Bottom Nav Active Item Synchronization
    const mobItems = document.querySelectorAll('.mobile-nav-item:not(.mob-cart-trigger)');
    mobItems.forEach(it => {
      it.classList.remove('active');
      it.removeAttribute('aria-current');
    });

    let activeMobId = 'mob-nav-home';
    if (['products-section', 'brands-section', 'categories-section'].includes(currentId)) {
      activeMobId = 'mob-nav-shop';
    } else if (['finder-section', 'calculator-section'].includes(currentId)) {
      activeMobId = 'mob-nav-finder';
    }

    const activeEl = document.getElementById(activeMobId);
    if (activeEl) {
      activeEl.classList.add('active');
      activeEl.setAttribute('aria-current', 'page');
    }
  }

  window.addEventListener('scroll', updateActiveNav, { passive: true });
  updateActiveNav();
}

// ==========================================================================
// 2. VEHICLE BATTERY FINDER
// ==========================================================================
function initVehicleFinder() {
  const typeSelect = document.getElementById('finder-vehicle-type');
  const makeSelect = document.getElementById('finder-vehicle-make');
  const modelSelect = document.getElementById('finder-vehicle-model');
  const form = document.getElementById('vehicle-finder-form');

  if (!typeSelect || !makeSelect || !modelSelect || !form) return;

  function populateMakes() {
    const type = typeSelect.value;
    const db = type === 'cars' ? VEHICLE_DATABASE.cars : VEHICLE_DATABASE.bikes;
    makeSelect.innerHTML = '<option value="">Select Make / Manufacturer</option>' + 
      db.map(item => `<option value="${item.make}">${item.make}</option>`).join('');
    modelSelect.innerHTML = '<option value="">Select Model</option>';
    modelSelect.disabled = true;
  }

  function populateModels() {
    const type = typeSelect.value;
    const make = makeSelect.value;
    const db = type === 'cars' ? VEHICLE_DATABASE.cars : VEHICLE_DATABASE.bikes;
    const found = db.find(item => item.make === make);

    if (found && found.models.length > 0) {
      modelSelect.disabled = false;
      modelSelect.innerHTML = '<option value="">Select Model</option>' + 
        found.models.map(m => `<option value="${m}">${m}</option>`).join('');
    } else {
      modelSelect.innerHTML = '<option value="">Select Model</option>';
      modelSelect.disabled = true;
    }
  }

  typeSelect.addEventListener('change', populateMakes);
  makeSelect.addEventListener('change', populateModels);
  populateMakes();

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const type = typeSelect.value;
    const make = makeSelect.value;

    if (!make) {
      showToast('Please select your vehicle make', 'warning');
      return;
    }

    const db = type === 'cars' ? VEHICLE_DATABASE.cars : VEHICLE_DATABASE.bikes;
    const match = db.find(item => item.make === make);

    if (match && match.battery) {
      const battery = window.productsCatalog.find(p => p.id === match.battery);
      if (battery) {
        showToast(`Found recommended battery: ${battery.name}!`, 'success');
        openProductQuickView(battery.id);
        const productsSection = document.getElementById('products-section');
        if (productsSection) productsSection.scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      const categoryToFilter = type === 'cars' ? 'car-battery' : 'automotive-battery';
      filterProductsByCategory(categoryToFilter);
      showToast(`Showing all batteries compatible with ${make}`, 'info');
      document.getElementById('products-section')?.scrollIntoView({ behavior: 'smooth' });
    }
  });
}

// ==========================================================================
// 3. CATALOG RENDERING & DYNAMIC FILTERS
// ==========================================================================
let currentCatalogFilter = {
  category: 'all',
  brand: 'all',
  search: '',
  onSale: false,
  inStockOnly: false,
  sort: 'featured',
  priceMax: 100000
};

function renderProductsCatalog() {
  const grid = document.getElementById('products-catalog-grid');
  const countEl = document.getElementById('catalog-products-count');
  const bannerSlot = document.getElementById('search-results-banner-slot');
  if (!grid) return;

  const catalog = window.productsCatalog || [];
  const searchQuery = (currentCatalogFilter.search || '').trim();

  let filtered = catalog.filter(product => {
    // Smart Search across SKU, model, name, brand, capacity, warranty, type, description, categories
    if (searchQuery) {
      const score = getSearchRelevanceScore(product, searchQuery);
      product._searchScore = score;
      if (score <= 0) return false;
    } else {
      product._searchScore = 0;
    }

    // Category
    if (currentCatalogFilter.category !== 'all') {
      if (!product.categories.includes(currentCatalogFilter.category)) return false;
    }

    // Brand
    if (currentCatalogFilter.brand !== 'all') {
      if (product.brandSlug !== currentCatalogFilter.brand) return false;
    }

    // On sale
    if (currentCatalogFilter.onSale && (!product.originalPrice || product.originalPrice <= product.price)) {
      return false;
    }

    // In stock
    if (currentCatalogFilter.inStockOnly && product.stock <= 0) {
      return false;
    }

    // Price Max
    if (product.price > currentCatalogFilter.priceMax) {
      return false;
    }

    return true;
  });

  // Sorting: When search is active and sort is 'featured' (default), place the most relevant searched items directly on top!
  if (searchQuery && currentCatalogFilter.sort === 'featured') {
    filtered.sort((a, b) => (b._searchScore || 0) - (a._searchScore || 0));
  } else if (currentCatalogFilter.sort === 'price-low') {
    filtered.sort((a, b) => a.price - b.price);
  } else if (currentCatalogFilter.sort === 'price-high') {
    filtered.sort((a, b) => b.price - a.price);
  } else if (currentCatalogFilter.sort === 'rating') {
    filtered.sort((a, b) => b.rating - a.rating);
  }

  // Render Search Active Results Banner Slot
  if (bannerSlot) {
    if (searchQuery.length > 0) {
      bannerSlot.innerHTML = `
        <div class="search-active-banner">
          <div class="search-active-info">
            <span class="search-active-badge">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              <span>SMART SEARCH RESULTS</span>
            </span>
            <h3 class="search-active-query">Searched items displayed on top: <strong>"${escapeHtml(searchQuery)}"</strong></h3>
            <span class="search-active-count">${filtered.length} products found • Ranked by relevance</span>
          </div>
          <button type="button" class="btn-exit-search-mode" onclick="window.clearGlobalSearch()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            <span>Clear Search & Show All</span>
          </button>
        </div>
      `;
    } else {
      bannerSlot.innerHTML = '';
    }
  }

  if (countEl) countEl.textContent = `Showing ${filtered.length} of ${catalog.length} products`;

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align:center; padding: 4rem 1.5rem; background: #fff; border-radius: var(--radius-lg); border: 2px dashed #CBD5E1; margin: 1rem 0;">
        <div style="font-size: 2.75rem; margin-bottom: 0.5rem;">🔍</div>
        <h3 style="font-size:1.25rem; font-weight:800; color:#0F172A; margin-bottom:0.5rem;">
          ${searchQuery ? `No products found for "${escapeHtml(searchQuery)}"` : 'No matching batteries or inverters found'}
        </h3>
        <p style="color:#64748B; font-size:0.92rem; max-width:480px; margin:0 auto 1.25rem;">
          ${searchQuery ? 'Try searching by battery model (e.g. IMTT1500, Epiq), brand (Exide, Smarten), capacity (150Ah, 200Ah), or vehicle type.' : 'Try relaxing your filters or resetting the price slider.'}
        </p>
        <button class="btn-primary-red" onclick="window.clearGlobalSearch()" style="margin:0 auto; padding:0.65rem 1.5rem; font-size:0.9rem; font-weight:700; border-radius:8px; display:inline-flex; align-items:center; gap:0.5rem; cursor:pointer;">
          <span>Clear Search & View All Products</span>
        </button>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map(product => {
    let stockTag = '<span class="product-stock-tag in-stock">● In Stock</span>';
    if (product.stock === 0) {
      stockTag = '<span class="product-stock-tag out-stock">● Out of Stock</span>';
    } else if (product.stock <= product.minStock) {
      stockTag = `<span class="product-stock-tag low-stock">● Low: ${product.stock} Left</span>`;
    }

    const hasDiscount = product.originalPrice && product.originalPrice > product.price;
    const cleanWarranty = product.warranty ? product.warranty.split('(')[0].trim() : 'Official Warranty';

    return `
      <article class="product-card" id="card-${product.id}" onclick="navigateToProduct('${product.id}')" title="Click to view details for ${product.name}">
        <div class="product-thumb-box">
          <img src="${product.image || 'assets/logo.png'}" alt="${product.name}" class="product-thumb-img" loading="lazy" onerror="this.onerror=null; this.src='assets/logo.png';">
          ${hasDiscount ? `<span class="product-discount-badge">${product.discount || 'Special'}</span>` : ''}
          ${stockTag}
        </div>
        <div class="product-body">
          <span class="product-brand-badge" style="background:${product.brandColor}15; color:${product.brandColor}; border:1px solid ${product.brandColor}30;">
            ${product.brand}
          </span>
          <h3 class="product-title" title="${product.name}">
            ${product.name}
          </h3>
          <div class="product-specs-chip">
            <span>${product.capacity || '12V'} • ${cleanWarranty}</span>
          </div>
          <div class="product-pricing">
            <span class="price-current">NPR ${product.price.toLocaleString()}</span>
            ${hasDiscount ? `<span class="price-original">NPR ${product.originalPrice.toLocaleString()}</span>` : ''}
          </div>
          <div class="product-actions-row">
            <button class="btn-add-cart" id="btn-add-${product.id}" onclick="event.stopPropagation(); handleAddToCart('${product.id}', this)" ${product.stock <= 0 ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''} aria-label="Add ${product.name} to Cart">
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>
              <span>${product.stock <= 0 ? 'Out of Stock' : 'Add'}</span>
            </button>
            <button class="btn-buy-now-card" onclick="event.stopPropagation(); buyProductNow('${product.id}')" ${product.stock <= 0 ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''} aria-label="Buy ${product.name} Now with Old Battery Exchange" title="Buy Now & Choose Old Battery Exchange">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              <span>Buy Now</span>
            </button>
            <a href="https://wa.me/9779705997260?text=Hi%2C%20I%20am%20inquiring%20about%20${encodeURIComponent(product.name)}%20(SKU%3A%20${product.sku})%20priced%20at%20NPR%20${product.price}." target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation();" class="btn-whatsapp-card" title="Chat on WhatsApp" aria-label="WhatsApp Inquiry">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.03 14.69 2 12.04 2ZM12.05 20.15C10.57 20.15 9.12 19.75 7.85 19L7.55 18.82L4.43 19.64L5.26 16.6L5.06 16.29C4.24 14.98 3.81 13.47 3.81 11.91C3.81 7.37 7.5 3.69 12.05 3.69C14.25 3.69 16.31 4.55 17.87 6.11C19.42 7.66 20.28 9.72 20.28 11.92C20.27 16.46 16.59 20.15 12.05 20.15ZM16.57 14.37C16.32 14.25 15.1 13.65 14.87 13.56C14.64 13.48 14.48 13.44 14.31 13.68C14.15 13.93 13.66 14.5 13.51 14.67C13.37 14.83 13.22 14.85 12.97 14.73C12.72 14.6 11.93 14.34 10.99 13.51C10.26 12.86 9.77 12.05 9.62 11.8C9.48 11.55 9.61 11.42 9.73 11.3C9.84 11.19 9.98 11.01 10.1 10.87C10.23 10.73 10.27 10.62 10.35 10.46C10.44 10.29 10.39 10.15 10.33 10.03C10.27 9.9 9.77 8.68 9.57 8.18C9.37 7.69 9.17 7.76 9.02 7.75C8.88 7.74 8.71 7.74 8.55 7.74C8.38 7.74 8.12 7.8 7.89 8.05C7.67 8.3 7.03 8.89 7.03 10.1C7.03 11.31 7.91 12.47 8.03 12.63C8.16 12.8 9.76 15.26 12.21 16.32C12.79 16.57 13.25 16.72 13.6 16.83C14.19 17.02 14.72 16.99 15.15 16.93C15.63 16.86 16.62 16.33 16.83 15.75C17.03 15.16 17.03 14.66 16.97 14.56C16.91 14.45 16.82 14.49 16.57 14.37Z"/>
              </svg>
            </a>
          </div>
        </div>
      </article>
    `;
  }).join('');
}

function handleAddToCart(productId, btnEl) {
  if (!btnEl || btnEl.disabled) return;
  const originalHtml = btnEl.innerHTML;
  btnEl.disabled = true;
  btnEl.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation: spin 0.8s linear infinite;"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
    <span>Adding...</span>
  `;

  setTimeout(() => {
    window.cartSystem.addItem(productId, 1, btnEl);
    btnEl.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
      <span>Added ✓</span>
    `;
    btnEl.classList.add('btn-added-animate');

    setTimeout(() => {
      btnEl.innerHTML = originalHtml;
      btnEl.disabled = false;
      btnEl.classList.remove('btn-added-animate');
    }, 1400);
  }, 180);
}

function initCatalogFilters() {
  const searchInput = document.getElementById('catalog-search-input');
  const sortSelect = document.getElementById('catalog-sort-select');
  const priceRange = document.getElementById('filter-price-slider');
  const priceDisplay = document.getElementById('price-slider-display');
  const saleCheckbox = document.getElementById('filter-sale-only');
  const inStockCheckbox = document.getElementById('filter-stock-only');

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      currentCatalogFilter.search = e.target.value;
      renderProductsCatalog();
    });
  }

  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      currentCatalogFilter.sort = e.target.value;
      renderProductsCatalog();
    });
  }

  if (priceRange && priceDisplay) {
    priceRange.addEventListener('input', (e) => {
      currentCatalogFilter.priceMax = Number(e.target.value);
      priceDisplay.textContent = `Up to NPR ${Number(e.target.value).toLocaleString()}`;
      renderProductsCatalog();
    });
  }

  if (saleCheckbox) {
    saleCheckbox.addEventListener('change', (e) => {
      currentCatalogFilter.onSale = e.target.checked;
      renderProductsCatalog();
    });
  }

  if (inStockCheckbox) {
    inStockCheckbox.addEventListener('change', (e) => {
      currentCatalogFilter.inStockOnly = e.target.checked;
      renderProductsCatalog();
    });
  }

  // Bind category checkbox group
  document.querySelectorAll('input[name="cat-filter-radio"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      currentCatalogFilter.category = e.target.value;
      renderProductsCatalog();
    });
  });

  // Bind brand checkbox group
  document.querySelectorAll('input[name="brand-filter-radio"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      currentCatalogFilter.brand = e.target.value;
      renderProductsCatalog();
    });
  });
}

function filterProductsByCategory(catId) {
  currentCatalogFilter.category = catId;
  const radio = document.querySelector(`input[name="cat-filter-radio"][value="${catId}"]`);
  if (radio) radio.checked = true;
  renderProductsCatalog();
}

function filterProductsByBrand(brandSlug) {
  currentCatalogFilter.brand = brandSlug;
  const radio = document.querySelector(`input[name="brand-filter-radio"][value="${brandSlug}"]`);
  if (radio) radio.checked = true;
  renderProductsCatalog();
  document.getElementById('products-section')?.scrollIntoView({ behavior: 'smooth' });
}

function resetCatalogFilters() {
  currentCatalogFilter = {
    category: 'all',
    brand: 'all',
    search: '',
    onSale: false,
    inStockOnly: false,
    sort: 'featured',
    priceMax: 100000
  };

  const searchInput = document.getElementById('catalog-search-input');
  if (searchInput) searchInput.value = '';

  const sortSelect = document.getElementById('catalog-sort-select');
  if (sortSelect) sortSelect.value = 'featured';

  const catAllRadio = document.querySelector('input[name="cat-filter-radio"][value="all"]');
  if (catAllRadio) catAllRadio.checked = true;

  const brandAllRadio = document.querySelector('input[name="brand-filter-radio"][value="all"]');
  if (brandAllRadio) brandAllRadio.checked = true;

  const saleCheckbox = document.getElementById('filter-sale-only');
  if (saleCheckbox) saleCheckbox.checked = false;

  const inStockCheckbox = document.getElementById('filter-stock-only');
  if (inStockCheckbox) inStockCheckbox.checked = false;

  const priceRange = document.getElementById('filter-price-slider');
  const priceDisplay = document.getElementById('price-slider-display');
  if (priceRange) priceRange.value = 100000;
  if (priceDisplay) priceDisplay.textContent = 'Up to NPR 100,000';

  renderProductsCatalog();
}

// ==========================================================================
// 4. BRANDS & CATEGORIES RENDERING (BIGGER BRANDS LOGOS)
// ==========================================================================
function renderBrandsGrid() {
  const container = document.getElementById('brands-grid-container');
  if (!container) return;

  container.innerHTML = BRANDS_LIST.map(brand => `
    <div class="brand-card-item ${brand.featured ? 'featured' : ''}" onclick="filterProductsByBrand('${brand.slug}')" title="Filter products by ${brand.name}" role="button" tabindex="0">
      <div class="brand-logo-frame">
        <img src="${brand.logo}" alt="${brand.name} official partner" class="brand-card-logo" loading="lazy" onerror="this.onerror=null; this.src='assets/logo.png';">
      </div>
      <div class="brand-card-name">${brand.name}</div>
      <span class="brand-card-action">View Catalog →</span>
    </div>
  `).join('');
}

function getCategorySvg(catId) {
  switch(catId) {
    case 'inverter-battery':
      return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="16" height="13" rx="2"/><line x1="22" y1="11" x2="22" y2="15"/><line x1="7" y1="11" x2="7" y2="15"/><line x1="5" y1="13" x2="9" y2="13"/><line x1="12" y1="13" x2="14" y2="13"/></svg>`;
    case 'car-battery':
      return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>`;
    case 'automotive-battery':
      return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13" rx="1"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>`;
    case 'lithium-battery':
      return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`;
    case 'inverter':
      return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><circle cx="7" cy="12" r="2"/><path d="M13 12h5"/><circle cx="15.5" cy="12" r="0.5"/><path d="M14 9l2 3-2 3"/></svg>`;
    case 'solar-hybrid-pcu':
      return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`;
    case 'online-ups':
      return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>`;
    case 'solar-charge-controller':
      return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/><circle cx="15" cy="15" r="2"/></svg>`;
    case 'voltage-stabilizer':
      return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>`;
    case 'erickshaw-battery':
      return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><circle cx="5" cy="18" r="3"/><circle cx="19" cy="18" r="3"/><path d="M5 15h9l4-6H8L5 15z"/><path d="M12 9V5l3-2"/></svg>`;
    case 'vrla-battery':
      return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><polyline points="9 12 11 14 15 10"/></svg>`;
    case 'battery-charger':
      return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/><polyline points="13 11 10 15 14 15 11 19"/></svg>`;
    default:
      return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><rect width="16" height="10" x="2" y="7" rx="2" ry="2"/><line x1="22" x2="22" y1="11" y2="13"/></svg>`;
  }
}

function renderCategoriesGrid() {
  const container = document.getElementById('categories-grid-container');
  if (!container) return;

  container.innerHTML = CATEGORIES_LIST.map(cat => `
    <div class="category-card" onclick="filterProductsByCategory('${cat.id}'); document.getElementById('products-section')?.scrollIntoView({behavior:'smooth'});" role="button" tabindex="0" title="Browse ${cat.name} solutions">
      <div class="category-card-icon" aria-hidden="true">
        ${getCategorySvg(cat.id)}
      </div>
      <div class="category-card-info">
        <h3>${cat.name}</h3>
        <p>${cat.desc}</p>
        <div class="category-card-arrow">Browse Products →</div>
      </div>
    </div>
  `).join('');
}

// ==========================================================================
// 5. PRODUCT QUICK VIEW / DETAILS MODAL & INTERACTIVE ZOOM & GALLERY
// ==========================================================================
function initQuickViewModal() {
  const overlay = document.getElementById('quickview-modal-overlay');
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeProductDetails(true);
    });
  }

  // Handle browser back/forward navigation
  window.addEventListener('popstate', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const prodId = urlParams.get('product');
    if (prodId) {
      navigateToProduct(prodId, false);
    } else {
      closeProductDetails(false);
    }
  });

  // Handle direct page load with ?product= parameter
  const initialParams = new URLSearchParams(window.location.search);
  const initialProd = initialParams.get('product');
  if (initialProd) {
    setTimeout(() => navigateToProduct(initialProd, false), 150);
  }
}

let activeDetailQuantity = 1;

function navigateToProduct(productId, updateHistory = true) {
  const product = window.productsCatalog ? window.productsCatalog.find(p => p.id === productId) : null;
  if (!product) return;

  activeDetailQuantity = 1;

  if (updateHistory) {
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('product', product.id);
    window.history.pushState({ productId: product.id }, '', newUrl.toString());
  }

  document.title = `${product.name} | Exide Battery Wholesale Nepal`;
  renderProductDetailPage(product);
}

function closeProductDetails(updateHistory = true) {
  const overlay = document.getElementById('quickview-modal-overlay');
  if (overlay) overlay.classList.remove('open');

  if (updateHistory) {
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.delete('product');
    const cleanUrl = newUrl.pathname + (newUrl.search ? '?' + newUrl.searchParams.toString() : '') + (newUrl.hash || '');
    window.history.pushState({}, '', cleanUrl);
  }

  document.title = 'Exide Battery Wholesale | AET Official Partner - The Power House';
}

function updateProductDetailQty(delta, maxStock) {
  const input = document.getElementById('detail-qty-input');
  if (!input) return;
  let val = parseInt(input.value, 10) || 1;
  val = Math.max(1, Math.min(val + delta, maxStock || 99));
  input.value = val;
  activeDetailQuantity = val;
}

function setProductDetailQty(val, maxStock) {
  const input = document.getElementById('detail-qty-input');
  let parsed = parseInt(val, 10);
  if (isNaN(parsed) || parsed < 1) parsed = 1;
  parsed = Math.min(parsed, maxStock || 99);
  if (input) input.value = parsed;
  activeDetailQuantity = parsed;
}

function buyProductNow(productId) {
  const product = window.productsCatalog ? window.productsCatalog.find(p => p.id === productId) : null;
  if (!product || product.stock <= 0) {
    showToast('Product is currently out of stock.', 'error');
    return;
  }
  const qty = typeof activeDetailQuantity === 'number' && activeDetailQuantity > 0 ? activeDetailQuantity : 1;
  window.cartSystem.addItem(productId, qty);
  closeProductDetails(false);

  // Directly navigate to choose old battery exchange in shopping cart drawer
  setTimeout(() => {
    if (window.cartSystem && typeof window.cartSystem.navigateToScrapExchange === 'function') {
      window.cartSystem.navigateToScrapExchange(product);
    } else if (window.cartSystem) {
      window.cartSystem.openDrawer();
    }
  }, 100);
}
window.buyProductNow = buyProductNow;

function copyProductShareLink(productId) {
  const shareUrl = `${window.location.origin}${window.location.pathname}?product=${encodeURIComponent(productId)}`;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(shareUrl).then(() => {
      showToast('Product link copied to clipboard!', 'success');
    }).catch(() => {
      prompt('Copy this product link:', shareUrl);
    });
  } else {
    prompt('Copy this product link:', shareUrl);
  }
}

function openProductQuickView(productId) {
  navigateToProduct(productId, true);
}

function renderProductDetailPage(product) {
  if (!product) return;

  const contentBox = document.getElementById('quickview-modal-body');
  if (!contentBox) return;

  // Build gallery images: strictly show uploaded images only, never generate automatically
  let galleryImages = [];
  if (product.images && Array.isArray(product.images) && product.images.length > 0) {
    galleryImages = product.images.filter(img => typeof img === 'string' && img.trim() !== '');
  } else if (product.image && typeof product.image === 'string' && product.image.trim() !== '') {
    galleryImages = [product.image];
  } else {
    galleryImages = ['assets/logo.png'];
  }

  const specsList = Object.entries(product.specs || {})
    .filter(([k, v]) => {
      if (v === null || v === undefined) return false;
      const str = String(v).trim();
      return str !== '' && str !== '0' && str !== '0.0' && str !== '0 Ah' && str !== '0 V' && str !== '0W' && str !== '0VA';
    })
    .map(([k, v]) => `
    <tr>
      <th style="background:#F8FAFC; padding:0.65rem 0.9rem; text-align:left; font-size:0.82rem; width:36%; border-bottom:1px solid #E2E8F0; color:#334155;">${k}</th>
      <td style="padding:0.65rem 0.9rem; font-size:0.85rem; border-bottom:1px solid #E2E8F0; color:#0F172A; font-weight:600;">${v}</td>
    </tr>
  `).join('');

  // Related products
  const related = (window.productsCatalog || [])
    .filter(p => p.id !== product.id && (p.brandSlug === product.brandSlug || p.categories.some(c => product.categories.includes(c))))
    .slice(0, 3);

  contentBox.innerHTML = `
    <div class="quickview-scroll-wrapper">
      <div class="quickview-grid">
        <!-- Left: Image Gallery with Interactive Zoom -->
        <div>
          <div class="quickview-zoom-container" id="quickview-zoom-box">
            <img src="${galleryImages[0] || product.image || 'assets/logo.png'}" alt="${product.name}" class="quickview-img" id="quickview-main-image">
          </div>

          <!-- Multiple Thumbnails (Only displayed if multiple uploaded images exist) -->
          ${galleryImages.length > 1 ? `
          <div class="quickview-gallery-strip">
            ${galleryImages.map((imgSrc, idx) => `
              <div class="quickview-thumb-item ${idx === 0 ? 'active' : ''}" onmouseenter="switchQuickViewImage('${imgSrc}', this)" onclick="switchQuickViewImage('${imgSrc}', this)">
                <img src="${imgSrc}" alt="${product.name} view ${idx + 1}">
              </div>
            `).join('')}
          </div>
          <p style="text-align:center; font-size:0.75rem; color:#64748B; margin-top:0.4rem;">
            Hover over any thumbnail to preview
          </p>
          ` : ''}
        </div>

        <!-- Right: Product Info, Actions & Buying -->
        <div>
          <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.5rem; flex-wrap:wrap;">
            <span class="product-brand-badge" style="background:${product.brandColor}15; color:${product.brandColor}; border:1px solid ${product.brandColor}30;">
              AET Official Partner • ${product.brand} Genuine
            </span>
            <span style="font-size:0.75rem; font-weight:700; color:var(--color-success); background:var(--color-success-bg); padding:2px 8px; border-radius:4px;">
              ✓ 100% Genuine Stamped Warranty
            </span>
          </div>

          <h2 style="font-family:var(--font-heading); font-size:1.65rem; font-weight:800; line-height:1.2; color:#0F172A; margin-bottom:0.5rem;">
            ${product.name}
          </h2>

          <div style="font-family:monospace; font-size:0.85rem; color:#64748B; margin-bottom:1rem; display:flex; gap:1rem; flex-wrap:wrap;">
            <span>SKU: <strong>${product.sku}</strong></span>
            <span>Stock: <strong style="color:${product.stock > 0 ? 'var(--color-success)' : 'var(--color-danger)'};">${product.stock > 0 ? product.stock + ' units ready in store' : 'Out of stock'}</strong></span>
            <span>Rating: <strong style="color:#D97706;">★ ${product.rating || 4.9} (${product.reviewsCount || 84} reviews)</strong></span>
          </div>

          <div style="display:flex; align-items:baseline; gap:0.75rem; margin-bottom:1.25rem;">
            <span style="font-family:var(--font-heading); font-size:1.85rem; font-weight:800; color:var(--color-exide-red);">
              NPR ${product.price.toLocaleString()}
            </span>
            ${product.originalPrice && product.originalPrice > product.price ? `
              <span style="font-size:1.05rem; color:#94A3B8; text-decoration:line-through;">
                NPR ${product.originalPrice.toLocaleString()}
              </span>
              <span class="product-discount-badge" style="position:static;">
                ${product.discount}
              </span>
            ` : ''}
          </div>

          <!-- Short Description -->
          <div style="background:#F8FAFC; border-left:4px solid var(--color-exide-blue); padding:0.75rem 1rem; border-radius:0 6px 6px 0; font-size:0.88rem; color:#334155; margin-bottom:1.25rem; line-height:1.5;">
            ${product.shortDesc || product.description}
          </div>

          <!-- Tagged Compatible Vehicles (for Automotive / Car Batteries) -->
          ${((product.compatibleVehicles && product.compatibleVehicles.length) || (product.specs && product.specs['Compatible Vehicles'])) ? `
            <div style="background:#EFF6FF; border:1px solid #BFDBFE; border-radius:8px; padding:0.75rem 1rem; margin-bottom:1.25rem;">
              <div style="font-size:0.8rem; font-weight:800; color:#1D4ED8; margin-bottom:0.4rem; display:flex; align-items:center; gap:0.4rem;">
                🚗 Compatible Vehicles & Models:
              </div>
              <div style="display:flex; flex-wrap:wrap; gap:0.4rem;">
                ${(product.compatibleVehicles || (product.specs['Compatible Vehicles'] || '').split(',').map(s=>s.trim())).filter(Boolean).map(veh => `
                  <span style="background:#FFFFFF; color:#1E40AF; border:1px solid #93C5FD; font-size:0.75rem; font-weight:700; padding:2px 8px; border-radius:4px; box-shadow:0 1px 2px rgba(0,0,0,0.05);">${veh}</span>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Quantity Selector & Actions Group -->
          <div style="margin-bottom:1.25rem; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:10px; padding:0.85rem 1rem;">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:0.75rem; flex-wrap:wrap; gap:0.5rem;">
              <label for="detail-qty-input" style="font-size:0.85rem; font-weight:700; color:#0F172A;">Quantity:</label>
              <div class="qty-control" style="background:#FFFFFF; border:1px solid #CBD5E1;">
                <button class="qty-btn" type="button" onclick="updateProductDetailQty(-1, ${product.stock})" aria-label="Decrease quantity" style="background:#F1F5F9; color:#0F172A;">-</button>
                <input type="number" id="detail-qty-input" value="1" min="1" max="${product.stock}" oninput="setProductDetailQty(this.value, ${product.stock})" style="width:48px; height:28px; text-align:center; border:none; font-weight:800; font-size:0.95rem; color:#0F172A; background:transparent;">
                <button class="qty-btn" type="button" onclick="updateProductDetailQty(1, ${product.stock})" aria-label="Increase quantity" style="background:#F1F5F9; color:#0F172A;">+</button>
              </div>
            </div>

            <!-- Action Buttons: Add to Cart, Buy Now, WhatsApp -->
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.65rem; margin-bottom:0.65rem;">
              <button class="btn-primary-red" style="height:44px; font-size:0.9rem; font-weight:800; border-radius:8px;" onclick="window.cartSystem.addItem('${product.id}', activeDetailQuantity); closeProductDetails(true);" ${product.stock <= 0 ? 'disabled style="opacity:0.5;"' : ''}>
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>
                <span>Add to Cart</span>
              </button>

              <button class="btn-buy-now" style="height:44px; font-size:0.9rem; font-weight:800; border-radius:8px; background:#0047BA; color:#FFFFFF; border:none; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; gap:0.4rem;" onclick="buyProductNow('${product.id}')" ${product.stock <= 0 ? 'disabled style="opacity:0.5;"' : ''}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                <span>Buy Now</span>
              </button>
            </div>

            <div style="display:grid; grid-template-columns:1fr auto; gap:0.5rem;">
              <a href="https://wa.me/9779705997260?text=Hi%20Exide%20Battery%20Wholesale%2C%20I%20am%20interested%20in%20${encodeURIComponent(product.name)}%20(SKU%3A%20${product.sku})%20priced%20at%20NPR%20${product.price}." target="_blank" rel="noopener noreferrer" class="btn-whatsapp-aligned" style="width:100%; height:40px; font-size:0.85rem; padding:0 0.85rem;">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                  <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.03 14.69 2 12.04 2ZM12.05 20.15C10.57 20.15 9.12 19.75 7.85 19L7.55 18.82L4.43 19.64L5.26 16.6L5.06 16.29C4.24 14.98 3.81 13.47 3.81 11.91C3.81 7.37 7.5 3.69 12.05 3.69C14.25 3.69 16.31 4.55 17.87 6.11C19.42 7.66 20.28 9.72 20.28 11.92C20.27 16.46 16.59 20.15 12.05 20.15ZM16.57 14.37C16.32 14.25 15.1 13.65 14.87 13.56C14.64 13.48 14.48 13.44 14.31 13.68C14.15 13.93 13.66 14.5 13.51 14.67C13.37 14.83 13.22 14.85 12.97 14.73C12.72 14.6 11.93 14.34 10.99 13.51C10.26 12.86 9.77 12.05 9.62 11.8C9.48 11.55 9.61 11.42 9.73 11.3C9.84 11.19 9.98 11.01 10.1 10.87C10.23 10.73 10.27 10.62 10.35 10.46C10.44 10.29 10.39 10.15 10.33 10.03C10.27 9.9 9.77 8.68 9.57 8.18C9.37 7.69 9.17 7.76 9.02 7.75C8.88 7.74 8.71 7.74 8.55 7.74C8.38 7.74 8.12 7.8 7.89 8.05C7.67 8.3 7.03 8.89 7.03 10.1C7.03 11.31 7.91 12.47 8.03 12.63C8.16 12.8 9.76 15.26 12.21 16.32C12.79 16.57 13.25 16.72 13.6 16.83C14.19 17.02 14.72 16.99 15.15 16.93C15.63 16.86 16.62 16.33 16.83 15.75C17.03 15.16 17.03 14.66 16.97 14.56C16.91 14.45 16.82 14.49 16.57 14.37Z"/>
                </svg>
                <span>WhatsApp</span>
              </a>
              <button type="button" onclick="copyProductShareLink('${product.id}')" style="height:40px; font-size:0.8rem; font-weight:700; color:#0047BA; background:#EFF6FF; border:1px solid #BFDBFE; border-radius:6px; padding:0 0.75rem; cursor:pointer;" title="Share product link">
                🔗 Link
              </button>
            </div>
          </div>

          <!-- Doorstep Service Highlights -->
          <div class="product-perks-strip">
            <div class="perk-item">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              <span>Free Delivery & Terminal Fitting</span>
            </div>
            <div class="perk-item">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              <span>Old Scrap Battery Cash Rebate</span>
            </div>
            <div class="perk-item">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              <span>Doorstep Claim at Any Nepal Outlet</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Detailed Description & Highlights -->
      <div style="margin-top:2rem; padding-top:1.5rem; border-top:1px solid #E2E8F0;">
        <h3 style="font-size:1.15rem; font-weight:800; color:#0F172A; margin-bottom:0.75rem;">Product Overview & In-Depth Details</h3>
        <div class="product-description-body" style="font-size:0.92rem; color:#475569; line-height:1.7; margin-bottom:1.25rem;">
          ${product.description}
        </div>

        ${product.features && product.features.length ? `
          <h4 style="font-size:0.95rem; font-weight:800; color:#0F172A; margin-bottom:0.5rem;">Key Engineering Advantages:</h4>
          <ul style="list-style:disc; margin-left:1.5rem; color:#475569; font-size:0.9rem; line-height:1.7; margin-bottom:1.5rem;">
            ${product.features.map(f => `<li>${f}</li>`).join('')}
          </ul>
        ` : ''}

        <!-- Technical Specifications Table -->
        <h3 style="font-size:1.15rem; font-weight:800; color:#0F172A; margin-bottom:0.75rem;">Official Technical Specifications</h3>
        <table class="specs-full-table">
          <tbody>${specsList}</tbody>
        </table>
      </div>

      <!-- Related Products Section (Fully Scrollable & Interactive) -->
      ${related.length > 0 ? `
        <div class="related-products-section">
          <div class="related-header">
            <h3>You May Also Need / Related Power Solutions</h3>
            <span style="font-size:0.85rem; color:#64748B;">Compatible with your setup</span>
          </div>
          <div class="related-products-grid">
            ${related.map(r => `
              <div class="related-card" onclick="openProductQuickView('${r.id}')">
                <img src="${r.image}" alt="${r.name}" class="related-thumb">
                <div class="related-body">
                  <span class="related-brand">${r.brand}</span>
                  <h4 class="related-title" title="${r.name}">${r.name}</h4>
                  <div class="related-price">NPR ${r.price.toLocaleString()}</div>
                  <button class="btn-primary-red" style="height:32px; font-size:0.75rem; width:100%; margin-top:0.4rem;" onclick="event.stopPropagation(); window.cartSystem.addItem('${r.id}', 1, this);">
                    + Add to Cart
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;

  initImageZoom();
  document.getElementById('quickview-modal-overlay').classList.add('open');
}

function switchQuickViewImage(src, thumbEl) {
  const mainImg = document.getElementById('quickview-main-image');
  if (mainImg) {
    mainImg.style.opacity = '0.4';
    setTimeout(() => {
      mainImg.src = src;
      mainImg.style.opacity = '1';
    }, 120);
  }
  document.querySelectorAll('.quickview-thumb-item').forEach(t => t.classList.remove('active'));
  if (thumbEl) thumbEl.classList.add('active');
}

function initImageZoom() {
  const box = document.getElementById('quickview-zoom-box');
  const img = document.getElementById('quickview-main-image');
  if (!box || !img) return;

  box.addEventListener('mousemove', (e) => {
    const rect = box.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    img.style.transformOrigin = `${x}% ${y}%`;
    img.style.transform = 'scale(1.45)';
  });

  box.addEventListener('mouseleave', () => {
    img.style.transformOrigin = 'center center';
    img.style.transform = 'scale(1)';
  });
}

function closeQuickViewModal() {
  closeProductDetails(true);
  document.body.style.overflow = '';
  document.documentElement.style.overflow = '';
}

// ==========================================================================
// 6. INVERTER & BATTERY LOAD CALCULATOR (NEPAL POWER SIZING)
// ==========================================================================
const APPLIANCES_CONFIG = [
  { id: 'app-led', name: 'LED Lights (15W)', watt: 15, count: 6 },
  { id: 'app-fan', name: 'Ceiling Fans (75W)', watt: 75, count: 3 },
  { id: 'app-tv', name: 'LED TV (100W)', watt: 100, count: 1 },
  { id: 'app-router', name: 'Wi-Fi Router (15W)', watt: 15, count: 1 },
  { id: 'app-pc', name: 'Computer / Laptop (120W)', watt: 120, count: 1 },
  { id: 'app-fridge', name: 'Refrigerator (250W)', watt: 250, count: 0 },
  { id: 'app-pump', name: 'Water Pump (750W / 1HP)', watt: 750, count: 0 },
  { id: 'app-cooler', name: 'Room Cooler / Mixer (180W)', watt: 180, count: 0 }
];

let selectedBackupHours = 4;
let selectedSystemType = 'inverter'; // 'inverter' | 'solar' | 'both'
let calcSelectedItems = {
  includeBattery: true,
  includeInverter: true
};

function initLoadCalculator() {
  const container = document.getElementById('calc-appliances-container');
  if (!container) return;

  container.innerHTML = APPLIANCES_CONFIG.map(app => `
    <div class="calc-appliance-item">
      <div class="appliance-info">
        <span class="appliance-name">${app.name}</span>
        <span class="appliance-watt">${app.watt} Watts each</span>
      </div>
      <div class="qty-control">
        <button class="qty-btn" type="button" onclick="updateCalcAppliance('${app.id}', -1)">-</button>
        <input type="number" id="qty-${app.id}" class="calc-qty-input" value="${app.count}" min="0" max="99" oninput="setCalcApplianceQty('${app.id}', this.value)" onchange="setCalcApplianceQty('${app.id}', this.value)">
        <button class="qty-btn" type="button" onclick="updateCalcAppliance('${app.id}', 1)">+</button>
      </div>
    </div>
  `).join('');

  // Quick buttons (1 to 4 hours)
  document.querySelectorAll('.btn-hour-choice').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.btn-hour-choice').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      selectedBackupHours = parseInt(e.target.dataset.hours, 10);
      const dropdown = document.getElementById('calc-backup-hours-dropdown');
      if (dropdown) dropdown.value = selectedBackupHours;
      recalculatePower();
    });
  });

  // Dropdown menu for backup hours
  const hoursDropdown = document.getElementById('calc-backup-hours-dropdown');
  if (hoursDropdown) {
    hoursDropdown.addEventListener('change', (e) => {
      selectedBackupHours = parseInt(e.target.value, 10);
      document.querySelectorAll('.btn-hour-choice').forEach(b => {
        b.classList.toggle('active', parseInt(b.dataset.hours, 10) === selectedBackupHours);
      });
      recalculatePower();
    });
  }

  // Energy source / system type selector buttons
  document.querySelectorAll('.btn-sys-type').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.btn-sys-type').forEach(b => b.classList.remove('active'));
      const targetBtn = e.target.closest('.btn-sys-type');
      targetBtn.classList.add('active');
      selectedSystemType = targetBtn.dataset.type;
      recalculatePower();
    });
  });

  recalculatePower();
}

function updateCalcAppliance(appId, delta) {
  const app = APPLIANCES_CONFIG.find(a => a.id === appId);
  if (!app) return;

  app.count = Math.max(0, app.count + delta);
  const input = document.getElementById(`qty-${app.id}`);
  if (input) input.value = app.count;

  recalculatePower();
}

function setCalcApplianceQty(appId, val) {
  const app = APPLIANCES_CONFIG.find(a => a.id === appId);
  if (!app) return;

  const parsed = parseInt(val, 10);
  app.count = isNaN(parsed) || parsed < 0 ? 0 : parsed;
  recalculatePower();
}

function recalculatePower() {
  const totalWatts = APPLIANCES_CONFIG.reduce((sum, a) => sum + (a.watt * a.count), 0);

  const wattEl = document.getElementById('calc-total-watts');
  const vaEl = document.getElementById('calc-recommended-va');
  const ahEl = document.getElementById('calc-recommended-ah');
  const pkgContainer = document.getElementById('calc-package-breakdown');

  if (totalWatts === 0) {
    if (wattEl) wattEl.textContent = '0 W';
    if (vaEl) vaEl.textContent = '0 VA';
    if (ahEl) ahEl.textContent = '0 Ah';

    if (pkgContainer) {
      pkgContainer.innerHTML = `
        <div class="calc-empty-prompt" style="padding:1.75rem 1.25rem; text-align:center; background:rgba(255,255,255,0.04); border:1.5px dashed rgba(255,255,255,0.18); border-radius:14px; margin-top:1rem;">
          <div style="font-size:2rem; margin-bottom:0.4rem;">⚡</div>
          <div style="font-weight:800; font-size:1.05rem; color:#FFFFFF; margin-bottom:0.35rem;">Select your appliances above</div>
          <p style="font-size:0.84rem; color:#94A3B8; margin:0 auto; max-width:340px; line-height:1.45;">
            Add LED bulbs, fans, TV, Wi-Fi router, or laptops to calculate the exact inverter wattage, voltage system, and battery capacity for your backup needs.
          </p>
        </div>
      `;
    }
    return;
  }

  // Electrical Engineering Calculation:
  // Power Factor = 0.8
  // Safety / Surge Headroom = 25% (1.25 multiplier)
  // Inverter Efficiency = 85% (0.85)
  // Usable DoD (Depth of Discharge) for Tubular Battery = 70% (0.70)
  const powerFactor = 0.8;
  const surgeMultiplier = 1.25;
  const inverterEfficiency = 0.85;
  const batteryDoD = 0.70;

  const rawVA = (totalWatts / powerFactor) * surgeMultiplier;
  const recommendedVA = Math.ceil(rawVA / 50) * 50; // Rounded to nearest 50 VA

  // Battery Energy needed Wh = (Watts * Hours) / (Efficiency * DoD)
  const energyWh = Math.round((totalWatts * selectedBackupHours) / (inverterEfficiency * batteryDoD));

  // Determine system DC Voltage (12V, 24V or 48V)
  let systemVoltage = 12;
  let batteryQuantity = 1;

  if (recommendedVA > 2200) {
    systemVoltage = 48;
    batteryQuantity = 4;
  } else if (recommendedVA > 1150) {
    systemVoltage = 24;
    batteryQuantity = 2;
  } else {
    systemVoltage = 12;
    batteryQuantity = 1;
  }

  // Required Ah per battery string at systemVoltage
  const requiredAhPerBattery = Math.round(energyWh / systemVoltage);
  const totalAh12VEquiv = Math.round(energyWh / 12);

  // Determine Battery Specification
  let batteryModelName = "Exide 150 Ah Invamaster Tubular Battery (IMTT1500)";
  let batteryAmpereRating = "150 Ah";
  let batteryPrice = 34000;
  let targetBatteryId = "exide-battery-150-invamaster";

  if (requiredAhPerBattery > 165 || totalAh12VEquiv > 220) {
    batteryModelName = "Exide 200 Ah Invamaster Tall Tubular Battery (IMTT2000)";
    batteryAmpereRating = "200 Ah";
    batteryPrice = 44499;
    targetBatteryId = "exide-200ah-invamaster-battery";
  } else if (requiredAhPerBattery <= 85 && batteryQuantity === 1) {
    batteryModelName = "Exide Matrix 12V 80Ah Heavy-Duty Battery";
    batteryAmpereRating = "80 Ah";
    batteryPrice = 19800;
    targetBatteryId = "exide-matrix-car-battery";
  }

  // Determine Inverter / UPS / Solar Model based on Application
  let inverterModelName = "";
  let inverterPrice = 18500;
  let targetInverterId = "livfast-1175-inverter";

  if (selectedSystemType === 'solar') {
    if (systemVoltage >= 24) {
      inverterModelName = "Eastman 1500VA Solar Hybrid MPPT PCU (24V)";
      inverterPrice = 34000;
      targetInverterId = "eastman-solar-hybrid-pcu";
    } else {
      inverterModelName = "Smarten Superpower 1100VA MPPT Solar PCU (12V)";
      inverterPrice = 23500;
      targetInverterId = "smarten-superpower-pcu";
    }
  } else if (selectedSystemType === 'both') {
    if (systemVoltage >= 24) {
      inverterModelName = "Smarten Saver 2500VA Heavy-Duty Solar & Grid Dual PCU (24V)";
      inverterPrice = 44000;
      targetInverterId = "smarten-saver-dual-pcu";
    } else {
      inverterModelName = "Livfast 1175 Pure Sinewave Dual Solar-Grid Inverter (12V)";
      inverterPrice = 22000;
      targetInverterId = "livfast-1175-inverter";
    }
  } else {
    // Normal Inverter / Home UPS
    if (systemVoltage >= 24) {
      inverterModelName = "Smarten 1500VA Pure Sinewave Inverter (24V System)";
      inverterPrice = 26500;
      targetInverterId = "smarten-lithium-inverter";
    } else {
      inverterModelName = "Livfast 1175 Pure Sinewave Inverter (1050VA / 12V)";
      inverterPrice = 18500;
      targetInverterId = "livfast-1175-inverter";
    }
  }

  // Update UI Elements
  if (wattEl) wattEl.textContent = `${totalWatts} W`;
  if (vaEl) vaEl.textContent = `${recommendedVA} VA (${systemVoltage}V System)`;
  if (ahEl) ahEl.textContent = `${batteryQuantity}x ${batteryAmpereRating} (${totalAh12VEquiv} Ah eq.)`;

  if (pkgContainer) {
    const totalBatteryCost = batteryPrice * batteryQuantity;
    const totalPkgPrice = (calcSelectedItems.includeBattery ? totalBatteryCost : 0) + (calcSelectedItems.includeInverter ? inverterPrice : 0);

    pkgContainer.innerHTML = `
      <div class="pkg-config-badge">
        <span>⚡ System Architecture: <strong>${systemVoltage}V DC Bus</strong></span>
        <span>🕒 Target Backup: <strong>${selectedBackupHours} Hours</strong></span>
      </div>

      <div class="pkg-paired-list">
        <!-- Battery Option -->
        <label class="pkg-check-row">
          <input type="checkbox" id="calc-check-batt" ${calcSelectedItems.includeBattery ? 'checked' : ''} onchange="toggleCalcItem('includeBattery', this.checked)">
          <div class="pkg-item-desc">
            <span class="pkg-item-type">🔋 Recommended Battery:</span>
            <strong>${batteryQuantity}x ${batteryModelName}</strong>
            <small style="color:#94A3B8; display:block; margin-top:2px;">Capacity: ${batteryAmpereRating} each | 36 Months Official Warranty</small>
          </div>
          <div class="pkg-item-price">
            NPR ${totalBatteryCost.toLocaleString()}
          </div>
        </label>

        <!-- Inverter Option -->
        <label class="pkg-check-row">
          <input type="checkbox" id="calc-check-inv" ${calcSelectedItems.includeInverter ? 'checked' : ''} onchange="toggleCalcItem('includeInverter', this.checked)">
          <div class="pkg-item-desc">
            <span class="pkg-item-type">🔌 Paired Inverter / PCU:</span>
            <strong>1x ${inverterModelName}</strong>
            <small style="color:#94A3B8; display:block; margin-top:2px;">Output: ${recommendedVA} VA Rating | Pure Sine Wave</small>
          </div>
          <div class="pkg-item-price">
            NPR ${inverterPrice.toLocaleString()}
          </div>
        </label>
      </div>

      <div class="pkg-summary-bar">
        <div>
          <span style="font-size:0.8rem; color:#94A3B8; display:block;">Estimated Package Price:</span>
          <strong style="font-size:1.3rem; color:var(--color-exide-red);">NPR ${totalPkgPrice.toLocaleString()}</strong>
        </div>
        <button class="btn-primary-red btn-calc-add" id="calc-add-pkg-btn" onclick="addCalculatedPackageToCart('${targetBatteryId}', ${batteryQuantity}, '${targetInverterId}', this)">
          <span>Add Selected to Cart</span>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
        </button>
      </div>
      <div style="font-size:0.75rem; color:#64748B; margin-top:0.75rem; text-align:center;">
        ⚙️ Engineered for Nepal grid conditions: 0.8 PF, 25% safety reserve, 85% inverter efficiency & 70% tubular battery usable DoD.
      </div>
    `;
  }
}

function toggleCalcItem(itemKey, isChecked) {
  calcSelectedItems[itemKey] = isChecked;
  recalculatePower();
}

function addCalculatedPackageToCart(batteryId, batteryQty, inverterId, btnEl) {
  if (!calcSelectedItems.includeBattery && !calcSelectedItems.includeInverter) {
    showToast('Please check at least one component (Battery or Inverter)', 'warning');
    return;
  }

  if (calcSelectedItems.includeBattery) {
    window.cartSystem.addItem(batteryId, batteryQty);
  }

  if (calcSelectedItems.includeInverter) {
    window.cartSystem.addItem(inverterId, 1);
  }

  if (btnEl) {
    animateAddToCartButton(btnEl);
  }

  showToast('Recommended power system added to cart!', 'success');
}

// ==========================================================================
// 7. WARRANTY VERIFICATION TOOL
// ==========================================================================
function initWarrantyChecker() {
  const form = document.getElementById('warranty-checker-form');
  const resultBox = document.getElementById('warranty-result-box');
  if (!form || !resultBox) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const serial = document.getElementById('warranty-serial-input').value.trim().toUpperCase();
    if (!serial) {
      showToast('Please enter your battery serial number', 'warning');
      return;
    }

    let foundProduct = null;
    (window.productsCatalog || []).forEach(p => {
      if (p.serialNumbers && p.serialNumbers.some(s => s.toUpperCase() === serial)) {
        foundProduct = p;
      }
    });

    if (foundProduct || serial.startsWith('EX-') || serial.startsWith('SN-')) {
      const prodName = foundProduct ? foundProduct.name : 'Exide Genuine Tubular Power Battery';
      const warrantyPeriod = foundProduct ? foundProduct.warranty : '36 Months Official Warranty';

      resultBox.style.display = 'block';
      resultBox.innerHTML = `
        <div style="background:var(--color-success-bg); border:1.5px solid var(--color-success); border-radius:var(--radius-md); padding:1.25rem;">
          <div style="display:flex; align-items:center; gap:0.5rem; color:var(--color-success); font-weight:800; font-size:1.1rem; margin-bottom:0.5rem;">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            100% Genuine Authorized Battery Verified
          </div>
          <div style="font-size:0.9rem; color:#0F172A; margin-bottom:0.25rem;">
            Product: <strong>${prodName}</strong>
          </div>
          <div style="font-size:0.85rem; color:#475569;">
            Serial Number: <code style="font-weight:700;">${serial}</code>
          </div>
          <div style="font-size:0.85rem; color:#475569;">
            Warranty Coverage: <strong style="color:var(--color-exide-blue);">${warrantyPeriod}</strong>
          </div>
          <div style="font-size:0.8rem; color:#10B981; margin-top:0.5rem; font-weight:600;">
            ✓ Eligible for free doorstep service & replacement claim at any Exide Battery Wholesale outlet (Hotline: +9779705997260).
          </div>
        </div>
      `;
      showToast('Serial verified successfully!', 'success');
    } else {
      resultBox.style.display = 'block';
      resultBox.innerHTML = `
        <div style="background:var(--color-danger-bg); border:1.5px solid var(--color-danger); border-radius:var(--radius-md); padding:1.25rem;">
          <div style="color:var(--color-danger); font-weight:800; font-size:1rem; margin-bottom:0.25rem;">
            Serial Number Not Found in Live Records
          </div>
          <p style="font-size:0.85rem; color:#475569;">
            If you purchased this battery from an authorized sub-dealer, please contact our Nepal hotline at <strong>+9779705997260</strong> with your purchase receipt.
          </p>
        </div>
      `;
    }
  });
}

// ==========================================================================
// 8. STORE OUTLETS
// ==========================================================================
function initOutlets() {
  const container = document.getElementById('outlets-grid-container');
  if (!container || !NEPAL_LOCATIONS) return;

  container.innerHTML = NEPAL_LOCATIONS.outlets.map(o => `
    <div class="outlet-card">
      <div class="outlet-city">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--color-exide-red);"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
        ${o.city}
      </div>
      <div class="outlet-address">${o.address}</div>
      <div style="font-size:0.8rem; color:#64748B; margin-bottom:0.75rem;">🕒 ${o.time}</div>
      <a href="tel:${o.phone.replace(/[^0-9+]/g, '')}" class="outlet-contact-link">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
        ${o.phone}
      </a>
    </div>
  `).join('');
}

// ==========================================================================
// 9. GLOBAL SEARCH (Pinned While Searching & Isolated Result Mode)
// ==========================================================================
function updateSearchModePinning(val) {
  const q = (val || '').trim();
  const header = document.querySelector('.site-header');
  const clearBtn = document.getElementById('search-clear-btn');

  if (q.length > 0) {
    document.body.classList.add('search-mode-active');
    header?.classList.add('search-pinned');
    if (clearBtn) clearBtn.classList.add('visible');
  } else {
    document.body.classList.remove('search-mode-active');
    header?.classList.remove('search-pinned');
    if (clearBtn) clearBtn.classList.remove('visible');
  }
}

const POPULAR_SEARCH_QUERIES = [
  'Exide IMTT1500',
  '150Ah Tall Tubular',
  'Exide IT500',
  'Car Battery 45Ah',
  'Solar Hybrid PCU',
  'Lithium LiFePO4',
  'Old Battery Scrap'
];

window.confirmSearchToCatalog = function(overrideTerm) {
  const headerSearchInput = document.getElementById('global-search-input');
  const catalogSearchInput = document.getElementById('catalog-search-input');
  const dropdown = document.getElementById('global-search-dropdown');
  const term = overrideTerm !== undefined ? overrideTerm : (headerSearchInput ? headerSearchInput.value.trim() : '');

  if (headerSearchInput) headerSearchInput.value = term;
  if (catalogSearchInput) catalogSearchInput.value = term;
  if (dropdown) dropdown.classList.remove('open');

  currentCatalogFilter.search = term;
  updateSearchModePinning(term);
  renderProductsCatalog();

  const productsSection = document.getElementById('products-section');
  if (productsSection) {
    const headerOffset = 80;
    const elementPosition = productsSection.getBoundingClientRect().top;
    const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
    window.scrollTo({ top: Math.max(0, offsetPosition), behavior: 'smooth' });
  }
};

window.clearGlobalSearch = function() {
  const headerSearchInput = document.getElementById('global-search-input');
  const catalogSearchInput = document.getElementById('catalog-search-input');
  const dropdown = document.getElementById('global-search-dropdown');

  if (headerSearchInput) headerSearchInput.value = '';
  if (catalogSearchInput) catalogSearchInput.value = '';
  if (dropdown) dropdown.classList.remove('open');

  updateSearchModePinning('');
  currentCatalogFilter.search = '';
  renderProductsCatalog();

  const productsSection = document.getElementById('products-section');
  if (productsSection) {
    productsSection.scrollIntoView({ behavior: 'smooth' });
  }
};

function renderSmartSearchDropdown(val) {
  const dropdown = document.getElementById('global-search-dropdown');
  if (!dropdown) return;

  const q = (val || '').trim();
  const catalog = window.productsCatalog || [];

  if (q.length === 0) {
    // Show Popular Searches chips when search input is empty but active/focused
    dropdown.innerHTML = `
      <div class="search-dropdown-quick-section">
        <div class="search-quick-title">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          <span>Popular Searches in Nepal</span>
        </div>
        <div class="search-quick-chips">
          ${POPULAR_SEARCH_QUERIES.map(item => `
            <button type="button" class="search-quick-chip" onclick="window.confirmSearchToCatalog('${escapeHtml(item)}')">
              <span>${escapeHtml(item)}</span>
            </button>
          `).join('')}
        </div>
      </div>
    `;
    dropdown.classList.add('open');
    return;
  }

  // Score all catalog products and rank by highest relevance on top
  const matches = [];
  for (const product of catalog) {
    const score = getSearchRelevanceScore(product, q);
    if (score > 0) {
      matches.push({ product, score });
    }
  }

  // Sort with highest relevance score directly on top
  matches.sort((a, b) => b.score - a.score);

  if (matches.length === 0) {
    dropdown.innerHTML = `
      <div class="search-dropdown-empty">
        <div style="font-size:1.8rem; margin-bottom:0.35rem;">🔍</div>
        <h4 style="font-size:0.95rem; font-weight:800; color:#0F172A; margin-bottom:0.25rem;">No exact match for "${escapeHtml(q)}"</h4>
        <p style="font-size:0.8rem; color:#64748B; margin-bottom:0.75rem;">Try searching by model (e.g. IMTT1500, IT500), capacity (150Ah), or vehicle type.</p>
        <div class="search-quick-chips">
          ${POPULAR_SEARCH_QUERIES.slice(0, 4).map(item => `
            <button type="button" class="search-quick-chip" onclick="window.confirmSearchToCatalog('${escapeHtml(item)}')">
              <span>${escapeHtml(item)}</span>
            </button>
          `).join('')}
        </div>
      </div>
    `;
    dropdown.classList.add('open');
    return;
  }

  // Render top matching products directly in smart dropdown
  const topMatches = matches.slice(0, 7);
  dropdown.innerHTML = `
    <div class="search-dropdown-header">
      <span class="search-match-count">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        <span>Found <strong>${matches.length}</strong> matching products</span>
      </span>
      <span class="view-all-link" onclick="window.confirmSearchToCatalog()">View all on top ↗</span>
    </div>

    <div class="search-dropdown-list">
      ${topMatches.map(({ product }) => {
        const highlightedTitle = highlightSearchMatch(product.name, q);
        const highlightedSku = highlightSearchMatch(product.sku, q);
        const hasDiscount = product.originalPrice && product.originalPrice > product.price;

        return `
          <div class="search-dropdown-item" onclick="window.confirmSearchToCatalog(); navigateToProduct('${product.id}')" title="Click to view details for ${product.name}">
            <img src="${product.image || 'assets/logo.png'}" alt="${product.name}" class="search-dropdown-thumb" loading="lazy" onerror="this.onerror=null; this.src='assets/logo.png';">
            <div class="search-dropdown-info">
              <div class="search-dropdown-title">${highlightedTitle}</div>
              <div class="search-dropdown-meta">
                <span class="search-dropdown-brand">${product.brand}</span>
                <span class="search-dropdown-sku">Model: ${highlightedSku}</span>
                ${product.capacity ? `<span class="search-dropdown-cap">${product.capacity}</span>` : ''}
              </div>
              <div class="search-dropdown-price-row">
                <span class="search-dropdown-price">NPR ${product.price.toLocaleString()}</span>
                ${hasDiscount ? `<span class="search-dropdown-orig-price">NPR ${product.originalPrice.toLocaleString()}</span>` : ''}
                ${product.stock > 0 ? '<span class="search-stock-badge in-stock">● In Stock</span>' : '<span class="search-stock-badge out-stock">● Out of Stock</span>'}
              </div>
            </div>
            <div class="search-dropdown-actions">
              <button type="button" class="btn-search-quick-add" onclick="event.stopPropagation(); window.quickAddToCart('${product.id}', this)" ${product.stock <= 0 ? 'disabled style="opacity:0.4; cursor:not-allowed;"' : ''} title="Add directly to cart">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>
                <span>+ Add</span>
              </button>
              <button type="button" class="btn-search-quick-buy" onclick="event.stopPropagation(); window.confirmSearchToCatalog(); window.buyProductNow('${product.id}')" ${product.stock <= 0 ? 'disabled style="opacity:0.4; cursor:not-allowed;"' : ''} title="Buy Now & Choose Old Battery Exchange">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                <span>Buy</span>
              </button>
            </div>
          </div>
        `;
      }).join('')}
    </div>

    <div class="search-dropdown-footer" onclick="window.confirmSearchToCatalog()">
      <span>Show all <strong>${matches.length}</strong> searched products on top of catalog</span>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
    </div>
  `;
  dropdown.classList.add('open');
}

function initGlobalSearch() {
  const headerSearchInput = document.getElementById('global-search-input');
  const clearBtn = document.getElementById('search-clear-btn');
  const dropdown = document.getElementById('global-search-dropdown');
  if (!headerSearchInput) return;

  let debounceTimer = null;

  // Real-time smart search on typing
  headerSearchInput.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    const val = e.target.value;

    updateSearchModePinning(val);

    debounceTimer = setTimeout(() => {
      const q = val.trim();
      currentCatalogFilter.search = q;
      const catalogSearchInput = document.getElementById('catalog-search-input');
      if (catalogSearchInput && catalogSearchInput.value !== val) {
        catalogSearchInput.value = val;
      }

      // Render live dropdown directly under search box
      renderSmartSearchDropdown(val);

      // Also update catalog and place searched items on top
      renderProductsCatalog();
    }, 120);
  });

  // Show smart search quick suggestions on focus
  headerSearchInput.addEventListener('focus', () => {
    renderSmartSearchDropdown(headerSearchInput.value);
    if (headerSearchInput.value.trim().length > 0) {
      updateSearchModePinning(headerSearchInput.value);
    }
  });

  // Enter or key navigation
  headerSearchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      clearTimeout(debounceTimer);
      window.confirmSearchToCatalog(headerSearchInput.value.trim());
    } else if (e.key === 'Escape') {
      if (dropdown) dropdown.classList.remove('open');
    }
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-input-wrapper')) {
      if (dropdown) dropdown.classList.remove('open');
    }
  });

  // Sync catalog-search-input back to headerSearchInput
  const catalogSearchInput = document.getElementById('catalog-search-input');
  if (catalogSearchInput) {
    catalogSearchInput.addEventListener('input', (e) => {
      if (headerSearchInput.value !== e.target.value) {
        headerSearchInput.value = e.target.value;
        updateSearchModePinning(e.target.value);
      }
    });
  }
}

// ==========================================================================
// 10. UNIFIED NAVIGATION CONTROLLER (Force Leave Open Modals & Navigate Reliably)
// ==========================================================================
window.forceLeaveAndNavigate = function(targetSelector, sourceBtn) {
  // 1. Tactile feedback on clicked button ("automaticaly show/ navigate clicked buttons always")
  const btn = sourceBtn || (window.event && window.event.target ? window.event.target.closest('button, a, .mobile-nav-item, .drawer-link') : null);
  if (btn) {
    btn.classList.add('btn-just-clicked');
    setTimeout(() => btn.classList.remove('btn-just-clicked'), 300);
  }

  // 2. FORCELY LEAVE CURRENT PAGES AT ANY COST:
  // Close EVERY open modal overlay (checkout modal, admin ERP, login, profile, etc.)
  document.querySelectorAll('.modal-overlay.open').forEach(modal => {
    modal.classList.remove('open');
  });

  // Close Cart Drawer
  const cartOverlay = document.getElementById('cart-drawer-overlay');
  if (cartOverlay) cartOverlay.classList.remove('open');
  if (window.cartSystem) {
    window.cartSystem.isDrawerOpen = false;
  }

  // Close Mobile Menu Drawer
  if (typeof window.toggleMobileDrawer === 'function') {
    window.toggleMobileDrawer(false);
  } else {
    const mobDrawer = document.getElementById('mobile-nav-drawer');
    const mobOverlay = document.getElementById('mobile-drawer-overlay');
    if (mobDrawer) mobDrawer.classList.remove('open');
    if (mobOverlay) mobOverlay.classList.remove('open');
  }

  // Close Mobile Filters
  if (typeof window.toggleMobileFilters === 'function') {
    window.toggleMobileFilters(false);
  }

  // Close Product Quickview Modal & clean up URL query parameter
  const qv = document.getElementById('quickview-modal-overlay');
  if (qv) qv.classList.remove('open');
  if (window.location.search && window.location.search.includes('product=')) {
    try {
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete('product');
      window.history.pushState({}, '', cleanUrl.pathname + (cleanUrl.search ? '?' + cleanUrl.searchParams.toString() : '') + (cleanUrl.hash || ''));
    } catch(e) {}
  }

  // 3. Forcibly restore body & documentElement scrollability
  document.body.style.overflow = '';
  document.documentElement.style.overflow = '';
  document.body.classList.remove('modal-open');

  // 4. Update Navigation Active States ("automaticaly show/ navigate clicked buttons always")
  if (targetSelector) {
    if (targetSelector === '#' || targetSelector === '#hero') {
      if (window.setMobileActiveNav) window.setMobileActiveNav('mob-nav-home');
    } else if (targetSelector === '#products-section') {
      if (window.setMobileActiveNav) window.setMobileActiveNav('mob-nav-shop');
    } else if (targetSelector === '#finder-section') {
      if (window.setMobileActiveNav) window.setMobileActiveNav('mob-nav-finder');
    }

    document.querySelectorAll('.nav-links a').forEach(a => {
      if (a.getAttribute('href') === targetSelector) {
        a.classList.add('active');
      } else {
        a.classList.remove('active');
      }
    });
  }

  if (!targetSelector) return;

  // 5. Scroll / Navigate forcibly to destination
  setTimeout(() => {
    if (targetSelector === '#' || targetSelector === '#hero') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (targetSelector.startsWith('#')) {
      const target = document.querySelector(targetSelector);
      if (target) {
        const headerOffset = 70;
        const elementPosition = target.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

        window.scrollTo({
          top: Math.max(0, offsetPosition),
          behavior: 'smooth'
        });
      } else {
        const el = document.getElementById(targetSelector.replace('#', ''));
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    } else if (targetSelector.startsWith('http://') || targetSelector.startsWith('https://') || targetSelector.startsWith('/')) {
      window.location.href = targetSelector;
    }
  }, 40);
};

window.smoothNav = function(targetSelector, sourceBtn) {
  window.forceLeaveAndNavigate(targetSelector, sourceBtn);
};

window.toggleMobileDrawer = function(forceState) {
  const drawer = document.getElementById('mobile-nav-drawer');
  const overlay = document.getElementById('mobile-drawer-overlay');
  const hamburger = document.getElementById('mobile-menu-toggle-btn');
  if (!drawer || !overlay) return;

  const isOpen = forceState !== undefined ? forceState : !drawer.classList.contains('open');
  if (isOpen) {
    drawer.classList.add('open');
    overlay.classList.add('open');
    if (hamburger) hamburger.classList.add('active');
    document.body.style.overflow = 'hidden';
    if (window.authManager) window.authManager.updateAuthUI();
  } else {
    drawer.classList.remove('open');
    overlay.classList.remove('open');
    if (hamburger) hamburger.classList.remove('active');
    document.body.style.overflow = '';
  }
};

window.setMobileActiveNav = function(activeId) {
  const items = document.querySelectorAll('.mobile-nav-item:not(.mob-cart-trigger)');
  items.forEach(it => it.classList.remove('active'));
  const target = document.getElementById(activeId);
  if (target) target.classList.add('active');
};

// Close mobile drawer on escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    window.toggleMobileDrawer(false);
  }
});

// ==========================================================================
// 11. MOBILE COLLAPSIBLE FILTERS CONTROLLER
// ==========================================================================
window.toggleMobileFilters = function(forceState) {
  const sidebar = document.getElementById('catalog-sidebar');
  const btn = document.getElementById('btn-toggle-filters-mobile');
  const chevron = document.getElementById('mobile-filter-chevron');
  if (!sidebar) return;

  const isOpen = forceState !== undefined ? forceState : !sidebar.classList.contains('mobile-expanded');
  if (isOpen) {
    sidebar.classList.add('mobile-expanded');
    if (btn) btn.classList.add('active');
    if (chevron) chevron.textContent = '▴';
  } else {
    sidebar.classList.remove('mobile-expanded');
    if (btn) btn.classList.remove('active');
    if (chevron) chevron.textContent = '▾';
  }
};

// ==========================================================================
// 12. DEEP LINKING URL PARAMETER LISTENER (WhatsApp Bill & Tax Invoice)
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const viewOrder = urlParams.get('view_order') || urlParams.get('view_bill');
  if (viewOrder) {
    setTimeout(() => {
      let orders = [];
      try {
        const stored = localStorage.getItem('bm_exide_orders');
        orders = stored ? JSON.parse(stored) : [];
      } catch(e) {}

      const found = orders.find(o => o.orderId === viewOrder || o.invoiceNumber === viewOrder);
      if (found && window.cartSystem) {
        window.cartSystem.lastOrder = found;
        window.cartSystem.openCheckoutModal();
        window.cartSystem.renderInvoiceUI(found);
        window.cartSystem.goToCheckoutStep(4);
      }
    }, 700);
  }
});

// ==========================================================================
// 13. GLOBAL BUTTON NAVIGATION INTERCEPTOR (Forcibly leave open views on click)
// ==========================================================================
document.addEventListener('click', function(e) {
  const trigger = e.target.closest('a[href^="#"], .mobile-nav-item, .drawer-link, .nav-links a, .hero-btn, .btn-hero, .btn-quick-view, [data-nav-target]');
  if (!trigger) return;

  // Let special modal triggers open their targeted modal after clearing previous state
  if (trigger.id === 'mob-nav-cart' || trigger.classList.contains('mob-cart-trigger') || trigger.id === 'mob-nav-account') {
    return;
  }

  const href = trigger.getAttribute('href') || trigger.getAttribute('data-nav-target');
  if (href && href.startsWith('#')) {
    e.preventDefault();
    window.forceLeaveAndNavigate(href, trigger);
  }
}, false);


