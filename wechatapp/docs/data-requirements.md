# 小程序壳数据字段与只读范围

## 数据源
- 复用现有 REST API：`GET /cases`、`GET /cases/:caseId`（含 samples/reports）、`GET /cases/:caseId/samples/:sampleId/analysis`。
- 如调试阶段无法访问 HTTPS，可读取 `assets/demo-cases.json` 中的静态数据（后续步骤会添加）。

## 核心类型
节选自 `frontend/src/types/cases.ts`，小程序壳只读展示以下字段：

### CaseRecord
- `id`, `identifier`, `displayName`, `notes`, `metadata`, `createdAt`, `updatedAt`
- `samples: CaseSample[]`
- `reports: CaseReport[]`

### CaseSample
- `id`, `caseId`, `displayName`, `modality`, `originalFilename`
- `imageUrl`, `thumbnailUrl`, `createdAt`, `updatedAt`
- `analysis?: TissueAnalysis`（仅组织切片）

### CaseReport
- `id`, `caseId`, `title`, `summary`, `content`, `tags`, `metadata`, `createdAt`, `updatedAt`

### TissueAnalysis
- `raw` 指标：`pos_cells_*`, `iod_total_cells`, `positive_area_*`, `tissue_area_*`, `positive_intensity`
- `derived` 指标：`positive_cells_ratio`, `positive_cells_density`, `mean_density`, `h_score`, `irs`
- `images`: `raw_image_path`, `parsed_image_path`

## 只读约束
- 小程序壳阶段不支持“新增/编辑/删除”病例、样本、报告；所有按钮仅作展示或折叠效果。
- 收藏/展开状态存储在前端本地状态/Storage，不回写后端。
- AI 对话仅发送本地 mock 消息，不与真实服务交互，也不上传病例内容到外部接口。

## 上下文参数
- `contextMode`：`global`（无上下文）或 `case`（携带病例信息）。
- `caseContext`（当 `contextMode=case`）：`caseId`, `caseIdentifier`, 可选 `sampleId`, `reportId`, `reportSummary`。
