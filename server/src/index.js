/**
 * CheckMaster sync server — JSON file store, single API key.
 * Env: DATA_DIR (default ./data), PORT (default 3847), API_KEY (or read from data/.env)
 */
const fs = require('fs');
const path = require('path');
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
  return JSON.parse(fs.readFileSync(statePath, 'utf8'));
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

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: '20mb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'checkmaster-sync', version: '1' });
});

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
    const saved = writeState({
      folders,
      checklists,
      settings,
      activeChecklistId: activeChecklistId ?? null,
    });
    res.json({ ok: true, updatedAt: saved.updatedAt });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`CheckMaster sync server listening on http://0.0.0.0:${PORT}`);
});
