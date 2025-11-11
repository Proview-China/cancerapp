# cases Specification

## Purpose
TBD - created by archiving change add-text-case-reports. Update Purpose after archive.
## Requirements
### Requirement: Case Text Report Storage
系统 MUST 支持在创建病例时同时导入一个或多个文字病历，并允许仅用文字病历创建病例。

#### Scenario: Import case with text reports only
- **WHEN** 客户端调用 `POST /cases`，传入 `identifier` 与 `textReports` JSON（至少 1 条，含 title+content）且不包含文件
- **THEN** 服务器创建病例，返回 `201`，响应体中的 `reports` 列表包含新建文本

#### Scenario: Reject empty text payload
- **WHEN** `textReports` 中缺少 `title` 或 `content`
- **THEN** 接口返回 `400`，提示具体缺失字段

### Requirement: Case Text Report Management
系统 MUST 为每个病例提供文字病历的增删改查能力，并在 `GET /cases` 中返回这些数据。

#### Scenario: List reports with cases
- **WHEN** 客户端请求 `GET /cases`
- **THEN** 每个病例对象包含 `reports: CaseReport[]`，字段至少包括 `id`, `title`, `summary`, `content`, `tags`, `created_at`

#### Scenario: CRUD endpoints
- **WHEN** 客户端访问：
  - `GET /cases/{caseId}/reports`
  - `POST /cases/{caseId}/reports`
  - `PATCH /cases/{caseId}/reports/{reportId}`
  - `DELETE /cases/{caseId}/reports/{reportId}`
- **THEN** 服务返回 200/201/204，并对不存在的病例或报告返回 404（含 message）

### Requirement: Demo Text Case Catalog
系统 MUST 提供至少 3 条官方示例文字病历，便于导入演示。

#### Scenario: Load demo case set
- **WHEN** 用户在前端点击“加载示例病历”
- **THEN** 导入表单被填充为我们预置的 3 条中文病历（含建议 identifier/title/content），用户可直接提交

#### Scenario: Inspect demo data source
- **WHEN** 开发者查阅仓库文档或源码
- **THEN** 能找到 `demoTextCases`（或同名）文件，清晰记录示例文本及字段说明

### Requirement: Case Sample Analysis Association (Tissue Only)
病例样本（`cases` → `case_samples`）对于 `modality='组织切片'` SHALL 具有关联的分析结果对象 `analysis`，包含：
- 原始指标（a–i）与单位
- 衍生指标（a–e）与单位
- 图像路径（原始/解析）

#### Scenario: List cases with tissue analysis
- WHEN 客户端请求 `GET /cases`
- THEN 返回的每个“组织切片”样本对象包含 `analysis` 字段（存在时）；其他模态不包含或为 `null`

#### Scenario: Fetch sample analysis by id
- WHEN 客户端请求 `GET /cases/{caseId}/samples/{sampleId}/analysis`
- THEN 返回与 `GET /cases` 聚合字段一致的分析对象；不存在时返回 404（含 message）

### Requirement: Aggregation and Filtering Rules
列表聚合 SHALL 仅在 `modality='组织切片'` 且存在分析数据时附加 `analysis`；非组织切片或无分析数据不附加。返回顺序与现有样本排序一致。

#### Scenario: Mixed modality cases
- WHEN 同一病例包含 CT/核磁/组织切片
- THEN 仅组织切片样本拥有 `analysis`，其它样本 `analysis` 缺省

