## 1. 规范与方案
- [x] 1.1 对齐范围：仅前端最小实现（无 LLM/无真实上传/内存态）
- [x] 1.2 会话模型：以 `caseId` 为键隔离；同病例跨影像/文字共享

## 2. 前端实现
- [x] 2.1 新增 `AIChatPanel` 组件与样式，提供：气泡列表、输入框、上传文件、发送、重置（＋）
- [x] 2.2 将 `AIChatPanel` 集成到 `CasesWorkspace` 右侧分析区，替换原内容
- [x] 2.3 主题一致：沿用 pond 按钮风格与现有排版变量；键盘可达

## 3. 校验与文档
- [x] 3.1 手动验证：按病例隔离、同病例共享、上传占位、＋ 与发送可用
- [ ] 3.2 更新 README（前端）增加 AI 对话区说明（可选）

## 4. OpenSpec 流程
- [x] 4.1 `openspec validate add-ai-chat-panel-in-analysis --strict`
- [ ] 4.2 审阅与归档：`openspec archive add-ai-chat-panel-in-analysis --yes`
