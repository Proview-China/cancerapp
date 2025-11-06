## 1. 实现
- [x] 1.1 侧边栏最小宽度：在 CSS 添加 `min-width` 与网格下限，确保小于阈值仍保持可读；校对与 `MIN_SIDEBAR_WIDTH` 一致。
- [x] 1.2 卡片/列表排版：统一标题/摘要字号与行高；对摘要添加 2 行截断；统一操作按钮间距与对齐；优化 hover/active 阴影。
- [x] 1.3 抽样页面核查：病例卡（含影像与文字）、导入弹窗、报告项三处典型元素均应用统一排版规则。

## 2. 检查
- [x] 2.1 DevTools MCP：
  - 打开 `http://localhost:5173`（或 Electron 指向的 Vite 服务）
  - 缩放窗口并拖动侧边栏，验证 `min-width` 生效（<360px 不再压缩）
  - 检查卡片标题/摘要是否出现 `line-clamp` 截断，溢出无换行抖动
  - 截取 snapshot，保存结论
- [x] 2.2 前端构建：`npm run build`

## 3. 文档
- [x] 3.1 在 `frontend/README.md` 补充 UI 细节规范（最小宽度、文字截断、操作区间距）
