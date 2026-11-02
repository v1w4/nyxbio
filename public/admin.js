const $ = id => document.getElementById(id);
const fmt = n => n.toLocaleString('pt-BR');
const api = (url, opts = {}) => fetch(url, { headers: { 'content-type': 'application/json' }, ...opts })
  .then(async r => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'erro'); return j; });
const flash = (el, ok, text) => {
  el.className = ok ? 'ok' : 'err';
  el.textContent = text;
  setTimeout(() => (el.textContent = ''), 4000);
};

function addRow(listId, label = '', url = '') {
  const row = document.createElement('div');
  row.className = 'row-item';
  const a = document.createElement('input'); a.placeholder = 'texto'; a.value = label;
  const b = document.createElement('input'); b.placeholder = 'https://...'; b.value = url;
  const x = document.createElement('button');
  x.type = 'button'; x.className = 'btn ghost'; x.textContent = '×';
  x.onclick = () => row.remove();
  row.append(a, b, x);
  $(listId).appendChild(row);
}
function fillList(listId, items) {
  $(listId).textContent = '';
  (items || []).forEach(i => addRow(listId, i.label, i.url));
}
function readList(listId) {
  return [...$(listId).children]
    .map(r => ({ label: r.children[0].value.trim(), url: r.children[1].value.trim() }))
    .filter(i => i.label && i.url);
}

const val = id => $(id).value.trim();

function fillForm(p) {
  $('f-name').value = p.name || '';
  $('f-bio').value = p.bio || '';
  $('f-quote').value = p.quote || '';
  $('f-initial').value = p.avatarInitial || '';
  $('f-avatar').value = p.avatarUrl || '';
  $('f-discord').value = p.discordId || '';
  $('f-theme').value = p.theme || 'default';
  $('f-bg').value = (p.customTheme && p.customTheme.bg) || '';
  $('f-accent').value = (p.customTheme && p.customTheme.accent) || '';
  $('f-text').value = (p.customTheme && p.customTheme.text) || '';
  $('f-gif').value = p.gifBackground || '';
  $('f-music').value = p.music || '';
  $('f-css').value = p.customCss || '';
  document.getElementById('custom-css').textContent = p.customCss || '';
  fillList('links-list', p.links);
  fillList('stack-list', p.stack);
  $('json').value = JSON.stringify(p, null, 2);
  $('empty-hint').hidden = !!(p.name || p.bio);
  applyTheme(p);
}

function readForm() {
  return {
    name: val('f-name'), bio: val('f-bio'), quote: val('f-quote'),
    avatarInitial: val('f-initial'), avatarUrl: val('f-avatar'), discordId: val('f-discord'),
    theme: $('f-theme').value,
    customTheme: { bg: val('f-bg'), accent: val('f-accent'), text: val('f-text') },
    gifBackground: val('f-gif'), music: val('f-music'),
    customCss: $('f-css').value,
    links: readList('links-list'), stack: readList('stack-list')
  };
}

async function loadProfile() {
  const p = await api('/api/profile');
  delete p.views;
  fillForm(p);
}

async function loadUsage() {
  const u = await api('/api/usage');
  $('usage-bar').style.width = Math.min(100, (u.used / u.budget) * 100) + '%';
  $('usage-text').textContent = `${fmt(u.used)} de ${fmt(u.budget)} tokens usados (${u.month}) · restam ${fmt(u.left)}`;
}

async function loadHistory() {
  const rows = await api('/api/history');
  $('history').textContent = '';
  for (const r of rows) {
    const d = document.createElement('div');
    d.textContent = `${new Date(r.created_at).toLocaleString('pt-BR')} · ${r.source}`;
    $('history').appendChild(d);
  }
}

function addMsg(text, me) {
  const d = document.createElement('div');
  d.className = 'msg' + (me ? ' me' : '');
  d.textContent = text;
  $('chat-log').appendChild(d);
  $('chat-log').scrollTop = $('chat-log').scrollHeight;
}
async function loadChat() {
  const rows = await api('/api/chat');
  $('chat-log').textContent = '';
  for (const m of rows) addMsg(m.content, m.role === 'user');
}

async function enter() {
  $('login-box').hidden = true;
  $('panel').hidden = false;
  await Promise.all([loadProfile(), loadUsage(), loadHistory(), loadChat()]);
}

$('login-btn').onclick = async () => {
  try {
    await api('/api/login', { method: 'POST', body: JSON.stringify({ password: $('pw').value }) });
    $('login-err').textContent = '';
    enter();
  } catch (e) { $('login-err').textContent = e.message; }
};
$('pw').onkeydown = e => { if (e.key === 'Enter') $('login-btn').click(); };

$('add-link').onclick = () => addRow('links-list');
$('add-stack').onclick = () => addRow('stack-list');

$('save-btn').onclick = async () => {
  try {
    await api('/api/profile', { method: 'PUT', body: JSON.stringify(readForm()) });
    await Promise.all([loadProfile(), loadHistory()]);
    flash($('save-msg'), true, 'salvo ✓');
  } catch (e) { flash($('save-msg'), false, 'erro: ' + e.message); }
};

$('save-json').onclick = async () => {
  try {
    const body = JSON.parse($('json').value);
    await api('/api/profile', { method: 'PUT', body: JSON.stringify(body) });
    await Promise.all([loadProfile(), loadHistory()]);
    flash($('save-msg'), true, 'salvo ✓');
  } catch (e) { flash($('save-msg'), false, 'erro: ' + e.message); }
};

$('chat-form').onsubmit = async e => {
  e.preventDefault();
  const text = $('chat-input').value.trim();
  if (!text) return;
  $('chat-input').value = '';
  $('chat-err').textContent = '';
  addMsg(text, true);
  $('chat-btn').disabled = true;
  try {
    const out = await api('/api/chat', { method: 'POST', body: JSON.stringify({ message: text }) });
    addMsg(out.reply, false);
    if (out.profile) await Promise.all([loadProfile(), loadHistory()]);
    await loadUsage();
  } catch (err) { $('chat-err').textContent = err.message; }
  $('chat-btn').disabled = false;
};

$('logout-btn').onclick = async () => {
  await api('/api/logout', { method: 'POST' });
  location.reload();
};

(async () => {
  const { authed } = await api('/api/me');
  if (authed) enter(); else $('login-box').hidden = false;
  applyTheme(await api('/api/profile'));
})();
