# analysis Specification

## Purpose
TBD - created by archiving change add-tissue-analysis-demo-panels. Update Purpose after archive.
## Requirements
### Requirement: Tissue Slide Analysis Data Model (Raw Metrics)
系统 MUST 为 `modality='组织切片'` 的样本存储以下原始分析数据（单位须明确）：
- a) 1级弱阳性细胞数量（Positive Cells 1 Weak，`count`）
- b) 2级中度阳性细胞数量（Positive Cells 2 Moderate，`count`）
- c) 3级强阳性细胞数量（Positive Cells 3 Strong，`count`）
- d) IOD 细胞总数（Total Cells Number，`count`）
- e) 阳性面积（Positive Area，`mm²`）
- f) 组织面积（Tissue Area，`mm²`）
- g) 阳性像素面积（Positive Area，`pixel`）
- h) 组织像素面积（Tissue Area，`pixel`）
- i) 阳性强度（Positive Intensity，`unitless`或约定范围）

#### Scenario: Persist and fetch raw metrics
- WHEN 后端存在 `sample_tissue_analysis` 记录
- THEN `GET /cases` 或 `GET /cases/:caseId/samples/:sampleId/analysis` 返回完整原始指标与单位

### Requirement: Tissue Slide Analysis Derived Metrics
系统 MUST 存储并返回以下处理后指标：
- a) 阳性细胞比率（Positive Cells, `%`）
- b) 阳性细胞密度（Positive Cells Density, `number/mm²`）
- c) 平均光密度值（Mean Density, `unitless`）
- d) H-Score（`unitless`）
- e) IRS（`unitless`）

#### Scenario: Persist and fetch derived metrics
- WHEN 后端存在 `sample_tissue_analysis` 记录
- THEN 接口返回衍生指标，字段名与单位与上表一致

### Requirement: Analysis API Contract
接口返回的 analysis 对象 MUST 符合以下结构与命名：
```json
{
  "raw": {
    "pos_cells_1_weak": "number",
    "pos_cells_2_moderate": "number",
    "pos_cells_3_strong": "number",
    "iod_total_cells": "number",
    "positive_area_mm2": "number",
    "tissue_area_mm2": "number",
    "positive_area_px": "number",
    "tissue_area_px": "number",
    "positive_intensity": "number"
  },
  "derived": {
    "positive_cells_ratio": "number",
    "positive_cells_density": "number",
    "mean_density": "number",
    "h_score": "number",
    "irs": "number"
  },
  "images": {
    "raw_image_path": "string|null",
    "parsed_image_path": "string|null"
  },
  "metadata": {}
}
```

#### Scenario: Missing fields and nulls
- WHEN 某些字段在 demo 数据中缺失
- THEN 该字段可省略或为 null；前端显示“未提供”，不显示单位

### Requirement: Image Paths for System Viewer
系统 MUST 为组织切片样本保存两类图像路径（本地绝对路径或可解析路径）：
- 原始图像 `raw_image_path`
- 解析图像 `parsed_image_path`

#### Scenario: System viewer integration contract
- WHEN 前端获取分析数据
- THEN 若存在上述路径，UI 按钮可调用系统默认查看器打开；若缺失路径则禁用按钮

### Requirement: Demo Dataset Binding
系统 SHALL 提供最少 3 名 demo 病人的组织切片分析数据（只读），来源于 `demo_fake/`；
样本与分析表应建立一对一或一对多（按切片/区域）关系，本次采用一对一（每个样本一条分析汇总）。

#### Scenario: Demo visibility
- WHEN 导入或初始化 demo 数据
- THEN 在 UI 选择相应样本后可见原始/衍生指标与按钮（无需执行真实推理）

### Requirement: Localization and Labels
系统 SHALL 提供一个标签映射以便 UI 显示中/英名：
- 例如：`pos_cells_1_weak` → `1级弱阳性细胞数量 / Positive Cells 1 Weak`
- 单位映射与字段绑定：`mm²`/`px`/`%`/`number/mm²`/`unitless`

#### Scenario: Consistent label map
- WHEN 渲染不同 demo 样本
- THEN 标签/单位名称保持一致，无歧义或拼写差异

### Requirement: Visualization Demo Data Contract (Client-only)
前端 MUST 使用 `TissueAnalysis.derived` 字段（ratio/mean_density/h_score/irs）作为图表输入；若无可用数据 SHALL 使用演示常量；本次不新增后端接口与路由。

#### Scenario: Use existing TissueAnalysis data when available
- Given 已选择病例与其组织切片样本
- When 前端调用 `fetchSampleAnalysis(caseId, sampleId)`
- Then 若返回 `TissueAnalysis`，则使用其 `derived` 字段中的：
  - `positive_cells_ratio`（0–1）
  - `mean_density`（需标准化到 0–1）
  - `h_score`（除以 300 截断到 0–1）
  - `irs`（除以 12 截断到 0–1）
- And 将这些数值用于热力图与扇形图的演示可视化

#### Scenario: Fallback to demo constants when data missing
- Given 无可用的 `TissueAnalysis`
- Then 前端使用演示常量（例如 `ratio=0.8, mean_density=0.1, h_score=0.6, irs=0.5`）用于两图绘制

### Requirement: Factor Bucketing and Normalization Rules
前端 MUST 按规定的归一化与分桶规则计算高/中/低占比用于扇形图；所有比例值 SHALL 截断到 [0,1]，并保持规则一致性以便复现。

#### Scenario: Normalization
- Then 归一化规则：
  - `positive_cells_ratio`：保持 0–1
  - `mean_density`：采用线性缩放至 0–1（可按数据分布设上限，例如 0.2；超过部分截断到 1）
  - `h_score`：`min(h_score/300, 1)`
  - `irs`：`min(irs/12, 1)`

#### Scenario: Level bucketing for pie
- Then 将四项归一值按阈值分桶：高≥0.75，中≥0.5，低<0.5
- And 统计高/中/低各自数量占比绘制扇形图

### Requirement: Demo Dataset Usage
如已执行 demo_fake 数据导入，前端 SHALL 通过 `fetchSampleAnalysis` 获取实际数据；仅取 `derived` 数值用于图表（images 字段仅用于参考/调试，不在本次视图内展示）。

#### Scenario: demo_fake seeded data
- Given 项目存在 `demo_fake/` 数据且已通过脚本 `backend/scripts/seed-demo-tissue-analysis.ts` 导入
- Then `fetchSampleAnalysis` 将返回 `TissueAnalysis`，其 `images` 字段包含 `raw_image_path` 与 `parsed_image_path` 用于参考
- And 本次仅使用 `derived` 数值作为两图输入；不引入后端改动

### Requirement: Dual Metric Systems (Cell- and Area-based)
系统 SHALL 并行支持细胞法与面积法派生并用于可视化：
- 细胞法：ratio_cells、H-score_cells、阳性细胞密度；
- 面积法：ratio_area、mean_density、surface_density；
面积口径优先使用 `mm²`，`px` 仅兜底；tooltip 中 MUST 标注单位来源。

#### Scenario: Consistent units across charts
- Then 当面积以像素口径提供时，tooltip 明确标注 `px` 并与 `mm²` 口径区分；不混淆单位

### Requirement: Standardization and Clipping
前端 SHALL 为所有特征计算 z-score（相对全库），并在 ±2.5 进行裁剪；同时提供分位（P10–P90）以支持分位带与描边。

#### Scenario: Z-score clipping with overflow hint
- Then 超出 ±2.5 的单元以点纹提示被裁剪，原值在 tooltip 中完整显示

### Requirement: Correlation and BH-FDR
前端 SHALL 使用 Spearman 相关并进行 BH-FDR 多重校正以确定星标；当样本量 N<6 时不显示星标。

#### Scenario: Star thresholds
- Then FDR 阈值：q≤0.1 → `*`，q≤0.05 → `**`，q≤0.01 → `***`

### Requirement: Confidence and Imputation
前端 SHALL 计算置信度 conf∈[0,1]，基于细胞总数↑、面积覆盖↑、阴性极端占比↓ 的归一组合；缺失采用中位数填补且以灰斜纹表示。

#### Scenario: Missing values explicitly marked
- Then 缺失被中位数填补但在图上以灰斜纹标识，tooltip 说明“由缺失填补”

### Requirement: Deterministic Risk Score
综合风险分 SHALL 使用固定权重：h_score 0.4、irs 0.3、ratio 0.2、mean_density 0.1；所有视图使用相同定义。

#### Scenario: Risk score consistency
- Then 中心仪表、样本列条与相关条引用的风险分数数值一致，无漂移

### Requirement: Heatmap Judgement Dimensions (Case-local)
系统 SHALL 在病例内对每个特征计算以下“判断维度”，以供热力图横轴使用：
- 归一（0–1）、归一十分位（离散到10档）、z分（病例内；不足样本回退）、|z|、分位（0–1）、分位组(Q1–Q5)、相对排名、正偏/负偏（基于z）、IQR位置、置信度、稳定性（CV反向）、权重（固定权重）、完备度（1-缺失率）。

#### Scenario: Case-local computation and fallback
- Then 以上维度均按“当前病例内样本集合”计算；若样本不足（例如 <3），z类维度回退为归一值；tooltip 需说明口径

### Requirement: Visual Jitter Does Not Alter Data
为避免大片连片的视觉效果，客户端可以对热力图单元格应用确定性微抖动（基于 case/sample/feature/dimension 的伪随机）；无论是否启用抖动，系统 SHALL 保证抖动仅影响显示，且 SHALL NOT 改变底层数值或 tooltip 文案。

#### Scenario: Deterministic jitter safeguard
- Then 抖动幅度 SHALL ≤ 0.18，且 clamp 到 [0,1]；刷新后色块位置稳定一致
