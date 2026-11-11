## Why

CancerApp 当前没有用户身份、可撤销会话或账户状态基础。后续病例授权和受保护图片访问需要独立的服务端认证能力，但当前业务接口仍存在匿名访问旁路。

## What Changes

- 新增用户名账户模型，去除首尾 ASCII 空白、使用 Unicode NFKC 和与 locale 无关的 `toLowerCase()`，以唯一约束保存；不承诺完整 Unicode case-fold。
- 新增 `users`、`sessions` 的显式版本化迁移。
- 使用 Argon2id（memory 64 MiB、time cost 3、parallelism 1）保存密码哈希。
- 使用高熵随机会话 token，通过 HttpOnly Cookie 传递，服务端只保存 token 哈希。
- 支持绝对/空闲过期、撤销、登录轮换和禁用账户即时失效。
- 增加 `authenticateRequest`、Origin/CSRF 防护和认证测试。
- Electron 开发和打包首期使用受控 localhost 页面来源；退出回归已验证，不把 `file://` 或 `null` Origin 作为已支持的认证来源。

- 增加登录、登出、当前会话、修改密码和账户状态检查。

## Impact

- Affected specs: `user-authentication-sessions`。
- Database: 只新增认证表和迁移版本记录，不增加 `cases.owner_user_id` 或 `case_access`。
- Existing routes: 本 Change 只保护认证、账户和会话接口；`/cases`、`/uploads`、`/ai` 仍可能绕过登录。
- Electron 客户端需要使用 Cookie 会话和 `credentials: include`。

## Non-Goals

- 不实现病例所有权、病例级授权、病例共享或 `case_access`。
- 不实现正式图片下载接口、关闭或替换 `/uploads`。
- 不实现 AI 配置/聊天权限、微信登录、SSO、Python AI、模型训练、依赖升级或前端大规模重构。
- 不物理删除用户，只禁用并保留审计记录。
- Windows/NTFS 的恢复权限策略不属于本 Change，由后续跨平台 Change 处理。

## Deployment Boundary

本 Change 仅提供应用层认证和会话基础，不提供可用于生产的管理员初始化或恢复流程。生产初始化、恢复、OS 权限、运行目录、生命周期锁及备份恢复演练属于后续独立 Change `secure-admin-bootstrap-and-recovery`，本次不创建。该后续 Change 完成前不得真实部署或使用真实患者数据；恢复不得通过 HTTP、Electron renderer、IPC 或普通应用接口触发。`/cases`、`/uploads`、`/ai` 和病例、图片及 AI 授权仍属后续工作。隔离数据库迁移、打包 Electron localhost 登录/退出和支持设备 Argon2 性能已有验收记录。临时目录 flock 测试不是生产权限验证。
