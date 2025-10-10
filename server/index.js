/**
 * server/index.js — centrale Express-server voor Superhond (v0.26.4)
 * - Dient /public/ frontend uit
 * - Stelt /api/config dynamisch samen vanuit Render ENV
 * - Optionele /api/ping en /api/sheets (proxy) endpoints
 */

import express from 'express';
import compression from 'compression';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));

// ────────────────────────────────────────────────
// DYNAMISCHE CONFIG: leest Render ENV-variabelen
// ────────────────────────────────────────────────
app.get('/api/config', (req, res) => {
  const config = {
    apiBase: process.env.API_BASE || '',
    version: '0.26.4',
    env: process.env.NODE_ENV || 'prod',
    adminToken: process.env.ADMIN_TOKEN || '',
  };
  res.json(config);
});

// ────────────────────────────────────────────────
// Eenvoudige health/ping endpoint
// ────────────────────────────────────────────────
app.get('/api/ping', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// ────────────────────────────────────────────────
// Proxy voor /api/sheets (optioneel, mag 404’en)
// ────────────────────────────────────────────────
app.all('/api/sheets', async (req, res) => {
  // Alleen actief als je zelf een proxy wilt gebruiken
  const target = process.env.API_BASE;
  if (!target) return res.status(404).json({ error: 'Geen API_BASE ingesteld' });

  try {
    const method = req.method;
    const qs = req.originalUrl.split('?')[1] || '';
    const url = `${target}${qs ? '?' + qs : ''}`;

    const headers = { 'Content-Type': 'application/json' };
    const body = ['POST', 'PUT', 'PATCH'].includes(method) ? JSON.stringify(req.body || {}) : undefined;

    const r = await fetch(url, { method, headers, body, mode: 'cors' });
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }

    res.status(r.status).send(data);
  } catch (e) {
    console.error('Proxy error:', e);
    res.status(500).json({ error: String(e.message || e) });
  }
});

// ────────────────────────────────────────────────
// Static frontend (public/)
// ────────────────────────────────────────────────
const publicDir = path.resolve(__dirname, '../public');
app.use(express.static(publicDir));

// fallback → dashboard
app.get('*', (req, res) => {
  res.sendFile(path.join(publicDir, 'dashboard', 'index.html'));
});

// ────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Superhond server running on port ${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'prod'}`);
});
