# CancerApp — 前端（React + Vite + Electron）

基于 React 19 + Vite 7 的前端，桌面容器采用 Electron。提供病例导入与分析展示 UI。

## 快速开始

```bash
cd frontend
npm install
npm run electron:dev
```

开发模式会同时启动 Vite 与 Electron，支持热重载。

## 常用脚本

- `npm run dev`：仅启动 Vite（浏览器预览）。
- `npm run electron:dev`：启动 Electron 桌面应用。
- `npm run electron:build`：打包桌面应用。
- `npm run lint`：使用 ESLint 校验前端代码质量。

## 目录结构

```
.
├── public/            # 静态资源
├── src/               # React + TypeScript UI 代码
└── vite.config.ts     # Vite 配置
```

## 打包提示

首次执行 `npm run electron:build` 会构建桌面应用安装包，建议在目标平台上打包。

## 病例导入（影像 + 文字）演示流程

> 需要后端服务已启动（参考 `backend/README.md`）并完成 `database/schema.sql` 初始化。

1. 启动后端：`cd backend && npm run dev`
2. 启动前端：`cd frontend && npm run electron:dev`（或 `npm run dev` 仅起 Vite）
3. 在“病例”页点击“导入影像”或“导入文字”打开导入弹窗：
   - 影像模式：选择图像文件；填写或确认自动生成的名称、类别后导入。
   - 文字模式：可手动输入标题/摘要/正文，或点击“导入文档”选择本地 `.docx/.txt/.md` 文件，系统自动转换为 Markdown；也可使用“加载示例病历”一键填充 3 条 Demo。
4. 导入成功后，病例卡会展示影像数量与文字数量；点击影像或文字即可在右侧查看：
   - 影像支持缩放拖拽，居中显示；
   - 文字以 Markdown 渲染，并在分析面板中展示摘要与标签。
5. 文字病历支持“编辑”“删除”操作；影像可单独删除或通过后端 API 重命名、补充样例。

## UI 细节规范（update-ui-detail-polish）

- 侧边栏宽度保护：最小 420px、最大 720px（`MIN_SIDEBAR_WIDTH` / `MAX_SIDEBAR_WIDTH`）。
  - `.analysis-sidebar`、`.preferences-sidebar` 使用相同的 `min-width` 与 `max-width`。
  - 栅格列宽在运行时通过 `Math.min(Math.max(MIN, width), MAX)` clamp，拖拽不会压缩至导致排版错位。
  - 顶置区域与滚动区域宽度一致，`GuidedScrollArea` 滚动条固定在最右侧且不影响外侧手柄命中。
- 分屏与拖拽：
  - 病例预览区中置竖向手柄（`case-split-handle`），可拖拽或使用左右箭头微调；手柄高度约为容器 50%。
  - 左右面板宽度按比例存储，最小 35%、最大 75%，防止分析面板过窄。
- 快速导入：侧栏顶置按钮合并为“快速导入”，弹出面板仅包含“图像”“文字”两项，进入后沿用既有导入流程。
- 病例卡重构：
  - 主区按钮仅保留“编辑”“删除”“展开/收起”，编辑仅修改病例名称。
  - 展开后分为“图像”“文字”两个框，各自具备“新增”“展开/收起”按钮，靠右排列并随文字长度自适应。
  - Emoji 与“未设置显示名称”文案移除，统一使用中文标签。
- 缩略图与列表排版：
  - 图像缩略图在 `case-panel__media-thumb` 中等比缩放（最长边 ≤ 20px），完整展示全貌、不裁剪。
  - 标题字号/粗细统一为 `1rem / 600`，摘要沿用双行截断（`-webkit-line-clamp: 2`），操作区固定间距 8px 并右对齐。
- 预览主题：图像与文字预览标题栏统一使用 `var(--panel-gradient)`，Markdown 区域与图像预览采用一致的暖色背景。
- 验证与审计建议：
  - 构建：`cd frontend && npm run build`
  - 预览：`npm run preview -- --port 5173`
  - 监视（Playwright MCP）：
    1. 拖拽侧栏与中部手柄，确认 clamp 与命中区域。
    2. 展开病例后核查“图像/文字”两框的“新增”“展开/收起”、缩略图比例与按钮对齐。
    3. 验证病例重命名流程（编辑 → 保存），列表与预览同步更新。
---

## 分析区（四池塘）与外部打开

- 分析区展示四类信息：基础、原始（a–i 指标）、处理后（a–e 指标）、AI 文本（Markdown）。
- “查看原始图像/解析图像”按钮通过 Electron 打开系统默认图片查看器；在纯浏览器环境会提示不支持外部打开。
- 空值显示“未提供”，数字统一精度与单位格式化。

## 配置与后端联通

- `VITE_API_BASE_URL` 指向后端地址，默认 `http://localhost:4000`。
- 请先按 `backend/README.md` 初始化数据库并运行 Demo 种子（F10/F11/F13）。

## Demo 数据来源

- `demo_fake/BIOBANK-F10|F11|F13`：包含原始/解析图像与文本文件，前端不直接渲染解析图，只提供外部打开按钮。
## 图像总结（复合热力图 + 多层级环形图）

- 复合热力图
  - 行=指标；列=“医生判断维度”（归一/十分位/z分/|z|/分位/Q组/排名/正偏/负偏/IQR位/置信/稳定/权重/完备）。
  - 病例隔离：统计口径仅在当前病例样本内；样本过少时 z 分回退为归一。
  - 视觉：单元格白色网格，确定性微抖动（仅影响显示）避免大片连片；图例与画布居中，无横向滚动。

- 多层级环形图
  - 中心风险仪表 + 风险分层 + 特征贡献 + 分位细分 + HSI 组成 + 缺失率。
  - 与热力图统一色表；图形与图例居中显示，拖拽左右分隔手柄/缩放窗口时实时居中。

实现细节见 `frontend/src/components/VisualizationPanel.tsx`。
