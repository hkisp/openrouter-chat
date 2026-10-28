# SMART Chat

简单的网页聊天界面，通过服务端代理调用 [OpenRouter](https://openrouter.ai)。支持免费对话模型与图片生成模型。API Key 只保存在服务器环境变量中，不会暴露给浏览器。

默认对话模型：`nvidia/nemotron-3-ultra-550b-a55b:free`

## 功能

- 深色现代聊天 UI（中文标签）
- 流式对话输出（SSE）
- 图片模型：调用 OpenRouter Image API，在对话中展示生成图
- 模型选择（对话 / 图片分组）
- 对话历史本地 `localStorage` 持久化
- 一键清空 / 新对话
- 移动端适配

## 图片模型

| 显示名 | OpenRouter ID |
|--------|---------------|
| FLUX 3 Image Klein（便宜） | `black-forest-labs/flux-3-image-klein` |
| FLUX 3 Image | `black-forest-labs/flux-3-image` |
| Qwen Image 2.1 Turbo | `qwen/qwen-image-2.1-turbo` |
| Nano Banana 2.1 | `google/gemini-nano-banana-2.1` |
| Seedream 5.0 Flash | `bytedance-seed/seedream-5-0-flash` |
| Muse Image | `meta/muse-image` |

图片生成走 `POST /api/v1/images`，按张计费，需 OpenRouter 账户有余额。

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
| `OPENROUTER_MODEL` | 默认对话模型 | `nvidia/nemotron-3-ultra-550b-a55b:free` |
| `PORT` | 服务端口 | `3000` |
| `OPENROUTER_REFERER` | OpenRouter HTTP-Referer | `http://localhost:3000` |

## API

- `GET /api/health` — 健康检查
- `GET /api/models` — 已配置的图片模型列表
- `POST /api/chat` — 代理聊天补全（流式）
- `POST /api/image` — 代理图片生成

聊天请求体示例：

```json
{
  "model": "nvidia/nemotron-3-ultra-550b-a55b:free",
  "stream": true,
  "messages": [
    { "role": "user", "content": "你好" }
  ]
}
```

图片请求体示例：

```json
{
  "model": "black-forest-labs/flux-3-image-klein",
  "prompt": "a serene mountain landscape at sunset",
  "n": 1
}
```

成功时返回 `images: [{ url: "data:image/png;base64,..." }]`，前端直接展示。

## 技术栈

- Node.js + Express
- 静态前端（HTML / CSS / JS）
- `dotenv` / `cors`

## 许可证

MIT
