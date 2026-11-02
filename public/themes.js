window.THEMES = {
  default: { '--bg':'#0b0b0f','--card':'#14141b','--text':'#eaeaf0','--muted':'#8a8a99','--accent':'#7c5cff','--border':'#24242e','--font':'system-ui, sans-serif' },
  mrrobot: { '--bg':'#050805','--card':'#0a120a','--text':'#33ff66','--muted':'#1f9943','--accent':'#33ff66','--border':'#124d22','--font':"'Courier New', monospace", scan:true },
  lain:    { '--bg':'#0d0a10','--card':'#17121c','--text':'#f3e9f5','--muted':'#b59bc0','--accent':'#ff5fa2','--border':'#3a2a44','--font':"'Courier New', monospace", scan:true },
  cyber:   { '--bg':'#03070d','--card':'#081421','--text':'#d6f4ff','--muted':'#5fa8c9','--accent':'#00e5ff','--border':'#0f3a52','--font':'system-ui, sans-serif' },
  hacker:  { '--bg':'#000000','--card':'#050d05','--text':'#00ff41','--muted':'#0a8a2a','--accent':'#00ff41','--border':'#0b3a14','--font':'ui-monospace, monospace', scan:true },
  cpp:     { '--bg':'#06101c','--card':'#0c1b2d','--text':'#e6f1ff','--muted':'#6b8fb5','--accent':'#00599c','--border':'#16365a','--font':'ui-monospace, monospace' },
  python:  { '--bg':'#0c0f14','--card':'#141a22','--text':'#f1f1f1','--muted':'#9aa5b1','--accent':'#ffd43b','--border':'#263241','--font':'ui-monospace, monospace' },
  rust:    { '--bg':'#141210','--card':'#1e1a17','--text':'#f5e6dc','--muted':'#a38b7a','--accent':'#dea584','--border':'#3a2f27','--font':'ui-monospace, monospace' },
  js:      { '--bg':'#0d0d0d','--card':'#161616','--text':'#f7df1e','--muted':'#a9a300','--accent':'#f7df1e','--border':'#2a2a2a','--font':'ui-monospace, monospace' }
};

window.applyTheme = function (profile) {
  const t = Object.assign({}, THEMES[profile.theme] || THEMES.default);
  const c = profile.customTheme || {};
  if (c.bg) t['--bg'] = c.bg;
  if (c.accent) { t['--accent'] = c.accent; t['--border'] = c.accent; }
  if (c.text) t['--text'] = c.text;
  const root = document.documentElement.style;
  for (const k in t) if (k.startsWith('--')) root.setProperty(k, t[k]);
  root.setProperty('--bg-image', profile.gifBackground ? `url("${profile.gifBackground}")` : 'none');
  document.body.classList.toggle('scan', !!t.scan);
};
