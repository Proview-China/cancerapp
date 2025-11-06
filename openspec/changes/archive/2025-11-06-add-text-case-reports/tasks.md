## 1. 数据与后端
- [x] 1.1 更新 `database/schema.sql`，新增 `case_reports` 表（UUID 主键、case 外键、title/content/metadata、timestamps）。
- [x] 1.2 在 `backend/src/types.ts`、`casesRouter` 中引入 `CaseReport` 类型，允许 `POST /cases` 接收 `textReports` JSON，且允许“仅文字”病例（无文件也可成立）。
- [x] 1.3 新增 `GET /cases/:caseId/reports`、`POST /cases/:caseId/reports`、`PATCH /cases/:caseId/reports/:reportId`、`DELETE ...`，并在 `GET /cases` 响应中附带 `reports`。
- [x] 1.4 增加输入校验（title/content 非空、content 字数上限），并为上述接口编写单元/集成测试。

## 2. 前端交互
- [x] 2.1 扩展 `frontend/src/types/cases.ts` 与 `caseService`，对接新的 `reports` 数据结构及 CRUD API。
- [x] 2.2 在 `AnalysisSidebar`（或新组件）中展示文字病历列表，可按病例折叠、查看、删除。
- [x] 2.3 在导入弹窗中增加“文字病历”模式：支持新增多条文字记录、加载示例、校验字段，并调用 `onImportCase` 传入 `textReports`。
- [x] 2.4 提供示例病历数据文件（3 条中文 demo 文本），并在 UI 中提供“一键填充”交互。

## 3. 验证
- [x] 3.1 本地运行 `backend: npm run dev`、`frontend: npm run electron:dev`，验证图片+文字混合导入、仅文字导入、编辑/删除文字病历。（说明见 `frontend/README.md` “病例导入演示流程”）
- [x] 3.2 通过 `openspec validate add-text-case-reports --strict`。
- [x] 3.3 更新 README/文档，说明如何演示文字病历。
