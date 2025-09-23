
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const DATABASE_URL = process.env.DATABASE_URL || './data.db';
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

if (!OPENAI_API_KEY) {
  console.warn('⚠️  Missing OPENAI_API_KEY. Set it in .env or environment variables.');
}

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(cors({ origin: CORS_ORIGIN === '*' ? true : CORS_ORIGIN.split(',') }));

// --- SQLite setup ---
sqlite3.verbose();
const db = new sqlite3.Database(DATABASE_URL);
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );`);
  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER,
    role TEXT CHECK(role IN ('user','assistant','system')) NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(conversation_id) REFERENCES conversations(id)
  );`);
});

// Serve the chat UI as well (optional)
app.use('/', express.static(path.join(__dirname, '..', 'public')));

// Create conversation
app.post('/api/convos', (req, res) => {
  const title = req.body?.title || 'Nieuw gesprek';
  db.run('INSERT INTO conversations(title) VALUES(?)', [title], function(err){
    if (err) return res.status(500).json({ error: 'db_insert_failed' });
    return res.json({ id: this.lastID });
  });
});

// List conversations
app.get('/api/convos', (req, res) => {
  db.all('SELECT id, title, created_at FROM conversations ORDER BY id DESC LIMIT 50', [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'db_read_failed' });
    return res.json(rows);
  });
});

// List messages
app.get('/api/messages', (req, res) => {
  const id = parseInt(req.query.conversationId);
  if (!id) return res.status(400).json({ error: 'missing_conversationId' });
  db.all('SELECT id, role, content, created_at FROM messages WHERE conversation_id = ? ORDER BY id ASC', [id], (err, rows) => {
    if (err) return res.status(500).json({ error: 'db_read_failed' });
    return res.json(rows);
  });
});

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { conversationId, message } = req.body || {};
    if (!conversationId || !message) {
      return res.status(400).json({ error: 'missing_params' });
    }

    // Save user message
    await new Promise((resolve, reject) => {
      db.run('INSERT INTO messages(conversation_id, role, content) VALUES(?,?,?)',
        [conversationId, 'user', message],
        (err) => err ? reject(err) : resolve()
      );
    });

    // Build messages context (last 20 messages)
    const history = await new Promise((resolve, reject) => {
      db.all('SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY id DESC LIMIT 20', [conversationId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows.reverse());
      });
    });

    // Call OpenAI chat API
    const completion = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          { role: 'system', content: 'You are a helpful assistant for Superhond. Keep answers concise.' },
          ...history
        ],
        temperature: 0.3
      })
    });

    if (!completion.ok) {
      const errText = await completion.text();
      return res.status(500).json({ error: 'openai_error', detail: errText });
    }

    const data = await completion.json();
    const reply = data.choices?.[0]?.message?.content ?? '(geen antwoord)';

    // Save assistant message
    await new Promise((resolve, reject) => {
      db.run('INSERT INTO messages(conversation_id, role, content) VALUES(?,?,?)',
        [conversationId, 'assistant', reply],
        (err) => err ? reject(err) : resolve()
      );
    });

    res.json({ reply });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error' });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Superhond chat server up on http://localhost:${PORT}`);
});
