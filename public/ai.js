// ── Nyx public AI chat ────────────────────────────────────────────────
(() => {
  const $ = id => document.getElementById(id);
  const log = document.getElementById('chat-log');
  const input = $('ai-input');
  const form = $('ai-form');
  const suggestions = document.querySelectorAll('.sug');
  const dot = $('ai-dot');
  const card = $('ai-card');
  const toggle = $('ai-toggle');
  const resetBtn = $('ai-reset');
  const mic = $('ai-mic');
  const logCount = () => log.children.length;

  let session = [];
  let streaming = false;

  function addMsg(text, who) {
    const d = document.createElement('div');
    d.className = 'msg ' + who;
    d.textContent = text;
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
    return d;
  }

  function setTyping(on) {
    dot.style.opacity = on ? '1' : '.4';
    if (on) dot.style.animation = 'pulse 1.2s ease-in-out infinite';
    else dot.style.animation = '';
  }

  async function send(text) {
    if (streaming) return;
    const msg = String(text).trim();
    if (!msg) return;
    addMsg(msg, 'user');
    session.push({ role: 'user', content: msg });
    input.value = '';
    streaming = true;
    setTyping(true);
    const chatLog = log;
    const inputBox = input;
    try {
      const res = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: msg })
      });
      if (!res.ok) { setTyping(false); addMsg('erro: ' + (await res.json()).error, 'assistant'); return; }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let full = '';
      while (true) {
        const { done, value } = await reader.read();
        const chunk = decoder.decode(value);
        buffer += chunk;
        let nl;
        while ((nl = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (line.startsWith('data: ')) {
            try {
              const ev = JSON.parse(line.slice(6));
              if (ev.chunk) {
                full += ev.chunk;
                // render incrementally into the last assistant message
                const last = chatLog.lastElementChild;
                if (last && last.className === 'msg assistant') {
                  // truncate trailing newline-in-middle marker
                  let txt = full;
                  if (txt.endsWith('\n')) txt = txt.slice(0, -1);
                  last.textContent = txt;
                } else if (full) {
                  const d = addMsg(full, 'assistant');
                  // no fade needed
                }
              } else if (ev.error) {
                addMsg('erro: ' + ev.error, 'assistant');
              }
            } catch { /* ignore malformed */ }
          }
        }
        if (done) break;
      }
      // flush any trailing partial
      if (buffer.trim()) {
        const last = log.lastElementChild;
        if (last && last.className === 'msg assistant') {
          last.textContent = buffer.trim();
        }
      }
      session.push({ role: 'assistant', content: full });
    } catch (e) {
      setTyping(false);
      addMsg('erro de rede', 'assistant');
    }
    streaming = false;
    setTyping(false);
    inputBox.focus();
  }

  // voice
  if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.continuous = false;
    rec.lang = 'pt-BR';
    rec.interimResults = false;
    mic.onclick = () => {
      rec.start();
      mic.textContent = '·····';
      mic.disabled = true;
      rec.onresult = (e) => {
        const txt = e.results[0][0].transcript;
        input.value = txt;
        input.focus();
        mic.textContent = '🎤 voz';
        mic.disabled = false;
      };
      rec.onerror = () => { mic.textContent = '🎤 voz'; mic.disabled = false; };
      rec.onend = () => { mic.textContent = '🎤 voz'; mic.disabled = false; };
    };
  } else {
    mic.disabled = true;
  }

  // suggestions
  for (const s of suggestions) s.onclick = () => { send(s.dataset.sug); };

  // toggle / reset
  toggle.onclick = () => {
    card.hidden = !card.hidden;
    toggle.textContent = card.hidden ? 'ativa assistente' : 'fecha assistente';
  };
  resetBtn.onclick = () => {
    log.textContent = '';
    session = [];
  };

  form.onsubmit = (e) => { e.preventDefault(); send(input.value); };
})();
