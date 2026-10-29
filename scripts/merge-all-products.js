const fs = require('fs');

const productsDataContent = fs.readFileSync('js/products-data.js', 'utf8');
const scrapedProducts = require('./scraped-batterymart-products.json');
const existingDbProducts = JSON.parse(fs.readFileSync('data/products.json', 'utf8'));

const BRAND_COLORS = {
  'exide': '#ED1C24',
  'amaron-quanta': '#618520',
  'livfast': '#FF5F1D',
  'sf-sonic': '#2E3077',
  'smarten': '#10509A',
  'eastman': '#253B81',
  'genus': '#0161A8',
  'geon': '#004B85',
  'luminous': '#0A387E',
  'livguard': '#E02636',
  'fuji-electric': '#C00000',
  'delta': '#0083CA',
  'hbl': '#003366',
  'mtekpower': '#D71920',
  'sukam': '#005596',
  'suntek': '#E86C00'
};

const matchInitial = productsDataContent.match(/const INITIAL_PRODUCTS = (\[[\s\S]*?\]);\r?\n\r?\nconst BRANDS_LIST/);
if (!matchInitial) {
  console.error('Could not find INITIAL_PRODUCTS in js/products-data.js');
  process.exit(1);
}

const existingStorefront = eval(matchInitial[1]);

// Keep only the original master products (those not starting with bm-)
const originalMaster = existingStorefront.filter(p => !p.id.startsWith('bm-'));
console.log(`Original master products count: ${originalMaster.length}`);

const mergedStorefront = [...originalMaster];
const seenIds = new Set(originalMaster.map(p => p.id));
const seenNames = new Set(originalMaster.map(p => p.name.toLowerCase().trim()));

for (const p of scrapedProducts) {
  const normName = p.name.toLowerCase().trim();
  if (seenNames.has(normName) || seenIds.has(p.id)) {
    continue;
  }
  seenNames.add(normName);
  seenIds.add(p.id);

  const brandSlug = p.brandSlug || (p.brand ? p.brand.toLowerCase().replace(/[^a-z0-9]+/g, '-') : 'exide');
  const brandColor = BRAND_COLORS[brandSlug] || '#0047BA';

  const cleanProduct = {
    id: p.id,
    sku: p.sku,
    name: p.name,
    brand: p.brand || 'Exide',
    brandSlug,
    brandColor,
    categories: Array.isArray(p.categories) && p.categories.length > 0 ? p.categories : ['inverter-battery'],
    price: p.price || 25000,
    originalPrice: p.originalPrice || Math.round((p.price || 25000) * 1.08),
    discount: p.discount || '8% off',
    image: p.image || 'assets/logo.png',
    images: Array.isArray(p.images) && p.images.length > 0 ? p.images : [p.image || 'assets/logo.png'],
    featured: false,
    warranty: p.warranty || '36 Months Official Warranty',
    capacity: p.capacity || '12V Power System',
    stock: p.stock || 20,
    minStock: 3,
    costPrice: p.costPrice || Math.round((p.price || 25000) * 0.82),
    rating: parseFloat(p.rating) || 4.8,
    reviewsCount: parseInt(p.reviewsCount, 10) || 32,
    shortDesc: p.shortDesc || '',
    description: p.description || '',
    features: Array.isArray(p.features) && p.features.length > 0 ? p.features : [
      'Genuine manufacturer power backup solution',
      'Engineered for deep cycle durability and continuous loads in Nepal',
      'Factory tested, pre-charged and certified'
    ],
    specs: (p.specs && typeof p.specs === 'object' && Object.keys(p.specs).length > 0) ? p.specs : {
      'Brand': p.brand,
      'Capacity': p.capacity,
      'Warranty': p.warranty
    },
    complimentaryServices: [
      'Free Battery Terminal Greasing (Prevents sulfur buildup)',
      'Free Inverter Charging Voltage Calibration Check',
      'Free Official Stamped Warranty Card Verification'
    ]
  };

  mergedStorefront.push(cleanProduct);
}

console.log(`Merged storefront catalog has ${mergedStorefront.length} total products.`);

const updatedProductsData = productsDataContent.replace(
  /const INITIAL_PRODUCTS = \[[\s\S]*?\];\r?\n\r?\nconst BRANDS_LIST/,
  `const INITIAL_PRODUCTS = ${JSON.stringify(mergedStorefront, null, 2)};\n\nconst BRANDS_LIST`
);

fs.writeFileSync('js/products-data.js', updatedProductsData, 'utf8');
console.log('✅ Updated js/products-data.js.');

// Database merge
const originalDb = existingDbProducts.filter(p => !p.id.startsWith('bm-'));
const mergedDb = [...originalDb];
const dbSeenIds = new Set(originalDb.map(p => p.id));
const dbSeenNames = new Set(originalDb.map(p => p.name.toLowerCase().trim()));

for (const p of mergedStorefront) {
  const normName = p.name.toLowerCase().trim();
  if (!dbSeenIds.has(p.id) && !dbSeenNames.has(normName)) {
    dbSeenIds.add(p.id);
    dbSeenNames.add(normName);
    mergedDb.push({
      id: p.id,
      sku: p.sku,
      name: p.name,
      brand: p.brand,
      brandSlug: p.brandSlug,
      categories: p.categories,
      capacity: p.capacity,
      warranty: p.warranty,
      costPrice: p.costPrice,
      price: p.price,
      wholesalePrice: Math.round(p.price * 0.9),
      stock: p.stock,
      minStock: p.minStock,
      image: p.image,
      images: p.images || [p.image],
      description: p.description,
      features: p.features,
      specs: p.specs,
      complimentaryServices: p.complimentaryServices,
      featured: p.featured,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }
}

fs.writeFileSync('data/products.json', JSON.stringify(mergedDb, null, 2), 'utf8');
console.log(`✅ Updated data/products.json with ${mergedDb.length} total products.`);
