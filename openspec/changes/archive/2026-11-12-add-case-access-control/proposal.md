## Why

认证 Change 已提供账户、会话和 CSRF 基础，但病例及其样本、文字报告和分析汇总仍没有病例级授权。`POST /cases` 还会按 `identifier` 冲突更新病例，因此仅在路由入口追加登录校验不足以防止跨病例读写和同编号越权。

## What Changes

- 为病例建立单一 owner、病理医生显式授权及最小审计记录；管理员可访问全部病例，研究人员不得访问任何临床病例接口。
- 只授予 `read`、`edit`、`upload` 三种能力；`edit` 和 `upload` 依赖有效 `read`。管理员独占授权管理及病例、样本、文字报告删除。
- 对病例列表和全部病例、样本、报告、排序及分析汇总接口实施后端授权；未登录仍由现有认证中间件处理，病例不存在与当前用户无权访问统一响应。
- 对创建接口的 identifier 冲突执行拒绝，不得更新既有病例、追加样本/报告、变更 owner 或泄露既有病例信息。
- 管理员和病理医生创建病例时均由服务端将当前用户设为 owner；已有病例追加样本使用独立接口并要求 upload 能力和既有 CSRF 校验。
- 确保病例删除后审计记录仍保留，不受病例外键级联删除影响。
- 通过独立版本化迁移，将全部旧病例映射到显式指定且启用的管理员；映射、数量和关联核验失败时事务回滚并失败关闭。
- 前端最小接入现有 Cookie 会话和 CSRF 流程，处理未登录/无权响应，并按服务端返回能力显示操作；不新增授权管理界面。

## Impact

- Affected specs: `cases`（病例访问控制、删除和审计）。
- Affected code: backend case routes and authorization/migration services; desktop case service and operation visibility; focused backend and frontend tests.
- Database: add owner/access-grant/audit objects and an independent versioned data migration; do not change the authentication schema or file-storage schema.

## Non-Goals

- 不提供所有权转交、删除审批或授权管理界面。
- 不保护直接 `/uploads` 图片下载、不关闭静态文件访问，不增加 AI 权限。
- 不授权研究人员访问临床病例；研究数据集、脱敏和原图例外另行设计。
- 不包含生产管理员 bootstrap/recovery、Windows 支持或其他延期的生产治理。

## Security Boundary

本 Change 只建立病例 API 的病例级授权，不代表图片静态访问、AI 或整个系统已安全。现有 `/uploads` 和 AI 路由仍可能绕过病例授权；在后续图片访问保护及其他适用治理完成前，不得据此宣称可用于真实患者数据或多人生产部署。
