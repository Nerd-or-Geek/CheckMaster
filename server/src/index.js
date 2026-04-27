/**
 * CheckMaster sync server — MariaDB-backed sync API.
 * Env: DATA_DIR (default ./data), PORT (default 3847), API_KEY (or read from data/.env)
 * MariaDB: DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_DATABASE
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const db = require('./db');

const root = path.join(__dirname, '..');
const dataDir = process.env.DATA_DIR || path.join(root, 'data');
const envPath = path.join(dataDir, '.env');

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
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';

function newId() {
  return crypto.randomBytes(12).toString('hex');
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(String(password)).digest('hex');
}

function toTimestamp(value) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? Date.now() : parsed;
  }
  return Date.now();
}

function parseSettings(raw) {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return raw || typeof raw === 'object' ? raw : {};
}

const defaultSettings = {
  darkMode: false,
  systemDarkMode: true,
  defaultView: 'interactive',
  chartType: 'pie',
  density: 'comfortable',
  storageMode: 'local',
  lastSyncTime: null,
  serverUrl: '',
  serverApiKey: '',
};

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

function formatFolder(row) {
  return {
    id: row.folder_id,
    ownerId: row.owner_uid || null,
    parentId: row.parent_id || null,
    name: row.name,
    expanded: Boolean(row.expanded),
    color: row.color,
    createdAt: toTimestamp(row.created_at),
    updatedAt: toTimestamp(row.updated_at),
  };
}

function formatChecklist(row) {
  return {
    id: row.checklist_id,
    ownerId: row.owner_uid || null,
    title: row.title,
    description: row.description || '',
    folderId: row.folder_id || null,
    type: row.type || 'basic',
    createdAt: toTimestamp(row.created_at),
    updatedAt: toTimestamp(row.updated_at),
  };
}

function formatSection(row) {
  return {
    id: row.section_id,
    checklistId: row.checklist_id,
    name: row.title,
    expanded: false,
    order: Number(row.sort_order) || 0,
    createdAt: toTimestamp(row.created_at),
  };
}

function formatItem(row) {
  return {
    id: row.item_id,
    sectionId: row.section_id || null,
    name: row.title,
    description: row.description || '',
    category: row.category || '',
    checked: Boolean(row.is_completed),
    requiredQty: 0,
    ownedQty: 0,
    images: [],
    notes: '',
    createdAt: toTimestamp(row.created_at),
  };
}

async function findApiKey(key) {
  if (!key) return false;
  if (key === API_KEY) return true;
  const [rows] = await db.query('SELECT 1 FROM api_keys WHERE key_value = ? LIMIT 1', [key]);
  return rows.length > 0;
}

async function auth(req, res, next) {
  try {
    const key = req.get('X-API-Key') || (req.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (!await findApiKey(key)) {
      res.status(401).json({ ok: false, error: 'Unauthorized' });
      return;
    }
    next();
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error) });
  }
}

async function adminAuth(req, res, next) {
  try {
    const authHeader = req.headers['authorization'] || '';
    if (!authHeader.startsWith('Bearer ')) {
      res.status(401).send('Unauthorized');
      return;
    }
    const token = authHeader.slice(7);
    if (token === ADMIN_PASSWORD || await findApiKey(token)) {
      next();
      return;
    }
    res.status(401).send('Unauthorized');
  } catch (error) {
    res.status(500).send('Unauthorized');
  }
}

async function getServerSettings() {
  const [rows] = await db.query('SELECT settings_json, active_checklist_id FROM server_settings WHERE id = ? LIMIT 1', ['global']);
  if (!rows.length) {
    return { settings: { ...defaultSettings }, activeChecklistId: null };
  }
  const settings = { ...defaultSettings, ...parseSettings(rows[0].settings_json) };
  return { settings, activeChecklistId: rows[0].active_checklist_id || null };
}

async function saveServerSettings(settings, activeChecklistId) {
  const payload = JSON.stringify({ ...defaultSettings, ...settings });
  await db.execute(
    'INSERT INTO server_settings (id, settings_json, active_checklist_id) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE settings_json = VALUES(settings_json), active_checklist_id = VALUES(active_checklist_id), updated_at = CURRENT_TIMESTAMP',
    ['global', payload, activeChecklistId],
  );
}

function buildChecklistSnapshot(checklist, sections, items) {
  const checklistSections = sections
    .filter((section) => section.checklist_id === checklist.checklist_id)
    .map(formatSection);
  const sectionIds = new Set(checklistSections.map((section) => section.id));
  const checklistItems = items
    .filter((item) => sectionIds.has(item.section_id))
    .map(formatItem);

  return {
    ...formatChecklist(checklist),
    sections: checklistSections,
    items: checklistItems,
  };
}

async function buildFullSnapshot() {
  const [folders] = await db.query('SELECT * FROM folders ORDER BY created_at ASC');
  const [checklists] = await db.query('SELECT * FROM checklists ORDER BY created_at ASC');
  const [sections] = await db.query('SELECT * FROM sections ORDER BY sort_order ASC, created_at ASC');
  const [items] = await db.query(
    'SELECT i.*, s.checklist_id FROM checklist_items AS i LEFT JOIN sections AS s ON i.section_id = s.section_id ORDER BY i.sort_order ASC, i.created_at ASC',
  );
  const { settings, activeChecklistId } = await getServerSettings();

  return {
    folders: folders.map(formatFolder),
    checklists: checklists.map((checklist) => buildChecklistSnapshot(checklist, sections, items)),
    settings,
    activeChecklistId,
    updatedAt: Date.now(),
  };
}

async function withTransaction(callback) {
  const pool = await db.getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

function createFolderValues(folder) {
  return [
    folder.id,
    folder.ownerId || null,
    folder.parentId || null,
    folder.name || 'Untitled folder',
    folder.expanded ? 1 : 0,
    folder.color || '#999999',
    folder.createdAt ? new Date(folder.createdAt) : new Date(),
    folder.updatedAt ? new Date(folder.updatedAt) : new Date(),
  ];
}

function createChecklistValues(checklist) {
  return [
    checklist.id,
    checklist.ownerId || null,
    checklist.folderId || null,
    checklist.title || 'Untitled checklist',
    checklist.description || '',
    checklist.type || 'basic',
    checklist.createdAt ? new Date(checklist.createdAt) : new Date(),
    checklist.updatedAt ? new Date(checklist.updatedAt) : new Date(),
  ];
}

function createSectionValues(section, checklistId) {
  return [
    section.id,
    checklistId,
    section.name || 'Untitled section',
    Number(section.order) || 0,
    section.createdAt ? new Date(section.createdAt) : new Date(),
    section.updatedAt ? new Date(section.updatedAt) : new Date(),
  ];
}

function createItemValues(item) {
  return [
    item.id,
    item.sectionId || null,
    item.name || '',
    item.description || '',
    item.checked ? 1 : 0,
    Number(item.sortOrder) || 0,
    item.createdAt ? new Date(item.createdAt) : new Date(),
    item.updatedAt ? new Date(item.updatedAt) : new Date(),
  ];
}

async function initializeServer() {
  await db.initialize();
}

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: '20mb' }));
app.use(logApiCall);
app.use('/admin/static', express.static(path.join(__dirname, 'admin')));

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'checkmaster-sync', version: '1' });
});

app.post('/api/auth/register', auth, async (req, res) => {
  try {
    const { username, password, displayName } = req.body || {};
    if (!username || !password) {
      res.status(400).json({ ok: false, error: 'username and password are required' });
      return;
    }
    const uname = String(username).trim().toLowerCase();
    const [users] = await db.query('SELECT uid FROM users WHERE username = ? LIMIT 1', [uname]);
    if (users.length) {
      res.status(409).json({ ok: false, error: 'Username already taken' });
      return;
    }
    const passwordHash = hashPassword(password);
    const uid = newId();
    await db.execute(
      'INSERT INTO users (uid, username, display_name, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [uid, uname, (displayName || uname).trim(), passwordHash, new Date(), new Date()],
    );
    res.status(201).json({ ok: true, user: { id: uid, username: uname, displayName: (displayName || uname).trim(), createdAt: Date.now() } });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error) });
  }
});

app.post('/api/auth/login', auth, async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      res.status(400).json({ ok: false, error: 'username and password are required' });
      return;
    }
    const uname = String(username).trim().toLowerCase();
    const [users] = await db.query('SELECT * FROM users WHERE username = ? LIMIT 1', [uname]);
    if (!users.length) {
      res.status(401).json({ ok: false, error: 'Invalid username or password' });
      return;
    }
    const user = users[0];
    if (hashPassword(password) !== user.password_hash) {
      res.status(401).json({ ok: false, error: 'Invalid username or password' });
      return;
    }
    res.json({ ok: true, user: { id: user.uid, username: user.username, displayName: user.display_name, createdAt: toTimestamp(user.created_at) } });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error) });
  }
});

app.get('/api/auth/users', auth, async (_req, res) => {
  try {
    const [users] = await db.query('SELECT uid AS id, username, display_name AS displayName, created_at FROM users ORDER BY created_at ASC');
    res.json({ ok: true, users: users.map((user) => ({ ...user, createdAt: toTimestamp(user.created_at) })) });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error) });
  }
});

app.get('/api/v1/data', auth, async (_req, res) => {
  try {
    const snapshot = await buildFullSnapshot();
    res.json(snapshot);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error) });
  }
});

app.put('/api/v1/data', auth, async (req, res) => {
  try {
    const { folders, checklists, settings, activeChecklistId } = req.body || {};
    if (!Array.isArray(folders) || !Array.isArray(checklists) || !settings || typeof settings !== 'object') {
      res.status(400).json({ ok: false, error: 'Body must include folders[], checklists[], settings{}' });
      return;
    }

    await withTransaction(async (connection) => {
      const folderIds = folders.map((folder) => folder.id).filter(Boolean);
      if (folderIds.length) {
        await connection.query('DELETE FROM folders WHERE folder_id NOT IN (?)', [folderIds]);
      } else {
        await connection.query('DELETE FROM folders');
      }
      if (folders.length) {
        const folderRows = folders.map(createFolderValues);
        await connection.query(
          'INSERT INTO folders (folder_id, owner_uid, parent_id, name, expanded, color, created_at, updated_at) VALUES ? ON DUPLICATE KEY UPDATE owner_uid = VALUES(owner_uid), parent_id = VALUES(parent_id), name = VALUES(name), expanded = VALUES(expanded), color = VALUES(color), updated_at = VALUES(updated_at)',
          [folderRows],
        );
      }

      const checklistIds = checklists.map((checklist) => checklist.id).filter(Boolean);
      if (checklistIds.length) {
        await connection.query('DELETE FROM sections WHERE checklist_id NOT IN (?)', [checklistIds]);
        await connection.query('DELETE FROM checklists WHERE checklist_id NOT IN (?)', [checklistIds]);
      } else {
        await connection.query('DELETE FROM sections');
        await connection.query('DELETE FROM checklists');
      }

      if (checklists.length) {
        const checklistRows = checklists.map(createChecklistValues);
        await connection.query(
          'INSERT INTO checklists (checklist_id, owner_uid, folder_id, title, description, type, created_at, updated_at) VALUES ? ON DUPLICATE KEY UPDATE owner_uid = VALUES(owner_uid), folder_id = VALUES(folder_id), title = VALUES(title), description = VALUES(description), type = VALUES(type), updated_at = VALUES(updated_at)',
          [checklistRows],
        );

        const sectionRows = [];
        const itemRows = [];
        checklists.forEach((checklist) => {
          const checklistId = checklist.id;
          const sections = Array.isArray(checklist.sections) ? checklist.sections : [];
          sections.forEach((section) => {
            sectionRows.push(createSectionValues(section, checklistId));
          });
          const items = Array.isArray(checklist.items) ? checklist.items : [];
          items.forEach((item) => {
            itemRows.push(createItemValues(item));
          });
        });

        if (sectionRows.length) {
          const checklistIdSet = [...new Set(checklists.map((checklist) => checklist.id))];
          await connection.query('DELETE FROM sections WHERE checklist_id IN (?)', [checklistIdSet]);
          await connection.query(
            'INSERT INTO sections (section_id, checklist_id, title, sort_order, created_at, updated_at) VALUES ?',
            [sectionRows],
          );
        }

        if (itemRows.length) {
          const sectionIds = itemRows.map((row) => row[1]).filter(Boolean);
          if (sectionIds.length) {
            await connection.query('DELETE i FROM checklist_items AS i LEFT JOIN sections AS s ON i.section_id = s.section_id WHERE s.section_id IN (?)', [sectionIds]);
          }
          await connection.query(
            'INSERT INTO checklist_items (item_id, section_id, title, description, is_completed, sort_order, created_at, updated_at) VALUES ?',
            [itemRows],
          );
        }
      }

      await saveServerSettings(settings, activeChecklistId ?? null);
    });

    const snapshot = await buildFullSnapshot();
    res.json({ ok: true, updatedAt: snapshot.updatedAt });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error) });
  }
});

app.get('/api/folders', auth, async (_req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM folders ORDER BY created_at ASC');
    res.json({ folders: rows.map(formatFolder) });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error) });
  }
});

app.post('/api/folders', auth, async (req, res) => {
  try {
    const folder = {
      id: newId(),
      ownerId: req.body.ownerId || null,
      parentId: req.body.parentId || null,
      name: req.body.name || 'Untitled folder',
      expanded: Boolean(req.body.expanded),
      color: req.body.color || '#999999',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await db.execute(
      'INSERT INTO folders (folder_id, owner_uid, parent_id, name, expanded, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [folder.id, folder.ownerId, folder.parentId, folder.name, folder.expanded ? 1 : 0, folder.color, new Date(folder.createdAt), new Date(folder.updatedAt)],
    );
    res.status(201).json(folder);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error) });
  }
});

app.put('/api/folders/:id', auth, async (req, res) => {
  try {
    const folderId = req.params.id;
    const [rows] = await db.query('SELECT * FROM folders WHERE folder_id = ? LIMIT 1', [folderId]);
    if (!rows.length) {
      res.status(404).json({ ok: false, error: 'Not found' });
      return;
    }
    const existing = rows[0];
    const update = {
      parentId: req.body.parentId ?? existing.parent_id,
      name: req.body.name ?? existing.name,
      expanded: typeof req.body.expanded === 'boolean' ? req.body.expanded : Boolean(existing.expanded),
      color: req.body.color ?? existing.color,
    };
    await db.execute(
      'UPDATE folders SET parent_id = ?, name = ?, expanded = ?, color = ?, updated_at = CURRENT_TIMESTAMP WHERE folder_id = ?',
      [update.parentId, update.name, update.expanded ? 1 : 0, update.color, folderId],
    );
    res.json({ id: folderId, ...update });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error) });
  }
});

app.delete('/api/folders/:id', auth, async (req, res) => {
  try {
    const folderId = req.params.id;
    await db.execute('UPDATE checklists SET folder_id = NULL WHERE folder_id = ?', [folderId]);
    const [result] = await db.execute('DELETE FROM folders WHERE folder_id = ?', [folderId]);
    if (result.affectedRows === 0) {
      res.status(404).json({ ok: false, error: 'Not found' });
      return;
    }
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error) });
  }
});

app.get('/api/checklists', auth, async (_req, res) => {
  try {
    const [checklists] = await db.query('SELECT * FROM checklists ORDER BY created_at ASC');
    const [sections] = await db.query('SELECT * FROM sections ORDER BY sort_order ASC, created_at ASC');
    const [items] = await db.query('SELECT i.*, s.checklist_id FROM checklist_items AS i LEFT JOIN sections AS s ON i.section_id = s.section_id ORDER BY i.sort_order ASC, i.created_at ASC');
    res.json({ checklists: checklists.map((checklist) => buildChecklistSnapshot(checklist, sections, items)) });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error) });
  }
});

app.post('/api/checklists', auth, async (req, res) => {
  try {
    const checklist = {
      id: newId(),
      ownerId: req.body.ownerId || null,
      folderId: req.body.folderId || null,
      title: req.body.title || 'Untitled checklist',
      description: req.body.description || '',
      type: req.body.type || 'basic',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await db.execute(
      'INSERT INTO checklists (checklist_id, owner_uid, folder_id, title, description, type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [checklist.id, checklist.ownerId, checklist.folderId, checklist.title, checklist.description, checklist.type, new Date(checklist.createdAt), new Date(checklist.updatedAt)],
    );
    const sections = Array.isArray(req.body.sections) ? req.body.sections : [];
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    if (sections.length) {
      await db.query('INSERT INTO sections (section_id, checklist_id, title, sort_order, created_at, updated_at) VALUES ?', [sections.map((section) => createSectionValues(section, checklist.id))]);
    }
    if (items.length) {
      await db.query('INSERT INTO checklist_items (item_id, section_id, title, description, is_completed, sort_order, created_at, updated_at) VALUES ?', [items.map(createItemValues)]);
    }
    const [sectionsRows] = await db.query('SELECT * FROM sections WHERE checklist_id = ? ORDER BY sort_order ASC, created_at ASC', [checklist.id]);
    const [itemsRows] = await db.query('SELECT i.*, s.checklist_id FROM checklist_items AS i LEFT JOIN sections AS s ON i.section_id = s.section_id WHERE s.checklist_id = ? ORDER BY i.sort_order ASC, i.created_at ASC', [checklist.id]);
    const response = buildChecklistSnapshot({ checklist_id: checklist.id, owner_uid: checklist.ownerId, folder_id: checklist.folderId, title: checklist.title, description: checklist.description, type: checklist.type, created_at: new Date(checklist.createdAt), updated_at: new Date(checklist.updatedAt) }, sectionsRows, itemsRows);
    res.status(201).json(response);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error) });
  }
});

app.put('/api/checklists/:id', auth, async (req, res) => {
  try {
    const checklistId = req.params.id;
    const [existing] = await db.query('SELECT * FROM checklists WHERE checklist_id = ? LIMIT 1', [checklistId]);
    if (!existing.length) {
      res.status(404).json({ ok: false, error: 'Not found' });
      return;
    }
    const checklist = existing[0];
    const updated = {
      ownerId: req.body.ownerId ?? checklist.owner_uid,
      folderId: req.body.folderId ?? checklist.folder_id,
      title: req.body.title ?? checklist.title,
      description: req.body.description ?? checklist.description,
      type: req.body.type ?? checklist.type,
    };
    await db.execute(
      'UPDATE checklists SET owner_uid = ?, folder_id = ?, title = ?, description = ?, type = ?, updated_at = CURRENT_TIMESTAMP WHERE checklist_id = ?',
      [updated.ownerId, updated.folderId, updated.title, updated.description, updated.type, checklistId],
    );
    if (Array.isArray(req.body.sections)) {
      await db.execute('DELETE FROM sections WHERE checklist_id = ?', [checklistId]);
      if (req.body.sections.length) {
        await db.query('INSERT INTO sections (section_id, checklist_id, title, sort_order, created_at, updated_at) VALUES ?', [req.body.sections.map((section) => createSectionValues(section, checklistId))]);
      }
    }
    if (Array.isArray(req.body.items)) {
      await db.query('DELETE i FROM checklist_items AS i LEFT JOIN sections AS s ON i.section_id = s.section_id WHERE s.checklist_id = ?', [checklistId]);
      if (req.body.items.length) {
        await db.query('INSERT INTO checklist_items (item_id, section_id, title, description, is_completed, sort_order, created_at, updated_at) VALUES ?', [req.body.items.map(createItemValues)]);
      }
    }
    const [sectionsRows] = await db.query('SELECT * FROM sections WHERE checklist_id = ? ORDER BY sort_order ASC, created_at ASC', [checklistId]);
    const [itemsRows] = await db.query('SELECT i.*, s.checklist_id FROM checklist_items AS i LEFT JOIN sections AS s ON i.section_id = s.section_id WHERE s.checklist_id = ? ORDER BY i.sort_order ASC, i.created_at ASC', [checklistId]);
    const response = buildChecklistSnapshot({ checklist_id: checklistId, owner_uid: updated.ownerId, folder_id: updated.folderId, title: updated.title, description: updated.description, type: updated.type, created_at: checklist.created_at, updated_at: new Date() }, sectionsRows, itemsRows);
    res.json(response);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error) });
  }
});

app.delete('/api/checklists/:id', auth, async (req, res) => {
  try {
    const [result] = await db.execute('DELETE FROM checklists WHERE checklist_id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      res.status(404).json({ ok: false, error: 'Not found' });
      return;
    }
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error) });
  }
});

app.get('/api/items', auth, async (_req, res) => {
  try {
    const [items] = await db.query('SELECT i.*, s.checklist_id FROM checklist_items AS i LEFT JOIN sections AS s ON i.section_id = s.section_id ORDER BY i.sort_order ASC, i.created_at ASC');
    res.json({ items: items.map(formatItem) });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error) });
  }
});

app.post('/api/items', auth, async (req, res) => {
  try {
    const item = {
      id: newId(),
      sectionId: req.body.sectionId || null,
      name: req.body.title || req.body.name || '',
      description: req.body.description || '',
      checked: Boolean(req.body.checked),
      sortOrder: Number(req.body.sortOrder) || 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await db.execute(
      'INSERT INTO checklist_items (item_id, section_id, title, description, is_completed, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [item.id, item.sectionId, item.name, item.description, item.checked ? 1 : 0, item.sortOrder, new Date(item.createdAt), new Date(item.updatedAt)],
    );
    res.status(201).json(formatItem(item));
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error) });
  }
});

app.patch('/api/items/:id', auth, async (req, res) => {
  try {
    const itemId = req.params.id;
    const [rows] = await db.query('SELECT * FROM checklist_items WHERE item_id = ? LIMIT 1', [itemId]);
    if (!rows.length) {
      res.status(404).json({ ok: false, error: 'Not found' });
      return;
    }
    const item = rows[0];
    const updates = {
      sectionId: req.body.sectionId ?? item.section_id,
      title: req.body.title ?? item.title,
      description: req.body.description ?? item.description,
      is_completed: typeof req.body.checked === 'boolean' ? (req.body.checked ? 1 : 0) : item.is_completed,
      sort_order: typeof req.body.sortOrder === 'number' ? req.body.sortOrder : item.sort_order,
    };
    await db.execute(
      'UPDATE checklist_items SET section_id = ?, title = ?, description = ?, is_completed = ?, sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE item_id = ?',
      [updates.sectionId, updates.title, updates.description, updates.is_completed, updates.sort_order, itemId],
    );
    res.json(formatItem({ ...item, ...updates }));
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error) });
  }
});

app.delete('/api/items/:id', auth, async (req, res) => {
  try {
    const [result] = await db.execute('DELETE FROM checklist_items WHERE item_id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      res.status(404).json({ ok: false, error: 'Not found' });
      return;
    }
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error) });
  }
});

app.get('/api/shares', auth, async (_req, res) => {
  try {
    const [shares] = await db.query('SELECT * FROM checklist_shares ORDER BY created_at ASC');
    res.json({ shares });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error) });
  }
});

app.post('/api/shares', auth, async (req, res) => {
  try {
    const share = {
      id: newId(),
      checklistId: req.body.checklistId,
      sharedWithUid: req.body.sharedWithUid,
      permission: req.body.permission,
      createdAt: Date.now(),
    };
    await db.execute(
      'INSERT INTO checklist_shares (share_id, checklist_id, shared_with_uid, permission, created_at) VALUES (?, ?, ?, ?, ?)',
      [share.id, share.checklistId, share.sharedWithUid, share.permission, new Date(share.createdAt)],
    );
    res.status(201).json(share);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error) });
  }
});

app.delete('/api/shares/:id', auth, async (req, res) => {
  try {
    const [result] = await db.execute('DELETE FROM checklist_shares WHERE share_id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      res.status(404).json({ ok: false, error: 'Not found' });
      return;
    }
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error) });
  }
});

app.get('/api/shared/:token', async (req, res) => {
  try {
    const [shares] = await db.query('SELECT * FROM checklist_shares WHERE share_id = ? LIMIT 1', [req.params.token]);
    const share = shares[0];
    if (!share) {
      res.status(404).json({ ok: false, error: 'Not found' });
      return;
    }
    const [checklists] = await db.query('SELECT * FROM checklists WHERE checklist_id = ? LIMIT 1', [share.checklist_id]);
    if (!checklists.length) {
      res.status(404).json({ ok: false, error: 'Checklist not found' });
      return;
    }
    const checklist = checklists[0];
    const [sections] = await db.query('SELECT * FROM sections WHERE checklist_id = ? ORDER BY sort_order ASC, created_at ASC', [checklist.checklist_id]);
    const [items] = await db.query('SELECT i.*, s.checklist_id FROM checklist_items AS i LEFT JOIN sections AS s ON i.section_id = s.section_id WHERE s.checklist_id = ? ORDER BY i.sort_order ASC, i.created_at ASC', [checklist.checklist_id]);
    res.json({ share, data: buildChecklistSnapshot(checklist, sections, items) });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error.message || error) });
  }
});

app.get('/api/admin/apilog', adminAuth, (_req, res) => {
  res.json({ log: apiCallLog });
});

app.get('/api/admin/serverlogs', adminAuth, (_req, res) => {
  res.json({ logs: serverLogs });
});

app.get('/api/admin/ping', adminAuth, (_req, res) => res.json({ ok: true }));

app.get('/api/admin/users', adminAuth, async (_req, res) => {
  try {
    const [users] = await db.query('SELECT uid AS id, username, display_name AS displayName, created_at FROM users ORDER BY created_at ASC');
    res.json({ users: users.map((user) => ({ ...user, createdAt: toTimestamp(user.created_at) })) });
  } catch (error) {
    res.status(500).json({ error: String(error.message || error) });
  }
});

app.put('/api/admin/users/:id', adminAuth, async (req, res) => {
  try {
    const { displayName } = req.body || {};
    const [result] = await db.execute('UPDATE users SET display_name = ? WHERE uid = ?', [displayName, req.params.id]);
    if (result.affectedRows === 0) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: String(error.message || error) });
  }
});

app.delete('/api/admin/users/:id', adminAuth, async (req, res) => {
  try {
    await db.execute('DELETE FROM users WHERE uid = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: String(error.message || error) });
  }
});

app.get('/api/admin/apikeys', adminAuth, async (_req, res) => {
  try {
    const [rows] = await db.query('SELECT key_value FROM api_keys ORDER BY created_at ASC');
    res.json({ keys: rows.map((row) => row.key_value) });
  } catch (error) {
    res.status(500).json({ error: String(error.message || error) });
  }
});

app.post('/api/admin/apikeys', adminAuth, async (req, res) => {
  try {
    const { key } = req.body || {};
    if (!key || typeof key !== 'string') {
      res.status(400).json({ error: 'Key required' });
      return;
    }
    await db.execute('INSERT IGNORE INTO api_keys (key_value) VALUES (?)', [key]);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: String(error.message || error) });
  }
});

app.delete('/api/admin/apikeys/:key', adminAuth, async (req, res) => {
  try {
    await db.execute('DELETE FROM api_keys WHERE key_value = ?', [req.params.key]);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: String(error.message || error) });
  }
});

app.get('/api/admin/alldata', adminAuth, async (_req, res) => {
  try {
    const [users] = await db.query('SELECT uid AS id, username, display_name AS displayName, created_at FROM users ORDER BY created_at ASC');
    const [folders] = await db.query('SELECT * FROM folders ORDER BY created_at ASC');
    const [checklists] = await db.query('SELECT * FROM checklists ORDER BY created_at ASC');
    const [sections] = await db.query('SELECT * FROM sections ORDER BY sort_order ASC, created_at ASC');
    const [items] = await db.query('SELECT i.*, s.checklist_id FROM checklist_items AS i LEFT JOIN sections AS s ON i.section_id = s.section_id ORDER BY i.sort_order ASC, i.created_at ASC');
    const [shares] = await db.query('SELECT * FROM checklist_shares ORDER BY created_at ASC');
    const [apiKeys] = await db.query('SELECT key_value FROM api_keys ORDER BY created_at ASC');
    const { settings, activeChecklistId } = await getServerSettings();
    res.json({
      users: users.map((user) => ({ ...user, createdAt: toTimestamp(user.created_at) })),
      folders: folders.map(formatFolder),
      checklists: checklists.map((checklist) => buildChecklistSnapshot(checklist, sections, items)),
      shares,
      settings,
      activeChecklistId,
      apiKeys: apiKeys.map((row) => row.key_value),
    });
  } catch (error) {
    res.status(500).json({ error: String(error.message || error) });
  }
});

app.put('/api/admin/alldata', adminAuth, async (req, res) => {
  try {
    const obj = req.body;
    if (!obj || typeof obj !== 'object') {
      res.status(400).json({ error: 'Invalid data' });
      return;
    }
    await withTransaction(async (connection) => {
      if (Array.isArray(obj.apiKeys)) {
        await connection.query('DELETE FROM api_keys');
        const keys = obj.apiKeys.filter((key) => typeof key === 'string');
        if (keys.length) {
          await connection.query('INSERT IGNORE INTO api_keys (key_value) VALUES ?', [keys.map((key) => [key])]);
        }
      }
      if (Array.isArray(obj.folders)) {
        await connection.query('DELETE FROM folders');
        if (obj.folders.length) {
          await connection.query('INSERT INTO folders (folder_id, owner_uid, parent_id, name, expanded, color, created_at, updated_at) VALUES ?', [obj.folders.map(createFolderValues)]);
        }
      }
      if (Array.isArray(obj.checklists)) {
        await connection.query('DELETE FROM checklist_items');
        await connection.query('DELETE FROM sections');
        await connection.query('DELETE FROM checklists');
        if (obj.checklists.length) {
          await connection.query('INSERT INTO checklists (checklist_id, owner_uid, folder_id, title, description, type, created_at, updated_at) VALUES ?', [obj.checklists.map(createChecklistValues)]);
          const sectionRows = [];
          const itemRows = [];
          obj.checklists.forEach((checklist) => {
            const listSections = Array.isArray(checklist.sections) ? checklist.sections : [];
            listSections.forEach((section) => {
              sectionRows.push(createSectionValues(section, checklist.id));
            });
            const listItems = Array.isArray(checklist.items) ? checklist.items : [];
            listItems.forEach((item) => {
              itemRows.push(createItemValues(item));
            });
          });
          if (sectionRows.length) {
            await connection.query('INSERT INTO sections (section_id, checklist_id, title, sort_order, created_at, updated_at) VALUES ?', [sectionRows]);
          }
          if (itemRows.length) {
            await connection.query('INSERT INTO checklist_items (item_id, section_id, title, description, is_completed, sort_order, created_at, updated_at) VALUES ?', [itemRows]);
          }
        }
      }
      if (obj.settings || typeof obj.settings === 'object') {
        await connection.query('INSERT INTO server_settings (id, settings_json, active_checklist_id) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE settings_json = VALUES(settings_json), active_checklist_id = VALUES(active_checklist_id), updated_at = CURRENT_TIMESTAMP', ['global', JSON.stringify(obj.settings), obj.activeChecklistId || null]);
      }
    });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: String(error.message || error) });
  }
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

initializeServer()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`CheckMaster sync server listening on http://0.0.0.0:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  });
