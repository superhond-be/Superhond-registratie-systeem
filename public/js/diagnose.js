/**
 * public/js/diagnose.js — Superhond diagnoselint (v0.3.0)
 * - Leest <meta name="superhond-exec"> als bron van de waarheid
 * - Synchroniseert localStorage("superhond:execBase")
 * - Ping rechtstreeks naar GAS /exec?mode=ping
 * - Toont onderaan een kleine statusbalk met Exec + Online/Offline
 * - “Fix”-knop zet localStorage => meta-waarde
 */

(function () {
  const LS_KEY = 'superhond:execBase';

  // ───────── helpers
  const onReady = (cb) =>
    document.readyState !== 'loading'
      ? cb()
      : document.addEventListener('DOMContentLoaded', cb, { once: true });

  const getMetaExec = () =>
    document.querySelector('meta[name="superhond-exec"]')?.content?.trim() || '';

  const getStoredExec = () => {
    try { return localStorage.getItem(LS_KEY) || ''; }
    catch { return ''; }
  };

  const setStoredExec = (val) => {
    try {
      if (val) localStorage.setItem(LS_KEY, val);
      else localStorage.removeItem(LS_KEY);
    } catch {}
  };

  const same = (a,b) => String(a||'').trim() === String(b||'').trim();

  async function pingExec(url) {
    if (!url) return false;
    const sep = url.includes('?') ? '&' : '?';
    const test = `${url}${sep}mode=ping&t=${Date.now()}`;
    try {
      const r = await fetch(test, { cache: 'no-store' });
      return r.ok;
    } catch {
      return false;
    }
  }

  // ───────── UI lint
  function ensureBar() {
    let bar = document.getElementById('sh-diag-bar');
    if (bar) return bar;

    const styleId = 'sh-diag-style';
    if (!document.getElementById(styleId)) {
      const s = document.createElement('style');
      s.id = styleId;
      s.textContent = `
        #sh-diag-bar{
          position:fixed;left:12px;bottom:12px;z-index:9999;
          display:flex;gap:.5rem;align-items:center;
          background:#111827;color:#fff;border-radius:10px;
          padding:.5rem .7rem;box-shadow:0 6px 18px rgba(0,0,0,.25);
          font:13px/1.2 system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;
          opacity:.92
        }
        #sh-diag-bar .dot{width:.55rem;height:.55rem;border-radius:999px;background:#9ca3af;display:inline-block}
        #sh-diag-bar .dot.ok{background:#16a34a}
        #sh-diag-bar .dot.bad{background:#ef4444}
        #sh-diag-bar code{background:rgba(255,255,255,.12);padding:.1rem .35rem;border-radius:6px}
        #sh-diag-bar button{
          appearance:none;border:1px solid rgba(255,255,255,.25);
          background:transparent;color:#fff;border-radius:8px;
          padding:.25rem .5rem;cursor:pointer
        }
        #sh-diag-bar button:hover{background:rgba(255,255,255,.08)}
      `;
      document.head.appendChild(s);
    }

    bar = document.createElement('div');
    bar.id = 'sh-diag-bar';
    bar.innerHTML = `
      <span class="dot" aria-hidden="true"></span>
      <span id="sh-diag-text">Diagnose…</span>
      <button id="sh-diag-fix" type="button" title="Zet localStorage = meta">Fix</button>
      <button id="sh-diag-retry" type="button" title="Opnieuw testen">Test</button>
    `;
    document.body.appendChild(bar);
    return bar;
  }

  function setBar(state) {
    const bar = ensureBar();
    const dot = bar.querySelector('.dot');
    const txt = bar.querySelector('#sh-diag-text');
    dot?.classList.remove('ok','bad');
    if (state.online === true) dot?.classList.add('ok');
    else if (state.online === false) dot?.classList.add('bad');
    if (txt) {
      const short = (u) => String(u||'').replace(/^https?:\/\/(www\.)?/, '');
      txt.innerHTML = `Exec: <code>${short(state.exec || 'n.v.t.')}</code> — ${state.online ? 'Online' : 'Offline'}`;
    }
  }

  // ───────── main
  async function run() {
    // Sync: meta → localStorage (als ls leeg of verschilt)
    const meta = getMetaExec();
    const stored = getStoredExec();
    if (meta && !same(meta, stored)) {
      setStoredExec(meta);
    }

    // Ping gebaseerd op (meta of stored)
    const execBase = meta || stored || '';
    const ok = await pingExec(execBase);

    // UI
    setBar({ exec: execBase, online: ok });
    // Update topbar-dot indien aanwezig
    if (window.SuperhondUI?.setOnline) window.SuperhondUI.setOnline(ok);
  }

  onReady(async () => {
    ensureBar();
    // Knoppen
    const bar = ensureBar();
    bar.querySelector('#sh-diag-fix')?.addEventListener('click', async () => {
      const meta = getMetaExec();
      if (!meta) { alert('Geen <meta name="superhond-exec"> gevonden.'); return; }
      setStoredExec(meta);
      await run();
    });
    bar.querySelector('#sh-diag-retry')?.addEventListener('click', run);

    await run();
  });

  // export voor handmatig aanroepen
  window.SuperhondDiag = { rerun: () => onReady(run) };
})();
