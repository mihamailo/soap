import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const rootDir = resolve(__dirname, '..');
const distDir = join(rootDir, 'dist');
const indexFile = join(distDir, 'index.html');
const port = Number.parseInt(process.env.PORT || process.env.APP_PORT || '3000', 10);

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

function json(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(body));
}

function serveStatic(req, res) {
  if (!existsSync(indexFile)) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Frontend build not found. Run pnpm build before starting the server.');
    return;
  }

  const requestUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(requestUrl.pathname);
  const normalizedPath = normalize(pathname).replace(/^(\.\.[/\\])+/, '');
  const requestedFile = join(distDir, normalizedPath);
  const safeFile = resolve(requestedFile);
  const filePath =
    safeFile.startsWith(distDir) && existsSync(safeFile) && statSync(safeFile).isFile()
      ? safeFile
      : indexFile;
  const extension = extname(filePath);

  const headers = {
    'Content-Type': mimeTypes[extension] || 'application/octet-stream',
  };

  if (extension !== '.html') {
    headers['Cache-Control'] = 'public, max-age=31536000, immutable';
  }

  res.writeHead(200, headers);

  if (req.method === 'HEAD') {
    res.end();
    return;
  }

  createReadStream(filePath)
    .on('error', () => {
      if (!res.headersSent) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      }
      res.end('Not found');
    })
    .pipe(res);
}

const server = createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    return json(res, 200, { ok: true, mode: 'frontend' });
  }

  if (req.method === 'GET' || req.method === 'HEAD') {
    return serveStatic(req, res);
  }

  res.writeHead(405, { Allow: 'GET, HEAD' });
  res.end();
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Frontend server is listening on port ${port}`);
});
