## Context

CancerApp 优先部署于 Electron 单机，并预留内网部署。当前 `backend/src/app.ts` 挂载 `/cases`、`/uploads`、`/ai`，而 `frontend/electron/main.cjs` 的开发页面是 `http://localhost:5173`，打包页面是 `file://`。本 Change 只建立认证基础，不改变业务资源授权。

## Goals / Non-Goals

### Goals

- 建立 admin、pathologist、researcher 三类账户。
- 提供可撤销服务端 Cookie 会话和账户状态。
- 固定认证迁移、密码和会话安全边界。

### Non-Goals

- 病例所有权/授权、正式图片保护、`/uploads` 替换、AI 权限。

## Decisions

### 1. 用户和账户

登录标识固定为用户名：去首尾 ASCII 空白、Unicode NFKC、稳定的 `toLowerCase` 并再次 NFKC；规范化值唯一保存，空值、控制或格式控制字符及超过 64 个 Unicode 字符拒绝。不承诺完整 Unicode case-fold，复杂等价规则留待国际化 Change。角色只允许 `admin`、`pathologist`、`researcher`。账户只禁用、不物理删除；管理员不能自禁用，系统不能禁用最后一个启用管理员。操作在事务中锁定管理员计数，防止并发移除最后管理员。

### 2. 密码和部署边界

使用 Argon2id，memory 64 MiB、time cost 3、parallelism 1；支持设备的耗时和峰值内存记录见 `docs/acceptance/2026-11-11-authentication.md`。生产管理员初始化、密码恢复、受控 OS 身份、`/run/cancerapp`、生产生命周期锁、备份恢复演练和多 OS 身份验证移至后续 `secure-admin-bootstrap-and-recovery`。当前不提供可用于生产的管理员恢复；后续 Change 完成前不得真实部署或使用真实患者数据。不得通过 HTTP、Electron renderer、IPC 或普通应用接口触发管理员恢复。临时目录 flock 测试不证明生产权限。

### 3. 会话生命周期

使用密码学随机源生成至少 32 字节 token，Cookie 携带原值，数据库只保存 SHA-256(token) 十六进制哈希。每次登录生成新会话；绝对过期 24 小时，空闲过期 2 小时，绝对期限不能被刷新。登出撤销当前会话并清 Cookie；改密、禁用撤销全部会话，客户端重新登录。登录失败统一为 401；用户名第 1 至第 5 次失败仍返回统一认证失败，第 6 次尝试起在 15 分钟窗口内限流；成功登录清除该用户名失败计数。来源维度每 60 秒最多 30 次尝试；单机直接按客户端地址计数，只有显式配置可信代理时才解析转发头，否则按代理地址计数。多进程/内网限速需后续部署验证，不得将内存计数器宣称为多节点方案。

### 4. Cookie、Electron 和 CSRF

首选方案是让 Electron 开发和打包页面都从受控 localhost 来源加载：开发环境使用现有 Vite 地址，打包环境由本机后端提供固定绑定回环地址的页面或等价受控静态页面，并使用显式 API 地址。生产监听端口、页面启动时序和打包资源交付必须在实施阶段验证；当前 `file://` 行为未验证。该方案提供明确 HTTP Origin，避免把 `null` Origin 加入白名单；代价是本机端口、启动时序和资源交付需要维护。

备选 A 保留 `file://`：必须先验证 Cookie 保存、`Origin: null`、凭据发送和 CSRF 行为，首期不选用。备选 C 使用自定义安全协议或 preload 代理，可提供受控来源，但会增加 IPC、协议和打包测试面，留待独立设计。不得使用长期 localStorage token 或简单放开 `null` Origin。

客户端使用 `credentials: 'include'`。Cookie 为 HttpOnly、SameSite=Lax、Path=/，不设宽泛 Domain；首期回环 HTTP 使用 Secure=false，未来 HTTPS 内网必须 Secure=true。只允许配置的开发 localhost Origin 和打包 localhost Origin，缺失、`null`、不可信 Origin 的状态变更请求一律拒绝。

CSRF 使用两阶段同步令牌：`GET /auth/csrf` 在匿名阶段生成短期高熵令牌，通过非 HttpOnly、SameSite=Lax、Path=/ 的 CSRF Cookie 和 JSON 返回值交付；登录请求必须通过允许 Origin 校验，并验证 `X-CSRF-Token` 与 CSRF Cookie 一致。登录成功后轮换令牌并将其哈希绑定到新会话；会话令牌可用于连续状态变更，不因正常验证而消费。登出、改密、禁用和会话过期使旧令牌失效；缺失、不一致、过期或跨会话令牌均拒绝且不得产生状态变化。前端读取引导响应中的令牌，并通过 `credentials: 'include'` 和请求头发送。

当前打包 `file://` 的 Cookie/Origin 行为未验证。若不可靠，候选为受控 localhost 页面或自定义安全协议/preload 代理；需用户批准和实际测试，不改用长期 localStorage token。

### 5. 保护边界

本 Change 保护登录、登出、当前会话、修改密码、管理员账户启停。`/cases`、`/uploads`、`/ai` 保持现状，可能匿名访问。病例授权、正式图片接口、AI 权限是后续 Change；认证完成不等于整体受保护，仍禁用于真实患者数据。

### 6. 数据模型与迁移

`users` 包含 id、规范化 username、password_hash、role、is_active、created_at、updated_at、last_login_at、password_changed_at；username 唯一，role/status 有检查约束。

`sessions` 包含 id、user_id、token_hash、expires_at、last_seen_at、created_at、revoked_at；token_hash 唯一，建 `(user_id, expires_at)`、`(user_id, revoked_at)` 索引，user_id 外键引用 users.id。认证迁移有版本号、单事务、迁移前备份和对象清单，只新增认证对象，不修改业务表，不依赖普通 GET 的 `db/init.ts`。失败回滚事务或恢复备份；测试只用隔离库，禁止连接/初始化 5432。

### 7. 测试

覆盖用户名规则、最后管理员保护、哈希参数、会话生命周期、限速、Cookie/credentials、Origin/CSRF、日志脱敏、迁移回滚及明确的认证旁路边界。Electron 开发/打包行为必须记录来源、API、Cookie 和失败原因，当前均待环境验证。

## Risks / Trade-offs

- Cookie 便于撤销但需要 CSRF；Argon2id 有内存成本。
- `file://` 行为未验证，优先受控 localhost 页面，不关闭安全检查。
- 认证后业务接口仍可能匿名访问，必须保留真实患者数据禁用限制。

## Migration and Rollback Plan

1. 在隔离测试库确认目标不是 5432，备份并记录对象清单。
2. 单事务执行版本化认证迁移，确认只新增认证对象。
3. 运行认证约束和回滚测试。
4. 失败时回滚事务；超出事务边界则停止并恢复备份，不删除业务表或病例数据。
5. 通过后才受控部署，普通 GET 不初始化认证表。

## Open Questions Requiring Approval

- 是否接受用户名规范化规则、Argon2id 参数及 24h/2h 会话期限？
- 是否接受管理员不可自禁用/物理删除/禁用最后管理员？
- 是否接受 5 次/15 分钟和 30 次/分钟限速？
- 是否接受首期开发和打包均使用受控 localhost 页面并暂不承诺 `file://`？
- 未来内网是否强制 HTTPS，最终 Origin 白名单是什么？

### Rate-limit Boundary

限流响应状态、`Retry-After` 和统一响应体必须固定并测试。禁用账户仍使用统一失败响应并计入用户名限流；来源地址只有在显式可信代理配置下才使用转发头。

隔离测试数据库迁移、打包 Electron 的 localhost 登录/退出回归和支持设备 Argon2 性能已经有验收报告。生产管理员初始化、恢复和真实患者数据部署仍被后续 Change 阻止。
