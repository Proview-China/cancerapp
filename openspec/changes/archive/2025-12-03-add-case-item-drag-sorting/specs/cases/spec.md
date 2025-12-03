## MODIFIED Requirements

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

### Requirement: Aggregation and Filtering Rules
列表聚合 SHALL 仅在 `modality='组织切片'` 且存在分析数据时附加 `analysis`；非组织切片或无分析数据不附加。返回顺序与现有样本排序一致。

#### Scenario: Mixed modality cases
- WHEN 同一病例包含 CT/核磁/组织切片
- THEN 仅组织切片样本拥有 `analysis`，其它样本 `analysis` 缺省
- AND 样本列表在同一病例内按稳定的排序字段升序返回；若部分记录缺少排序值，则这些记录按照 `created_at` 逆序附加在已排序列表之后

## ADDED Requirements

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

