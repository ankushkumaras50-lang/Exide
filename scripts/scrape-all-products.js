const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const urls = require('./batterymart-product-urls.json');

function fetchUrl(url, retries = 3) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 15000
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let redirectUrl = res.headers.location;
        if (!redirectUrl.startsWith('http')) {
          redirectUrl = new URL(redirectUrl, url).toString();
        }
        return fetchUrl(redirectUrl, retries - 1).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        if (retries > 0) {
          setTimeout(() => fetchUrl(url, retries - 1).then(resolve).catch(reject), 1000);
        } else {
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        }
        return;
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', (err) => {
      if (retries > 0) {
        setTimeout(() => fetchUrl(url, retries - 1).then(resolve).catch(reject), 1000);
      } else {
        reject(err);
      }
    });
    req.on('timeout', () => {
      req.destroy();
      if (retries > 0) {
        setTimeout(() => fetchUrl(url, retries - 1).then(resolve).catch(reject), 1000);
      } else {
        reject(new Error(`Timeout for ${url}`));
      }
    });
  });
}

function parseProductPage(html, url) {
  let productLd = null;
  const jsonLdMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  if (jsonLdMatch) {
    for (const m of jsonLdMatch) {
      try {
        const content = m.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '').trim();
        const parsed = JSON.parse(content);
        if (parsed['@type'] === 'Product') {
          productLd = parsed;
          break;
        }
      } catch (e) {}
    }
  }

  // Name
  let name = '';
  if (productLd && productLd.name) {
    name = productLd.name;
  } else {
    const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    name = h1Match ? h1Match[1].replace(/<[^>]+>/g, '').trim() : '';
  }
  if (!name) return null;

  // Slug & ID
  const urlParts = url.split('/').filter(Boolean);
  const slug = urlParts[urlParts.length - 1];
  const id = `bm-${slug}`;

  // Brand
  let brand = 'Exide';
  if (productLd && productLd.brand) {
    brand = typeof productLd.brand === 'object' ? productLd.brand.name : productLd.brand;
  }
  if (!brand || brand.toLowerCase() === 'generic' || brand.toLowerCase() === 'battery mart') {
    // Attempt brand deduction from title
    const brandsCheck = ['Exide', 'Smarten', 'Livfast', 'Eastman', 'SF Sonic', 'Amaron', 'Luminous', 'Genus', 'Geon', 'Sukam', 'Livguard', 'Microtek', 'Okaya', 'V-Guard'];
    for (const b of brandsCheck) {
      if (new RegExp('\\b' + b + '\\b', 'i').test(name)) {
        brand = b;
        break;
      }
    }
  }
  brand = brand || 'Exide';
  const brandSlug = brand.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  // Category
  let categoryName = 'Inverter Battery';
  if (productLd && productLd.category) {
    categoryName = productLd.category;
  } else {
    const catMatch = html.match(/<a[^>]+href=["']\/categories\/([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
    if (catMatch) categoryName = catMatch[2].replace(/<[^>]+>/g, '').trim();
  }
  let catSlug = 'inverter-battery';
  const catLower = (categoryName + ' ' + name).toLowerCase();
  if (catLower.includes('solar') || catLower.includes('pcu')) {
    catSlug = 'solar-hybrid-pcu';
  } else if (catLower.includes('online ups') || catLower.includes('ups') && !catLower.includes('lithium')) {
    catSlug = 'online-ups';
  } else if (catLower.includes('lithium') || catLower.includes('lifepo4')) {
    catSlug = 'lithium-battery';
  } else if (catLower.includes('car') || catLower.includes('automotive') || catLower.includes('truck') || catLower.includes('tractor')) {
    catSlug = 'car-battery';
  } else if (catLower.includes('inverter') && !catLower.includes('battery')) {
    catSlug = 'inverter';
  }

  // Price & Original Price
  let price = 0;
  let originalPrice = 0;
  if (productLd && productLd.offers) {
    price = Number(productLd.offers.price) || 0;
    if (productLd.offers.priceSpecification && productLd.offers.priceSpecification.price) {
      originalPrice = Number(productLd.offers.priceSpecification.price) || 0;
    }
  }
  if (!price) {
    const priceM = html.match(/<span[^>]*class=["'][^"']*text-primary[^"']*["'][^>]*>\s*(?:NPR|Rs\.?)\s*([\d,]+)/i);
    if (priceM) price = parseInt(priceM[1].replace(/,/g, ''), 10) || 0;
  }
  if (!originalPrice) {
    const origM = html.match(/<span[^>]*class=["'][^"']*line-through[^"']*["'][^>]*>\s*(?:NPR|Rs\.?)\s*([\d,]+)/i);
    if (origM) originalPrice = parseInt(origM[1].replace(/,/g, ''), 10) || 0;
  }
  if (price > 0 && originalPrice <= price) {
    originalPrice = Math.round(price * 1.08 / 100) * 100;
  }
  const discount = originalPrice > price ? `${Math.round((1 - price / originalPrice) * 100)}% off` : '5% off';

  // Images
  let images = [];
  if (productLd && productLd.image) {
    images = Array.isArray(productLd.image) ? productLd.image : [productLd.image];
  }
  if (images.length === 0) {
    const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    let m;
    while ((m = imgRegex.exec(html)) !== null) {
      const src = m[1];
      if (src.includes('uploads') || src.includes('media') || src.includes('product')) {
        images.push(src);
      }
    }
  }
  images = images.map(src => {
    if (src.startsWith('http')) return src;
    if (src.startsWith('/')) return `https://www.batterymart.com.np${src}`;
    return `https://www.batterymart.com.np/${src}`;
  });
  const mainImage = images.length > 0 ? images[0] : 'assets/logo.png';

  // Description
  let description = '';
  if (productLd && productLd.description) {
    description = productLd.description;
  } else {
    const descM = html.match(/<p class="[^"]*text-justify[^"]*">([\s\S]*?)<\/p>/i);
    if (descM) description = descM[1].replace(/<[^>]+>/g, '').trim();
  }

  // Specifications
  const specs = {};
  const tableMatch = html.match(/<table[\s\S]*?<\/table>/i);
  if (tableMatch) {
    const rows = [...tableMatch[0].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
    for (const row of rows) {
      const cols = [...row[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(c => c[1].replace(/<[^>]+>/g, '').trim());
      if (cols.length >= 2 && cols[0]) {
        specs[cols[0]] = cols[1];
      }
    }
  }

  // Capacity & Warranty
  let capacity = specs['Capacity'] || '';
  if (!capacity) {
    const capM = name.match(/(\d+\s*Ah(?:\s*-\s*\d+V)?|\d+\s*VA|\d+\s*kVA|\d+\s*kW)/i);
    if (capM) capacity = capM[1];
    else capacity = '12V Power System';
  }

  let warranty = specs['Warranty'] || '';
  if (!warranty) {
    const warM = (html + ' ' + name).match(/(\d+\s*(?:Months|Years|Year|Month))/i);
    if (warM) warranty = `${warM[1]} Official Nepal Warranty`;
    else warranty = '36 Months Manufacturer Warranty';
  }

  // Model & SKU
  const model = specs['Model'] || '';
  let sku = model ? `${brand.slice(0, 3).toUpperCase()}-${model.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10).toUpperCase()}` : `BM-${slug.slice(0, 12).toUpperCase()}`;

  // Features
  let features = [];
  const ulLists = [...html.matchAll(/<ul[^>]*>([\s\S]*?)<\/ul>/gi)];
  for (const ul of ulLists) {
    const liItems = [...ul[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map(l => l[1].replace(/<[^>]+>/g, '').trim()).filter(Boolean);
    if (liItems.length >= 2 && !liItems[0].includes('Home') && !liItems[0].includes('Cart')) {
      features = liItems;
      break;
    }
  }
  if (features.length === 0) {
    features = [
      `Genuine ${brand} authorized power unit engineered for Nepal grid standards`,
      `Optimal duty cycle performance with high thermal tolerance`,
      `Factory inspected, pre-charged and certified with official stamped warranty`
    ];
  }

  return {
    id,
    sku,
    name,
    brand,
    brandSlug,
    categories: [catSlug],
    price: price || 25000,
    originalPrice: originalPrice || 28000,
    discount,
    image: mainImage,
    images: images.length > 0 ? images : [mainImage],
    featured: false,
    warranty,
    capacity,
    stock: Math.floor(Math.random() * 15) + 10,
    minStock: 3,
    costPrice: Math.round((price || 25000) * 0.82),
    rating: (4.7 + Math.random() * 0.3).toFixed(1),
    reviewsCount: Math.floor(Math.random() * 50) + 12,
    shortDesc: description.slice(0, 180) + '...',
    description: description || `${name} by ${brand} available with free installation and genuine manufacturer warranty in Nepal.`,
    features,
    specs,
    complimentaryServices: [
      "Free Battery Terminal Greasing (Prevents sulfur buildup)",
      "Free Inverter Charging Voltage Calibration Check",
      "Free Official Stamped Warranty Card Verification"
    ],
    sourceUrl: url
  };
}

async function run() {
  console.log(`Starting crawl of ${urls.length} products...`);
  const results = [];
  const concurrency = 12;
  let activeIndex = 0;
  let completed = 0;

  async function worker() {
    while (activeIndex < urls.length) {
      const idx = activeIndex++;
      const url = urls[idx];
      try {
        const html = await fetchUrl(url);
        const item = parseProductPage(html, url);
        if (item) {
          results.push(item);
        }
      } catch (err) {
        console.error(`Failed ${url}: ${err.message}`);
      }
      completed++;
      if (completed % 25 === 0 || completed === urls.length) {
        console.log(`Progress: ${completed}/${urls.length} products processed (${results.length} valid)`);
      }
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);

  console.log(`\nCrawl complete! Total extracted: ${results.length} products`);
  fs.writeFileSync('scripts/scraped-batterymart-products.json', JSON.stringify(results, null, 2), 'utf8');
  console.log('Saved to scripts/scraped-batterymart-products.json');
}

run();

