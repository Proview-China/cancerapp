## Status — 2026-11-12（固定对话3维护）

依据 `evidence-2026-11-12.md` 的对话4分层验证记录和对话5窄范围复核结论同步。勾选表示对应任务已有记录证据；对话5独立复核限于两处前端修复和测试补强，并未重演 UI。对话4报告的真库、替身、构建和页面结果不归为对话5独立验证。证据边界及未覆盖项见 handoff/evidence；未重跑检查。

## 1. Authorization data and migration

- [x] 1.1 Add case owner, active/revocable read/edit/upload grants, and minimal append-only access audit records with foreign keys, checks, and active-grant uniqueness.
- [x] 1.2 Implement one shared effective-capability policy: owner/admin rules, enabled pathologist recipient limit, edit/upload require read, researcher hard denial, and transactional dependent-grant revocation/regrant history.
- [x] 1.3 Add an independent versioned migration requiring an explicit legacy-case-to-enabled-admin mapping; never infer or auto-select the administrator.
- [x] 1.4 In one transaction assign legacy owners and verify case count, exact owner coverage/identity/status, mapping coverage, and unchanged sample/report/analysis associations; inject failures and assert full rollback/fail-closed behavior. Evidence: dialog 4 reports PostgreSQL 16 transaction failure cases and a successful protected CLI migration on synthetic schema; dialog 5 narrowly reviewed transaction/CLI reuse and exact owner verification, without independently rerunning database work.

## 2. Backend case API enforcement

- [x] 2.1 Apply authentication and authorization to every case list/detail/create/update/delete, sample read/write/delete, report read/write/delete, ordering, analysis-summary, and other case-scoped route.
- [x] 2.2 Filter list rows in the database to admin-visible and owner/read-granted cases; ensure aggregate sample/report/analysis queries use only that authorized case set.
- [x] 2.3 Validate sample/report membership against both route caseId and child ID; return the same status and equivalent response for missing and unauthorized cases/resources.
- [x] 2.4 Require admin for case/sample/report deletion and for grant/revoke operations; record successful deletes and grant changes transactionally, with no delete-approval workflow.
- [x] 2.5 Harden POST /cases identifier conflict using atomic conflict rejection; verify conflict cannot mutate an existing case/owner, append sample/report records, publish/associate files, or return existing-case data.
- [x] 2.6 Add a dedicated existing-case sample append endpoint and frontend service call; require upload capability and reuse existing Origin/session-bound CSRF protection. Never use identifier conflict as an append path.
- [x] 2.7 Reuse existing Origin and session-bound CSRF middleware for every other state-changing case and grant endpoint; add no authentication or CSRF bypass.

## 3. Minimal frontend integration

- [x] 3.1 Update the case service to send Cookie credentials and obtain/send the existing session-bound CSRF token for state changes.
- [x] 3.2 Handle unauthenticated and forbidden responses and render edit/upload/delete controls from server-returned effective capabilities; keep server authorization authoritative.
- [x] 3.3 Do not add a full grant-management interface; document the supported server-side grant operations for a later UI change.

## 4. Focused acceptance

- [x] 4.1 Test role/capability matrix for admin, owner pathologist, read-only, read+edit, read+upload, all three capabilities, ungranted pathologist, and researcher with/without an anomalous grant. Policy unit tests and HTTP owner, hidden pathologist, researcher denial and admin-grant cases pass.
- [x] 4.2 Test cross-case ID substitution for case, sample, report, order and analysis endpoints; assert no data disclosure or mutation and consistent missing/forbidden behavior. Evidence: dialog 4 reports cross-case sample/report/order/analysis coverage; dialog 5 narrowly reviewed the focused coverage. No claim that dialog 5 reran real-database or UI tests.
- [x] 4.3 Test same-identifier create conflict for existing owner, metadata, samples, reports, file references, and response disclosure under authorized and unauthorized callers. Evidence: dialog 4 reports tests preserving an existing sample/file reference and rejecting an unauthorized researcher collision; dialog 5 reviewed the test additions in its narrow scope.
- [x] 4.4 Test admin and pathologist case creation assign owner from authenticated current user; test existing-case append requires upload capability and valid Origin/CSRF. Synthetic owner and append/denial HTTP cases pass; global Origin/CSRF gate is table-driven for state-changing routes.
- [x] 4.5 Test grant uniqueness, edit/upload dependency, read revocation cascading to dependent grants, immediate denial after revoke, and later regrant preserving audit history. HTTP tests exercise read/edit/upload grants, revoke cascade, regrant history, and access denial after revocation; the database active-grant partial unique index enforces uniqueness.
- [x] 4.6 Test every state-changing case/grant request with missing, invalid, expired and valid session-bound CSRF proof and allowed/disallowed Origin. Router table verifies every mutating route rejects invalid proof and disallowed/missing Origin; valid proof paths are covered by successful mutation HTTP cases. Token expiry/binding semantics are covered by shared CSRF tests.
- [x] 4.7 Test deletion/admin-only grant administration and audit transaction behavior; audit failure must roll back the associated mutation, deletion audit must remain queryable after case deletion, and audit records must omit clinical content and credentials.
- [x] 4.8 Test legacy migration success against an explicit enabled-admin mapping and failure rollback for missing/disabled admin, incomplete mapping, count mismatch, association mismatch and injected SQL failure. Evidence: dialog 4 reports synthetic PostgreSQL rollback variants and successful protected CLI migration; dialog 5 narrowly reviewed migration implementation/tests, not an independent database rerun.
- [x] 4.9 Run existing authorized case workflows for list, create with samples/reports, append samples, edit, upload, ordering, analysis summary and admin deletion; verify unauthorized paths remain rejected. Evidence: dialog 4 reports Vite page/real-session workflow and authenticated browser API checks for append, edit, ordering, analysis, denial and deletion. Some image append/sort actions used page-context fetch rather than UI buttons. Dialog 5 did not independently replay UI; this evidence is attributed to dialog 4.
- [x] 4.10 Run focused backend tests and backend build plus the affected frontend build; report results without treating UI checks as authorization enforcement. Evidence: dialog 4 reports backend 70 passed/10 opt-in skips, separate PostgreSQL 10 passed, backend build, latest frontend TypeScript/Vite build, strict OpenSpec validation and diff check passed. Dialog 5 read existing logs and ran the narrow 17-test set; it did not rerun the full suite, PostgreSQL suite or builds.

## Boundaries

`/uploads` direct static access, image download authorization, AI authorization, research datasets/de-identification, ownership transfer, delete approval, production administrator bootstrap/recovery and Windows support are outside this Change. Their remaining exposure must not be described as whole-system security.
