## Context
- 现状：`cases` 仅关联图像样例（`case_samples`）。导入接口强制需要文件，前端 UI 没有文字病历概念。
- 需求：提供“病例识别和读取 demo”，即：
  1. 官方示例文字病历可直接加载导入。
  2. 用户可在 UI 中录入/查看/删除文字病历，并存入数据库。
  3. 与现有病例结构保持一致（同一 `case` 同时拥有图像与文字）。
- 约束：继续使用 PostgreSQL；优先简单实现，避免一次引入富文本/搜索引擎。

## Goals / Non-Goals
- Goals
  - 允许仅文字数据创建病例，并与图像样例共存。
  - 提供文字病历 CRUD API，与 `/cases` 列表同源数据。
  - 交付 3 条中文 demo 病历（JSON/TS 常量），一键注入导入表单。
- Non-Goals
  - 不引入全文检索/标签搜索。
  - 不实现权限控制或版本回滚。
  - 不构建富文本（仅基础 Markdown/纯文本）。

## Decisions
1. **数据模型**：新增 `case_reports` 表
   - 字段：`id UUID`、`case_id UUID`、`title TEXT`、`summary TEXT`、`content TEXT`、`tags TEXT[]`、`metadata JSONB`、`created_at/updated_at`。
   - 原因：不修改 `case_samples` 结构，避免空 `storage_path`；保留多条文字记录能力。
2. **导入接口**：`POST /cases` 新增 `textReports` 字段（JSON 字符串）
   - 允许无文件但携带 `textReports`；若两者皆空则仍拒绝。
   - `textReports` 中每条包含 `title`, `content`, 可选 `summary`, `tags`。
3. **API 设计**
   - `/cases`：响应内新增 `reports: CaseReport[]`。
   - `/cases/:caseId/reports`：`GET`（列表）、`POST`（新增）。
   - `/cases/:caseId/reports/:reportId`：`PATCH`（编辑）、`DELETE`。
   - 返回结构与 `CaseReport` TypeScript 类型保持一致。
4. **示例病历**
   - 在前端维护 `demoTextCases.ts` 常量数组，每条含病例标识建议值。
   - UI 中“加载示例病历”会将这些 demo 写入导入表单，并允许用户再编辑后提交。
5. **验证策略**
   - 后端增加 Supertest/Vitest（或 jest）用例，覆盖文字-only 创建、混合创建、CRUD。
   - 前端人工验证 + 整体 e2e（可加 Cypress/Playwright 但当前阶段可人工）。

## Risks / Trade-offs
- **数据库迁移**：需确保在生产库中执行 schema 变更；建议提供 SQL 脚本并记录在 README。
- **表单复杂度**：导入弹窗新增“文字模式”可能增加表单复杂性；通过 Tab 形式保持清晰。
- **内容体积**：`content` 允许较长文本（<= 10k 字），需在 API 层做限制以防止 Postgres 负荷。

## Migration Plan
1. 应用 schema 变更，创建 `case_reports` 表。
2. 部署新版后端，使 `/cases` 返回 `reports`，同时兼容旧前端（旧前端不会读取该字段）。
3. 部署前端，引入文字病历 UI。
4. 验收：导入 demo 病历、查看与删除、与图像样例混合展示。

## Open Questions
- 是否需要全文搜索 / 标签筛选？（当前不实现）
- Demo 病历是否需要同步到后端种子脚本？目前计划只在前端提供；可根据演示需求再补。
