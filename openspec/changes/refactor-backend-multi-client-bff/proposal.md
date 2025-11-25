# Proposal: refactor-backend-multi-client-bff

## Why

### 1. 多端共享同一后端但缺乏清晰边界

当前桌面端（Electron UI）、移动网页端（`frontend-mobile`）以及未来的微信小程序端，均依赖同一组后端能力来管理病例及其影像样例和文字病历：

- 获取病例列表与详情（病例 + 影像样例 + 文字病历 + 组织切片分析）
- 在创建/更新病例时同时导入样例文件和文字病历
- 文字病历的增删改查
- 影像样例的更新与删除
- 组织切片分析数据的查询

这些能力目前主要集中在单一路由文件 `backend/src/routes/cases.ts` 中：

- 在同一个文件内同时处理 HTTP 细节（路径、状态码、JSON 结构）、业务规则（字段校验、UPSERT 逻辑、样例命名规则）、数据库访问（`pool.query` 针对 `cases`、`case_samples`、`case_reports`、`sample_tissue_analysis` 等表）以及文件存储（`storeFile`、`deleteStoredFile`）。
- 同一套接口既供桌面端使用，也被计划复用到 mobile/web/小程序端；当不同终端在字段、接口形状、节流策略上存在差异时，很难在一个路由文件内保持结构清晰和行为一致。

结果是：

- 终端特定的差异（例如：桌面端需要完整的病例结构，移动端只需要精简字段）目前无法通过“专用入口 + 公共业务”的方式表达，只能在单一路由内叠加条件逻辑；
- 一旦需要为某个终端增加或裁剪字段，很容易误伤其他终端。

### 2. 假数据与真实数据库并存，数据源不统一

从 `openspec/project.md` 和现有代码可以看到：

- 项目已经定义了 PostgreSQL schema（`cases`、`case_samples`、`sample_tissue_analysis` 等），并在后端通过 `pool` 访问这些表；
- 同时存在 demo/fake 数据用于演示（例如通过 seed 脚本导入 demo 组织切片分析数据，或在前端/后端中以硬编码 JSON 的形式存在）；
- 对于部分前端（尤其是移动端/小程序端）来说，真实数据库尚未完全成为唯一的数据来源。

风险包括：

- 调试时难以判断某一视图究竟在使用数据库中的真实记录，还是某段硬编码的 demo 数据；
- 后续如引入导出、统计、外部系统集成（例如将病例数据导出给分析平台），如果数据没有统一落在数据库中，将显著增加实现和维护成本。

### 3. 数据库结构未来存在调整需求，需要预留演进空间

结合项目背景和现有规格（`cases` 与 `analysis`），可以预见：

- 病例（Case）在未来很可能需要增加更多元数据字段（例如医生信息、诊断阶段、标签等），也可能需要拆分为基础信息表与扩展信息表；
- 影像样例（Sample）可能支持更多模态、更多文件存储方式（本地目录、NAS、对象存储）；
- 文字病历（Report）可能拆分为正文表与标签表，并支持多语言或版本历史；
- 组织切片分析（TissueAnalysis）已经在 `analysis` 规格中包含较多字段，后续还可能引入多版本分析记录、区域级分析、不同算法输出等。

如果后端继续让路由层直接操作表结构：

- 任意针对表结构的调整（拆表、加字段、索引调整）都将直接波及路由代码；
- 多个终端（桌面端、移动端/小程序端）的行为会同时受到影响，迁移风险难以控制；
- 难以实现“后台悄悄改库 + 接口保持不变”的渐进式演进。

### 4. 本次变更的目标

本次变更的目标是在**不立即重写现有功能**的前提下，建立一套面向多端的后端分层架构和 API 契约，为后续具体实现提供清晰的蓝图：

- 为病例相关 API 引入多端 BFF（Backend For Frontend）层：
  - 桌面端走 `/desktop/...` 路由，获取完整的病例视图，适配 Electron UI；
  - 移动端/小程序走 `/mobile/...` 路由，获取裁剪后的轻量视图；
  - 两个入口都依赖同一套业务逻辑与数据访问，不各自“复制一份后端”。
- 明确后端分层：
  - BFF 层：只处理 HTTP/JSON 与终端差异；
  - Service 层：集中病例业务规则（列表、详情、创建/更新、删除、文字病历、样例、分析查询等）；
  - Repository 层：集中所有数据库访问与对象映射；
  - Database：PostgreSQL 作为唯一真相源。
- 明确数据源：
  - 病例、样例、文字病历与切片分析 API 响应数据统一来自 PostgreSQL 和文件系统；
  - demo/fake 数据仅作为 seed 输入写入数据库，而非运行期直接输出。
- 为未来数据库结构调整预留空间：
  - 对外稳定的是 BFF 层的 API 形状和 Service 层的业务模型；
  - 数据库表结构可以在 Repository 层内部灵活演进。

本 proposal 只覆盖 **OpenSpec changes 层面** 的工作：定义变更目标、架构设计、规格增量以及任务拆分；不涉及任何实际代码变更。

## What Changes

本节描述本次变更在规格与架构层面的具体内容。实现时应严格遵守“先有规格，再改代码”的流程。

### 1. 新增多端 BFF 路由层（Desktop / Mobile）

#### 1.1 桌面端 BFF（Desktop BFF）

为桌面端（Electron UI）新增一组以 `/desktop` 为前缀的病例相关路由，以明确桌面端 API 契约：

- `GET /desktop/cases`
  - 返回病例列表；
  - 每个病例对象的结构等价于当前 `GET /cases` 返回的 `CaseWithRelations`，包含：
    - 病例基础信息；
    - 所有关联影像样例（含 `modality`、描述、文件路径、缩略图等）；
    - 所有关联文字病历（含 title、summary、content、tags 等）；
    - 对于 `modality='组织切片'` 的样本，附带 `analysis` 对象（结构参考 `analysis` 规格）。
- `GET /desktop/cases/{caseId}`
  - 返回单个病例详情，结构与列表中相同（只包含一个病例）。
- `POST /desktop/cases`
  - 支持当前 `POST /cases` 已有的行为：
    - 通过 `identifier` UPSERT 病例；
    - 同时上传一个或多个样例文件；
    - 同时导入一个或多个文字病历。
- `PATCH /desktop/cases/{caseId}`、`DELETE /desktop/cases/{caseId}`、`PATCH /desktop/cases/{caseId}/samples/{sampleId}`、`DELETE /desktop/cases/{caseId}/samples/{sampleId}`、
  以及文字病历的 CRUD 接口：
  - 行为与当前对应路由保持一致，但仅作为桌面端 BFF 的入口。

规定：

- 桌面端的 BFF 路由对字段的覆盖度保持“尽量完整”，以满足桌面 UI 的需求；
- 具体执行逻辑（数据库访问、UPSERT 规则、文件存储等）不直接写在路由中，而是委托 Service 层完成。

#### 1.2 移动端 BFF（Mobile BFF）

为移动端网页、小程序等新增一组以 `/mobile` 为前缀的病例相关路由，提供针对移动场景优化的轻量视图：

- `GET /mobile/cases`
  - 返回轻量化病例列表；
  - 每条病例至少包含：
    - `id`
    - 面向用户显示的名称（例如 `displayName`）
    - 最近一条文字病历的摘要（或 null）
    - 主样例缩略图（例如优先选取首个样例的缩略图，或一个代表性的“封面”缩略图；缺失时为 null）
    - 最近更新时间（例如 `updated_at`）
  - 不要求在列表中返回所有文字病历正文和所有样例的详细信息。
- `GET /mobile/cases/{caseId}`
  - 返回精简版病例详情；
  - 包含病例基础信息，以及：
    - 精简的样例列表（例如只包含样例 id、模态、描述、缩略图 URL）；
    - 精简的文字病历列表（例如只包含 id、title、summary、created_at）。
- 文字病历与样例相关的其他接口（例如查看文字病历详情、查看切片分析）可以按需要在 `/mobile` 下暴露，行为始终基于与桌面端相同的 Service 层。

规定：

- 移动端 BFF 不引入独立的业务规则，所有业务规则应复用 Service 层；
- 区别仅在于：BFF 层对 Service 返回的统一业务对象进行字段裁剪与重组，以适应移动端体验与带宽限制。

#### 1.3 兼容现有 `/cases` 路由

为降低迁移风险，在一段过渡期内：

- `/cases` 路由可以作为“兼容入口”保留；
- `/cases` 的实现可以内部转调 Desktop BFF 或对应 Service 接口，以保持行为等价；
- 开发规范中应明确：新的前端调用尽量使用 `/desktop/...` 或 `/mobile/...`，避免在新功能中继续依赖 `/cases`。

具体是否以及何时完全移除 `/cases`，将在后续变更中单独决策，并通过新的 change 记录。

### 2. 引入 Service 层：集中病例业务逻辑

在 `backend/src/services/` 下定义病例相关 Service 模块（示例名：`casesService`），将当前 `backend/src/routes/cases.ts` 中的业务逻辑抽象为一组“业务动作”，例如：

- 病例：
  - 列出病例列表（包含样例、文字病历、分析）；
  - 获取单个病例详情；
  - 创建/更新病例（identifier UPSERT，附带样例与文字病历）；
  - 删除病例（包含样例文件清理）；
  - 更新病例显示名等基础字段。
- 样例：
  - 修改样例描述与模态；
  - 删除样例（数据库记录 + 物理文件）。
- 文字病历：
  - 列出病例下所有文字病历；
  - 新增文字病历；
  - 修改文字病历；
  - 删除文字病历。
- 切片分析：
  - 获取某样例的组织切片分析结果。

Service 层职责与约束：

- 负责业务规则与领域校验：
  - 例如：identifier 必填、标题/内容长度限制、模态值合法性、病例/样例/报告存在性等；
  - 对于跨多表的一致性（如同一事务内创建病例与样例），负责协调 Repository 调用和事务边界。
- 不直接操作数据库或构造 SQL：
  - 所有数据库访问通过 Repository 层间接完成；
  - Service 层可以持有事务上下文（例如通过注入的 Unit-of-Work），但不感知具体表结构。
- 向上提供稳定的“业务接口”：
  - BFF 层只关心业务接口，不关心底层 Repository 与表结构；
  - 未来改变数据模型/数据库结构时，只要 Service 接口不变，BFF 层不需要改动。

### 3. 引入 Repository 层：集中数据库访问与对象映射

在 `backend/src/repositories/` 下增加病例相关 Repository 模块，负责对 PostgreSQL 的所有读写和数据映射，例如：

- `casesRepository`：
  - 负责 `cases` 表的 CRUD；
  - 提供按条件查询病例列表的能力（支持排序、分页等）。
- `caseSamplesRepository`：
  - 负责 `case_samples` 表的 CRUD；
  - 提供按病例批量加载样例的能力。
- `caseReportsRepository`：
  - 负责 `case_reports` 表的 CRUD；
  - 提供按病例加载/写入/修改/删除文字病历的能力。
- `tissueAnalysisRepository`：
  - 负责 `sample_tissue_analysis` 表的读写；
  - 提供按样例加载分析记录的能力。

Repository 层职责与约束：

- 是**唯一**直接操作数据库连接和 SQL 的层：
  - 路由层（BFF）和 Service 层不得直接调用 `pool.query` 或访问 `pg` 连接；
  - 对 `cases`、`case_samples`、`case_reports`、`sample_tissue_analysis` 等病例相关表的每一次读写都必须通过 Repository 封装。
- 聚合与映射逻辑集中在此层：
  - 例如：在加载病例列表时，一次性查询相关样例和文字病历，并组装为统一的业务对象；
  - 在加载组织切片分析时，将多列原始/衍生指标与图片路径映射为 `analysis` 规格定义的结构。
- 吸收数据库结构演进：
  - 将来拆表、加字段或更改主键类型时，仅需调整 Repository 内部的 SQL 与映射逻辑；
  - Service 与 BFF 层继续依赖稳定的业务对象模型，不被数据库结构变动直接影响。

### 4. 数据源统一到 PostgreSQL，demo 仅作为 seed 输入

本次变更在规格层面确立以下约束：

- 病例、样例、文字病历与切片分析相关的 API 响应数据 MUST 来自 PostgreSQL 数据库（以及文件系统中的真实文件），不得在运行时直接返回硬编码 JSON；
- demo/fake 数据的角色：
  - 允许以 JSON/TS 文件形式存在仓库（例如 `demo_fake/`），但这些文件仅作为 seed/迁移脚本的数据输入；
  - demo 数据通过脚本导入 PostgreSQL 后，与“正式数据”在 API 层面没有区别；
  - 前端通过统一的 API 访问 demo 数据，无需感知其来源。

这样保证：

- 调试时只需关注数据库和文件系统的状态，不需要区分“真数据 vs 假数据”；
- 为后续统计、导出和外部集成提供稳定基础。

### 5. 为未来数据库结构调整预留边界

在本次变更中，并不直接修改 `openspec/specs/analysis/spec.md` 定义的分析数据模型，也不立刻重构数据库 schema，而是通过以下方式为未来演进预留空间：

- 在 Service 层和 TypeScript 类型中稳定病例、样例、文字病历和切片分析的业务模型（字段名与语义）；
- 将“业务对象 ↔ 多张表/多列”的映射集中在 Repository 层，后续调整表结构时只改这一层；
- 保留 `metadata` 等 JSON 字段用于承载不确定或易变化的信息，避免为暂时不稳定的字段定义过多硬编码列；
- 保持 `identifier` 作为病例层面的业务编号长期稳定，允许内部主键类型与策略演进，并通过 Repository 做转换。

本 proposal 不要求在当前变更中完成具体的 schema 重构；针对数据库结构的实际变更将以新的 change 逐步提出。

## Impact

### Specs

- `openspec/specs/cases/spec.md`
  - 新增多端 BFF（Desktop/Mobile）入口与轻量视图的需求；
  - 新增后端分层架构（BFF → Service → Repository → DB）的要求；
  - 新增“数据库为病例相关数据唯一真实来源”的要求，限制运行期假数据用法。
- `openspec/specs/analysis/spec.md`
  - 沿用现有分析数据模型与接口结构；
  - 在本变更中仅通过 `cases` 规格引用和设计说明强调：分析数据依旧来自 PostgreSQL，经 Repository 层提供，不在路由层直接构造。
- `openspec/specs/ui/spec.md` 与 `openspec/specs/mobile-ui/spec.md`
  - 本变更不直接修改 UI 规格；
  - 后续变更将分别为桌面端和移动端规定：应接入 `/desktop/...` 或 `/mobile/...` 路由，而非历史 `/cases`。

### Code (概念层面，仅作为参考，不在本变更中直接修改)

> 以下为实现本变更时可能受影响的代码位置，作为架构说明，**本 change 不对代码做任何实际改动**。

- Backend
  - 预计新增：
    - `backend/src/routes/desktop/*`：桌面端 BFF 路由；
    - `backend/src/routes/mobile/*`：移动端 BFF 路由；
    - `backend/src/services/casesService.*`：病例相关业务逻辑；
    - `backend/src/repositories/*`：病例/样例/文字病历/分析的数据访问；
  - 预计修改：
    - `backend/src/server.ts`：挂载 `/desktop` 与 `/mobile` 前缀；
    - `backend/src/routes/cases.ts`：逐步将业务逻辑与数据访问迁移到 Service/Repository，并保留为兼容入口或最终清理。
- Frontend
  - 桌面端与移动端将在后续变更中逐步切换到新的 BFF 路径（`/desktop/...`、`/mobile/...`），对应更新前端 service 层。

### Process

- 病例相关需求新增或调整时，需首先更新 `cases` 规格中的要求，再通过新的 change 调整 Service/Repository 与 BFF，实现与文档同步；
- 数据库相关变更应优先考虑在 Repository 层进行适配，并通过 seed/migration 脚本确保 demo 与正式数据都落在数据库中。

## Risks and Mitigations

### 风险 1：多端 BFF 入口导致 API 面表面复杂度上升

新增 `/desktop` 与 `/mobile` 两组入口，会在短期内增加 API 面数量，对开发者造成一定认知负担。

缓解措施：

- 在规格中明确：所有病例相关业务逻辑集中在 Service 层，BFF 层仅做视图裁剪；
- 在文档中给出推荐使用路径：
  - 桌面 UI 使用 `/desktop/...`；
  - 移动 UI 与小程序使用 `/mobile/...`；
  - `/cases` 仅限旧版本兼容，不建议新功能依赖。

### 风险 2：分层带来短期重构成本

引入 Service/Repository 层意味着需要重构现有 `cases` 路由，短期内会增加工作量。

缓解措施：

- 将重构拆解为一系列小步任务（见 `tasks.md`），每一步都保持 API 行为不变；
- 先在内部完成 Service/Repository 抽取，再引入 BFF 路由和前端迁移；
- 通过 OpenSpec change 的方式，确保每一阶段都有清晰的规格与任务边界。

### 风险 3：数据库结构后续调整仍可能引发意料之外的影响

即便有 Repository 层，过于激进的 schema 变更仍可能引入 bug。

缓解措施：

- 在 Repository 层引入尽量小的可测试单元（例如按病例/样例/报告分模块），并在变更时优先调整这些单元；
- 避免在单次变更中同时调整大量表与大量 API 行为，将结构性修改拆分成多个 change；
- 使用 seed 数据和本地环境进行回归验证，确保 demo 和真实数据路径都工作正常。

## Rollout Plan (High-level)

> 具体任务和顺序见同目录下的 `tasks.md`；本节给出阶段性里程碑。

1. **阶段 1：规格与设计**
   - 完成本 proposal；
   - 在 `cases` 规格中新增多端 BFF + 分层架构 + 数据源统一的需求（本 change 附带的 `specs/cases/spec.md`）；
   - 在 `design.md` 中细化 BFF/Service/Repository 的接口边界与对象模型。

2. **阶段 2：后端内部重构（保持现有 API 行为）**
   - 从 `backend/src/routes/cases.ts` 中提取病例相关 Service 与 Repository；
   - 确认路由层不再直接访问数据库；
   - 保持 `/cases` 行为与当前实现兼容。

3. **阶段 3：引入 Desktop/Mobile BFF**
   - 新增 `/desktop/...` 与 `/mobile/...` 路由，消费 Service 层；
   - `GET /desktop/cases` 提供与现有 `GET /cases` 等价的完整病例视图；
   - `GET /mobile/cases` 与 `GET /mobile/cases/{caseId}` 提供轻量视图。

4. **阶段 4：前端迁移与旧接口收敛**
   - 桌面 UI 切换到 `/desktop/...`；
   - 移动 UI 与小程序切换到 `/mobile/...`；
   - 评估并逐步收敛 `/cases` 旧入口。

5. **阶段 5：后续数据库演进（单独 change 提出）**
   - 在新的分层架构基础上，以较小粒度的 change 调整病例/样例/文字病历/分析的数据库结构；
   - 每次变更仅修改 Repository 与迁移脚本，保持 Service/BFF API 稳定。

