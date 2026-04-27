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

const serverLogs = [];
const originalConsole = {
  log: console.log,
  info: console.info,
  warn: console.warn,
  error: console.error,
};
function captureServerLog(level, args) {
  try {
    const message = args.map((item) => {
      if (typeof item === 'string') return item;
      if (item instanceof Error) return item.stack || item.message;
      return JSON.stringify(item, null, 2);
    }).join(' ');
    serverLogs.push({
      time: new Date().toISOString(),
      level,
      message,
    });
    if (serverLogs.length > 200) serverLogs.shift();
  } catch (_) {}
}
['log', 'info', 'warn', 'error'].forEach((method) => {
  console[method] = (...args) => {
    captureServerLog(method, args);
    originalConsole[method].apply(console, args);
  };
});

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
app.use('/admin/static', express.static(path.join(__dirname, 'admin')));

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
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

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


app.get('/api/admin/apilog', adminAuth, (_req, res) => {
  res.json({ log: apiCallLog });
});
app.get('/api/admin/serverlogs', adminAuth, (_req, res) => {
  res.json({ logs: serverLogs });
});

app.get('/api/admin/ping', adminAuth, (_req, res) => res.json({ ok: true }));
app.get('/api/admin/users', adminAuth, (_req, res) => {
  const { users = [] } = readState();
  res.json({ users: users.map(({ passwordHash, salt, ...u }) => u) });
});
app.put('/api/admin/users/:id', adminAuth, (req, res) => {
  const { id } = req.params;
  const { displayName } = req.body || {};
  const state = readState();
  const user = state.users.find((u) => u.id === id);
  if (!user) return res.status(404).json({ error: 'Not found' });
  if (displayName) user.displayName = displayName;
  writeState(state);
  res.json({ ok: true });
});
app.delete('/api/admin/users/:id', adminAuth, (req, res) => {
  const { id } = req.params;
  const state = readState();
  state.users = state.users.filter((u) => u.id !== id);
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
  apiKeyList = apiKeyList.filter((k) => k !== key);
  const state = readState();
  state.apiKeys = apiKeyList;
  writeState(state);
  res.json({ ok: true });
});

app.get('/api/admin/alldata', adminAuth, (_req, res) => {
  res.json(readState());
});
app.put('/api/admin/alldata', adminAuth, (req, res) => {
  const obj = req.body;
  if (!obj || typeof obj !== 'object') return res.status(400).json({ error: 'Invalid data' });
  writeState(obj);
  res.json({ ok: true });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`CheckMaster sync server listening on http://0.0.0.0:${PORT}`);
});
