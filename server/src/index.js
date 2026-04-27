/**
 * CheckMaster sync server — JSON file store, single API key.
 * Env: DATA_DIR (default ./data), PORT (default 3847), API_KEY (or read from data/.env)
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');

const root = path.join(__dirname, '..');
const dataDir = process.env.DATA_DIR || path.join(root, 'data');
const envPath = path.join(dataDir, '.env');
const statePath = path.join(dataDir, 'state.json');

function loadDotEnv() {
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, 'utf8');
  raw.split(/\r?\n/).forEach((line) => {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  });
}

loadDotEnv();

if (!process.env.API_KEY) {
  console.error('Missing API_KEY. Run: node scripts/bootstrap.js');
  process.exit(1);
}

const API_KEY = process.env.API_KEY;
const PORT = Number(process.env.PORT || 3847, 10) || 3847;

function readState() {
  if (!fs.existsSync(statePath)) {
    return {
      folders: [],
      checklists: [],
      shares: [],
      users: [],
      settings: {
        darkMode: false,
        defaultView: 'interactive',
        chartType: 'pie',
        density: 'comfortable',
        storageMode: 'local',
        lastSyncTime: null,
        serverUrl: '',
        serverApiKey: '',
      },
      activeChecklistId: null,
      updatedAt: 0,
    };
  }
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  if (!Array.isArray(state.shares)) state.shares = [];
  if (!Array.isArray(state.users)) state.users = [];
  return state;
}

function writeState(obj) {
  fs.mkdirSync(dataDir, { recursive: true });
  const next = { ...obj, updatedAt: Date.now() };
  fs.writeFileSync(statePath, JSON.stringify(next, null, 0), 'utf8');
  return next;
}

function auth(req, res, next) {
  const key = req.get('X-API-Key') || (req.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!key || key !== API_KEY) {
    res.status(401).json({ ok: false, error: 'Unauthorized' });
    return;
  }
  next();
}

function newId() {
  return crypto.randomBytes(12).toString('hex');
}


// In-memory API call log (last 100 calls)
const apiCallLog = [];
function logApiCall(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    apiCallLog.push({
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      time: new Date().toISOString(),
      ms: Date.now() - start,
      ip: req.ip || req.connection?.remoteAddress || '',
    });
    if (apiCallLog.length > 100) apiCallLog.shift();
  });
  next();
}

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: '20mb' }));
app.use(logApiCall);

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'checkmaster-sync', version: '1' });
});

// ── Auth ──────────────────────────────────────────────────────────────────────
// POST /api/auth/register  { username, password, displayName? }  → 201 { ok, user }
app.post('/api/auth/register', auth, (req, res) => {
  try {
    const { username, password, displayName } = req.body || {};
    if (!username || !password) {
      res.status(400).json({ ok: false, error: 'username and password are required' });
      return;
    }
    const state = readState();
    const uname = String(username).trim().toLowerCase();
    if (state.users.find(u => u.username === uname)) {
      res.status(409).json({ ok: false, error: 'Username already taken' });
      return;
    }
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.createHmac('sha256', salt).update(String(password)).digest('hex');
    const user = {
      id: newId(),
      username: uname,
      displayName: (displayName || uname).trim(),
      passwordHash: hash,
      salt,
      createdAt: Date.now(),
    };
    state.users.push(user);
    writeState(state);
    const { passwordHash: _, salt: __, ...safeUser } = user;
    res.status(201).json({ ok: true, user: safeUser });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

// POST /api/auth/login  { username, password }  → 200 { ok, user }
app.post('/api/auth/login', auth, (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      res.status(400).json({ ok: false, error: 'username and password are required' });
      return;
    }
    const state = readState();
    const uname = String(username).trim().toLowerCase();
    const user = state.users.find(u => u.username === uname);
    if (!user) {
      res.status(401).json({ ok: false, error: 'Invalid username or password' });
      return;
    }
    const hash = crypto.createHmac('sha256', user.salt).update(String(password)).digest('hex');
    if (hash !== user.passwordHash) {
      res.status(401).json({ ok: false, error: 'Invalid username or password' });
      return;
    }
    const { passwordHash: _, salt: __, ...safeUser } = user;
    res.json({ ok: true, user: safeUser });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

// GET /api/auth/users  → 200 { users: [ { id, username, displayName, createdAt } ] }
app.get('/api/auth/users', auth, (_req, res) => {
  try {
    const { users } = readState();
    const safe = (users || []).map(({ passwordHash: _, salt: __, ...u }) => u);
    res.json({ ok: true, users: safe });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

// ── Legacy bulk sync (v1) ─────────────────────────────────────────────────────
app.get('/api/v1/data', auth, (_req, res) => {
  try {
    const data = readState();
    res.json(data);
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

app.put('/api/v1/data', auth, (req, res) => {
  try {
    const { folders, checklists, settings, activeChecklistId } = req.body || {};
    if (!Array.isArray(folders) || !Array.isArray(checklists) || !settings || typeof settings !== 'object') {
      res.status(400).json({ ok: false, error: 'Body must include folders[], checklists[], settings{}' });
      return;
    }
    const current = readState();
    const saved = writeState({
      folders,
      checklists,
      shares: current.shares,
      settings,
      activeChecklistId: activeChecklistId ?? null,
    });
    res.json({ ok: true, updatedAt: saved.updatedAt });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

// ── Folders ───────────────────────────────────────────────────────────────────
app.get('/api/folders', auth, (_req, res) => {
  try {
    const { folders } = readState();
    res.json({ folders });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

app.post('/api/folders', auth, (req, res) => {
  try {
    const state = readState();
    const folder = { id: newId(), createdAt: Date.now(), ...req.body };
    state.folders.push(folder);
    writeState(state);
    res.status(201).json(folder);
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

app.put('/api/folders/:id', auth, (req, res) => {
  try {
    const state = readState();
    const idx = state.folders.findIndex((f) => f.id === req.params.id);
    if (idx === -1) { res.status(404).json({ ok: false, error: 'Not found' }); return; }
    state.folders[idx] = { ...state.folders[idx], ...req.body, id: req.params.id };
    writeState(state);
    res.json(state.folders[idx]);
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

app.delete('/api/folders/:id', auth, (req, res) => {
  try {
    const state = readState();
    const idx = state.folders.findIndex((f) => f.id === req.params.id);
    if (idx === -1) { res.status(404).json({ ok: false, error: 'Not found' }); return; }
    state.folders.splice(idx, 1);
    writeState(state);
    res.status(204).end();
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

// ── Checklists ────────────────────────────────────────────────────────────────
app.get('/api/checklists', auth, (_req, res) => {
  try {
    const { checklists } = readState();
    res.json({ checklists });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

app.post('/api/checklists', auth, (req, res) => {
  try {
    const state = readState();
    const checklist = { id: newId(), createdAt: Date.now(), ...req.body };
    state.checklists.push(checklist);
    writeState(state);
    res.status(201).json(checklist);
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

app.put('/api/checklists/:id', auth, (req, res) => {
  try {
    const state = readState();
    const idx = state.checklists.findIndex((c) => c.id === req.params.id);
    if (idx === -1) { res.status(404).json({ ok: false, error: 'Not found' }); return; }
    state.checklists[idx] = { ...state.checklists[idx], ...req.body, id: req.params.id };
    writeState(state);
    res.json(state.checklists[idx]);
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

app.delete('/api/checklists/:id', auth, (req, res) => {
  try {
    const state = readState();
    const idx = state.checklists.findIndex((c) => c.id === req.params.id);
    if (idx === -1) { res.status(404).json({ ok: false, error: 'Not found' }); return; }
    state.checklists.splice(idx, 1);
    writeState(state);
    res.status(204).end();
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

// ── Shares ────────────────────────────────────────────────────────────────────
app.get('/api/shares', auth, (_req, res) => {
  try {
    const { shares } = readState();
    res.json({ shares });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

app.post('/api/shares', auth, (req, res) => {
  try {
    const state = readState();
    const token = crypto.randomBytes(24).toString('base64url');
    const share = { id: newId(), token, createdAt: Date.now(), ...req.body };
    state.shares.push(share);
    writeState(state);
    res.status(201).json(share);
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

app.delete('/api/shares/:id', auth, (req, res) => {
  try {
    const state = readState();
    const idx = state.shares.findIndex((s) => s.id === req.params.id);
    if (idx === -1) { res.status(404).json({ ok: false, error: 'Not found' }); return; }
    state.shares.splice(idx, 1);
    writeState(state);
    res.status(204).end();
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

// Public — no auth required
app.get('/api/shared/:token', (req, res) => {
  try {
    const state = readState();
    const share = state.shares.find((s) => s.token === req.params.token);
    if (!share) { res.status(404).json({ ok: false, error: 'Not found' }); return; }
    const data = state.checklists.find((c) => c.id === share.checklistId) ?? null;
    res.json({ share, data });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});


// ── Admin Dashboard ─────────────────────────────────────────────────────────
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';
let apiKeyList = [process.env.API_KEY];
try {
  const state = readState();
  if (Array.isArray(state.apiKeys)) apiKeyList = state.apiKeys;
} catch {}

function adminAuth(req, res, next) {
  const auth = req.headers['authorization'] || '';
  if (auth.startsWith('Bearer ')) {
    const token = auth.slice(7);
    if (token === ADMIN_PASSWORD) return next();
    if (apiKeyList.includes(token)) return next();
  }
  res.status(401).send('Unauthorized');
}

app.get('/admin', (req, res) => {
  const state = readState();
  const userCount = (state.users || []).length;
  const checklistCount = (state.checklists || []).length;
  const folderCount = (state.folders || []).length;
  const shareCount = (state.shares || []).length;
  res.set('Content-Type', 'text/html');
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>CheckMaster Admin</title>
      <style>
        body { font-family: 'Inter', system-ui, sans-serif; background: #f8fafc; color: #222; margin: 0; }
        .layout { display: flex; min-height: 100vh; }
        .sidebar { width: 220px; background: #1e293b; color: #fff; padding: 32px 0 0 0; display: flex; flex-direction: column; align-items: center; }
        .sidebar h1 { font-size: 1.5rem; margin-bottom: 2em; font-weight: 800; letter-spacing: 1px; }
        .sidebar nav { width: 100%; }
        .sidebar nav a { display: block; color: #cbd5e1; text-decoration: none; padding: 12px 32px; font-size: 1.1rem; border-left: 4px solid transparent; transition: background 0.2s, border-color 0.2s; }
        .sidebar nav a.active, .sidebar nav a:hover { background: #334155; color: #fff; border-left: 4px solid #3b82f6; }
        .main { flex: 1; padding: 40px 5vw 40px 5vw; background: #f8fafc; }
        .cards { display: flex; gap: 24px; margin-bottom: 32px; }
        .card { background: #fff; border-radius: 12px; box-shadow: 0 2px 12px #0001; padding: 24px 32px; flex: 1; display: flex; flex-direction: column; align-items: center; }
        .card h2 { margin: 0 0 8px 0; font-size: 1.1rem; color: #64748b; font-weight: 700; }
        .card .big { font-size: 2.2rem; font-weight: 800; color: #3b82f6; }
        .section { margin-bottom: 36px; }
        .section h2 { font-size: 1.3rem; margin-bottom: 12px; color: #1e293b; }
        table { border-collapse: collapse; width: 100%; margin-bottom: 2em; background: #fff; }
        th, td { border: 1px solid #e5e7eb; padding: 8px 12px; }
        th { background: #f1f5f9; }
        tr:nth-child(even) { background: #f9fafb; }
        .actions button { margin-right: 8px; }
        .api-key { font-family: monospace; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; }
        .apilog-table { font-size: 0.97rem; }
        .apilog-table th, .apilog-table td { padding: 6px 8px; }
        .apilog-table th { background: #e0e7ef; }
        .apilog-table tr:nth-child(even) { background: #f3f6fa; }
        .apilog-status-2 { color: #22c55e; font-weight: 700; }
        .apilog-status-4, .apilog-status-5 { color: #ef4444; font-weight: 700; }
        @media (max-width: 900px) {
          .cards { flex-direction: column; gap: 16px; }
          .main { padding: 24px 2vw; }
          .sidebar { width: 100px; padding: 16px 0 0 0; }
          .sidebar nav a { font-size: 0.95rem; padding: 10px 10px; }
        }
      </style>
    </head>
    <body>
      <div class="layout">
        <aside class="sidebar">
          <h1>CheckMaster</h1>
          <nav>
            <a href="#dashboard" class="active">Dashboard</a>
            <a href="#users">Users</a>
            <a href="#apikeys">API Keys</a>
            <a href="#data">Data</a>
            <a href="#apilog">API Log</a>
          </nav>
        </aside>
        <main class="main">
          <div class="cards">
            <div class="card"><h2>Users</h2><div class="big" id="stat-users">${userCount}</div></div>
            <div class="card"><h2>Checklists</h2><div class="big" id="stat-checklists">${checklistCount}</div></div>
            <div class="card"><h2>Folders</h2><div class="big" id="stat-folders">${folderCount}</div></div>
            <div class="card"><h2>Shares</h2><div class="big" id="stat-shares">${shareCount}</div></div>
          </div>
          <div class="section" id="dashboard">
            <h2>API Call Log</h2>
            <table class="apilog-table" id="apilog"><thead><tr><th>Time</th><th>IP</th><th>Method</th><th>Path</th><th>Status</th><th>ms</th></tr></thead><tbody></tbody></table>
          </div>
          <div class="section" id="users">
            <h2>Users</h2>
            <table id="users-table"><thead><tr><th>ID</th><th>Username</th><th>Display Name</th><th>Created</th><th>Actions</th></tr></thead><tbody></tbody></table>
          </div>
          <div class="section" id="apikeys">
            <h2>API Keys</h2>
            <div id="api-keys"></div>
            <input id="new-key" placeholder="New API key" /> <button onclick="addKey()">Add Key</button>
          </div>
          <div class="section" id="data">
            <h2>All Data</h2>
            <pre id="alldata" style="max-height:300px;overflow:auto;background:#f1f5f9;padding:12px;border-radius:8px;"></pre>
          </div>
        </main>
      </div>
      <script>
        let token = localStorage.getItem('admin_token') || '';
        function login() {
          const pw = prompt('Admin password:');
          fetch('/api/admin/ping', { headers: { Authorization: 'Bearer ' + pw } })
            .then(r => r.ok ? r.json() : Promise.reject()).then(() => {
              token = pw; localStorage.setItem('admin_token', pw); loadAll();
            }).catch(() => alert('Wrong password'));
        }
        function api(path, opts={}) {
          opts.headers = opts.headers || {}; opts.headers.Authorization = 'Bearer ' + token;
          return fetch(path, opts).then(r => r.json());
        }
        function loadAll() {
          loadUsers(); loadApiKeys(); loadData(); loadApiLog();
        }
        function loadUsers() {
          api('/api/admin/users').then(d => {
            const tb = document.querySelector('#users-table tbody');
            tb.innerHTML = '';
            (d.users||[]).forEach(u => {
              const tr = document.createElement('tr');
              tr.innerHTML = '<td>' + u.id + '</td><td>' + u.username + '</td><td>' + u.displayName + '</td><td>' + new Date(u.createdAt).toLocaleString() + '</td><td class="actions"><button onclick="editUser(\'' + u.id + '\')">Edit</button><button onclick="delUser(\'' + u.id + '\')">Delete</button></td>';
              tb.appendChild(tr);
            });
            document.getElementById('stat-users').textContent = (d.users||[]).length;
          });
        }
        function editUser(id) { const name = prompt('New display name:'); if (!name) return; api('/api/admin/users/' + id, { method:'PUT', body:JSON.stringify({ displayName:name }), headers:{'Content-Type':'application/json'} }).then(loadUsers); }
        function delUser(id) { if (!confirm('Delete user?')) return; api('/api/admin/users/' + id, { method:'DELETE' }).then(loadUsers); }
        function loadApiKeys() {
          api('/api/admin/apikeys').then(d => {
            const div = document.getElementById('api-keys');
            div.innerHTML = (d.keys||[]).map(function(k) { return '<span class="api-key">' + k + '</span> <button onclick="delKey(\'' + k + '\')">Delete</button>'; }).join('<br>');
          });
        }
        function addKey() { const k = document.getElementById('new-key').value.trim(); if (!k) return; api('/api/admin/apikeys', { method:'POST', body:JSON.stringify({ key:k }), headers:{'Content-Type':'application/json'} }).then(loadApiKeys); }
        function delKey(k) { if (!confirm('Delete key?')) return; api('/api/admin/apikeys/' + k, { method:'DELETE' }).then(loadApiKeys); }
        function loadData() { api('/api/admin/alldata').then(d => { document.getElementById('alldata').textContent = JSON.stringify(d, null, 2); }); }
        function loadApiLog() {
          fetch('/api/admin/apilog', { headers: { Authorization: 'Bearer ' + token } })
            .then(r => r.json())
            .then(d => {
              const tb = document.querySelector('#apilog tbody');
              tb.innerHTML = '';
              (d.log||[]).slice().reverse().forEach(l => {
                const statusClass = l.status >= 500 ? 'apilog-status-5' : l.status >= 400 ? 'apilog-status-4' : l.status >= 200 ? 'apilog-status-2' : '';
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>${l.time.replace('T',' ').slice(0,19)}</td><td>${l.ip}</td><td>${l.method}</td><td>${l.path}</td><td class='${statusClass}'>${l.status}</td><td>${l.ms}</td>`;
                tb.appendChild(tr);
              });
            });
        }
        // Try auto-login
        fetch('/api/admin/ping', { headers: { Authorization: 'Bearer ' + token } }).then(r => r.ok ? loadAll() : login());
      </script>
    </body>
    </html>
  `);
});
// API for admin dashboard to get API call log
app.get('/api/admin/apilog', adminAuth, (_req, res) => {
  res.json({ log: apiCallLog });
});

// ── Admin API ───────────────────────────────────────────────────────────────
app.get('/api/admin/ping', adminAuth, (_req, res) => res.json({ ok: true }));
app.get('/api/admin/users', adminAuth, (_req, res) => {
  const { users=[] } = readState();
  res.json({ users: users.map(({ passwordHash, salt, ...u }) => u) });
});
app.put('/api/admin/users/:id', adminAuth, (req, res) => {
  const { id } = req.params;
  const { displayName } = req.body || {};
  const state = readState();
  const user = state.users.find(u => u.id === id);
  if (!user) return res.status(404).json({ error: 'Not found' });
  if (displayName) user.displayName = displayName;
  writeState(state);
  res.json({ ok: true });
});
app.delete('/api/admin/users/:id', adminAuth, (req, res) => {
  const { id } = req.params;
  const state = readState();
  state.users = state.users.filter(u => u.id !== id);
  writeState(state);
  res.json({ ok: true });
});
app.get('/api/admin/apikeys', adminAuth, (_req, res) => {
  res.json({ keys: apiKeyList });
});
app.post('/api/admin/apikeys', adminAuth, (req, res) => {
  const { key } = req.body || {};
  if (!key || typeof key !== 'string') return res.status(400).json({ error: 'Key required' });
  if (!apiKeyList.includes(key)) apiKeyList.push(key);
  const state = readState();
  state.apiKeys = apiKeyList;
  writeState(state);
  res.json({ ok: true });
});
app.delete('/api/admin/apikeys/:key', adminAuth, (req, res) => {
  const { key } = req.params;
  apiKeyList = apiKeyList.filter(k => k !== key);
  const state = readState();
  state.apiKeys = apiKeyList;
  writeState(state);
  res.json({ ok: true });
});
app.get('/api/admin/alldata', adminAuth, (_req, res) => {
  res.json(readState());
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`CheckMaster sync server listening on http://0.0.0.0:${PORT}`);
});
