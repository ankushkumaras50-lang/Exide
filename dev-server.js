// Local Development Server for Exide Battery Wholesale WebApp
// Pure Node.js - No external dependencies required
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const BASE_DIR = __dirname;

// Load .env file if present
try {
  const envPath = path.join(BASE_DIR, '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    lines.forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        let val = match[2] || '';
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (!process.env[match[1]]) process.env[match[1]] = val.replace(/\\n/g, '\n');
      }
    });
  }
} catch(e) {}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8'
};

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  let pathname = decodeURIComponent(parsedUrl.pathname);

  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  // Handle Serverless API routes
  if (pathname.startsWith('/api/')) {
    // Collect body if present
    const buffers = [];
    req.on('data', chunk => buffers.push(chunk));
    req.on('end', async () => {
      const rawBody = Buffer.concat(buffers).toString();
      try {
        req.body = rawBody ? JSON.parse(rawBody) : {};
      } catch (e) {
        req.body = rawBody;
      }
      req.query = parsedUrl.query;

      // Mock Vercel response helper
      res.status = function(code) {
        this.statusCode = code;
        return this;
      };
      res.json = function(data) {
        this.setHeader('Content-Type', 'application/json; charset=utf-8');
        this.end(JSON.stringify(data));
        return this;
      };

      // Resolve API handler path
      let apiRelPath = pathname.replace(/^\/api\//, '');
      let handlerPath = path.join(BASE_DIR, 'api', apiRelPath + '.js');

      if (!fs.existsSync(handlerPath)) {
        handlerPath = path.join(BASE_DIR, 'api', apiRelPath, 'index.js');
      }

      if (!fs.existsSync(handlerPath)) {
        if (apiRelPath.startsWith('auth/')) {
          handlerPath = path.join(BASE_DIR, 'api', 'auth.js');
          req.query = req.query || {};
          if (!req.query.action) req.query.action = apiRelPath.replace(/^auth\//, '');
        } else if (apiRelPath.startsWith('erp/')) {
          handlerPath = path.join(BASE_DIR, 'api', 'erp.js');
          req.query = req.query || {};
          if (!req.query.module) req.query.module = apiRelPath.replace(/^erp\//, '');
        }
      }

      if (fs.existsSync(handlerPath)) {
        try {
          delete require.cache[require.resolve(handlerPath)];
          const handler = require(handlerPath);
          await handler(req, res);
        } catch (err) {
          console.error(`API Error on ${pathname}:`, err);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: false, message: 'Internal API Server Error', error: err.message }));
        }
      } else {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: false, message: 'API Route Not Found' }));
      }
    });
    return;
  }

  // Handle Static Files
  if (pathname === '/' || pathname === '') {
    pathname = '/index.html';
  }

  const filePath = path.join(BASE_DIR, pathname);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Check if it's a directory with an index.html (e.g. /erp/)
      const dirIndex = path.join(filePath, 'index.html');
      if (fs.existsSync(dirIndex)) {
        serveFile(dirIndex, res);
        return;
      }

      // Fallback for cleanUrls (e.g. /product -> /product.html)
      const htmlPath = filePath + '.html';
      if (fs.existsSync(htmlPath)) {
        serveFile(htmlPath, res);
      } else if (pathname.startsWith('/erp') || pathname === '/admin') {
        // Fallback for ERP sub-routes to erp/index.html
        serveFile(path.join(BASE_DIR, 'erp', 'index.html'), res);
      } else {
        // Fallback to index.html for SPA-style storefront routing
        serveFile(path.join(BASE_DIR, 'index.html'), res);
      }
      return;
    }

    serveFile(filePath, res);
  });
});

function serveFile(filePath, res) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.statusCode = 500;
      res.end('Error loading file');
      return;
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', contentType);
    res.end(content);
  });
}

server.listen(PORT, () => {
  console.log(`Exide Battery Wholesale local server running at http://localhost:${PORT}`);
});
