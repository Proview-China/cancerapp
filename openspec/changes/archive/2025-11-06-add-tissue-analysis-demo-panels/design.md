## Overview
本设计聚焦 demo：仅对“组织切片”样本展示结构化分析结果与外部图像打开能力。后续可扩展到 CT/核磁等模态。

## UI 结构（右侧分析区）
- 分为四个“池塘”：
  1) 基本信息（Basic Pond）：展示样本/病例元信息（名称、模态、时间等）
  2) 原始数据（Raw Pond）：九项原始指标（a–i）+ 单位
  3) 处理后数据（Derived Pond）：五项衍生指标（a–e）+ 单位
  4) AI 预测与推理（AI Pond）：三段 markdown 文本（仅展示）
- 每个池塘内部采用“小池塘”卡片排布：两列网格（≥1280px），窄屏降为单列；卡片包含“名称（中/英）+ 值 + 单位 + 简注”。
- 不在 UI 内嵌显示“解析图像”；改由右上/右侧两个按钮外部打开：
  - 查看原始图像（Open Original）
  - 查看解析图像（Open Parsed）

### 布局与令牌（tokens）
- 网格列：`minmax(280px, 1fr)` × 2；gap: `16px`；池塘间距：`24px`
- 卡片：圆角 `8px`；内边距 `12px 16px`；阴影（悬浮）不超过现有“池塘”视觉
- 文字：标题 `14/20`，值 `16/24`，单位/次级 `12/18`；中文优先，英名次行
- 颜色：继承既有“池塘”主题，文本对比度 AA 级
- 空值占位：`未提供`

## Electron 能力（系统默认图片查看器）
- 采用 Electron `shell.openPath` 或等效桥接 `window.electronAPI.openPath(absPath)` 打开本地绝对路径。
- 前端按钮点击 → 调用桥（若无 Electron 环境，提示“不支持外部打开”）。
- 安全：仅允许打开应用 `uploads/` 或 `demo_fake/` 白名单路径；路径解析由后端/预加载脚本保证。

## 数据模型（仅组织切片）
新增表：`sample_tissue_analysis`
- 关联：`sample_id UUID REFERENCES case_samples(id) ON DELETE CASCADE`
- 原始指标（a–i）：
  - `pos_cells_1_weak INT`（1级弱阳性细胞数量, Positive Cells 1 Weak）
  - `pos_cells_2_moderate INT`（2级中度阳性细胞数量, Positive Cells 2 Moderate）
  - `pos_cells_3_strong INT`（3级强阳性细胞数量, Positive Cells 3 Strong）
  - `iod_total_cells INT`（IOD 细胞总数, Total Cells Number）
  - `positive_area_mm2 NUMERIC`（阳性面积, mm²）
  - `tissue_area_mm2 NUMERIC`（组织面积, mm²）
  - `positive_area_px BIGINT`（阳性像素面积, pixel）
  - `tissue_area_px BIGINT`（组织像素面积, pixel）
  - `positive_intensity NUMERIC`（阳性强度, 无量纲或按约定区间）
- 衍生指标（a–e）：
  - `positive_cells_ratio NUMERIC`（阳性细胞比率, %）
  - `positive_cells_density NUMERIC`（阳性细胞密度, number/mm²）
  - `mean_density NUMERIC`（平均光密度值, 无量纲）
  - `h_score NUMERIC`（H-Score）
  - `irs NUMERIC`（IRS）
- 图像：
  - `raw_image_path TEXT`（原始图像绝对路径或可解析路径）
  - `parsed_image_path TEXT`（解析图像绝对路径或可解析路径）
- 审计：
  - `metadata JSONB DEFAULT '{}'`
  - `created_at TIMESTAMPTZ DEFAULT NOW()` / `updated_at TIMESTAMPTZ DEFAULT NOW()`

### 单位与范围约束
- `*_mm2` 使用平方毫米；`*_px` 使用像素数；比率（%）统一 0–100；其余按数据源范围校验（宽松校验，演示为主）。

### 值格式化
- `%`：保留 2 位小数，千分位禁用；范围 [0, 100]
- `number/mm²`：保留 2 位小数；若 > 9999 采用千分位
- `mm²`：保留 2 位小数
- `px`：整数显示，千分位分隔
- `unitless`：保留 2 位小数（H-Score/IRS 可按整数显示）

## 后端聚合与接口
- `GET /cases`：在样本对象上追加 `analysis` 字段（当 `modality='组织切片'` 且存在分析），包含：原始指标、衍生指标、图像路径。
- `GET /cases/:caseId/samples/:sampleId/analysis`：返回与上面等价的单样本分析对象。
- 不新增写接口（demo 数据由脚本或迁移/seed 写入）。

## Demo 数据
- 数据来源：`demo_fake/BIOBANK-F10|F11|F13`（目录结构由数据提供方给出）
- 路径策略：
  - 若图像被复制到 `uploads/`，记录其绝对路径；否则记录 `demo_fake` 的绝对路径
  - Electron 按路径打开，不经由 HTTP

## AI Markdown（展示内容示例）
- 放置于前端静态/内置常量，或由后端以字段返回（本次 demo 可前端内置）。
- 内容包含：基本预测（病灶/免疫反应概述）、深度推理（分级解读与可能临床意义）、注意事项（数据偏差/切片质量影响）。
 - 规则：允许标题（h2/h3）、段落、无序列表、粗体/斜体；不渲染图片/脚注/HTML；最长 800 字/段，最多 3 段。

## 可访问性与交互
- 新增按钮具备键盘可达（`role="button"`，Enter/Space 触发）与禁用态。
- 池塘/卡片标题语义化（`aria-labelledby`），网格顺序与焦点移动一致。

## 失败与边界条件
- 若无 Electron 环境或路径不可访问 → 显示错误提示；按钮禁用或降级。
- 非“组织切片”样本 → 分析区显示“未提供”。
