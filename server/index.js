import { createSign } from 'node:crypto';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const rootDir = resolve(__dirname, '..');
const distDir = join(rootDir, 'dist');
const port = Number.parseInt(process.env.PORT || process.env.APP_PORT || '3000', 10);
const maxBodyBytes = 16 * 1024;

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

let tokenCache = null;

function json(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(body));
}

function normalizePrivateKey(key) {
  return key?.replace(/\\n/g, '\n');
}

function base64url(value) {
  return Buffer.from(JSON.stringify(value))
    .toString('base64')
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}

async function readJsonBody(req) {
  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBodyBytes) {
      throw new Error('payload_too_large');
    }
    chunks.push(chunk);
  }

  if (!chunks.length) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function cleanString(value, maxLength) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function validateLead(payload) {
  const lead = {
    name: cleanString(payload.name, 80),
    phone: cleanString(payload.phone, 40),
    product: cleanString(payload.product, 120),
    message: cleanString(payload.message, 600),
    source: cleanString(payload.source, 120),
  };

  if (payload.website) {
    return { error: 'spam' };
  }

  if (!lead.name) {
    return { error: 'name_required' };
  }

  if (!lead.phone) {
    return { error: 'phone_required' };
  }

  if (!/^[\d\s()+-]{6,40}$/.test(lead.phone)) {
    return { error: 'phone_invalid' };
  }

  return { lead };
}

function requireGoogleConfig() {
  const config = {
    clientEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    privateKey: normalizePrivateKey(process.env.GOOGLE_PRIVATE_KEY),
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: process.env.GOOGLE_SHEET_RANGE || 'Leads!A:G',
  };

  if (!config.clientEmail || !config.privateKey || !config.spreadsheetId) {
    throw new Error('google_config_missing');
  }

  return config;
}

async function getAccessToken(config) {
  const now = Math.floor(Date.now() / 1000);

  if (tokenCache && tokenCache.expiresAt - 60 > now) {
    return tokenCache.accessToken;
  }

  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: config.clientEmail,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };
  const unsignedJwt = `${base64url(header)}.${base64url(claim)}`;
  const signature = createSign('RSA-SHA256')
    .update(unsignedJwt)
    .sign(config.privateKey, 'base64')
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
  const assertion = `${unsignedJwt}.${signature}`;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  if (!response.ok) {
    throw new Error(`google_token_failed:${response.status}`);
  }

  const data = await response.json();
  tokenCache = {
    accessToken: data.access_token,
    expiresAt: now + Number(data.expires_in || 3600),
  };

  return tokenCache.accessToken;
}

async function appendLead(lead) {
  const config = requireGoogleConfig();
  const token = await getAccessToken(config);
  const range = encodeURIComponent(config.range);
  const url = new URL(
    `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}/values/${range}:append`,
  );
  url.searchParams.set('valueInputOption', 'USER_ENTERED');
  url.searchParams.set('insertDataOption', 'INSERT_ROWS');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      values: [
        [
          new Date().toISOString(),
          lead.name,
          lead.phone,
          lead.product,
          lead.message,
          lead.source,
          'degmylo.ru',
        ],
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`google_append_failed:${response.status}`);
  }
}

async function handleLead(req, res) {
  try {
    if (!req.headers['content-type']?.includes('application/json')) {
      return json(res, 415, { ok: false, error: 'unsupported_content_type' });
    }

    const payload = await readJsonBody(req);
    const result = validateLead(payload);

    if (result.error === 'spam') {
      return json(res, 200, { ok: true });
    }

    if (result.error) {
      return json(res, 400, { ok: false, error: result.error });
    }

    await appendLead(result.lead);
    return json(res, 200, { ok: true });
  } catch (error) {
    console.error(error);
    const status = error.message === 'payload_too_large' ? 413 : 500;
    return json(res, status, { ok: false, error: 'lead_submit_failed' });
  }
}

async function serveStatic(req, res) {
  const requestUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(requestUrl.pathname);
  const normalizedPath = normalize(pathname).replace(/^(\.\.[/\\])+/, '');
  const requestedFile = join(distDir, normalizedPath);
  const safeFile = resolve(requestedFile);
  const indexFile = join(distDir, 'index.html');
  const filePath =
    safeFile.startsWith(distDir) && existsSync(safeFile) && statSync(safeFile).isFile()
      ? safeFile
      : indexFile;
  const extension = extname(filePath);

  try {
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
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
}

const server = createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    return json(res, 200, { ok: true });
  }

  if (req.method === 'POST' && req.url === '/api/lead') {
    return handleLead(req, res);
  }

  if (req.method === 'GET' || req.method === 'HEAD') {
    return serveStatic(req, res);
  }

  res.writeHead(405, { Allow: 'GET, HEAD, POST' });
  res.end();
});

try {
  await readFile(join(distDir, 'index.html'));
} catch {
  console.warn('dist/index.html not found. Run pnpm build before pnpm start.');
}

server.listen(port, '0.0.0.0', () => {
  console.log(`Server is listening on port ${port}`);
});
