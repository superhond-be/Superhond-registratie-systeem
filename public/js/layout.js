/**
 * public/js/layout.js — Topbar & Footer mount (v0.27.3)
 * - Centrale gele topbar + footer
 * - Toont versienummer en build
 * - Detecteert Online/Offline status
 * - Compatibel met diagnose.js EXEC opslag
 */

(() => {
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const VERSION = 'v0.27.3';
  const BUILD = new Date().toISOString().slice(0, 10);

  // ───────────────────────── EXEC detectie (met patch)
  function resolveExecBase() {
    // 1) localStorage (voorrang)
    try {
      const lsApi = localStorage.getItem('superhond:apiBase');
      if (lsApi) return lsApi;
      const lsExec = localStorage.getItem('superhond:exec');
      if (lsExec) return lsExec;
    } catch {}

    // 2) window-variabele (fallback)
    if (typeof window.SUPERHOND_SHEETS_URL === 'string' && window.SUPERHOND_SHEETS_URL) {
      return window.SUPERHOND_SHEETS_URL;
    }

    // 3) meta-tag (fallback)
    const meta = document.querySelector('meta[name="superhond-exec"]');
    if (meta?.content) return meta.content.trim();

    // 4) Niets gevonden
    return '';
  }

  // ───────────────────────── UI render ─────────────────────────
  function renderTopbar() {
    const el = $('#topbar');
    if (!el) return;

    const execBase = resolveExecBase();
    const shortExec = execBase
      ? execBase.replace(/^https?:\/\/(www\.)?/, '').slice(0, 50) + (execBase.length > 50 ? '…' : '')
      : 'geen koppeling';

    el.innerHTML = `
      <div class="topbar-inner" style="background:#FFD500;display:flex;align-items:center;justify-content:space-between;padding:.5rem 1rem">
        <div class="left">
          <a href="/dashboard/" class="logo" style="text-decoration:none;color:#111;font-weight:700">🐶 Superhond</a>
        </div>
        <div class="right" style="display:flex;align-items:center;gap:.75rem">
          <span id="netstatus" class="badge offline" title="Geen verbinding">offline</span>
          <span class="version" title="${execBase}">${VERSION}</span>
        </div>
      </div>`;
  }

  function renderFooter() {
    const el = $('#footer');
    if (!el) return;
    const execBase = resolveExecBase();
    el.innerHTML = `
      <div class="footer-inner" style="padding:1rem;text-align:center;color:#6b7280;font-size:.85rem">
        <p>Superhond Registratiesysteem — ${VERSION} • Build ${BUILD}</p>
        <p><code>${execBase ? execBase.replace(/^https?:\/\/(www\.)?/, '') : 'geen EXEC gekoppeld'}</code></p>
      </div>`;
  }

  // ───────────────────────── Online/Offline badge ─────────────────────────
  function setOnline(isOnline = true) {
    const el = $('#netstatus');
    if (!el) return;
    if (isOnline) {
      el.textContent = 'online';
      el.className = 'badge online';
      el.style.background = '#22c55e';
    } else {
      el.textContent = 'offline';
      el.className = 'badge offline';
      el.style.background = '#ef4444';
    }
  }

  // ───────────────────────── Exporteer voor globale toegang ─────────────────────────
  window.SuperhondUI = {
    mount(opts = {}) {
      renderTopbar();
      renderFooter();
      if (opts.title) document.title = `${opts.title} – Superhond`;
      if (opts.icon && $('#page-icon')) $('#page-icon').textContent = opts.icon;
      if (opts.back) {
        const top = $('#topbar .left');
        if (top) {
          const link = document.createElement('a');
          link.href = opts.back;
          link.textContent = '← Terug';
          link.style.marginRight = '1rem';
          top.prepend(link);
        }
      }
      setOnline(false); // standaard = offline, tot eerste ping
    },
    setOnline,
    resolveExecBase,
  };

  // ───────────────────────── Init ─────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    renderTopbar();
    renderFooter();

    // Test verbinding kort na laden
    const exec = resolveExecBase();
    if (exec) {
      const testUrl = exec + (exec.includes('?') ? '&' : '?') + 'mode=ping&t=' + Date.now();
      fetch(testUrl, { cache: 'no-store' })
        .then(r => r.ok ? setOnline(true) : setOnline(false))
        .catch(() => setOnline(false));
    } else {
      setOnline(false);
    }
  }, { once: true });
})();
