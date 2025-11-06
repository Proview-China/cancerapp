## Why
目前系统仅支持导入带图像的病例样本，无法演示“病例识别和读取”的纯文本场景，也无法在数据库中维护文字病历。缺少这部分能力时，医生或算法研究者只能查看图片，无法直接检索、演示或联动文字描述，难以满足演示和数据整理需求。

## What Changes
- **数据层**：新增 `case_reports` 表，记录病例下的文字描述（标题、结构化标签、正文）；为 demo 预置 3 条精心撰写的中文病历文本。
- **导入流程**：扩展 `POST /cases` 允许仅携带文字病历（无文件也可建病例），通过 `textReports` JSON 字段一次性导入多条文字记录。
- **API**：
  - `GET /cases` 返回 `reports` 数组；新增 `GET /cases/:caseId/reports`、`POST`、`PATCH`、`DELETE` 接口以支持 CRUD。
  - 校验文本字段（必填 `title`+`content`），并返回 404/400 语义化错误。
- **前端**：
  - `caseService`/类型扩展，支持查询与提交文字病历。
  - AnalysisSidebar 中新增“文字病历”分区，可导入/查看/删除文本记录；导入弹窗支持切换“图片”与“文字”模式。
  - 提供“加载示例病历”按钮，可一键将预置 demo 文本写入导入表单。
- **演示文案**：在仓库内维护 `demoTextCases.ts`（或 JSON），包含 3 篇示例病历，供导入界面调用。

## Impact
- 受影响规格：`cases` 能力（病例与样本管理）。
- 代码影响：
  - 后端：`database/schema.sql`、`backend/src/routes/cases.ts`、`backend/src/types.ts`、`backend/src/db/*`、`backend/src/utils/*`。
  - 前端：`frontend/src/types/cases.ts`、`frontend/src/services/caseService.ts`、`frontend/src/components/AnalysisSidebar.tsx` 及相关样式/状态管理。
  - Demo 数据：新增 `frontend/src/demo/textCases.ts`（或等价文件）以及可能的后端种子脚本。
- 需要新增的验证：API 单测 / 手动场景，确保文字病历 CRUD 与图片逻辑互不影响。
