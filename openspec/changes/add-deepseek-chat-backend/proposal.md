# Proposal: add-deepseek-chat-backend

## 背景
当前 AI 对话仅展示本地 demo Markdown，并未接入真实推理服务；用户希望接入 OpenAI 兼容的 DeepSeek API，并能在“设置-后台行为”中填写 base-url 与 API key。需要支持“思考”时的流式输出，让聊天体验类似 ChatGPT。

## 目标
- 在后端新增 OpenAI 兼容的聊天网关（默认 DeepSeek），支持流式输出，安全管理 API Key 与 Base URL。
- 前端 AIChatPanel 改为调用后端接口，实时流式展示回复；缺少配置时有提示。
- 在“设置”页新增后台行为配置区，允许填写/更新 Base URL 与 API Key（本地存储于后端，不回显明文）。

## 非目标
- 暂不实现附件/文件内容上载至大模型（只保留附件列表展示）。
- 暂不做多模型选择或复杂路由；默认 1 个模型可配置。
- 不涉及云端多租户或多用户权限控制。

## 风险与约束
- DeepSeek API 需要流式处理和超时控制；需确保 key 不在日志或前端曝光。
- Electron/本地部署场景下，API Key 存储需落在后端安全存储（例如本地文件/环境），避免明文回传。
- 需要保证缺省配置时仍可 fallback demo 文案或给出明确提示。
