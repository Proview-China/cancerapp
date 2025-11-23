# WeChat Miniapp Shell (Taro) Design

## Goals
- 提供一个遵循微信小程序规范的只读壳，展示病历库、分析数据、预测建议，并提供 AI 对话入口。
- 复用现有 fake demo API 与类型，不重写后端。
- 为后续功能扩展（导入/编辑/真 AI）奠定页面、上下文与技术栈基础。

## Tech Stack & Structure
- Taro 4 + React 19 + TypeScript（与主前端保持一致），Target=微信小程序（weapp）。
- 新增 `wechatapp/` 目录，包含 `src/pages/index`（病历库）、`src/pages/case-detail`、`src/pages/ai-chat`，以及共享组件（病例卡、分析卡、浮动按钮等）。
- 使用 Taro 官方路由（`app.config.ts`）配置页面顺序；启用自定义导航栏以绘制仅含标题的顶栏。

## Visual Parity & Tokens
- 主题复用：沿用桌面端暖米色背景、卡片阴影、圆角 12–16、间距 12/16/24、字体粗细（标题 semibold 600–700、次级 500），定义到 `theme.scss` 并供首页卡片、Tab、气泡/输入区统一使用。
- 色板/渐变（取自 `frontend/src/index.css`）：
  - `--app-background: linear-gradient(135deg,#f1ede5 0%,#ece6db 48%,#f6f2ea 100%)`
  - `--panel-gradient: linear-gradient(180deg,#fefcf6 0%,#efe9dd 60%,#e7dfd1 100%)`
  - `--panel-highlight: linear-gradient(180deg, rgba(255,255,255,0.5), rgba(255,255,255,0))`
  - 文字：`--text-primary: #151515`，`--text-secondary: rgba(21,21,21,0.68)`
  - 品牌：`--brand-gradient: linear-gradient(135deg,#d7c6a9 0%,#c2b39b 100%)`
  - 阴影：`--shadow-outer: rgba(78,70,60,0.16)` + 内阴影组合（深 `rgba(84,76,66,0.14)`、亮 `rgba(255,255,255,0.78)`）复刻卡片/气泡的柔和浮起感。
- 安全区适配：顶部导航与搜索/标题区下沉留出 16–20px，底部浮窗/输入区留安全区内边距，保证与小程序状态栏/胶囊区不重叠；滚动区上下留白 ≥16。
- 首页卡片：标题区左对齐 identifier + displayName，右侧轻量按钮；折叠区分“图像/文字”分组，行间距 8–12，分隔线色值与桌面端次要线相近（浅棕透明）；允许展示数量/标签但保持只读（无收藏回写）。
- 详情页：Tab 使用桌面下划线/高亮风格；分析数据用 2–3 列栅格卡片（副标题+数值+单位，圆角 12–16，阴影同卡片）；预测区使用卡片容器与行距；空态/加载态留足间距，提示文案采用次级文本色。
- AI 对话：上下文 Banner 使用暖色卡片+圆角+小图标/圆点，气泡为暖灰背景轻阴影，输入区卡片化；允许轻量渐变/纹理模拟“池塘/火山口”气质，不引入重型图形库。

## Page Layout Guidelines
- 首页：
  - 顶部：自定义导航占位 + 搜索条（圆角 14–16，浅阴影），整体向下偏移安全区 16–20；右侧可放简洁操作图标，但不新增功能。
  - 卡片：纵向列表，卡片间距 12–16，内边距 14–16，圆角 12–16，外阴影 `--shadow-outer`；头部显示 identifier + displayName + 操作按钮；折叠区按“图像/文字”分组，每行展示 modality/标题 + 摘要，字重 600/500/400 递减。
  - 浮窗：右下品牌胶囊/圆形按钮 48–56，留底部安全边距 ≥20。
- 病例详情：
  - 顶部：病例名 + displayName，附小标签（样本数/报告数）；下方为 Tab，选中态使用柔和高亮/下划线，左右内间距 16–20。
  - 主体：分析 Tab 下为 2–3 列栅格（依据屏幕宽度自动换行）；预测 Tab 以卡片容器展示标题/摘要/正文，行距 1.5x，圆角/阴影同卡片。
  - 空态/错误：使用 StateHint 风格但套用主题色，留足上下间距。
- AI 对话：
  - Banner：固定在顶部，圆角 12–14，背景为 panel 渐变 + 轻阴影，包含 contextMode 文案及病例编号/摘要；不贴状态栏。
  - 气泡：左右对齐，圆角 12–16，背景暖灰/亮白，文字色按主/次色；间距 8–12；可含轻量纹理/渐变以呼应“池塘/火山口”。
  - 输入区：底部卡片样式，圆角 14–16，阴影轻，留出手势条空间；发送按钮可用品牌蓝但与主色不冲突。

## Non-Functional & Read-only Constraints
- 不新增编辑/导入/收藏回写功能；收藏/展开仅本地状态。
- AI 对话仅本地 mock，不上传真实数据；上下文仅用于提示显示。
- 保持性能轻量，不引入 ECharts/canvas 等重库；纹理/渐变采用 CSS 实现。

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
- **视觉回归风险**：小程序端样式适配需兼顾安全区/滚动，须复用主题 token 避免局部自定义色导致不一致；通过截图验证首页/详情/AI 三页的留白与组件层级。
