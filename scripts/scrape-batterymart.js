const https = require('https');
const fs = require('fs');

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let loc = res.headers.location;
        if (loc.startsWith('/')) loc = 'https://www.batterymart.com.np' + loc;
        return fetchUrl(loc).then(resolve).catch(reject);
      }
      let html = '';
      res.on('data', chunk => html += chunk);
      res.on('end', () => resolve(html));
    }).on('error', reject);
  });
}

async function run() {
  const prodLinks = new Set();
  const re = /href=["'](\/products\/[^"'#?]+|https?:\/\/www\.batterymart\.com\.np\/products\/[^"'#?]+)["']/gi;

  for (let page = 1; page <= 12; page++) {
    const url = `https://www.batterymart.com.np/products?page=${page}`;
    try {
      console.log(`Fetching page ${page}...`);
      const html = await fetchUrl(url);
      let m;
      let count = 0;
      while ((m = re.exec(html))) {
        let p = m[1];
        if (p.startsWith('/')) p = 'https://www.batterymart.com.np' + p;
        if (p !== 'https://www.batterymart.com.np/products') {
          prodLinks.add(p);
          count++;
        }
      }
      console.log(`Page ${page}: found ${count} links (total unique so far: ${prodLinks.size})`);
    } catch (e) {
      console.warn(`Error on page ${page}:`, e.message);
    }
  }

  console.log('Final unique product URLs:', prodLinks.size);
  fs.writeFileSync('scripts/batterymart-product-urls.json', JSON.stringify(Array.from(prodLinks), null, 2));
}

run().catch(console.error);
