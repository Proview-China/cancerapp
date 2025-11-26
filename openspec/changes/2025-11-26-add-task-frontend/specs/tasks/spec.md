## ADDED Requirements
### Requirement: Task Data Contract and Endpoints
任务中心 SHALL 定义统一的数据契约与接口：列表 `GET /tasks` 返回 `items[]`（`id,name,type,status,assignee,created_at,updated_at,progress,eta,model_version,data_source{case_id,source_type?,modality?,note?}`）与 `summary{queued,pending,in_progress,done,failed}`；详情 `GET /tasks/{id}` 追加 `steps[] {name,status,progress,started_at,ended_at,responsible}`, `failure_reason`, `retry_count`, `logs` 分页元数据；停止/重跑使用 `POST /tasks/{id}/stop|retry`，导出占位 `GET /tasks/{id}/export?format=pdf|json|excel`（可返回占位错误）。所有字段 SHALL 使用 snake_case，前端映射 camelCase。

#### Scenario: List and detail payloads are shape-consistent
- **WHEN** 客户端调用列表与详情接口
- **THEN** 返回的字段/嵌套结构符合上述契约，缺失可选字段以 `null`/空对象表示，不返回额外未定义字段

### Requirement: Task Status and Type Enumerations
任务状态 SHALL 限定为 `queued|pending|in_progress|done|failed|paused|canceled`，任务类型 SHALL 限定为（上传、自动分析、审核、训练、预测、报告、数据标注）。UI 状态徽章/图标 SHALL 映射：`queued/pending/canceled` 灰、`in_progress` 蓝、`done` 绿、`failed` 红、`paused` 琥珀；类型标签使用低饱和度配色。

#### Scenario: Enumerations enforced across API and UI
- **WHEN** 接口返回 status/type
- **THEN** 值只在上述集合内；UI 将 status 映射到规定的颜色/图标，出现集合外值时显示“未知状态”占位并记录错误

### Requirement: Demo Data and Service Toggle
任务中心 SHALL 内置 demo 列表/详情/日志数据，且形状与真实 API 完全一致；`taskService` SHALL 提供布尔开关（如 `USE_DEMO_TASKS`）决定使用本地 demo 还是远端接口，UI 层无需分支。

#### Scenario: Toggle without UI change
- **WHEN** 切换开关从 demo 到真实 API
- **THEN** UI 代码无需改动即可消费真实数据；反之亦然，字段与状态映射保持一致

### Requirement: Dashboard and Task List Behaviors
Dashboard SHALL 展示待处理计数、进度管线/进度条、最新动态、预警；列表 SHALL 支持状态/类型/时间/责任人筛选、状态徽章、行展开（当前步骤+最新日志摘要）、空/加载/错误状态。`queued` 状态 SHALL 以灰色表现“队列中”。

#### Scenario: List filtering and queued display
- **WHEN** 用户筛选状态或存在队列任务
- **THEN** 列表按筛选结果呈现；队列任务显示灰色“队列中”徽章且可见其排队/ETA 信息（若提供）

### Requirement: Task Detail, Steps, and Actions
任务详情 SHALL 展示步骤进度（含当前步骤高亮）、模型版本、数据源、ETA/进度、重试/失败次数、错误摘要、日志分页视图；操作按钮（停止/重跑/继续/导出） SHALL 基于权限与状态显隐/禁用，并调用对应接口。

#### Scenario: Actions constrained by status and permissions
- **WHEN** 任务状态为 `in_progress|queued|paused`
- **THEN** “停止”可用仅当 `can_stop=true`；当状态为 `done|failed|canceled` 时显示“重跑”且需 `can_retry=true`；导出按钮在任何状态仅当 `can_export=true`，其余情况禁用并提示原因

### Requirement: Polling and Log Pagination Strategy
任务中心 SHALL 对 `queued|in_progress|paused` 任务每 10–15s 轮询列表与详情，进入 `done|failed|canceled` 后停止；日志接口 SHALL 支持分页/增量（`offset/limit` 或 `since`），前端追加渲染并保留滚动位置。

#### Scenario: Polling stops on terminal states and logs append
- **WHEN** 任务由进行中变为终态
- **THEN** 轮询停止且 UI 不再发起轮询；加载日志分页时，新日志追加到列表末尾，不打乱已加载顺序

### Requirement: Export Placeholder and Error/Empty States
导出操作 SHALL 提供 pdf/json/excel 占位选项；当后端未实现或返回错误时，UI SHALL 显示“暂未开通/导出失败”提示且不崩溃。空列表、空日志、加载与错误态 SHALL 提供明确的占位/重试。

#### Scenario: Export not available handling
- **WHEN** 用户选择某导出格式且后端未支持或返回错误
- **THEN** UI 显示占位/失败提示，保持可重试或关闭，不影响任务详情与列表的其余交互
