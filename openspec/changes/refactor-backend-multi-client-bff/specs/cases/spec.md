## ADDED Requirements

### Requirement: Multi-client Case BFF Endpoints

系统 MUST 为病例相关功能提供面向桌面端与移动端的 BFF 路由前缀，并在两类入口之间共享同一套病例业务逻辑与数据源。

#### Scenario: Desktop BFF full case list

- **WHEN** 桌面端 UI 请求 `GET /desktop/cases`
- **THEN** 返回的病例列表中每条记录的结构 SHALL 等价于现有 `GET /cases` 所返回的病例对象（即包含病例基础字段、所有样例 `samples` 与所有文字病历 `reports`）
- **AND** 对于 `modality='组织切片'` 的样例，若存在分析数据，则 `analysis` 字段 SHALL 按 `analysis` 规格中定义的结构返回

#### Scenario: Desktop BFF case detail

- **WHEN** 桌面端 UI 请求 `GET /desktop/cases/{caseId}`
- **THEN** 返回单个病例对象，其字段 SHALL 与 `GET /desktop/cases` 列表中的单条记录保持一致，仅对象数量为 1
- **AND** 当 `caseId` 不存在时，接口 SHALL 返回 `404`（含描述性 `message`）

#### Scenario: Mobile BFF case list (lightweight view)

- **WHEN** 移动端或小程序 UI 请求 `GET /mobile/cases`
- **THEN** 返回的病例列表中每条记录 SHALL 为轻量视图，至少包含：
  - `id`
  - `displayName`（或等价的病例展示名称）
  - `latestReportSummary`（最近一条文字病历的摘要或 `null`）
  - `mainThumbnail`（代表性样例缩略图 URL 或 `null`）
  - `updated_at`
- **AND** 该轻量视图的各字段值 MUST 可从内部统一的病例业务对象（包含样例与文字病历）推导，不依赖移动端专用的数据模型

#### Scenario: Mobile BFF case detail (compact view)

- **WHEN** 移动端或小程序 UI 请求 `GET /mobile/cases/{caseId}`
- **THEN** 返回的病例详情 SHALL 为精简视图，至少包含：
  - 病例基础信息（如 `id`、`displayName`、`notes`、必要的时间字段）
  - `samples`：仅包含样例关键信息（如 `id`、`modality`、简要描述、缩略图 URL、创建时间）
  - `reports`：仅包含文字病历关键信息（如 `id`、`title`、`summary`、`created_at`）
- **AND** 该精简视图同样 MUST 可完全由统一病例业务对象推导，不引入移动端专用隐藏字段

#### Scenario: Shared business rules across BFFs

- **WHEN** 桌面端和移动端通过各自 BFF 接口执行病例创建/更新/删除、样例更新/删除、文字病历增删改查或切片分析查询
- **THEN** 这些操作 SHALL 共享同一套业务规则（例如字段校验逻辑、UPSERT 行为、模态约束），而不是在 Desktop 与 Mobile 路由中各自实现一份

---

### Requirement: Layered Backend Architecture for Cases

病例相关后端实现 MUST 采用“BFF → Service → Repository → Database”的分层架构，以解耦 HTTP 视图、业务逻辑与数据访问。

#### Scenario: Routing layer does not access DB directly

- **WHEN** 审查 `backend/src/server.ts` 与病例相关路由（包括 `/desktop/...` 与 `/mobile/...`）
- **THEN** 这些 BFF 路由层 SHALL 仅负责：
  - 从 HTTP 请求中解析路径参数、查询参数与请求体
  - 调用病例相关 Service 层接口
  - 将 Service 返回的业务对象转换为对外暴露的 JSON 结构
- **AND** 路由层 MUST NOT 直接调用 `pool.query` 或构造 SQL，也 MUST NOT 直接操作文件系统（例如 `fs`、`storeFile`、`deleteStoredFile`）

#### Scenario: Service encapsulates case business logic

- **WHEN** 审查病例相关业务实现
- **THEN** Service 层 SHALL 集中封装以下业务动作（不要求函数命名一致，但语义必须覆盖）：
  - 病例列表与详情（含样例、文字病历与组织切片分析）
  - 病例创建或更新（UPSERT by `identifier`，可同时导入样例与文字病历）
  - 病例删除（含关联样例与文件清理）
  - 病例基础信息更新（例如显示名称）
  - 病例内样例的更新与删除
  - 病例内文字病历的增删改查
  - 指定样例的组织切片分析查询
- **AND** Service 层 MUST NOT 直接使用数据库连接或 SQL，所有持久化访问 SHALL 通过 Repository 层完成

#### Scenario: Repository as single DB access point

- **WHEN** 搜索对 `cases`、`case_samples`、`case_reports` 与 `sample_tissue_analysis` 的数据库访问（例如 `SELECT`/`INSERT`/`UPDATE`/`DELETE`）
- **THEN** 这些访问 SHALL 仅出现在 Repository 层模块中（例如 `casesRepository`、`caseSamplesRepository`、`caseReportsRepository`、`tissueAnalysisRepository`）
- **AND** 除 Repository 之外的任何层（包括 BFF 与 Service） MUST NOT 直接构造 SQL 或访问 `pg.Pool`/`pg.Client`

---

### Requirement: Database as Single Source of Truth for Case Data

病例、样例、文字病历与组织切片分析相关的 API MUST 以 PostgreSQL 数据库作为唯一真实数据来源；demo/fake 数据仅可通过 seed/迁移脚本写入数据库，而不能在运行时直接作为 API 响应返回。

#### Scenario: Case-related APIs source data from DB

- **WHEN** 客户端调用下列任一病例相关接口：
  - 桌面 BFF：`/desktop/cases[...]`
  - 移动 BFF：`/mobile/cases[...]`
  - （兼容阶段）历史 `/cases[...]` 路由
- **THEN** 这些接口返回的病例、样例、文字病历与组织切片分析数据 SHALL 全部来源于 PostgreSQL 表（以及文件系统中的实际样例文件），而非运行期硬编码的假数据对象

#### Scenario: Demo data goes through seed scripts

- **WHEN** 项目需要提供 demo 病例/样例/文字病历/组织切片分析数据用于演示
- **THEN** 这些 demo 数据 SHALL：
  - 以 JSON/TS 等形式作为 seed 脚本的数据来源
  - 通过迁移/seed 脚本写入 PostgreSQL 中的相应表
  - 通过与正式数据完全相同的 API 路径（例如 `/desktop/cases`、`/mobile/cases` 等）返回给前端
- **AND** 运行期 SHALL NOT 存在绕过数据库、直接返回硬编码 demo JSON 的病例相关 API 行为（除非处于错误兜底或明显标记的诊断接口，这类诊断接口不在本需求范畴内）

