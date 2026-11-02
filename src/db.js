/**
 * src/db.js
 * Database layer (SQLite via node:sqlite).
 * Schema: profile, profile_history, token_usage, chat_messages, views.
 */
import { DatabaseSync } from 'node:sqlite';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || 'data.sqlite';
const DB = new DatabaseSync(DB_PATH);
DB.exec('PRAGMA journal_mode = WAL;');
DB.exec(`CREATE TABLE IF NOT EXISTS profile (id INTEGER PRIMARY KEY CHECK (id = 1), data TEXT NOT NULL, updated_at INTEGER);`);
DB.exec(`CREATE TABLE IF NOT EXISTS profile_history (id INTEGER PRIMARY KEY AUTOINCREMENT, data TEXT NOT NULL, source TEXT, created_at INTEGER);`);
DB.exec(`CREATE TABLE IF NOT EXISTS token_usage (month TEXT PRIMARY KEY, input_tokens INTEGER DEFAULT 0, output_tokens INTEGER DEFAULT 0);`);
DB.exec(`CREATE TABLE IF NOT EXISTS chat_messages (id INTEGER PRIMARY KEY AUTOINCREMENT, role TEXT NOT NULL, content TEXT NOT NULL, created_at INTEGER);`);
DB.exec(`CREATE TABLE IF NOT EXISTS views (id INTEGER PRIMARY KEY AUTOINCREMENT, created_at INTEGER);`);

export const THEMES = ['default', 'mrrobot', 'lain', 'cyber', 'hacker', 'cpp', 'python', 'rust', 'js', 'custom'];

const DEFAULT_PROFILE = {
  name: 'nyx',
  bio: 'hacker de dia, lain de noite. c++, rust, python, js e cyber.',
  avatarInitial: 'N',
  avatarUrl: '',
  discordId: '',
  theme: 'lain',
  customTheme: { bg: '', accent: '', text: '' },
  gifBackground: '',
  music: '',
  quote: '"present day, present time."',
  links: [
    { label: 'github', url: 'https://github.com' },
    { label: 'blog', url: 'https://example.com' },
    { label: 'discord', url: 'https://discord.com' }
  ],
  stack: [
    { label: '⌁ c++', url: 'https://isocpp.org' },
    { label: '⌁ rust', url: 'https://rust-lang.org' },
    { label: '⌁ python', url: 'https://python.org' },
    { label: '⌁ javascript', url: 'https://developer.mozilla.org' },
    { label: '⌁ cyber', url: 'https://owasp.org' },
    { label: '⌁ mr. robot', url: 'https://en.wikipedia.org/wiki/Mr._Robot' },
    { label: '⌁ lain', url: 'https://en.wikipedia.org/wiki/Serial_Experiments_Lain' }
  ]
};

const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
const safeUrl = (v) => {
  try {
    const u = new URL(String(v || ''));
    return ['http:', 'https:'].includes(u.protocol) ? u.href : '';
  } catch { return ''; }
};

const cssSafe = (v) => typeof v === 'string'
  ? v.slice(0, 6000)
      .replace(/<\/?style[^>]*>/gi, '')
      .replace(/@import|expression\s*\(|\bjavascript\s*:|behavior\s*:|-moz-binding|<script/gi, '')
  : '';

const color = (v) => (/^#[0-9a-f]{3,8}$/i.test(v || '') ? v : '');
const list = (arr, max) => Array.isArray(arr)
  ? arr.slice(0, max).map(i => ({ label: str(i && i.label, 30), url: safeUrl(i && i.url) }))
      .filter(i => i.label && i.url)
  : [];

export function sanitize(input = {}) {
  const ct = input.customTheme || {};
  return {
    name: str(input.name, 40),
    bio: str(input.bio, 160),
    avatarInitial: str(input.avatarInitial, 2) || (input.name || '?')[0] || '?',
    avatarUrl: safeUrl(input.avatarUrl),
    discordId: /^\d{5,25}$/.test(String(input.discordId || '')) ? String(input.discordId) : '',
    theme: THEMES.includes(input.theme) ? input.theme : 'default',
    customTheme: { bg: color(ct.bg), accent: color(ct.accent), text: color(ct.text) },
    gifBackground: safeUrl(input.gifBackground),
    customCss: cssSafe(input.customCss),
    music: safeUrl(input.music),
    quote: str(input.quote, 200),
    links: list(input.links, 20),
    stack: list(input.stack, 12)
  };
}

export function saveProfile(input, source) {
  const p = sanitize(input);
  const json = JSON.stringify(p);
  const t = Date.now();
  DB.prepare('INSERT OR REPLACE INTO profile (id, data, updated_at) VALUES (1, ?, ?)').run(json, t);
  DB.prepare('INSERT INTO profile_history (data, source, created_at) VALUES (?, ?, ?)').run(json, source, t);
  return p;
}

export function getProfile() {
  const row = DB.prepare('SELECT data FROM profile WHERE id = 1').get();
  if (!row) return saveProfile(DEFAULT_PROFILE, 'seed');
  return JSON.parse(row.data);
}

export function history() {
  return DB.prepare('SELECT id, source, created_at FROM profile_history ORDER BY id DESC LIMIT 50').all();
}

export function addView() { DB.prepare('INSERT INTO views (created_at) VALUES (?)').run(Date.now()); }
export function viewCount() { return DB.prepare('SELECT COUNT(*) AS n FROM views').get().n; }

const month = () => new Date().toISOString().slice(0, 7);
const budget = () => parseInt(process.env.TOKEN_BUDGET || '500000', 10);

export function usage() {
  const row = DB.prepare('SELECT input_tokens, output_tokens FROM token_usage WHERE month = ?').get(month());
  const used = row ? row.input_tokens + row.output_tokens : 0;
  return { month, used, budget, left: Math.max(0, budget() - used) };
}

export function addUsage(input, output) {
  DB.prepare(`INSERT INTO token_usage (month, input_tokens, output_tokens) VALUES (?, ?, ?)
    ON CONFLICT(month) DO UPDATE SET input_tokens = input_tokens + excluded.input_tokens,
      output_tokens = output_tokens + excluded.output_tokens`).run(month(), input, output);
}

export function addChat(role, content) { DB.prepare('INSERT INTO chat_messages (role, content, created_at) VALUES (?, ?, ?)').run(role, content, Date.now()); }
export function recentChat(n) {
  return DB.prepare(`SELECT role, content FROM (SELECT * FROM chat_messages ORDER BY id DESC LIMIT ?) ORDER BY id ASC`).all(n);
}
