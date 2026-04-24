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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`CheckMaster sync server listening on http://0.0.0.0:${PORT}`);
});
