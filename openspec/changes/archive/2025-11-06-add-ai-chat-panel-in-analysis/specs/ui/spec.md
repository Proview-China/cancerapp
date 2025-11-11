## ADDED Requirements

### Requirement: AI Chat Panel in Analysis Area
分析页右半“分析区” MUST 显示 AI 聊天面板，以气泡式展现对话，遵循项目的主题与排版风格，不影响左侧病例与预览交互。

#### Scenario: Bubble layout and theme
- WHEN 打开分析页
- THEN 右半区显示气泡式对话列表与输入区，风格与现有按钮/色板一致

### Requirement: Case-Scoped Conversation Context
会话上下文 SHALL 以病例（caseId）为粒度隔离；同一病例下的影像/文字共享同一会话；不同病例之间互不影响。

#### Scenario: Switch case and retain session
- WHEN 切换病例 A/B
- THEN A 与 B 的会话内容互不干扰，返回 A 时仍显示 A 的历史内容

### Requirement: Basic Controls (New/Upload/Send)
聊天面板 MUST 提供：
- “＋”按钮：新建对话/清空当前病例会话（确认可选，本次可直接清空）
- “上传文件”能力：选择本地文件，作为本条消息的附件展示（本次无需真实上传）
- “发送”按钮：发送文本（可带附件）并显示占位回复

#### Scenario: Compose and send
- WHEN 输入文本并可选选择文件
- THEN 点击“发送”后出现用户消息与占位 AI 回复；点击“＋”清空当前病例对话

