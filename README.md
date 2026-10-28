# OpenRouter Chat

简单的网页聊天界面，通过服务端代理调用 [OpenRouter](https://openrouter.ai) 免费模型。API Key 只保存在服务器环境变量中，不会暴露给浏览器。

默认模型：`nvidia/nemotron-3-ultra-550b-a55b:free`

## 功能

- 深色现代聊天 UI（中文标签）
- 流式输出（SSE）
- 模型选择（含免费模型）
- 对话历史本地 `localStorage` 持久化
- 一键清空 / 新对话
- 移动端适配

## 快速开始

```bash
git clone https://github.com/hkisp/openrouter-chat.git
cd openrouter-chat
cp .env.example .env
# 编辑 .env，填入你的 OPENROUTER_API_KEY（https://openrouter.ai/keys）
npm install
npm start
```

浏览器打开：http://localhost:3000

开发模式（文件变更自动重启，需 Node 18+）：

```bash
npm run dev
```

## 环境变量

| 变量 | 说明 | 默认 |
|------|------|------|
| `OPENROUTER_API_KEY` | OpenRouter API Key（必填） | — |
| `OPENROUTER_MODEL` | 默认模型 | `nvidia/nemotron-3-ultra-550b-a55b:free` |
| `PORT` | 服务端口 | `3000` |
| `OPENROUTER_REFERER` | OpenRouter HTTP-Referer | `http://localhost:3000` |

## API

- `GET /api/health` — 健康检查
- `POST /api/chat` — 代理聊天补全

请求体示例：

```json
{
  "model": "nvidia/nemotron-3-ultra-550b-a55b:free",
  "stream": true,
  "messages": [
    { "role": "user", "content": "你好" }
  ]
}
```

## 技术栈

- Node.js + Express
- 静态前端（HTML / CSS / JS）
- `dotenv` / `cors`

## 许可证

MIT
