const STORAGE_KEY = 'openrouter-chat-v1';

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

function render() {
  els.model.value = state.model;
  els.modelLabel.textContent = modelShortName(state.model);
  els.messages.innerHTML = '';

  if (!state.messages.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.innerHTML =
      '<h2>开始对话</h2><p>选择免费模型，输入问题后点击发送。支持流式输出，历史保存在本机浏览器。</p>';
    els.messages.appendChild(empty);
    return;
  }

  for (const m of state.messages) {
    els.messages.appendChild(createBubble(m.role, m.content));
  }
  scrollToBottom();
}

function createBubble(role, content, streaming = false) {
  const div = document.createElement('div');
  div.className = `msg ${role}`;
  const label =
    role === 'user' ? '你' : role === 'assistant' ? '助手' : role === 'error' ? '错误' : role;
  const roleEl = document.createElement('span');
  roleEl.className = 'role';
  roleEl.textContent = label;
  const body = document.createElement('div');
  body.className = 'body';
  body.textContent = content || '';
  if (streaming) {
    const cur = document.createElement('span');
    cur.className = 'cursor';
    body.appendChild(cur);
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

els.model.addEventListener('change', () => {
  state.model = els.model.value;
  els.modelLabel.textContent = modelShortName(state.model);
  saveState();
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
  const assistantMsg = { role: 'assistant', content: '' };
  state.messages.push(assistantMsg);
  const bubble = createBubble('assistant', '', true);
  const empty = els.messages.querySelector('.empty');
  if (empty) empty.remove();
  els.messages.appendChild(bubble);
  const body = bubble.querySelector('.body');
  scrollToBottom();

  try {
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
        const j = JSON.parse(detail);
        detail = j.detail?.error?.message || j.error || detail;
      } catch (_) {}
      throw new Error(detail || `HTTP ${res.status}`);
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
      body.textContent = assistantMsg.content;
    } else {
      body.textContent = assistantMsg.content;
    }
    saveState();
  } catch (err) {
    state.messages.pop();
    const errBubble = createBubble('error', err.message || String(err));
    els.messages.appendChild(errBubble);
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
