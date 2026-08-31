# EmoAI Affect Lab 前端

这是一个用于测试 LLM 对话和 affect 状态的 React + MUI 前端。

```powershell
cd frontend
npm install
npm run dev
```

打开 `http://127.0.0.1:5173/`。首次进入需要填写模型地址/端口、模型型号和 Access Key；配置保存在浏览器 `localStorage`，下次可直接点击“开始对话”。

模型接口按 OpenAI-compatible `POST /v1/chat/completions` 调用：端口填 `8000` 时会请求 `http://127.0.0.1:8000/v1/chat/completions`，也支持填写完整地址。对话请求由 Vite 的同源 `/api/chat` bridge 转发，避免浏览器 CORS 导致的 `Failed to fetch`。

Vite 开发服务器同时提供本地 `/api/affect` bridge，调用仓库根目录的 `src/runtime.js`，因此开发时右侧调试面板能显示真实的 `processTurn` 结果。部署为纯静态文件时 bridge 不存在，但仍可直接请求模型接口。
