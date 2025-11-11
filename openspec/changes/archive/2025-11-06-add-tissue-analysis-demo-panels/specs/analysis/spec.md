## ADDED Requirements

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
