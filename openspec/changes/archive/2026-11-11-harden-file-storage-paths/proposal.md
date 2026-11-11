## Why

当前上传流程根据病例标识、模态和样本序号拼接物理文件名，并直接在 `UPLOADS_ROOT` 执行 `writeFile`。重复导入、并发请求或异常恢复可能覆盖已有文件；删除路径也没有对规范化后的目标执行存储根目录和符号链接边界校验。该行为会造成文件内容与病例记录不一致，并暴露路径穿越风险。

## What Changes

- 为所有文件存储和删除操作建立受控路径解析流程：规范化输入，拒绝绝对路径、路径穿越和根目录外目标，并检查目录组件和目标文件的符号链接逃逸。
- 新上传文件使用由后端生成的不可预测唯一名称；原始文件名继续只用于现有展示字段和 API 数据，不参与物理存储路径生成。
- 使用受控临时目录和独占创建写入；文件关闭后使用经平台验证的原子 no-replace 发布（首选 `fs.link` 创建正式硬链接后删除临时名称），禁止把普通 `rename` 或“先检查再 rename”作为防覆盖保证。
- 保留现有 `case_samples.storage_path` 字段格式、API 响应、数据库字段和 `/uploads` 静态访问方式，使既有旧文件路径继续可用。
- 增加针对路径穿越、绝对路径、符号链接、重复文件名和并发写入的自动化测试。
- 明确失败清理责任：本次请求创建的 staging 临时文件由存储操作负责尽力清理；已成功发布的正式文件不由数据库回滚路径删除，数据库回滚后遗留的正式孤儿文件归后续文件状态机/清理 Change 处理。
- 将逻辑路径解析测试与真实文件系统提交测试分开，后者必须在目标文件系统上验证 `fs.link` 的 no-replace、权限和跨文件系统失败关闭行为。

本 Change 不新增或修改数据库 Schema，不迁移旧文件，不关闭 `/uploads`，也不实现文件状态机、正式孤儿清理任务、图片内容校验或认证授权。

## Impact

- Affected specs: `cases`（文件样本存储与访问兼容要求）
- Affected code: `backend/src/utils/fileStorage.ts`、`backend/src/routes/cases.ts`、`backend/src/server.ts`（仅验证静态目录边界假设）、`frontend/src/services/caseService.ts`（兼容性回归验证）、`backend/tests/`（文件存储测试）
- Database: 无表、字段或数据迁移；旧的 `storage_path` 值保持原样。

实现限制：Node 的 `fs.rename` 没有跨平台 no-replace 选项。若目标平台/文件系统无法验证 `fs.link` 或原生 no-replace 原语，必须失败关闭，不能回退到可能覆盖目标的普通 rename；拥有存储根目录写权限的本地攻击者造成的全部 TOCTOU 风险仍需原生句柄相对路径能力解决。
