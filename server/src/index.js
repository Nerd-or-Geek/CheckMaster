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

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: '20mb' }));

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
  res.set('Content-Type', 'text/html');
  res.send(`
    <!DOCTYPE html>
    <html lang=\"en\">
    <head>
      <meta charset=\"UTF-8\" />
      <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />
      <title>CheckMaster Admin</title>
      <style>
        body { font-family: system-ui,sans-serif; background: #f8fafc; color: #222; margin: 0; }
        .container { max-width: 900px; margin: 32px auto; background: #fff; border-radius: 12px; box-shadow: 0 2px 12px #0001; padding: 32px; }
        h1 { font-size: 2rem; margin-bottom: 0.5em; }
        table { border-collapse: collapse; width: 100%; margin-bottom: 2em; }
        th, td { border: 1px solid #e5e7eb; padding: 8px 12px; }
        th { background: #f1f5f9; }
        tr:nth-child(even) { background: #f9fafb; }
        .actions button { margin-right: 8px; }
        .api-key { font-family: monospace; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; }
      </style>
    </head>
    <body>
      <div class=\"container\">
        <h1>CheckMaster Admin</h1>
        <div id=\"login\" style=\"display:none;\">
          <h2>Admin Login</h2>
          <input id=\"pw\" type=\"password\" placeholder=\"Admin password\" />
          <button onclick=\"login()\">Login</button>
        </div>
        <div id=\"main\" style=\"display:none;\">
          <h2>Users</h2>
          <table id=\"users\"><thead><tr><th>ID</th><th>Username</th><th>Display Name</th><th>Created</th><th>Actions</th></tr></thead><tbody></tbody></table>
          <h2>API Keys</h2>
          <div id=\"api-keys\"></div>
          <input id=\"new-key\" placeholder=\"New API key\" /> <button onclick=\"addKey()\">Add Key</button>
          <h2>All Data</h2>
          <pre id=\"alldata\" style=\"max-height:300px;overflow:auto;background:#f1f5f9;padding:12px;border-radius:8px;\"></pre>
        </div>
      </div>
      <script>
        let token = localStorage.getItem('admin_token') || '';
        function login() {
          const pw = document.getElementById('pw').value;
          fetch('/api/admin/ping', { headers: { Authorization: 'Bearer ' + pw } })
            .then(r => r.ok ? r.json() : Promise.reject()).then(() => {
              token = pw; localStorage.setItem('admin_token', pw); showMain();
            }).catch(() => alert('Wrong password'));
        }
        function showMain() {
          document.getElementById('login').style.display = 'none';
          document.getElementById('main').style.display = '';
          loadUsers(); loadApiKeys(); loadData();
        }
        function showLogin() {
          document.getElementById('main').style.display = 'none';
          document.getElementById('login').style.display = '';
        }
        function api(path, opts={}) {
          opts.headers = opts.headers || {}; opts.headers.Authorization = 'Bearer ' + token;
          return fetch(path, opts).then(r => r.json());
        }
        function loadUsers() {
          api('/api/admin/users').then(d => {
            const tb = document.querySelector('#users tbody');
            tb.innerHTML = '';
            d.users.forEach(u => {
              const tr = document.createElement('tr');
              tr.innerHTML = '<td>' + u.id + '</td><td>' + u.username + '</td><td>' + u.displayName + '</td><td>' + new Date(u.createdAt).toLocaleString() + '</td><td class="actions"><button onclick="editUser(\'' + u.id + '\')">Edit</button><button onclick="delUser(\'' + u.id + '\')">Delete</button></td>';
              tb.appendChild(tr);
            });
          });
        }
        function editUser(id) { const name = prompt('New display name:'); if (!name) return; api('/api/admin/users/' + id, { method:'PUT', body:JSON.stringify({ displayName:name }), headers:{'Content-Type':'application/json'} }).then(loadUsers); }
        function delUser(id) { if (!confirm('Delete user?')) return; api('/api/admin/users/' + id, { method:'DELETE' }).then(loadUsers); }
        function loadApiKeys() {
          api('/api/admin/apikeys').then(d => {
            const div = document.getElementById('api-keys');
            div.innerHTML = d.keys.map(function(k) { return '<span class="api-key">' + k + '</span> <button onclick="delKey(\'' + k + '\')">Delete</button>'; }).join('<br>');
          });
        }
        function addKey() { const k = document.getElementById('new-key').value.trim(); if (!k) return; api('/api/admin/apikeys', { method:'POST', body:JSON.stringify({ key:k }), headers:{'Content-Type':'application/json'} }).then(loadApiKeys); }
        function delKey(k) { if (!confirm('Delete key?')) return; api('/api/admin/apikeys/' + k, { method:'DELETE' }).then(loadApiKeys); }
        function loadData() { api('/api/admin/alldata').then(d => { document.getElementById('alldata').textContent = JSON.stringify(d, null, 2); }); }
        // Try auto-login
        fetch('/api/admin/ping', { headers: { Authorization: 'Bearer ' + token } }).then(r => r.ok ? showMain() : showLogin());
      </script>
    </body>
    </html>
  `);
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
