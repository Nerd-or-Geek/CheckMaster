const mysql = require('mysql2/promise');

const {
  DB_HOST = '127.0.0.1',
  DB_PORT = '3306',
  DB_USER = 'root',
  DB_PASSWORD = '',
  DB_DATABASE = 'checklist_app',
} = process.env;

let pool = null;

async function createDatabaseIfNeeded() {
  const basePool = await mysql.createPool({
    host: DB_HOST,
    port: Number(DB_PORT),
    user: DB_USER,
    password: DB_PASSWORD,
    waitForConnections: true,
    connectionLimit: 1,
    queueLimit: 0,
    timezone: 'Z',
  });

  await basePool.query(`CREATE DATABASE IF NOT EXISTS \`${DB_DATABASE}\``);
  await basePool.end();
}

async function getPool() {
  if (pool) return pool;
  await createDatabaseIfNeeded();
  pool = mysql.createPool({
    host: DB_HOST,
    port: Number(DB_PORT),
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_DATABASE,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    namedPlaceholders: true,
    timezone: 'Z',
  });
  return pool;
}

async function query(sql, params) {
  const connection = await getPool();
  return connection.query(sql, params);
}

async function execute(sql, params) {
  const connection = await getPool();
  return connection.execute(sql, params);
}

async function ensureColumn(table, column, definition) {
  const conn = await getPool();
  const [rows] = await conn.query('SHOW COLUMNS FROM ?? LIKE ?', [table, column]);
  if (rows.length === 0) {
    await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
  }
}

async function initialize() {
  const conn = await getPool();

  await conn.query(`CREATE TABLE IF NOT EXISTS \`users\` (
    uid CHAR(36) NOT NULL PRIMARY KEY,
    username VARCHAR(100) NOT NULL,
    display_name VARCHAR(150) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY ux_users_username (username)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);

  await conn.query(`CREATE TABLE IF NOT EXISTS \`folders\` (
    folder_id CHAR(36) NOT NULL PRIMARY KEY,
    owner_uid CHAR(36) NULL,
    parent_id CHAR(36) NULL,
    name VARCHAR(255) NOT NULL,
    expanded TINYINT(1) NOT NULL DEFAULT 0,
    color VARCHAR(50) NOT NULL DEFAULT '#999999',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_folders_owner (owner_uid),
    CONSTRAINT fk_folders_owner FOREIGN KEY (owner_uid) REFERENCES \`users\` (uid) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);

  await conn.query(`CREATE TABLE IF NOT EXISTS \`checklists\` (
    checklist_id CHAR(36) NOT NULL PRIMARY KEY,
    owner_uid CHAR(36) NOT NULL,
    folder_id CHAR(36) NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL DEFAULT 'basic',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_checklists_owner (owner_uid),
    KEY idx_checklists_folder (folder_id),
    CONSTRAINT fk_checklists_owner FOREIGN KEY (owner_uid) REFERENCES \`users\` (uid) ON DELETE CASCADE,
    CONSTRAINT fk_checklists_folder FOREIGN KEY (folder_id) REFERENCES \`folders\` (folder_id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);

  await conn.query(`CREATE TABLE IF NOT EXISTS \`sections\` (
    section_id CHAR(36) NOT NULL PRIMARY KEY,
    checklist_id CHAR(36) NOT NULL,
    title VARCHAR(255) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_sections_checklist (checklist_id),
    CONSTRAINT fk_sections_checklist FOREIGN KEY (checklist_id) REFERENCES \`checklists\` (checklist_id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);

  await conn.query(`CREATE TABLE IF NOT EXISTS \`checklist_items\` (
    item_id CHAR(36) NOT NULL PRIMARY KEY,
    section_id CHAR(36) NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100) NOT NULL DEFAULT '',
    is_completed TINYINT(1) NOT NULL DEFAULT 0,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_items_section (section_id),
    CONSTRAINT fk_items_section FOREIGN KEY (section_id) REFERENCES \`sections\` (section_id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);

  await conn.query(`CREATE TABLE IF NOT EXISTS \`checklist_shares\` (
    share_id CHAR(36) NOT NULL PRIMARY KEY,
    checklist_id CHAR(36) NOT NULL,
    shared_with_uid CHAR(36) NOT NULL,
    permission ENUM('view','mark','edit') NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY ux_shares_checklist_user (checklist_id, shared_with_uid),
    KEY idx_shares_user (shared_with_uid),
    CONSTRAINT fk_shares_checklist FOREIGN KEY (checklist_id) REFERENCES \`checklists\` (checklist_id) ON DELETE CASCADE,
    CONSTRAINT fk_shares_user FOREIGN KEY (shared_with_uid) REFERENCES \`users\` (uid) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);

  await conn.query(`CREATE TABLE IF NOT EXISTS \`api_keys\` (
    key_value VARCHAR(255) NOT NULL PRIMARY KEY,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);

  await conn.query(`CREATE TABLE IF NOT EXISTS \`server_settings\` (
    id CHAR(36) NOT NULL PRIMARY KEY,
    settings_json TEXT NOT NULL,
    active_checklist_id CHAR(36) NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);

  if (process.env.API_KEY) {
    await conn.query('INSERT IGNORE INTO api_keys (key_value) VALUES (?)', [process.env.API_KEY]);
  }
  await conn.query('INSERT IGNORE INTO server_settings (id, settings_json, active_checklist_id) VALUES (?, ?, ?)', ['global', '{}', null]);
}

module.exports = {
  initialize,
  query,
  execute,
  getPool,
  ensureColumn,
};
