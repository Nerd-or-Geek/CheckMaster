/**
 * Creates data/.env with API_KEY and PORT if missing.
 * Run: node scripts/bootstrap.js
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.join(__dirname, '..');
const dataDir = process.env.DATA_DIR || path.join(root, 'data');
const envPath = path.join(dataDir, '.env');

fs.mkdirSync(dataDir, { recursive: true });

if (fs.existsSync(envPath)) {
  console.log('Already configured:', envPath);
  process.exit(0);
}

const apiKey = crypto.randomBytes(32).toString('hex');
const port = process.env.PORT || '3847';
const lines = [`API_KEY=${apiKey}`, `PORT=${port}`, ''];
fs.writeFileSync(envPath, lines.join('\n'), { mode: 0o600 });

console.log('');
console.log('=== CheckMaster server API key (save for the app) ===');
console.log(apiKey);
console.log('');
console.log('Written to', envPath);
console.log('Default PORT=', port);
