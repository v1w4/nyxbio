/**
 * server.js — Nyx v2.0: zero-dependency Express server.
 * Serves the bio-link + the local transformer AI, admin panel,
 * session, public profile, and streaming chat.
 */
import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, createHmac } from 'node:crypto';

import { sanitize, saveProfile, getProfile, history, viewCount, usage, addUsage, addChat, recentChat } from './src/db.js';
import { aiChat, aiChatStream, getModel } from './src/chat.js';
import { __version__ } from './src/model.js';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dir, 'public')));

const PASSWORD = process.env.ADMIN_PASSWORD;
const SECRET = process.env.SESSION_SECRET || randomBytes(32).toString('hex');
const sign = (v) => createHmac('sha256', SECRET).update(v).digest('hex');
const isAuthed = (req) => !!req.cookies.nyx && req.cookies.nyx === sign('admin');
const auth = (req, res, next) => (isAuthed(req) ? next() : res.status(401).json({ error: 'não autorizado' }));

// ── public ────────────────────────────────────────────────────────────
app.get('/api/profile', (req, res) => res.json({ ...getProfile(), views: viewCount() }));
app.post('/api/view', (req, res) => { addUsage(0, 0); res.json({ ok: true }); });

// ── session ──────────────────────────────────────────────────────────
app.post('/api/login', (req, res) => {
  if (!PASSWORD || req.body?.password !== PASSWORD) return res.status(401).json({ error: 'senha errada' });
  res.cookie('nyx', sign('admin'), { httpOnly: true, sameSite: 'strict', maxAge: 30 * 24 * 3600 * 1000 });
  res.json({ ok: true });
});
app.post('/api/logout', (req, res) => { res.clearCookie('nyx'); res.json({ ok: true }); });
app.get('/api/me', (req, res) => res.json({ authed: isAuthed(req) }));

// ── profile (admin) ──────────────────────────────────────────────────
app.put('/api/profile', auth, (req, res) => {
  try { res.json(saveProfile(req.body, 'manual')); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

app.get('/api/history', auth, (req, res) => res.json(history()));
app.get('/api/usage', auth, (req, res) => res.json(usage()));

// ── AI ───────────────────────────────────────────────────────────────
app.get('/api/model/status', (req, res) => {
  const m = getModel();
  res.json({ version: __version__, d: m.d, nHeads: m.nHeads, nLayers: m.nLayers, ffDim: m.ffDim, seqLen: m.seqLen, temperature: m.temperature, topK: m.topK, vocabSize: m.nTokens, engine: 'node:llama-style transformer (do zero)' });
});

app.post('/api/chat', auth, async (req, res) => {
  const msg = String(req.body?.message || '').slice(0, 2000).trim();
  if (!msg) return res.status(400).json({ error: 'mensagem vazia' });
  try { res.json(await aiChat(msg)); } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});

app.post('/api/chat/stream', auth, async (req, res) => {
  const msg = String(req.body?.message || '').slice(0, 2000).trim();
  if (!msg) return res.status(400).json({ error: 'mensagem vazia' });
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const write = (s) => { res.write(s + '\n'); };
  write('event: start\ndata: {}\n\n');

  function sendChunks() {
    let pending = true;
    const it = aiChatStream(msg, (chunk) => {
      if (!pending) return;
      write('data: ' + JSON.stringify({ chunk: chunk.token }) + '\n');
    });
    while (it.next().done === false) { /* nop */ }
    write('event: end\ndata: ' + JSON.stringify({ done: true }) + '\n\n');
    pending = false;
    res.end();
  }
  setImmediate(sendChunks);
  res.on('close', () => { try { res.write('event: close\ndata: {}\n\n'); } catch { /* */ } });
});

// ── misc ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ ok: true, node: process.version }));

// ── serve ────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, () => {
  console.log(`[nyxbio] v${__version__} rodando na porta ${PORT}`);
  console.log(`[nyxbio] ai: d=${getModel().d} heads=${getModel().nHeads} layers=${getModel().nLayers} vocab=${getModel().nTokens}`);
});

function shutdown(signal) {
  console.log(`[nyxbio] recebido ${signal}, encerrando...`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
