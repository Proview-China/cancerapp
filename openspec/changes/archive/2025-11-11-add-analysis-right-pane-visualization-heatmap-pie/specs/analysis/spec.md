## ADDED Requirements

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
