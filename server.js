require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const DEFAULT_MODEL =
  process.env.OPENROUTER_MODEL || 'nvidia/nemotron-3-ultra-550b-a55b:free';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    hasKey: Boolean(OPENROUTER_API_KEY),
    defaultModel: DEFAULT_MODEL,
  });
});

app.post('/api/chat', async (req, res) => {
  if (!OPENROUTER_API_KEY) {
    return res.status(500).json({
      error: 'OPENROUTER_API_KEY is not set. Copy .env.example to .env and add your key.',
    });
  }

  const { messages, model, stream = true } = req.body || {};

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages must be a non-empty array' });
  }

  const payload = {
    model: model || DEFAULT_MODEL,
    messages,
    stream: Boolean(stream),
  };

  const headers = {
    Authorization: `Bearer ${OPENROUTER_API_KEY}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': process.env.OPENROUTER_REFERER || 'http://localhost:3000',
    'X-Title': 'OpenRouter Chat',
  };

  try {
    const upstream = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      let detail = text;
      try {
        detail = JSON.parse(text);
      } catch (_) {
        /* keep raw text */
      }
      return res.status(upstream.status).json({
        error: 'OpenRouter request failed',
        detail,
      });
    }

    if (payload.stream) {
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();

      const reader = upstream.body.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(decoder.decode(value, { stream: true }));
        }
      } catch (err) {
        if (!res.writableEnded) {
          res.write(
            `data: ${JSON.stringify({ error: err.message || 'stream error' })}\n\n`
          );
        }
      } finally {
        if (!res.writableEnded) res.end();
      }
      return;
    }

    const data = await upstream.json();
    return res.json(data);
  } catch (err) {
    console.error('chat error:', err);
    return res.status(502).json({
      error: 'Failed to reach OpenRouter',
      detail: err.message,
    });
  }
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`OpenRouter Chat running at http://localhost:${PORT}`);
  if (!OPENROUTER_API_KEY) {
    console.warn('Warning: OPENROUTER_API_KEY is not set');
  }
});
