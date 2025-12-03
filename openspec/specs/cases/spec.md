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
- **AND** 同一病例内的 `reports` SHALL 按稳定的排序字段升序返回；若部分记录缺少排序值，则这些记录按照 `created_at` 逆序附加在已排序列表之后

#### Scenario: CRUD endpoints
- **WHEN** 客户端访问：
  - `GET /cases/{caseId}/reports`
  - `POST /cases/{caseId}/reports`
  - `PATCH /cases/{caseId}/reports/{reportId}`
  - `DELETE /cases/{caseId}/reports/{reportId}`
- **THEN** 服务返回 200/201/204，并对不存在的病例或报告返回 404（含 message）
- **AND** `GET /cases/{caseId}/reports` SHALL 使用与聚合视图相同的排序规则（先按排序字段，再按时间兜底）

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
- AND 样本列表在同一病例内按稳定的排序字段升序返回；若部分记录缺少排序值，则这些记录按照 `created_at` 逆序附加在已排序列表之后

### Requirement: Stable Ordering for Samples and Reports
系统 MUST 为每个病例内的样本与文字病历提供可持久化的排序能力，以支持前端拖拽后顺序保持稳定。

#### Scenario: Default ordering compatible with existing data
- **GIVEN** 系统中已存在若干病例及其样本/报告
- **WHEN** 部署排序能力而未进行任何手动重排
- **THEN** 每个病例中的样本与报告在 UI 中的显示顺序 SHALL 与变更前一致（例如按创建时间倒序），且排序字段的初始赋值与该默认顺序一致

#### Scenario: Persisted ordering after reorder
- **GIVEN** 某病例下存在至少 3 条文字病历
- **WHEN** 客户端通过排序 API 提交新的 ID 顺序
- **THEN** 后端 SHALL 更新对应记录的排序字段
- **AND** 后续所有 `GET /cases` 与 `GET /cases/{caseId}/reports` 返回中，报告顺序 SHALL 与新的排序一致

### Requirement: Samples and Reports Reorder API
系统 SHALL 提供用于重排同一病例内样本和文字病历的 API 端点，接收有序 ID 列表并更新排序字段。

#### Scenario: Reorder case reports
- **WHEN** 客户端发送 `PUT /cases/{caseId}/reports/order` 请求，主体包含该病例所有报告的 ID 列表，且列表长度与当前报告数一致、ID 集合完全相同
- **THEN** 服务 SHALL 在事务中按列表顺序更新每条报告的排序字段
- **AND** 若列表缺失、重复或包含其他病例的 ID，服务 SHALL 返回 `400` 并附带错误说明

#### Scenario: Reorder case samples
- **WHEN** 客户端发送 `PUT /cases/{caseId}/samples/order` 请求，主体包含该病例所有样本的 ID 列表，且列表长度与当前样本数一致、ID 集合完全相同
- **THEN** 服务 SHALL 在事务中按列表顺序更新每个样本的排序字段
- **AND** 若列表缺失、重复或包含其他病例的 ID，服务 SHALL 返回 `400` 并附带错误说明

