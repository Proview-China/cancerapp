## Why
- 桌面端（Electron）交互无法直接在微信小程序内运行，且现阶段业务需要一种轻量只读方案用于演示与验证，所以必须搭建一个兼容微信生态的壳。
- 小程序壳目标是开启「移动端阅读」场景：病例库作为入口、病例详情（分析/预测）作为核心内容，并提供 AI 对话入口验证上下文传递；通过 fake demo 数据可减少后端改动。
- 选用 Taro (React) 可以最大程度复用现有 React/TypeScript 经验，并确保微信编译链与组件规范可控。

## What Changes
- 新增 `wechatapp/` 目录，使用 Taro 4 + React + TypeScript；配置 `app.config.ts` 以包含 3 个页面：`pages/index`（病例库）、`pages/case-detail`、`pages/ai-chat`，并启用自定义导航栏（仅展示标题）。
- 首页（病例库）：
  - 请求现有 `GET /cases` 接口或内置 fake JSON，呈现折叠菜结构（图像/文字分节）与搜索/收藏/展开功能。
  - 页面右下角有 `FloatingAiButton`，点击跳转 AI 对话页并附带 `contextMode=global`。
- 病例详情页：
  - 路由参数包含 `caseId`、默认 sample/report 选项；页面包含两个 Tab：“分析数据”和“预测&建议”，数据结构与 Electron 端一致。
  - 页面同样放置 `FloatingAiButton`，点击跳转 AI 页面并附带 `contextMode=case` 以及 `caseId`、`sampleId`、`reportSummary` 等上下文。
- AI 对话页：
  - 采用占位对话列表 + 输入框，不连接真实模型；根据 `contextMode` 渲染提示条（“无上下文”或“当前病例：xxx”）。
  - 发送按钮将本地消息加入列表，保留后续与真实 AI 服务对接的接口。
- 配置 API 访问层（Taro request 封装），文档说明如何设置 base URL（例如通过 `.env` 或配置），以及开发者工具调试步骤。
- 复用桌面端的视觉/排版 token（色板、阴影、圆角、间距、字体粗细），对首页卡片、详情 Tab/指标栅格、AI 对话气泡与上下文 Banner 进行小程序适配，保持只读展示且不引入新增编辑功能。
  - 色板/渐变（取自桌面端 `index.css`）：`--app-background: linear-gradient(135deg,#f1ede5,#ece6db,#f6f2ea)`；`--panel-gradient: linear-gradient(180deg,#fefcf6 0%,#efe9dd 60%,#e7dfd1 100%)`；文字 `--text-primary: #151515` / `--text-secondary: rgba(21,21,21,0.68)`；品牌渐变 `--brand-gradient: linear-gradient(135deg,#d7c6a9,#c2b39b)`。
  - 阴影：外阴影 `--shadow-outer: rgba(78,70,60,0.16)`；内阴影组合（明暗）用于卡片/气泡；保留柔和高斯模糊感。
  - 圆角/间距：卡片圆角 12–16，输入/气泡 12–20，页面内边距 16–24，组件行间 8–12；Tab 下划线/高亮与桌面一致。
  - 字重：标题 600–700，次级文本 500，正文 400，字号按 Taro 默认 rem 缩放，保持层级。
  - 适配：顶部导航/搜索区/Tab/气泡与安全区脱开 16–20px，底部浮窗/输入区预留手势区域，避免贴边。

## Impact
- Affected specs: ui（新增微信小程序壳的页面结构、AI 浮窗与上下文规则 + 视觉对齐桌面端的样式适配要求）。
- Affected code: 新增 `wechatapp/` Taro 项目（页面/组件/服务/配置），更新 README/文档（运行命令、调试注意事项），未来提交 PR 时需把 fake demo 接入说明纳入；后续实现需按桌面端视觉 token 落地样式但保持只读。
