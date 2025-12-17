## ADDED Requirements

### Requirement: DeepSeek Chat Gateway (OpenAI-Compatible)
AI 聊天网关 MUST 提供 `/ai/chat` 接口，接受 OpenAI 兼容的聊天消息数组（含 user/assistant/system），支持 `caseId` 上下文透传和 `stream: true` 流式输出。

#### Scenario: Streamed Reply From DeepSeek
- **WHEN** 前端发送聊天请求（含历史消息与当前 user 消息，`stream: true`）
- **THEN** 后端调用 DeepSeek `/chat/completions`（OpenAI 兼容），以流式增量文本返回；前端可逐段渲染，不需等待完整响应

#### Scenario: Handles Missing Config Gracefully
- **WHEN** DeepSeek base-url 或 api-key 未配置
- **THEN** `/ai/chat` 返回明确的配置缺失错误（不暴露敏感信息），前端可提示用户配置

### Requirement: Secure Config Management for AI Provider
后端 MUST 暴露配置接口（如 `/ai/config` GET/POST），用于读取/更新 base-url、model、api-key；api-key 在响应中不得以明文返回。

#### Scenario: Save and Mask API Key
- **WHEN** 前端在设置页提交 base-url/api-key/model
- **THEN** 后端持久化配置（本地安全存储），响应仅表明 key 已配置而不回显明文

#### Scenario: Log Safety
- **WHEN** 发生请求/错误日志
- **THEN** 日志 MUST 不包含 api-key 或完整请求正文，只记录必要的时间、caseId、状态码

### Requirement: Sensible Defaults and Resource Limits
后端 MUST 提供默认模型、超时与最大内容长度限制，防止过长请求或卡死。

#### Scenario: Default Model/Timeout Applied
- **WHEN** 调用未显式指定模型或温度
- **THEN** 使用配置中的默认模型和超时（如 60s），并在超时/长度超限时返回可读错误
