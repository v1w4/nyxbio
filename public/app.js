const STATUS = {
  online:  { color: '#23a55a', text: 'online' },
  idle:    { color: '#f0b232', text: 'ausente' },
  dnd:     { color: '#f23f43', text: 'não perturbe' },
  offline: { color: '#80848e', text: 'offline' }
};
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = ms => new Promise(r => setTimeout(r, ms));
let P = null;

function setAvatar(src) {
  const old = document.getElementById('avatar');
  const el = document.createElement(src ? 'img' : 'div');
  el.id = 'avatar';
  el.className = 'avatar';
  if (src) { el.src = src; el.alt = ''; } else { el.textContent = P.avatarInitial || (P.name || '?')[0]; }
  old.replaceWith(el);
}

function renderItems(container, items, cls) {
  container.textContent = '';
  items.forEach((it, i) => {
    const a = document.createElement('a');
    a.href = it.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
    a.className = cls; a.textContent = it.label;
    a.style.animationDelay = (i * 80) + 'ms';
    container.appendChild(a);
  });
}

// terminal com digitação
async function typeTerminal(p) {
  const term = document.getElementById('term');
  term.textContent = '';
  const lines = [
    ['$ whoami', 'cmd'],
    [`${(p.name || 'usuario').toLowerCase().replace(/\s+/g, '_')} // ${p.bio || ''}`, 'out'],
    ['$ cat quote.txt', 'cmd'],
    [p.quote || '—', 'out'],
    ['$ ls links/', 'cmd'],
    [p.links.map(l => l.label).join('  ') || '(vazio)', 'out']
  ];
  const nodes = lines.map(([text, kind]) => {
    const d = document.createElement('div');
    d.className = kind;
    term.appendChild(d);
    return { d, text };
  });
  if (REDUCED) { nodes.forEach(n => (n.d.textContent = n.text)); return; }
  for (const n of nodes) {
    n.d.classList.add('typing');
    for (const ch of n.text) { n.d.textContent += ch; await wait(n.d.classList.contains('cmd') ? 45 : 14); }
    n.d.classList.remove('typing');
    await wait(180);
  }
  nodes[nodes.length - 1].d.classList.add('typing');
}

function render(p) {
  P = p;
  applyTheme(p);
  document.getElementById('custom-css').textContent = p.customCss || '';
  setAvatar(p.avatarUrl);

  const name = document.getElementById('name');
  name.textContent = p.name || 'seu perfil';
  name.dataset.text = name.textContent;
  document.getElementById('bio').textContent = p.bio || 'configure seu perfil em /admin.html';

  renderItems(document.getElementById('links'), p.links, 'link');
  renderItems(document.getElementById('stack'), p.stack, 'chip');
  document.getElementById('stack-card').hidden = p.stack.length === 0;
  document.getElementById('views').textContent = `${p.views} visitas`;

  if (p.music) {
    document.getElementById('music-card').hidden = false;
    const audio = document.getElementById('audio');
    const btn = document.getElementById('play');
    audio.src = p.music;
    btn.onclick = () => {
      if (audio.paused) { audio.play(); btn.textContent = '❚❚ pausar'; }
      else { audio.pause(); btn.textContent = '▶ tocar'; }
    };
    audio.onended = () => (btn.textContent = '▶ tocar');
  }
  typeTerminal(p);
}

async function presence() {
  if (!P || !P.discordId) return;
  try {
    const j = await (await fetch('https://api.lanyard.rest/v1/users/' + P.discordId)).json();
    if (!j.success) return;
    const d = j.data;
    const st = STATUS[d.discord_status] || STATUS.offline;
    document.getElementById('dot').style.background = st.color;

    const line = document.getElementById('presence');
    line.textContent = '';
    const strong = document.createElement('strong');
    strong.textContent = st.text;
    line.appendChild(strong);

    const custom = (d.activities || []).find(a => a.type === 4);
    if (custom && (custom.state || (custom.emoji && custom.emoji.name))) {
      line.append(' · ' + [custom.emoji && custom.emoji.name, custom.state].filter(Boolean).join(' '));
    }
    if (d.listening_to_spotify && d.spotify) {
      line.appendChild(document.createElement('br'));
      line.append(`♫ ${d.spotify.song} — ${d.spotify.artist}`);
    }
    if (!P.avatarUrl && d.discord_user && d.discord_user.avatar) {
      const ext = d.discord_user.avatar.startsWith('a_') ? 'gif' : 'png';
      setAvatar(`https://cdn.discordapp.com/avatars/${P.discordId}/${d.discord_user.avatar}.${ext}?size=256`);
    }
  } catch { /* sem rede: ignora */ }
}

// partículas flutuando na cor de destaque
function startParticles() {
  const c = document.getElementById('fx');
  const x = c.getContext('2d');
  let pts = [];
  const size = () => {
    c.width = innerWidth; c.height = innerHeight;
    pts = Array.from({ length: Math.min(90, Math.floor(innerWidth / 16)) }, () => ({
      x: Math.random() * c.width, y: Math.random() * c.height,
      v: 0.15 + Math.random() * 0.5, s: 0.8 + Math.random() * 1.8
    }));
  };
  const draw = () => {
    const color = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#fff';
    x.clearRect(0, 0, c.width, c.height);
    x.fillStyle = color;
    x.globalAlpha = 0.45;
    for (const p of pts) {
      p.y -= p.v;
      if (p.y < -4) { p.y = c.height + 4; p.x = Math.random() * c.width; }
      x.fillRect(p.x, p.y, p.s, p.s);
    }
    requestAnimationFrame(draw);
  };
  addEventListener('resize', size);
  size();
  if (!REDUCED) draw();
}

(async () => {
  startParticles();
  const p = await (await fetch('/api/profile')).json();
  render(p);
  presence();
  setInterval(presence, 15000);
  fetch('/api/view', { method: 'POST' });
})();
