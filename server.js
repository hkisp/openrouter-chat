require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const DEFAULT_MODEL =
  process.env.OPENROUTER_MODEL || 'nvidia/nemotron-3-ultra-550b-a55b:free';
const OPENROUTER_CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_IMAGES_URL = 'https://openrouter.ai/api/v1/images';

/** Models that use OpenRouter Image API (POST /api/v1/images). */
const IMAGE_MODELS = new Set([
  'black-forest-labs/flux-3-image-klein',
  'black-forest-labs/flux-3-image',
  'qwen/qwen-image-2.1-turbo',
  'google/gemini-nano-banana-2.1',
  'bytedance-seed/seedream-5-0-flash',
  'meta/muse-image',
]);

app.use(cors());
app.use(express.json({ limit: '8mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function openRouterHeaders() {
  return {
    Authorization: `Bearer ${OPENROUTER_API_KEY}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': process.env.OPENROUTER_REFERER || 'http://localhost:3000',
    'X-Title': 'SMART Chat',
  };
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    hasKey: Boolean(OPENROUTER_API_KEY),
    defaultModel: DEFAULT_MODEL,
  });
});

const CHAT_MODELS = [
  'nvidia/nemotron-3-ultra-550b-a55b:free',
  'nvidia/nemotron-3.5-lightning:free',
  'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
  'nvidia/nemotron-3.5-super-vl:free',
  'nvidia/nemotron-3.5-content-safety:free',
  'recursive/flint-v1.0:free',
  'openrouter/free',
  'poolside/laguna-s-2.1:free',
  'xingchen-agi/xing4.0-29b-a4b:free',
  'cohere/north-mini-code:free',
  'dots-studio/dots-3-note-preview:free',
];

app.get('/api/models', (_req, res) => {
  res.json({
    defaultModel: DEFAULT_MODEL,
    chatModels: CHAT_MODELS,
    imageModels: [...IMAGE_MODELS],
  });
});

app.post('/api/chat', async (req, res) => {
  if (!OPENROUTER_API_KEY) {
    return res.status(500).json({
      error: 'OPENROUTER_API_KEY is not set. Copy .env.example to .env and add your key.',
    });
  }

  const { messages, model, stream = true } = req.body || {};
  const chosen = model || DEFAULT_MODEL;

  if (IMAGE_MODELS.has(chosen)) {
    return res.status(400).json({
      error: 'Selected model is an image model. Use /api/image instead.',
      imageModel: true,
    });
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages must be a non-empty array' });
  }

  const payload = {
    model: chosen,
    messages,
    stream: Boolean(stream),
  };

  try {
    const upstream = await fetch(OPENROUTER_CHAT_URL, {
      method: 'POST',
      headers: openRouterHeaders(),
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

app.post('/api/image', async (req, res) => {
  if (!OPENROUTER_API_KEY) {
    return res.status(500).json({
      error: 'OPENROUTER_API_KEY is not set. Copy .env.example to .env and add your key.',
    });
  }

  const { prompt, model, n = 1, aspect_ratio, resolution } = req.body || {};
  const chosen = model || 'black-forest-labs/flux-3-image-klein';

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ error: 'prompt is required' });
  }

  if (!IMAGE_MODELS.has(chosen)) {
    return res.status(400).json({
      error: 'Model is not configured as an image model',
      model: chosen,
    });
  }

  const payload = {
    model: chosen,
    prompt: prompt.trim(),
    n: Math.min(Math.max(Number(n) || 1, 1), 4),
  };
  if (aspect_ratio) payload.aspect_ratio = aspect_ratio;
  if (resolution) payload.resolution = resolution;

  try {
    const upstream = await fetch(OPENROUTER_IMAGES_URL, {
      method: 'POST',
      headers: openRouterHeaders(),
      body: JSON.stringify(payload),
    });

    const text = await upstream.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (_) {
      data = { raw: text };
    }

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        error: 'OpenRouter image request failed',
        detail: data,
      });
    }

    const images = (data.data || [])
      .map((item) => {
        if (item.b64_json) {
          const media = item.media_type || 'image/png';
          return { url: `data:${media};base64,${item.b64_json}`, media_type: media };
        }
        if (item.url) return { url: item.url, media_type: item.media_type || null };
        return null;
      })
      .filter(Boolean);

    return res.json({
      model: chosen,
      images,
      usage: data.usage || null,
      created: data.created || null,
    });
  } catch (err) {
    console.error('image error:', err);
    return res.status(502).json({
      error: 'Failed to reach OpenRouter Images API',
      detail: err.message,
    });
  }
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`SMART Chat running at http://localhost:${PORT}`);
  if (!OPENROUTER_API_KEY) {
    console.warn('Warning: OPENROUTER_API_KEY is not set');
  }
});
