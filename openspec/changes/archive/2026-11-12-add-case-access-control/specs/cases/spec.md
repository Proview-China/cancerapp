## ADDED Requirements

### Requirement: Case Ownership and Explicit Capabilities

每个临床病例 MUST 恰有一个 owner。管理员 MUST 可访问全部病例；管理员或启用的病理医生创建病例时，服务端 MUST 将当前用户设为 owner，owner 拥有 read、edit、upload 能力。客户端 MUST NOT 指定或覆盖创建者 owner。管理员 MUST 可向其他启用病理医生显式授予和撤销 `read`、`edit`、`upload`；研究人员 MUST 不得访问临床病例 API，即使存在显式授权记录。显式授权 MUST 按病例、用户和能力保持唯一有效记录；`edit` 与 `upload` 只有在同一用户具有有效 `read` 时才有效。撤销 `read` MUST 同事务撤销其依赖的 `edit`/`upload`；后续重新授权 MUST 创建保留历史的新授权记录。所有权转交不属于本能力。

#### Scenario: Creator becomes owner
- **WHEN** 已启用管理员或病理医生创建病例
- **THEN** 服务端将当前用户设为唯一 owner，忽略或拒绝客户端提供的 owner，owner 可读取、编辑、上传

#### Scenario: Administrator accesses all cases
- **WHEN** 管理员请求任意病例
- **THEN** 管理员可读取、编辑和上传该病例内容

#### Scenario: Explicit grant dependency and regrant
- **GIVEN** 管理员向病理医生授予病例能力
- **WHEN** 授予 edit 或 upload，或撤销 read 后再重新授权
- **THEN** edit/upload 仅在有效 read 同时存在时生效；read 撤销原子撤销依赖能力；重新授权保留旧撤销记录并建立唯一的新有效记录

#### Scenario: Researcher cannot access clinical cases
- **GIVEN** 当前用户角色为 researcher，授权数据中即使存在异常 grant
- **WHEN** 用户调用任一临床病例接口
- **THEN** 请求被拒绝且不返回病例或子资源信息

### Requirement: Case API Authorization and Non-Disclosure

系统 MUST 在服务端对病例列表、病例详情/创建/更新/删除、样本读写/删除、文字报告读写/删除、样本和报告排序及分析汇总执行病例级授权。列表 MUST 在数据库查询层过滤到管理员全部病例或病理医生拥有/有效 read 授权的病例。子资源操作 MUST 验证资源属于 URL 中的 caseId。缺失病例与当前用户无权访问的病例 MUST 返回相同状态码和等价响应体，不泄露病例存在性。删除病例、样本和文字报告 MUST 仅允许管理员，并记录最小审计记录。所有状态变更 MUST 复用现有 Origin 和 session-bound CSRF 校验。

#### Scenario: Authorized list is filtered before response
- **WHEN** 病理医生请求病例列表
- **THEN** 仅返回其拥有或具有有效 read 授权的病例及这些病例关联的样本、报告和分析汇总

#### Scenario: Child resource belongs to another case
- **GIVEN** sampleId 或 reportId 属于不同于 URL caseId 的病例
- **WHEN** 请求读取或修改该子资源
- **THEN** 服务拒绝请求，不读取或修改跨病例数据，并对缺失与无权资源使用统一响应语义

#### Scenario: Delete is administrator-only and audit survives case deletion
- **WHEN** 病理医生尝试删除病例、样本或报告，或管理员执行删除
- **THEN** 病理医生请求被拒绝且无状态改变；管理员成功删除并在同一事务中写入不含临床正文和凭据的审计记录，病例删除后该审计记录仍可查询

#### Scenario: State-changing request requires existing CSRF proof
- **WHEN** 病例或授权状态变更请求缺少有效允许 Origin 或 session-bound CSRF proof
- **THEN** 服务在任何状态改变前拒绝请求

### Requirement: Existing Case Sample Append Requires Upload Capability

系统 MUST 提供独立的已有病例样本追加接口；该接口 MUST 要求当前用户具有病例 `upload` 能力并通过现有 Origin/session-bound CSRF 校验。`POST /cases` 的 identifier 冲突 MUST NOT 用作已有病例样本追加路径。

#### Scenario: Authorized append to an existing case
- **GIVEN** 用户对已有病例具有有效 upload 能力
- **WHEN** 用户通过独立追加接口提交样本并提供有效 Origin 与 CSRF proof
- **THEN** 样本关联到路径指定病例；缺失能力或 CSRF proof 时不写入样本或文件关联

### Requirement: Identifier Conflict Cannot Mutate or Disclose Existing Case

`POST /cases` MUST 将 `identifier` 冲突作为原子冲突拒绝，不得更新既有病例字段或 owner，不得追加样本、报告或文件关联，并不得返回既有病例内容。相同 identifier MUST NOT 构成病例访问授权。

#### Scenario: Same identifier submitted by another pathologist
- **GIVEN** identifier 已属于另一个病例 owner
- **WHEN** 其他用户以相同 identifier 创建病例并附带样本或报告
- **THEN** 请求返回冲突类响应，现有病例、owner、样本、报告和文件关联保持不变，响应不泄露现有病例信息

#### Scenario: Same identifier submitted by unauthorized caller
- **GIVEN** 当前主体不是可创建病例的启用病理医生或管理员
- **WHEN** 主体尝试以已存在的 identifier 创建病例
- **THEN** 请求被拒绝且不得借冲突路径读取、更新或追加现有病例内容

### Requirement: Explicit Legacy Case Ownership Migration

系统 MUST 通过独立版本化迁移为每个旧病例指定一个明确映射到的启用管理员 owner。迁移 MUST 在单个数据库事务中执行并核对病例数量、owner 覆盖与身份/启用状态及样本、报告、分析关联数量。缺少映射、管理员未启用、核验不一致或执行失败 MUST 回滚并失败关闭；不得自动猜测管理员或恢复无鉴权病例 API 作为回退。

#### Scenario: Legacy migration with explicit mapping
- **GIVEN** 完整旧病例映射指向明确且启用的管理员，迁移前后数量及关联核验一致
- **WHEN** 执行版本化迁移
- **THEN** 全部旧病例在同一事务中获得指定 owner，迁移版本与映射核验记录提交

#### Scenario: Invalid mapping or failed verification
- **GIVEN** 映射缺失、管理员禁用或病例/关联核验发生差异
- **WHEN** 迁移执行
- **THEN** 整个事务回滚，不留下部分 owner 赋值，迁移失败关闭且不开放匿名病例访问

### Requirement: Minimal Frontend Authorization Integration

桌面客户端 MUST 使用现有认证 Cookie 会话和 session-bound CSRF 流程调用病例 API，并区分未登录与无权响应。客户端 MUST 可依据服务端返回的有效能力显示编辑、上传和删除操作；服务端授权仍是最终判定。此 Change MUST NOT 要求新增完整授权管理界面。

#### Scenario: Client reflects server capability and handles denial
- **WHEN** 客户端加载当前用户可访问的病例及能力，或请求返回未登录/无权响应
- **THEN** 客户端仅显示对应能力操作并按状态提供登录/拒绝反馈，绕过或篡改界面仍不能绕过服务端授权

### Requirement: Case Access Control Boundary

本 Change MUST NOT 声称直接 `/uploads` 图片访问、AI 接口、研究数据集或整体系统已经受病例授权保护。图片下载保护、关闭 `/uploads`、AI 权限、研究数据和脱敏属于后续 Change；这些边界完成前不得宣称系统适用于真实患者数据或多人生产部署。

#### Scenario: Case API authorization does not imply whole-system protection
- **WHEN** 病例 API 授权 Change 已实施但图片静态访问或 AI 授权尚未完成
- **THEN** 文档和产品安全声明明确记录这些未保护边界，不把病例 API 授权表述为整体安全
