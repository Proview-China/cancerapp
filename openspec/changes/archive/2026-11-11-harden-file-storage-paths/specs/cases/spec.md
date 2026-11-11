## ADDED Requirements

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
