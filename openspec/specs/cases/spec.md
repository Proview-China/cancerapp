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

