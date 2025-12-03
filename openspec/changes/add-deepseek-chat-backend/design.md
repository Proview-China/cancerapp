# 设计：add-deepseek-chat-backend

## 方案概览
- **后端网关**：新增 `/ai/chat` 路由，封装 OpenAI 兼容接口（默认 DeepSeek），使用 `stream: true` 透传增量文本，支持 `caseId` 上下文透传。采用 `fetch` + ReadableStream，将 SSE/增量数据转为 `text/event-stream` 或 chunk 响应。
- **配置管理**：新增配置存取接口（如 `/ai/config` GET/POST），存储 base-url、api-key、model。存储方式：本地文件或环境变量缓存，不在响应中回显明文 key，仅返回是否已配置。请求/日志中避免打印 key。
- **前端调用**：AIChatPanel 改为拉取 `/ai/chat` 流，边收到边写入当前 assistant 气泡；缺省配置时显示提示/禁用发送。保留 demo fallback（未配置时输出默认 Markdown）。
- **设置页集成**：在“设置-后台行为”增加表单，允许输入 base-url 与 api-key，提交调用 `/ai/config` 更新；显示当前 base-url 与 “已配置/未配置 key” 状态。

## 数据流与状态
1. 发送消息：前端构造 messages（user/assistant history），POST `/ai/chat`，以 caseId 作为上下文提示。
2. 后端读取配置（base-url、api-key、model），转发到 DeepSeek `/chat/completions`，设置 `stream: true`、`temperature` 可配（默认 0.7），超时控制。
3. 前端读取流：逐段拼接到当前 assistant 消息，自动滚动，结束后收尾；出错时显示错误气泡。
4. 配置流程：设置页 POST `/ai/config` 保存；GET `/ai/config` 只返回 base-url 与 key 是否已配置。

## 关键决策/约束
- **安全**：key 仅后端持有；接口不回显明文；日志屏蔽敏感字段。请求时校验 Origin/Local 访问。
- **兼容性**：使用 OpenAI 兼容格式，便于切换其他模型；默认模型/温度可配置但有合理默认。
- **回退**：未配置 key 时，前端保持 demo 文案（现有 fake ai.txt），并在发送时提示配置。

## 待确认/假设
- 假设 DeepSeek 域名和模型为 openai 兼容（如 `deepseek-chat`），用户可在设置中覆盖 base-url/model。若域名不同，可通过 base-url 覆盖。
