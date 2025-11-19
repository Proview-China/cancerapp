## 1. 方案落地与脚手架
- [x] 1.1 阅读 `frontend/src/types/cases.ts` 与 fake demo 数据，列出小程序壳所需字段（病例、样本、报告、分析）以及只读限制清单
- [x] 1.2 使用 Taro CLI 新建 `wechatapp/` 项目（React + TS），配置 `package.json` scripts（如 `dev:weapp`、`build:weapp`）与 `.editorconfig`/`.prettierrc`
- [x] 1.3 在 `wechatapp/app.config.ts` 中注册 3 个页面（index、case-detail、ai-chat），启用自定义导航栏、统一背景色

## 2. 首页（病例库）
- [x] 2.1 创建 `pages/index` 组件：拉取病例列表（mock 或 API），展示“全部收起/搜索”头部与病例卡片折叠区，确保首屏仅显示病例库
- [x] 2.2 实现收藏/展开 UI（仅前端状态，不写入后端）与 loading/空状态占位
- [x] 2.3 集成 `FloatingAiButton` 组件，点击时 `Taro.navigateTo` 到 AI 页并传递 `contextMode=global`

## 3. 病例详情页
- [x] 3.1 创建 `pages/case-detail`：接收路由参数（caseId、默认 sampleId/reportId），在 `onLoad` 时请求病例详情/分析数据
- [x] 3.2 构建 Tab 容器（分析数据 / 预测&建议）；分析数据部分按照 fake demo 指标列表渲染，预测模块可渲染 Markdown/富文本
- [x] 3.3 在详情页放置 `FloatingAiButton`，跳转 AI 页并附带 `contextMode=case` 与序列化的上下文（caseId、sampleId、reportSummary）

## 4. AI 对话页
- [x] 4.1 创建 `pages/ai-chat`：读取 query 参数，显示上下文提示条（“无上下文”或带病例名）
- [x] 4.2 构建对话列表组件（支持左右气泡），初始化若干 fake 对话
- [x] 4.3 实现输入框与发送按钮：发送后把消息 append 并显示占位回复，预留接口供后续接入真实 AI

## 5. 数据与基础设施
- [x] 5.1 在 `wechatapp/src/services` 创建 API 封装（Taro request + 超时/错误处理 + base URL 配置），并 README 中说明如何设置 `WECHATAPP_API_BASE`
- [x] 5.2 如果本地无法访问 HTTPS，提供 fallback mock JSON（或指向 demo 静态文件），并在文档中说明调试方式

## 6. 文档与验证
- [x] 6.1 更新根 README（或新建 `wechatapp/README.md`），描述依赖安装、Taro CLI 要求、`npm run dev:weapp`/`build:weapp`、微信开发者工具导入步骤
- [x] 6.2 运行 `openspec validate add-wechat-miniapp-shell --strict`
- [x] 6.3 运行 Taro 构建/预览命令并记录输出（至少一次 `npm run dev:weapp` 或 `build:weapp`），确保壳可编译
