## 1. 规范与设计
- [x] 1.1 对齐现有 `openspec/specs/ui` 与 `openspec/specs/cases`，确认新增能力分拆（ui/cases/analysis）
- [x] 1.2 制定“池塘/小池塘”布局规则与命名清单（基础/原始/处理后/AI）
- [x] 1.3 定义显示令牌（gap、radius、阴影、字号、行高、颜色）与无障碍策略（Tab 顺序、角色、快捷键）
- [x] 1.4 明确中英文标签/单位/小数精度与格式化规则（% 精度、mm²/px 小数位）

## 2. 数据模型与存储（仅组织切片）
- [x] 2.1 新增表 `sample_tissue_analysis`
  - 关联：`case_samples(id)`（仅当 `modality='组织切片'`）
  - 原始指标（a–i）与单位定义（见 specs/analysis）
  - 衍生指标（a–e）与计算/单位说明（见 specs/analysis）
  - 图像路径：`raw_image_path`, `parsed_image_path`（本地绝对路径或可解析路径）
- [x] 2.2 SQL 迁移与回滚脚本
- [x] 2.3 demo seed：从 `demo_fake/` 读取 F10/F11/F13，建立到样本的关联并写入分析表
- [x] 2.4 审计与触发器：`updated_at` 触发器与索引（sample_id 唯一/普通，权衡一对一关系）

## 3. 后端接口
- [x] 3.1 在 `GET /cases` 聚合返回每个样本的 `analysis`（当模态为“组织切片”且存在分析）
- [x] 3.2 新增 `GET /cases/:caseId/samples/:sampleId/analysis`（只读，用于按需加载）
- [x] 3.3 输入校验与错误返回（404 不存在/403 非组织切片/200 空对象）
- [x] 3.4 路径白名单与安全校验（仅 `uploads/` 与 `demo_fake/`）
- [x] 3.5 观测性：记录请求耗时与失败原因（不泄露路径细节）

## 4. 前端 UI（分析区）
- [x] 4.1 将分析区拆分为四个“池塘”：基础/原始/处理后/AI
- [x] 4.2 每个池塘内部按“小池塘”网格排版（两列/自适应断行，移动端单列）
- [x] 4.3 新增两个按钮：查看原始图像/查看解析图像（仅当提供路径时可用；无图像则禁用）
- [x] 4.4 Electron 集成：调用系统默认图片查看器打开本地路径（无 Electron 环境时提示）
- [x] 4.5 无内嵌图片渲染；仅按钮外部打开
- [x] 4.6 值格式化：统一数字精度、千分位、单位符号；空值占位“未提供”
- [x] 4.7 AI markdown 渲染：标题深度、列表/强调、代码块禁用（若无需）

## 5. Demo 数据与 AI 文本
- [x] 5.1 从 `demo_fake/` 读取三位病人的组织切片示例（BIOBANK-F10/F11/F13）
- [x] 5.2 映射并写入 `sample_tissue_analysis`（原始/衍生指标、图像路径）
- [x] 5.3 准备 3 段 AI 预测与深度推理的 markdown（遵循左栏 markdown 风格）
- [x] 5.4 文案与名词表对齐：中/英标签一致，避免歧义

## 6. 校验与文档
- [x] 6.1 手动验证：
  - 列表加载 → 选择组织切片样本 → 分析区四个池塘展示
  - 按钮可打开系统图片查看器（原始/解析）
  - 非组织切片样本显示“未提供”占位
- [x] 6.2 记录截图与日志（UI/后端）
- [x] 6.3 更新 README/开发说明（环境变量、路径、演示步骤）
- [x] 6.4 规范审查：与 `openspec/specs/ui`/`cases` 现有条目无冲突；如冲突先提交变更讨论

## 7. OpenSpec 流程
- [x] 7.1 `openspec validate add-tissue-analysis-demo-panels --strict`
- [x] 7.2 审阅与归档：`openspec archive add-tissue-analysis-demo-panels --yes`
