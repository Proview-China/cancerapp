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

## Impact
- Affected specs: ui（新增微信小程序壳的页面结构、AI 浮窗与上下文规则）。
- Affected code: 新增 `wechatapp/` Taro 项目（页面/组件/服务/配置），更新 README/文档（运行命令、调试注意事项），未来提交 PR 时需把 fake demo 接入说明纳入。
