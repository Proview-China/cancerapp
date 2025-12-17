## MODIFIED Requirements

### Requirement: AI Chat Panel in Analysis Area
分析页右半“分析区” MUST 显示 AI 聊天面板，以气泡式展现对话，遵循项目的主题与排版风格，不影响左侧病例与预览交互。  
**Modification:** 聊天面板 MUST 调用后端 `/ai/chat` 流式接口，边流式渲染增量文本，缺省配置时提示用户配置 DeepSeek。

#### Scenario: Streamed AI Reply
- **WHEN** 用户在“分析”页 AI 面板发送消息
- **THEN** 面板立即显示用户消息并创建助手占位气泡，随着 `/ai/chat` 的流式响应追加文本，直至完成

#### Scenario: Missing Config Notice
- **WHEN** DeepSeek base-url 或 api-key 未配置
- **THEN** 发送入口应提示“未配置”，阻止发送或降级为本地 demo 文案，并引导用户前往“设置-后台行为”填写

## ADDED Requirements

### Requirement: Settings Backstage Controls
设置页 MUST 提供“后台行为”配置项。  
**Modification:** SHALL 新增 DeepSeek/OpenAI base-url、api-key（以及模型可选）的输入与保存按钮；保存后调用后端 `/ai/config` 更新，key 不以明文回显。

#### Scenario: Save AI Provider Config
- **WHEN** 在“设置-后台行为”输入 base-url/api-key 并点击保存
- **THEN** 前端调用配置接口保存；UI 显示“已配置/未配置”状态，不展示明文 key，后续聊天应使用新配置
