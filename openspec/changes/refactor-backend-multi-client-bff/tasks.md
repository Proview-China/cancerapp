## 1. 规格与背景对齐

- [ ] 1.1 阅读 `openspec/project.md`、`openspec/specs/cases/spec.md`、`openspec/specs/analysis/spec.md`，确认当前病例与分析相关能力与术语
- [ ] 1.2 通过 `rg`/`ls` 粗略梳理 `backend/src/routes/cases.ts`、`backend/src/db/*`、`backend/src/utils/fileStorage.ts` 的现状，仅用于理解，不做实现设计
- [ ] 1.3 与本提案保持一致，确认本 change 范围仅限于“增加多端 BFF + 分层架构 + 数据源统一”的规格与设计，不修改任何运行时代码

## 2. 设计 BFF / Service / Repository 边界

- [ ] 2.1 在 `design.md` 中明确 Desktop BFF 与 Mobile BFF 的职责：
  - [ ] 2.1.1 Desktop BFF：提供完整病例视图（等价于现有 `GET /cases` 返回的结构）
  - [ ] 2.1.2 Mobile BFF：提供轻量病例列表与精简详情视图，字段从统一业务对象派生
- [ ] 2.2 在 `design.md` 中罗列病例相关 Service 层“业务动作”清单：
  - [ ] 2.2.1 病例：列表、详情、创建/更新、删除、更新基础信息
  - [ ] 2.2.2 样例：更新描述/模态、删除样例（含文件清理）
  - [ ] 2.2.3 文字病历：病例内增删改查
  - [ ] 2.2.4 切片分析：按样例查询分析结果
- [ ] 2.3 在 `design.md` 中罗列 Repository 层“数据访问能力”清单：
  - [ ] 2.3.1 对 `cases`、`case_samples`、`case_reports`、`sample_tissue_analysis` 的 CRUD
  - [ ] 2.3.2 聚合查询：按病例批量加载样例、文字病历、分析并组装为业务对象
- [ ] 2.4 在 `design.md` 中阐明数据库为病例数据唯一真实来源的约束，以及 demo 数据仅作为 seed 输入的方式

## 3. 更新 cases 规格（多端 BFF + 分层架构）

- [ ] 3.1 在 `changes/refactor-backend-multi-client-bff/specs/cases/spec.md` 中新增 BFF 相关需求：
  - [ ] 3.1.1 明确 `/desktop/cases` 与 `/mobile/cases` 等路由的存在与基本字段要求
  - [ ] 3.1.2 说明 Desktop BFF 返回结构等价于现有 `GET /cases` 的 `CaseWithRelations`
  - [ ] 3.1.3 说明 Mobile BFF 列表与详情使用轻量视图，并由统一业务对象派生
- [ ] 3.2 在同一 delta 中新增后端分层架构需求：
  - [ ] 3.2.1 路由层仅做 HTTP/JSON 映射，不直接调用 `pool.query` 或操作文件系统
  - [ ] 3.2.2 Service 层集中封装病例业务动作，不直接构造 SQL
  - [ ] 3.2.3 Repository 层作为唯一数据库访问入口，封装所有与 `cases`、`case_samples`、`case_reports`、`sample_tissue_analysis` 相关的 SQL
- [ ] 3.3 在同一 delta 中新增数据源统一的需求：
  - [ ] 3.3.1 病例/样例/文字病历/分析 API 的响应数据 MUST 来自数据库（及文件系统），禁止运行期硬编码 demo 响应
  - [ ] 3.3.2 demo 数据仅通过 seed/迁移脚本写入数据库，并通过相同 API 返回

## 4. 交互与兼容性约束（文档层面）

- [ ] 4.1 在 `design.md` 中描述 `/cases` 旧路由的兼容策略：
  - [ ] 4.1.1 说明在实现阶段可以让 `/cases` 内部转调 Desktop BFF 或 Service 层
  - [ ] 4.1.2 标注 `/cases` 为“兼容入口”，建议新前端使用 `/desktop/...` 或 `/mobile/...`
- [ ] 4.2 在 `design.md` 中记录前端调用建议：
  - [ ] 4.2.1 桌面端推荐使用 `/desktop/...`
  - [ ] 4.2.2 移动端与小程序推荐使用 `/mobile/...`
- [ ] 4.3 在 `design.md` 中强调：本 change 不改变现有前端行为，所有行为变化必须在后续实现 change 中通过代码与测试共同完成

## 5. 校验与文档一致性

- [ ] 5.1 运行 `openspec validate refactor-backend-multi-client-bff --strict`，修复所有校验错误（标题层级、Requirement/Scenario 结构等）
- [ ] 5.2 使用 `openspec show cases --type spec` 检查新 delta 与现有 `cases` 规格是否一致、无冲突
- [ ] 5.3 简要 review 现有 `cases` 相关代码与本 change 的设计，确保规格不与现实实现明显矛盾（允许存在“待实现”差距，但不允许规格描述不可能实现的结构）
- [ ] 5.4 在本 change 完成后，将其状态标注为“准备实现”，并在后续实际实现 change 中引用本 change 的 design 与 tasks

## 6. 不在本 change 范围内的事项（显式排除）

- [ ] 6.1 不修改任何后端或前端代码（`backend/`、`frontend/`、`frontend-mobile/`、`wechatapp/` 等）
- [ ] 6.2 不调整数据库 schema 或迁移脚本，仅在设计中讨论未来 schema 变更的方向
- [ ] 6.3 不新增或修改 `openspec/specs/ui/spec.md` 与 `openspec/specs/mobile-ui/spec.md`，仅在 design 中对这些 capability 提出后续变更建议

