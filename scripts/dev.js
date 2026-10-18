#!/usr/bin/env node
/**
 * Servidor de desenvolvimento.
 *
 * - Roda o build e serve /dist em http://localhost:3000 (porta via PORT).
 * - Emula as URLs limpas da Vercel (/blog/slug → blog/slug.html).
 * - Executa /api/contact localmente (lê variáveis do arquivo .env, se existir).
 * - Observa content/, src/, public/ e api/: reconstrói ao salvar e recarrega o navegador.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from './build.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const PORT = Number(process.env.PORT) || 3000;
const WATCH = ['content', 'src', 'public', 'api'];

try {
  process.loadEnvFile(path.join(ROOT, '.env'));
} catch {
  // Sem .env: o formulário roda em modo local e só registra as mensagens no terminal.
}
process.env.SITE_URL ||= `http://localhost:${PORT}`;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.otf': 'font/otf',
  '.ttf': 'font/ttf',
  '.glb': 'model/gltf-binary',
  '.fbx': 'application/octet-stream',
  '.wasm': 'application/wasm',
};

const RELOAD_SNIPPET = `<script>(() => { const es = new EventSource('/__reload'); es.onmessage = () => location.reload(); })();</script>`;
const clients = new Set();

/** Resolve a URL como a Vercel com cleanUrls: arquivo, arquivo.html ou pasta/index.html. */
function resolveFile(urlPath) {
  const clean = path.normalize(decodeURIComponent(urlPath)).replace(/^([/\\])+/, '');
  const base = path.join(DIST, clean);
  if (!base.startsWith(DIST)) return null;
  const candidates = [base, `${base}.html`, path.join(base, 'index.html')];
  return candidates.find((file) => fs.existsSync(file) && fs.statSync(file).isFile()) || null;
}

function sendFile(res, file, status = 200) {
  const ext = path.extname(file).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  if (ext === '.html') {
    const html = fs.readFileSync(file, 'utf8');
    const body = html.includes('</body>') ? html.replace('</body>', `${RELOAD_SNIPPET}</body>`) : html + RELOAD_SNIPPET;
    res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    res.end(body);
    return;
  }
  const { size } = fs.statSync(file);
  const range = res.req.headers.range;
  // Suporte a Range para que vídeos possam ser reproduzidos/arrastados no navegador.
  if (range && /^bytes=/.test(range)) {
    const [startStr, endStr] = range.replace('bytes=', '').split('-');
    const start = Number(startStr) || 0;
    const end = endStr ? Math.min(Number(endStr), size - 1) : size - 1;
    res.writeHead(206, {
      'Content-Type': type,
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': end - start + 1,
      'Cache-Control': 'no-store',
    });
    fs.createReadStream(file, { start, end }).pipe(res);
    return;
  }
  res.writeHead(status, { 'Content-Type': type, 'Content-Length': size, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
}

async function handleApi(req, res, name) {
  const file = path.join(ROOT, 'api', `${name}.js`);
  if (!/^[\w-]+$/.test(name) || !fs.existsSync(file)) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'Função não encontrada.' }));
    return;
  }
  try {
    const mod = await import(`${pathToFileURL(file).href}?t=${fs.statSync(file).mtimeMs}`);
    await mod.default(req, res);
  } catch (error) {
    console.error(`[api/${name}]`, error);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'Erro interno.' }));
    }
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/__reload') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
    res.write(': conectado\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }

  const api = url.pathname.match(/^\/api\/([^/]+)\/?$/);
  if (api) return handleApi(req, res, api[1]);

  const file = resolveFile(url.pathname);
  if (file) return sendFile(res, file);

  const notFound = path.join(DIST, '404.html');
  if (fs.existsSync(notFound)) return sendFile(res, notFound, 404);
  res.writeHead(404);
  res.end('404');
});

/* Rebuild com debounce ----------------------------------------------------- */
let timer = null;
let building = false;
let pending = false;

async function rebuild(reason) {
  if (building) {
    pending = true;
    return;
  }
  building = true;
  try {
    if (reason) console.log(`\n↻ ${reason}`);
    await build({ dev: true });
    for (const client of clients) client.write('data: reload\n\n');
  } catch (error) {
    console.error(`✗ Build falhou: ${error.message}`);
  } finally {
    building = false;
    if (pending) {
      pending = false;
      rebuild('alterações pendentes');
    }
  }
}

for (const dir of WATCH) {
  const full = path.join(ROOT, dir);
  if (!fs.existsSync(full)) continue;
  fs.watch(full, { recursive: true }, (_event, filename) => {
    if (!filename) return;
    clearTimeout(timer);
    timer = setTimeout(() => rebuild(`${dir}/${String(filename).replace(/\\/g, '/')}`), 120);
  });
}

await rebuild();
server.listen(PORT, () => {
  console.log(`\n  Servidor rodando em http://localhost:${PORT}`);
  console.log('  Observando content/, src/, public/ e api/. Ctrl+C para sair.\n');
});
