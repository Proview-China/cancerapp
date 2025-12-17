# Proposal: add-deepseek-chat-backend

## Why
当前 AI 对话仅展示本地 demo Markdown，并未接入真实推理服务；需要接入 OpenAI 兼容的 DeepSeek API，并在“设置-后台行为”中可配置 base-url 与 API key，同时支持流式输出以获得类似 ChatGPT 的体验。

## What Changes
- 后端新增 OpenAI 兼容的聊天网关（默认 DeepSeek），支持流式输出、超时与长度限制。
- 后端新增配置存取接口（base-url / model / api-key），api-key 不回显明文。
- 前端 AIChatPanel 改为调用后端流式接口，边流式渲染增量文本；缺少配置时提示用户前往设置。
- 设置页新增“后台行为 · AI 提供方”配置区，支持保存与状态展示（仅显示是否已配置 key）。

## Impact
- Affected specs: `ai-chat`, `ui`
- Affected code:
  - `backend/src/routes/ai.ts`
  - `backend/src/ai/configStore.ts`
  - `backend/src/config.ts`
  - `frontend/src/services/aiService.ts`
  - `frontend/src/components/AIChatPanel.tsx`
  - `frontend/src/components/PreferencesContent.tsx`
- Risks / Constraints:
  - 必须避免在日志与前端暴露 API key；错误信息需可读但不泄露敏感信息。
  - Electron/本地部署场景下，API key 仅由后端持有并落在本地安全存储（文件/环境），前端不保留明文。
