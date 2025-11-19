# WeChat Miniapp Shell (Taro) Design

## Goals
- 提供一个遵循微信小程序规范的只读壳，展示病历库、分析数据、预测建议，并提供 AI 对话入口。
- 复用现有 fake demo API 与类型，不重写后端。
- 为后续功能扩展（导入/编辑/真 AI）奠定页面、上下文与技术栈基础。

## Tech Stack & Structure
- Taro 4 + React 19 + TypeScript（与主前端保持一致），Target=微信小程序（weapp）。
- 新增 `wechatapp/` 目录，包含 `src/pages/index`（病历库）、`src/pages/case-detail`、`src/pages/ai-chat`，以及共享组件（病例卡、分析卡、浮动按钮等）。
- 使用 Taro 官方路由（`app.config.ts`）配置页面顺序；启用自定义导航栏以绘制仅含标题的顶栏。

## Data Access
- 通过 Taro `request` 调用现有后端（需要把服务部署到 HTTPS 域名供小程序绑定；壳阶段可在 README 标明「使用本地调试 + 开发者工具」）。
- 建立 `services/cases.ts`：封装 `GET /cases`、`GET /cases/:id`、`GET /cases/:caseId/samples/:sampleId/analysis` 等；为了只读 demo，可在 dev 模式下 fallback 到静态 JSON。
- 所有数据保持 TypeScript 类型与前端 `frontend/src/types/cases.ts` 对齐，减少重复。

## Navigation & Context Flow
1. **首页（病历库）**
   - 默认展示病例列表，支持折叠菜片 / 文本部分。
   - 右下角悬浮 AI 按钮：跳转 `pages/ai-chat`，`contextMode=global`。
2. **病例详情页**
   - route params: `caseId`, 选中的 sample / report ids。
   - Tab A：分析数据；Tab B：预测&建议（文案/markdown）。
   - 页面内同样提供浮动 AI 按钮，点击时跳至 AI 页面携带 `contextMode=case` 以及 `caseId`、`sampleId`、`reportSummary` 等。
3. **AI 对话页**
   - 展示对话记录（mock 数据）与输入框；根据 `contextMode` 渲染信息条（“当前上下文：BIobank-F13” 或 “无上下文”）。
   - 暂不调用真实模型，保留发送按钮后显示本地回执，便于后续接入。

## Floating Button Implementation
- 自定义组件 `FloatingAiButton`：使用 `cover-view` + 固定定位，兼容滚动；支持 props：`onClick`、`variant`。
- 在各页面底部引入该组件，并确保与 TabBar/Scroll-view 不冲突。

## Risks & Mitigations
- **域名/HTTPS 限制**：小程序需备案域名才能请求接口；壳阶段在文档中说明需使用「开发者工具 + 127.0.0.1 调试」或准备内网穿透。
- **性能 & 包体积**：Taro + React + ECharts 可能超包；当前壳仅展示文字和简单图表，避免引入重型依赖。
- **上下文隐私**：AI 对话携带病例信息，必须在未来实现中考虑脱敏；壳阶段仅做提示，不上传真实数据。
