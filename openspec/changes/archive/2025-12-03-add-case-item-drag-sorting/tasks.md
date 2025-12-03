## 1. 需求与设计对齐
- [x] 1.1 复查 `openspec/specs/cases/spec.md` 与 `openspec/specs/ui/spec.md` 现有与病例/列表相关的要求，确保新需求与现有行为兼容
- [x] 1.2 与需求方确认排序粒度：本次仅支持“同一病例内部的图像样本顺序”和“同一病例内部的文字病历顺序”，不影响病例列表本身的顺序

## 2. 规格与数据模型
- [x] 2.1 在 `openspec/changes/add-case-item-drag-sorting/specs/cases/spec.md` 中补充/修改 Requirements，定义：
  - 样本/文字报告的稳定排序字段
  - 排序 API 的基本契约（输入为 ID 有序列表）
  - 现有 `GET /cases` 与子路由返回顺序的规则
- [x] 2.2 在 `openspec/changes/add-case-item-drag-sorting/specs/ui/spec.md` 中补充/修改 Requirements，描述：
  - 侧栏“图像/文字”列表的拖拽行为
  - 拖拽过程中卡片让位与视觉反馈
  - 键盘与不可用场景下的兜底行为
- [x] 2.3 运行 `openspec validate add-case-item-drag-sorting --strict`，修正所有规范校验问题

## 3. 后端实现与验证
- [x] 3.1 在 `database/schema.sql` 与 `backend/src/db/init.ts` 中为 `case_samples` 与 `case_reports` 添加排序字段（如 `sort_order`），并为旧数据设置合理默认值（按 `created_at` 映射）
- [x] 3.2 更新 `backend/src/routes/cases.ts` 的聚合查询，使样本/报告在所有返回中按排序字段（次序）排序，若缺失则退回 `created_at`
- [x] 3.3 为每个病例新增两个排序端点，例如：
  - `PUT /cases/{caseId}/samples/order`：请求体为样本 ID 列表
  - `PUT /cases/{caseId}/reports/order`：请求体为报告 ID 列表
  确保包含边界校验（ID 集合匹配、病例归属一致）与事务处理
- [x] 3.4 为排序端点添加基础单元测试或集成测试（优先使用现有 Vitest/Supertest 方案），覆盖：
  - 正常重排
  - ID 缺失/重复/跨病例的错误情况
  - 部分记录无排序值的兼容行为

## 4. 前端交互与持久化
- [x] 4.1 在 `frontend/src/services/caseService.ts` 中新增排序 API 调用函数，约定好请求体与错误处理
- [x] 4.2 在 `frontend/src/components/AnalysisSidebar.tsx` 中为“图像”和“文字”列表引入拖拽排序逻辑：
  - 按住某个 card 可上下拖动，其他 card 让位
  - 拖拽结束时更新本地顺序并调用排序 API 写回
  - 在排序进行中显示轻量状态提示（例如禁用其他排序操作）
- [x] 4.3 处理排序失败场景：
  - 若排序 API 返回错误或网络失败，恢复原有顺序
  - 在 UI 中以非打断式提示用户（如顶部 toast 或侧栏内错误提示）
- [x] 4.4 验证键盘/无鼠标场景下仍可操作或至少不破坏现有选择/编辑/删除功能

## 5. 回归与文档
- [x] 5.1 在本地跑通后端测试与基础手动回归：新增/删除样本/报告后排序行为是否仍然合理（新建条目的默认插入位置与 UI 表现）
- [x] 5.2 更新相关文档（如 `frontend/README.md` 或内部开发备注），在“病例导入与管理”章节说明拖拽排序能力和限制
- [x] 5.3 再次运行 `openspec validate add-case-item-drag-sorting --strict`，确保变更在归档前无规范错误
