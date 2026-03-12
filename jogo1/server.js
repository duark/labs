const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT        = 3000;
const SCORES_FILE = path.join(__dirname, 'scores.json');

// Bootstrap scores file
if (!fs.existsSync(SCORES_FILE)) {
  fs.writeFileSync(SCORES_FILE, '[]', 'utf8');
}

function readScores() {
  try { return JSON.parse(fs.readFileSync(SCORES_FILE, 'utf8')); }
  catch { return []; }
}

function writeScores(scores) {
  fs.writeFileSync(SCORES_FILE, JSON.stringify(scores, null, 2), 'utf8');
}

function addScore(name, score, boma) {
  const scores = readScores();
  scores.push({
    name:  name.trim().slice(0, 20),
    score: Number(score) || 0,
    boma:  Number(boma)  || 0,
    date:  new Date().toISOString().slice(0, 10),
  });
  scores.sort((a, b) => b.score - a.score);
  const top = scores.slice(0, 10);
  writeScores(top);
  return top;
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.otf':  'font/otf',
  '.js':   'application/javascript',
  '.json': 'application/json',
};

const server = http.createServer((req, res) => {
  const headers = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (req.method === 'OPTIONS') {
    res.writeHead(204, headers); res.end(); return;
  }

  // ── GET /scores ──────────────────────────────────────────────────────────────
  if (req.url === '/scores' && req.method === 'GET') {
    res.writeHead(200, { ...headers, 'Content-Type': 'application/json' });
    res.end(JSON.stringify(readScores()));
    return;
  }

  // ── POST /scores ─────────────────────────────────────────────────────────────
  if (req.url === '/scores' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { name, score, boma } = JSON.parse(body);
        if (!name) { res.writeHead(400, headers); res.end('name required'); return; }
        const top = addScore(name, score, boma);
        res.writeHead(200, { ...headers, 'Content-Type': 'application/json' });
        res.end(JSON.stringify(top));
      } catch {
        res.writeHead(400, headers); res.end('bad request');
      }
    });
    return;
  }

  // ── Static files ─────────────────────────────────────────────────────────────
  const filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
  const ext      = path.extname(filePath).toLowerCase();

  // Basic path traversal guard
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403, headers); res.end('forbidden'); return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404, headers); res.end('not found'); return; }
    res.writeHead(200, { ...headers, 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`\nboma-tetris → http://localhost:${PORT}\n`);
});
