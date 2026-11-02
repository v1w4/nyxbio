/**
 * src/chat.js
 * Nyx chat orchestration: AI generation, usage tracking, tool protocol,
 * streaming (SSE), and rate/token budget enforcement.
 */
import { usage, addUsage, addChat, getProfile } from './db.js';
import { Model, __version__ } from './model.js';

let _model = null;
export const getModel = () => {
  if (!_model) _model = new Model();
  return _model;
};

const CORPUS_FILE = process.env.CORPUS_FILE || 'src/corpus.txt';

export async function ensureModel() {
  const m = getModel();
  try {
    const fs = await import('node:fs/promises');
    const txt = await fs.readFile(CORPUS_FILE, 'utf-8');
    if (txt.trim()) {
      m.tokenizer.build(txt);
      m.nTokens = m.tokenizer.id2str.length;
      m.embed = new Float32Array(m.nTokens * m.d);
      for (let i = 0; i < m.nTokens; i++)
        for (let j = 0; j < m.d; j++) m.embed[i * m.d + j] = Math.random() * 0.02;
    }
  } catch { /* keep default */ }
  return m;
}

export const aiChat = async (msg) => {
  const { left } = usage();
  if (left <= 0) throw Object.assign(new Error('orçamento de tokens do mês acabou'), { status: 402 });
  addChat('user', msg);
  const m = getModel();
  let reply = '';
  const buf = [];
  for (const t of m.generate(msg, { maxTokens: 256 })) {
    const tok = m.tokenizer.display([t]);
    if (tok) reply += tok;
    buf.push(t);
  }
  const profile = getProfile();
  const out = m.handleTool('update_profile', { name: profile.name }, profile);
  addUsage(buf.length, 0);
  addChat('assistant', reply);
  return { reply, profile: out, usage: usage() };
};

export function* aiChatStream(msg, cb) {
  const m = getModel();
  const buf = [];
  for (const t of m.generate(msg, { maxTokens: 256 })) {
    const tok = m.tokenizer.display([t]);
    buf.push(t);
    cb({ token: tok, usage: { input: buf.length, output: buf.length } });
  }
}

export const AI_MODES = { NORMAL: 'normal', DOUBT: 'tenho_dúvida', SURPRISE: 'me_surpreenda' };
export let aiState = { mode: 'normal', currentStep: 0, answers: {}, pendingPreview: false, profileSnapshot: null };

/** Processa mensagem no contexto do modo atual */
export function processAIMsg(msg, profile) {
  const lower = String(msg).trim().toLowerCase();
  if (!aiState.mode || aiState.mode === AI_MODES.NORMAL) {
    return { reply: generateNormalReply(msg, profile), mode: AI_MODES.NORMAL, finished: false };
  }
  if (aiState.mode === AI_MODES.DOUBT) {
    const result = handleDoubtMode(lower, profile);
    if (result.finished) {
      const updated = getModel().handleTool('update_profile', aiState.answers, profile);
      aiState = { mode: AI_MODES.NORMAL, currentStep: 0, answers: {}, pendingPreview: false, profileSnapshot: null };
      return { reply: result.reply, mode: AI_MODES.NORMAL, finished: true, updateProfile: updated };
    }
    return { reply: result.reply, mode: AI_MODES.DOUBT, finished: false };
  }
  if (aiState.mode === AI_MODES.SURPRISE) {
    const result = handleSurpriseMode(lower, profile);
    if (result.finished) {
      const updated = getModel().handleTool('update_profile', aiState.answers, profile);
      aiState = { mode: AI_MODES.NORMAL, currentStep: 0, answers: {}, pendingPreview: false, profileSnapshot: null };
      return { reply: result.reply, mode: AI_MODES.NORMAL, finished: true, updateProfile: updated };
    }
    return { reply: result.reply, mode: AI_MODES.SURPRISE, finished: false };
  }
  return { reply: 'Olá! Eu sou a Nyx. Como posso ajudar seu perfil hoje?', mode: AI_MODES.NORMAL, finished: false };
}

function generateNormalReply(msg, profile) {
  if (msg.includes('faça um perfil') || msg.includes('personalize') || msg.includes('estilo lain')) {
    aiState.mode = AI_MODES.DOUBT;
    aiState.currentStep = 0;
    aiState.answers = {};
    aiState.profileSnapshot = JSON.parse(JSON.stringify(profile));
    aiState.answers.step1 = 'iniciado';
    return { reply: 'Que estilo você quer? (ex: lain, cyberpunk, mr. robot, custom)', mode: AI_MODES.DOUBT, finished: false };
  }
  if (msg.includes('confirmar')) {
    if (aiState.profileSnapshot) {
      const updated = getModel().handleTool('update_profile', aiState.answers, aiState.profileSnapshot);
      aiState = { mode: AI_MODES.NORMAL, currentStep: 0, answers: {}, pendingPreview: false, profileSnapshot: null };
      return { reply: 'Perfil atualizado!', mode: AI_MODES.NORMAL, finished: true, updateProfile: updated };
    }
  }
  return { reply: `Nyx: Como posso ajudar seu perfil hoje?`, mode: AI_MODES.NORMAL, finished: false };
}

function handleDoubtMode(lower, profile) {
  if (aiState.currentStep === 0) {
    if (lower.includes('lain')) { aiState.answers.style = 'lain'; aiState.answers.theme = 'lain'; }
    else if (lower.includes('cyber') || lower.includes('mr. robot') || lower.includes('mr robot')) { aiState.answers.style = lower; aiState.answers.theme = lower; }
    else { aiState.answers.style = 'indeterminado'; }
    aiState.currentStep = 1;
    return { reply: 'Que cor de destaque você prefere? (roxo, ciano, verde, rosa, laranja)', finished: false };
  }
  if (aiState.currentStep === 1) {
    const colorMap = { 'roxo': '#7c5cff', 'ciano': '#06ffaf', 'verde': '#39ff14', 'rosa': '#ff69b4', 'laranja': '#ffa500' };
    for (const [c, hex] of Object.entries(colorMap)) { if (lower.includes(c)) { aiState.answers.accent = hex; aiState.currentStep = 2; return { reply: 'Quer adicionar um GIF de fundo? (sim/não)', finished: false }; } }
    return { reply: 'Qual cor de destaque? (roxo, ciano, verde, rosa, laranja)', finished: false };
  }
  if (aiState.currentStep === 2) {
    if (lower.includes('sim') || lower.includes('s')) aiState.answers.gifBackground = 'https://media.giphy.com/media/l0HlBO5NtYBdM/giphy.gif';
    else aiState.answers.gifBackground = '';
    aiState.currentStep = 3;
    const preview = generatePreview(aiState.profileSnapshot);
    return { reply: `Preview:\n${preview}\nConfirmar? (sim/não)`, finished: true };
  }
  return { reply: `Preview final:\n${generatePreview(aiState.profileSnapshot)}\nConfirmar? (sim/não)`, finished: true };
}

function handleSurpriseMode(lower, profile) {
  const themes = ['lain', 'cyberpunk', 'mr. robot', 'hacker', 'cpp'];
  const chosen = themes[Math.floor(Math.random() * themes.length)];
  aiState.answers.style = chosen; aiState.answers.theme = chosen;
  if (chosen === 'lain') { aiState.answers.accent = '#7c5cff'; }
  else if (chosen === 'cyberpunk') { aiState.answers.accent = '#06ffaf'; }
  else if (chosen === 'mr. robot') { aiState.answers.accent = '#bd93d9'; }
  const preview = generatePreview(aiState.profileSnapshot);
  return { reply: `Surpresa! Estilo ${chosen}.\nPreview:\n${preview}\nConfirmar? (sim/não)`, finished: true };
}

function generatePreview(snapshot) {
  if (!snapshot) return 'Perfil sem dados.';
  const s = snapshot;
  return [
    `Nome: ${s.name || '—'}`, `Bio: ${s.bio || '—'}`, `Tema: ${s.theme || 'default'}`,
    `Acento: ${s.customTheme?.accent || '—'}`, `GIF: ${s.gifBackground ? 'sim' : 'não'}`,
    `Música: ${s.music ? 'sim' : 'não'}`, `Links: ${s.links?.map(l => l.label).join(', ') || 'nenhum'}`,
    `Stack: ${s.stack?.map(s => s.label).join(', ') || 'nenhum'}`
  ].join('\n');
}

export { processAIMsg, generatePreview };
