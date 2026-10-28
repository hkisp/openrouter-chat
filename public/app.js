const STORAGE_KEY = 'openrouter-chat-v1';

const IMAGE_MODELS = new Set([
  'black-forest-labs/flux-3-image-klein',
  'black-forest-labs/flux-3-image',
  'qwen/qwen-image-2.1-turbo',
  'google/gemini-nano-banana-2.1',
  'bytedance-seed/seedream-5-0-flash',
  'meta/muse-image',
]);

const SUGGESTIONS_CHAT = [
  { tag: '编程', text: '用简单例子解释什么是 Promise' },
  { tag: '写作', text: '帮我写一段产品介绍开场白' },
  { tag: '学习', text: '用三句话讲清机器学习是什么' },
  { tag: '日常', text: '给我 5 个周末放松的小点子' },
];

const SUGGESTIONS_IMAGE = [
  { tag: '风景', text: '黄昏时分的海边木栈道，温暖灯光，写实摄影' },
  { tag: '产品', text: '极简风格白底产品图，一杯拿铁咖啡，柔和阴影' },
  { tag: '角色', text: '赛博朋克女孩站在霓虹雨巷，插画风格' },
  { tag: '海报', text: '中文标题「SMART Chat」科技感海报，深蓝渐变' },
];

const els = {
  messages: document.getElementById('messages'),
  form: document.getElementById('composer'),
  input: document.getElementById('input'),
  send: document.getElementById('btn-send'),
  model: document.getElementById('model-select'),
  modelLabel: document.getElementById('model-label'),
  sidebar: document.getElementById('sidebar'),
  overlay: document.getElementById('overlay'),
  btnMenu: document.getElementById('btn-menu'),
  btnNew: document.getElementById('btn-new'),
  btnNewMobile: document.getElementById('btn-new-mobile'),
  btnClear: document.getElementById('btn-clear'),
};

let state = loadState();
let busy = false;

function isImageModel(id) {
  return IMAGE_MODELS.has(id || state.model);
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { messages: [], model: els.model.value };
    const data = JSON.parse(raw);
    return {
      messages: Array.isArray(data.messages) ? data.messages : [],
      model: data.model || els.model.value,
    };
  } catch {
    return { messages: [], model: els.model.value };
  }
}

function saveState() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ messages: state.messages, model: state.model })
  );
}

function modelShortName(id) {
  const opt = [...els.model.options].find((o) => o.value === id);
  return opt ? opt.textContent : id;
}

function updatePlaceholder() {
  els.input.placeholder = isImageModel()
    ? '描述你想生成的图片… Enter 发送'
    : '输入消息… Enter 发送，Shift+Enter 换行';
}

function renderEmpty() {
  const empty = document.createElement('div');
  empty.className = 'empty';
  const imageMode = isImageModel();
  empty.innerHTML = `
    <div class="empty-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="32" height="32" fill="none">
        <path d="M12 3l2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4L12 3z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
      </svg>
    </div>
    <h2>${imageMode ? '用文字生成图片' : '开始一段新对话'}</h2>
    <p>${
      imageMode
        ? '已选择图片模型。输入画面描述后发送，生成结果会显示在对话中。'
        : '选择免费对话模型或图片模型，输入后发送。历史保存在本机浏览器。'
    }</p>
    <div class="suggestions"></div>
  `;
  const grid = empty.querySelector('.suggestions');
  const list = imageMode ? SUGGESTIONS_IMAGE : SUGGESTIONS_CHAT;
  for (const s of list) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'suggestion';
    btn.innerHTML = `<span>${s.tag}</span>${s.text}`;
    btn.addEventListener('click', () => {
      if (busy) return;
      els.input.value = s.text;
      els.input.dispatchEvent(new Event('input'));
      els.form.requestSubmit();
    });
    grid.appendChild(btn);
  }
  return empty;
}

function render() {
  els.model.value = state.model;
  els.modelLabel.textContent = modelShortName(state.model);
  updatePlaceholder();
  els.messages.innerHTML = '';

  if (!state.messages.length) {
    els.messages.appendChild(renderEmpty());
    return;
  }

  for (const m of state.messages) {
    els.messages.appendChild(createBubble(m));
  }
  scrollToBottom();
}

function createBubble(msg, streaming = false) {
  const role = msg.role;
  const content = msg.content || '';
  const images = msg.images || [];

  const div = document.createElement('div');
  div.className = `msg ${role}`;
  const label =
    role === 'user' ? '你' : role === 'assistant' ? '助手' : role === 'error' ? '错误' : role;
  const badgeLetter = role === 'user' ? '你' : role === 'assistant' ? 'AI' : '!';

  const roleEl = document.createElement('span');
  roleEl.className = 'role';
  const badge = document.createElement('span');
  badge.className = 'role-badge';
  badge.textContent = badgeLetter;
  roleEl.appendChild(badge);
  roleEl.appendChild(document.createTextNode(label));

  const body = document.createElement('div');
  body.className = 'body';
  if (content) body.textContent = content;
  if (streaming) {
    const cur = document.createElement('span');
    cur.className = 'cursor';
    body.appendChild(cur);
  }

  if (images.length) {
    const gallery = document.createElement('div');
    gallery.className = 'image-gallery';
    for (const src of images) {
      const img = document.createElement('img');
      img.src = src;
      img.alt = '生成图片';
      img.loading = 'lazy';
      img.addEventListener('click', () => window.open(src, '_blank'));
      gallery.appendChild(img);
    }
    body.appendChild(gallery);
  }

  div.appendChild(roleEl);
  div.appendChild(body);
  return div;
}

function scrollToBottom() {
  els.messages.scrollTop = els.messages.scrollHeight;
}

function setBusy(v) {
  busy = v;
  els.send.disabled = v;
  els.input.disabled = v;
}

function closeSidebar() {
  els.sidebar.classList.remove('open');
  els.overlay.hidden = true;
}

function openSidebar() {
  els.sidebar.classList.add('open');
  els.overlay.hidden = false;
}

function newChat() {
  if (busy) return;
  state.messages = [];
  saveState();
  render();
  closeSidebar();
  els.input.focus();
}

function clearHistory() {
  if (busy) return;
  if (!confirm('确定清空全部对话历史？')) return;
  newChat();
}

function extractError(detail, fallback) {
  if (!detail) return fallback;
  if (typeof detail === 'string') return detail;
  return (
    detail.detail?.error?.message ||
    detail.error?.message ||
    detail.error ||
    detail.message ||
    fallback
  );
}

els.model.addEventListener('change', () => {
  state.model = els.model.value;
  els.modelLabel.textContent = modelShortName(state.model);
  updatePlaceholder();
  saveState();
  if (!state.messages.length) render();
});

els.btnMenu.addEventListener('click', openSidebar);
els.overlay.addEventListener('click', closeSidebar);
els.btnNew.addEventListener('click', newChat);
els.btnNewMobile.addEventListener('click', newChat);
els.btnClear.addEventListener('click', clearHistory);

els.input.addEventListener('input', () => {
  els.input.style.height = 'auto';
  els.input.style.height = Math.min(els.input.scrollHeight, 160) + 'px';
});

els.input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    els.form.requestSubmit();
  }
});

async function sendChat(text) {
  const assistantMsg = { role: 'assistant', content: '' };
  state.messages.push(assistantMsg);
  const bubble = createBubble(assistantMsg, true);
  const empty = els.messages.querySelector('.empty');
  if (empty) empty.remove();
  els.messages.appendChild(bubble);
  const body = bubble.querySelector('.body');
  scrollToBottom();

  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: state.model,
      stream: true,
      messages: state.messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .slice(0, -1)
        .concat([{ role: 'user', content: text }]),
    }),
  });

  if (!res.ok) {
    let detail = await res.text();
    try {
      detail = JSON.parse(detail);
    } catch (_) {}
    throw new Error(extractError(detail, `HTTP ${res.status}`));
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n');
    buffer = parts.pop() || '';

    for (const line of parts) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const data = trimmed.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      try {
        const json = JSON.parse(data);
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) {
          assistantMsg.content += delta;
          body.textContent = assistantMsg.content;
          const cur = document.createElement('span');
          cur.className = 'cursor';
          body.appendChild(cur);
          scrollToBottom();
        }
        if (json.error) {
          throw new Error(json.error.message || JSON.stringify(json.error));
        }
      } catch (err) {
        if (err instanceof SyntaxError) continue;
        throw err;
      }
    }
  }

  if (!assistantMsg.content) {
    assistantMsg.content = '（模型未返回内容）';
  }
  body.textContent = assistantMsg.content;
  saveState();
}

async function sendImage(text) {
  const assistantMsg = {
    role: 'assistant',
    content: '正在生成图片…',
    images: [],
  };
  state.messages.push(assistantMsg);
  const bubble = createBubble(assistantMsg, true);
  const empty = els.messages.querySelector('.empty');
  if (empty) empty.remove();
  els.messages.appendChild(bubble);
  const body = bubble.querySelector('.body');
  scrollToBottom();

  const res = await fetch('/api/image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: state.model,
      prompt: text,
      n: 1,
    }),
  });

  let data;
  try {
    data = await res.json();
  } catch (_) {
    throw new Error(`HTTP ${res.status}`);
  }

  if (!res.ok) {
    throw new Error(extractError(data, `HTTP ${res.status}`));
  }

  const urls = (data.images || []).map((img) => img.url).filter(Boolean);
  if (!urls.length) {
    throw new Error('未返回图片数据');
  }

  assistantMsg.content = '已生成图片';
  assistantMsg.images = urls;
  body.textContent = assistantMsg.content;
  const gallery = document.createElement('div');
  gallery.className = 'image-gallery';
  for (const src of urls) {
    const img = document.createElement('img');
    img.src = src;
    img.alt = '生成图片';
    img.loading = 'lazy';
    img.addEventListener('click', () => window.open(src, '_blank'));
    gallery.appendChild(img);
  }
  body.appendChild(gallery);
  saveState();
  scrollToBottom();
}

els.form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (busy) return;
  const text = els.input.value.trim();
  if (!text) return;

  state.messages.push({ role: 'user', content: text });
  els.input.value = '';
  els.input.style.height = 'auto';
  saveState();
  render();

  setBusy(true);

  try {
    if (isImageModel()) {
      await sendImage(text);
    } else {
      await sendChat(text);
    }
  } catch (err) {
    state.messages.pop();
    const errBubble = createBubble({
      role: 'error',
      content: err.message || String(err),
    });
    saveState();
    render();
    els.messages.appendChild(errBubble);
    scrollToBottom();
  } finally {
    setBusy(false);
    els.input.focus();
  }
});

render();
els.input.focus();
