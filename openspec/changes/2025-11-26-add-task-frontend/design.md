## Context
- 任务中心需复用现有前端视觉/交互（暖色渐变、圆角、阴影、衬线排版），并在无后端/数据库数据时以 demo 先行。
- 需要统一的任务数据契约（列表、详情、日志、操作），后续切换到真实 API 不改 UI 逻辑。
- 当前项目无登录/鉴权；权限控制需在规格与后端接口层协同实现或占位。

## Goals / Non-Goals
- Goals: 定义任务状态/类型枚举、数据字段、接口契约；前端 demo 与真实 API 的无缝切换；轮询与日志分页策略；操作/权限占位；导出占位。
- Non-Goals: 实现后端存储/调度/鉴权；新增跨端（小程序）任务 UI；引入 WebSocket 通道（仅预留）。

## Decisions
- Data contract: 列表返回 `id,name,type,status,assignee,created_at,updated_at,progress,eta,model_version,data_source{case_id,source_type?,modality?,note?}`、聚合 `summary{pending,in_progress,done,failed,queued}`；详情追加 `steps[] {name,status,progress,started_at,ended_at,responsible}`, `logs_pagination` 元数据、`failure_reason`, `retry_count`; 字段使用 snake_case，前端映射 camelCase。
- Polling: 无推送时对 `queued|in_progress|paused` 任务 10–15s 轮询列表与详情；`done|failed|canceled` 停止轮询；日志通过 `offset/limit` 或 `since` 增量拉取。
- Permissions: 建议 Admin 全权；责任人可停/重跑本任务；System 任务仅 Admin；列表/详情返回 `can_stop|can_retry|can_export` 以驱动前端按钮显隐/禁用，后端仍校验。
- Demo toggle: `taskService` 内 `USE_DEMO_TASKS` 控制，demo 数据与真实 API 形状一致（包含列表/详情/日志），方便随时切换。
- Export placeholder: 前端提供 pdf/json/excel 选项；后端未开通时提示；后续支持签名 URL 与有效期处理。

## Risks / Trade-offs
- 后端若未按契约提供字段/枚举，会导致映射与 UI 状态错误；需前置对齐与接口容错。
- 轮询频率过高会增加后端负载；频率基于状态分层（仅活跃任务）折中。
- 无鉴权场景下的权限占位可能与未来登录体系不一致；需在实现期同步角色模型。

## Migration Plan
- 阶段 1：基于 demo 数据完成 UI/交互，验证轮询、日志分页、状态映射与按钮占位。
- 阶段 2：后端对齐接口契约，切换 `USE_DEMO_TASKS=false`；保留容错与空/错误态。
- 阶段 3：接入导出真实接口/签名 URL（若提供）；评估是否升级为 WebSocket 推送。

## Open Questions
- 后端是否会提供明确的角色/鉴权体系（或沿用本地单用户），以及角色命名与权限字段是否与 `can_*` 布尔一致？若不一致需在实现前确认。
