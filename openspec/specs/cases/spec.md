# cases Specification

## Purpose
TBD - created by archiving change add-text-case-reports. Update Purpose after archive.
## Requirements
### Requirement: Case Text Report Storage
系统 MUST 支持在创建病例时同时导入一个或多个文字病历，并允许仅用文字病历创建病例。

#### Scenario: Import case with text reports only
- **WHEN** 客户端调用 `POST /cases`，传入 `identifier` 与 `textReports` JSON（至少 1 条，含 title+content）且不包含文件
- **THEN** 服务器创建病例，返回 `201`，响应体中的 `reports` 列表包含新建文本

#### Scenario: Reject empty text payload
- **WHEN** `textReports` 中缺少 `title` 或 `content`
- **THEN** 接口返回 `400`，提示具体缺失字段

### Requirement: Case Text Report Management
系统 MUST 为每个病例提供文字病历的增删改查能力，并在 `GET /cases` 中返回这些数据。

#### Scenario: List reports with cases
- **WHEN** 客户端请求 `GET /cases`
- **THEN** 每个病例对象包含 `reports: CaseReport[]`，字段至少包括 `id`, `title`, `summary`, `content`, `tags`, `created_at`
- **AND** 同一病例内的 `reports` SHALL 按稳定的排序字段升序返回；若部分记录缺少排序值，则这些记录按照 `created_at` 逆序附加在已排序列表之后

#### Scenario: CRUD endpoints
- **WHEN** 客户端访问：
  - `GET /cases/{caseId}/reports`
  - `POST /cases/{caseId}/reports`
  - `PATCH /cases/{caseId}/reports/{reportId}`
  - `DELETE /cases/{caseId}/reports/{reportId}`
- **THEN** 服务返回 200/201/204，并对不存在的病例或报告返回 404（含 message）
- **AND** `GET /cases/{caseId}/reports` SHALL 使用与聚合视图相同的排序规则（先按排序字段，再按时间兜底）

### Requirement: Demo Text Case Catalog
系统 MUST 提供至少 3 条官方示例文字病历，便于导入演示。

#### Scenario: Load demo case set
- **WHEN** 用户在前端点击“加载示例病历”
- **THEN** 导入表单被填充为我们预置的 3 条中文病历（含建议 identifier/title/content），用户可直接提交

#### Scenario: Inspect demo data source
- **WHEN** 开发者查阅仓库文档或源码
- **THEN** 能找到 `demoTextCases`（或同名）文件，清晰记录示例文本及字段说明

### Requirement: Case Sample Analysis Association (Tissue Only)
病例样本（`cases` → `case_samples`）对于 `modality='组织切片'` SHALL 具有关联的分析结果对象 `analysis`，包含：
- 原始指标（a–i）与单位
- 衍生指标（a–e）与单位
- 图像路径（原始/解析）

#### Scenario: List cases with tissue analysis
- WHEN 客户端请求 `GET /cases`
- THEN 返回的每个“组织切片”样本对象包含 `analysis` 字段（存在时）；其他模态不包含或为 `null`

#### Scenario: Fetch sample analysis by id
- WHEN 客户端请求 `GET /cases/{caseId}/samples/{sampleId}/analysis`
- THEN 返回与 `GET /cases` 聚合字段一致的分析对象；不存在时返回 404（含 message）

### Requirement: Aggregation and Filtering Rules
列表聚合 SHALL 仅在 `modality='组织切片'` 且存在分析数据时附加 `analysis`；非组织切片或无分析数据不附加。返回顺序与现有样本排序一致。

#### Scenario: Mixed modality cases
- WHEN 同一病例包含 CT/核磁/组织切片
- THEN 仅组织切片样本拥有 `analysis`，其它样本 `analysis` 缺省
- AND 样本列表在同一病例内按稳定的排序字段升序返回；若部分记录缺少排序值，则这些记录按照 `created_at` 逆序附加在已排序列表之后

### Requirement: Stable Ordering for Samples and Reports
系统 MUST 为每个病例内的样本与文字病历提供可持久化的排序能力，以支持前端拖拽后顺序保持稳定。

#### Scenario: Default ordering compatible with existing data
- **GIVEN** 系统中已存在若干病例及其样本/报告
- **WHEN** 部署排序能力而未进行任何手动重排
- **THEN** 每个病例中的样本与报告在 UI 中的显示顺序 SHALL 与变更前一致（例如按创建时间倒序），且排序字段的初始赋值与该默认顺序一致

#### Scenario: Persisted ordering after reorder
- **GIVEN** 某病例下存在至少 3 条文字病历
- **WHEN** 客户端通过排序 API 提交新的 ID 顺序
- **THEN** 后端 SHALL 更新对应记录的排序字段
- **AND** 后续所有 `GET /cases` 与 `GET /cases/{caseId}/reports` 返回中，报告顺序 SHALL 与新的排序一致

### Requirement: Samples and Reports Reorder API
系统 SHALL 提供用于重排同一病例内样本和文字病历的 API 端点，接收有序 ID 列表并更新排序字段。

#### Scenario: Reorder case reports
- **WHEN** 客户端发送 `PUT /cases/{caseId}/reports/order` 请求，主体包含该病例所有报告的 ID 列表，且列表长度与当前报告数一致、ID 集合完全相同
- **THEN** 服务 SHALL 在事务中按列表顺序更新每条报告的排序字段
- **AND** 若列表缺失、重复或包含其他病例的 ID，服务 SHALL 返回 `400` 并附带错误说明

#### Scenario: Reorder case samples
- **WHEN** 客户端发送 `PUT /cases/{caseId}/samples/order` 请求，主体包含该病例所有样本的 ID 列表，且列表长度与当前样本数一致、ID 集合完全相同
- **THEN** 服务 SHALL 在事务中按列表顺序更新每个样本的排序字段
- **AND** 若列表缺失、重复或包含其他病例的 ID，服务 SHALL 返回 `400` 并附带错误说明

### Requirement: Controlled File Storage Paths

系统 MUST 在文件写入、移动和删除前规范化存储路径，并确认解析后的目标位于配置的 `UPLOADS_ROOT` 边界内。系统 MUST 拒绝绝对路径、路径穿越、根目录外目标以及会通过符号链接逃逸的路径；边界判断 MUST 使用路径解析和分隔边界，不能只使用字符串前缀。

#### Scenario: Reject traversal and absolute storage paths

- **WHEN** 文件操作收到包含 `..`、编码后路径穿越、或绝对路径的存储 key
- **THEN** 操作失败且不读取、写入或删除存储根目录之外的文件

#### Scenario: Reject symlink escape

- **GIVEN** 存储根目录或其受控子目录下存在指向根目录外的符号链接
- **WHEN** 文件操作通过该链接访问目标
- **THEN** 操作失败且根目录外的目标文件保持不变

### Requirement: Unique Non-Overwriting File Commit

系统 MUST 为每个新文件生成由后端控制的不可预测唯一物理文件名，原始文件名 MUST NOT 决定正式物理路径。系统 MUST 使用受控临时目录和独占创建写入，并使用经过目标平台/文件系统验证的原子 no-replace 发布完成写入。普通 `rename` 或“先检查目标不存在，再 rename”不得作为防覆盖保证；目标已存在时 MUST 拒绝覆盖。若无法验证 no-replace 语义，系统 MUST 失败关闭。

#### Scenario: Duplicate logical uploads remain distinct

- **WHEN** 同一病例、模态、序号或原始文件名被重复或并发上传
- **THEN** 每个成功保存的文件拥有不同的受控存储路径，且每个文件内容完整对应其上传内容

#### Scenario: Existing target is preserved

- **GIVEN** 随机生成的正式目标或测试指定目标已经存在
- **WHEN** 保存操作尝试提交该文件
- **THEN** 操作失败或报告冲突，已有文件内容不发生变化

#### Scenario: Concurrent commit does not replace a winner

- **GIVEN** 多个并发请求尝试提交不同内容到同一逻辑目标
- **WHEN** 它们同时执行正式文件发布
- **THEN** 至多一个请求发布到该目标，其他请求收到冲突或失败，胜者内容保持完整且不被替换

#### Scenario: Interrupted write leaves no formal partial file

- **WHEN** 临时文件写入或原子移动在提交完成前失败
- **THEN** 正式路径不出现半成品，临时文件按错误路径清理，已有文件不被替换

#### Scenario: Staging directory is not publicly served

- **GIVEN** 存储根目录包含受控临时目录 `.staging`
- **WHEN** 客户端请求 `/uploads/.staging/<temporary-name>`
- **THEN** 静态访问拒绝该路径，同时合法旧文件和新正式文件仍按 `/uploads/<filename>` 可访问

#### Scenario: Unsupported no-replace primitive fails closed

- **GIVEN** 目标平台或文件系统无法证明 `fs.link` 或等价原生 no-replace 原语具备独占、不替换语义
- **WHEN** 系统尝试发布新文件
- **THEN** 发布失败并保留已有目标内容，系统不得回退到普通 `rename` 或“先检查再 rename”，且诊断不泄露服务器绝对路径

#### Scenario: Filesystem publication errors fail closed

- **WHEN** no-replace 发布返回 `EEXIST`、`EXDEV`、`EPERM` 或等价的不支持/权限错误
- **THEN** 系统报告失败或冲突，绝不覆盖已有正式文件；跨文件系统或权限不支持时不得降级为普通 `rename`，并按责任边界清理当前请求持有的 staging 名称

### Requirement: Legacy File URL Compatibility

系统 MUST 保留现有 `case_samples.storage_path` 和 `storage_thumbnail` 字段格式、API 响应字段及 `/uploads` URL 访问方式。现有合法旧路径 MUST 在不迁移文件和不修改 Schema 的情况下继续可读取和可删除；新路径 MUST 使用相同的 `/uploads/<filename>` 公共路径格式。

#### Scenario: Existing case image remains addressable

- **GIVEN** 数据库中已有合法 `/uploads/<legacy-name>` 路径
- **WHEN** 客户端按现有 `caseService` 逻辑将其解析为图片 URL
- **THEN** URL 格式和静态访问行为保持兼容

#### Scenario: New image uses the existing public contract

- **WHEN** 新文件保存成功并写入现有样本记录
- **THEN** 响应继续返回 `storage_path` 和 `storage_thumbnail`，其值为 `/uploads/<new-controlled-name>`，且不泄露服务器绝对路径

### Requirement: Storage Failure Cleanup Boundaries

系统 MUST 只清理由当前存储调用创建并持有的 staging 临时名称；临时写入、no-replace 发布或后续清理失败时，正式路径 MUST 不出现半成品且已有文件 MUST 不被删除或覆盖。数据库事务回滚后的已发布正式孤儿文件 MUST 保留为后续文件状态机/清理 Change 的责任，不得由本 Change 的回滚处理器通过猜测路径删除。

#### Scenario: Failed staging write cleans only owned temporary file

- **WHEN** 当前请求在 staging 写入或发布前失败
- **THEN** 当前请求创建的临时文件被尽力清理，其他请求的 staging/正式文件保持不变，并记录清理阶段诊断

#### Scenario: Database rollback does not guess-delete formal files

- **GIVEN** 正式 no-replace 发布成功后数据库事务回滚
- **WHEN** 请求执行回滚处理
- **THEN** 正式文件不因猜测归属而被删除；该正式孤儿被记录为后续状态机/清理 Change 的输入

