/**
 * public/js/diagnose.js — EXEC vastzetten + testen (v0.27.3)
 * - Slaat EXEC op in localStorage (superhond:apiBase én superhond:exec)
 * - Schrijft/actualiseert <meta name="superhond-exec">
 * - Test: ping + fetch Klanten/Honden rechtstreeks
 * - Werkt zonder /api-proxy; gebruikt alleen fetch()
 */

(function () {
  const LS_API = 'superhond:apiBase';
  const LS_EXE = 'superhond:exec';

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const ui = {
    input:  $('#exec-input') || $('input[name="exec"]') || $('input[type="url"]'),
    btnSave: $('#btn-save') || $('[data-diag="save"]'),
    btnClear: $('#btn-clear') || $('[data-diag="clear"]'),
    btnTest: $('#btn-test') || $('[data-diag="test"]'),
    tbl:     $('#diag-table') || document,
    state:   $('#state') || null,
    footerExec: document.querySelector('footer code')
  };

  function sanitizeExecUrl(url = '') {
    try {
      const u = new URL(String(url).trim());
      if (u.hostname === 'script.google.com' && u.pathname.startsWith('/macros/s/')) {
        // forceer eindigend op /exec
        let p = u.pathname;
        if (!p.endsWith('/exec'))
          p = p.replace(/\/userexec$/, '/exec')
               .replace(/\/deploy$/, '/exec')
               + (p.endsWith('/exec') ? '' : '/exec');
        return `${u.origin}${p}`;
      }
    } catch {}
    return '';
  }

  function setMetaExec(execUrl) {
    let m = document.querySelector('meta[name="superhond-exec"]');
    if (!m) {
      m = document.createElement('meta');
      m.setAttribute('name', 'superhond-exec');
      document.head.appendChild(m);
    }
    m.setAttribute('content', execUrl);
  }

  function saveExec(execUrl) {
    const safe = sanitizeExecUrl(execUrl);
    if (!safe) throw new Error('Geen geldige Google Apps Script /exec URL.');
    localStorage.setItem(LS_API, safe);
    localStorage.setItem(LS_EXE, safe);
    setMetaExec(safe);
    if (ui.footerExec)
      ui.footerExec.textContent = 'exec: ' + safe.replace(/^https?:\/\/(www\.)?/, '');
    return safe;
  }

  function getExec() {
    return (
      localStorage.getItem(LS_API) ||
      localStorage.getItem(LS_EXE) ||
      document.querySelector('meta[name="superhond-exec"]')?.content ||
      ''
    );
  }

  async function ping(execBase) {
    const sep = execBase.includes('?') ? '&' : '?';
    const url = `${execBase}${sep}mode=ping&t=${Date.now()}`;
    const r = await fetch(url, { cache: 'no-store' });
    const txt = await r.text();
    let ok = r.ok;
    try {
      const j = JSON.parse(txt);
      ok = ok && (j?.ok === true || j?.data?.ok === true || j?.data?.ping === 'OK');
    } catch {}
    return { ok, status: r.status, body: txt.slice(0, 300) };
  }

  async function fetchTab(execBase, mode) {
    const sep = execBase.includes('?') ? '&' : '?';
    const url = `${execBase}${sep}mode=${encodeURIComponent(mode)}&t=${Date.now()}`;
    const r = await fetch(url, { cache: 'no-store' });
    const txt = await r.text();
    if (!r.ok) throw new Error(`${mode}: HTTP ${r.status}`);
    let rows = [];
    try {
      const j = JSON.parse(txt);
      rows = j?.data || j?.rows || j?.result || [];
    } catch (e) {
      throw new Error(`${mode}: Ongeldige JSON`);
    }
    return { ok: true, rows, status: r.status };
  }

  function setRow(id, status, note = '') {
    const row = document.getElementById(id) || ui.tbl;
    const elS = row?.querySelector?.('[data-col="status"]');
    const elN = row?.querySelector?.('[data-col="note"]');
    const klass = status === 'OK' ? 'ok' : (status === 'Err' ? 'err' : 'muted');
    if (elS) { elS.textContent = status; elS.className = klass; }
    if (elN) { elN.textContent = note || ''; }
  }

  async function runTests() {
    const execBase = sanitizeExecUrl(getExec());
    if (!execBase) { setRow('row-base', 'Err', 'Geen EXEC ingesteld'); return; }

    setRow('row-base', 'OK', execBase.replace(/^https?:\/\/(www\.)?/, ''));

    try {
      const pr = await ping(execBase);
      setRow('row-ping', pr.ok ? 'OK' : 'Err', `HTTP ${pr.status}`);
      window.SuperhondUI?.setOnline?.(!!pr.ok);
      if (!pr.ok) return;
    } catch (e) {
      setRow('row-ping', 'Err', String(e.message || e));
      window.SuperhondUI?.setOnline?.(false);
      return;
    }

    try {
      const k = await fetchTab(execBase, 'klanten');
      setRow('row-klanten', 'OK', `Rijen: ${k.rows?.length ?? 0}`);
    } catch (e) {
      setRow('row-klanten', 'Err', String(e.message || e));
    }

    try {
      const h = await fetchTab(execBase, 'honden');
      setRow('row-honden', 'OK', `Rijen: ${h.rows?.length ?? 0}`);
    } catch (e) {
      setRow('row-honden', 'Err', String(e.message || e));
    }
  }

  // ─── Init UI ──────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    const cur = getExec();
    if (ui.input && cur) ui.input.value = cur;

    ui.btnSave?.addEventListener('click', (e) => {
      e.preventDefault();
      try {
        const val = ui.input?.value || '';
        const safe = saveExec(val);
        setRow('row-base', 'OK', safe.replace(/^https?:\/\/(www\.)?/, ''));
        window.alert('EXEC opgeslagen. Herlaad de pagina (Cmd/Ctrl + Shift + R) om overal Online te zien.');
      } catch (err) {
        window.alert('Opslaan mislukt: ' + (err?.message || err));
      }
    });

    ui.btnClear?.addEventListener('click', (e) => {
      e.preventDefault();
      localStorage.removeItem(LS_API);
      localStorage.removeItem(LS_EXE);
      setMetaExec('');
      if (ui.input) ui.input.value = '';
      setRow('row-base', '–', 'leeg');
      setRow('row-ping', '–', '');
      setRow('row-klanten', '–', '');
      setRow('row-honden', '–', '');
      window.alert('Cache gewist. Stel opnieuw een EXEC in en herlaad.');
    });

    ui.btnTest?.addEventListener('click', (e) => {
      e.preventDefault();
      runTests();
    });

    runTests();
  });

  window.SHDiag = { getExec, saveExec, runTests };
})();
