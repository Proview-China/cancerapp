## 1. Migration and data model

- [x] 1.1 Confirm username rules, Argon2id parameters, session lifetimes, rate limits, and Electron policy.
- [x] 1.2 Implement versioned users/sessions migration with normalized unique username, role/status checks, unique token hash, FK, expiry/revocation indexes, and version record.
- [x] 1.3 Test one-transaction migration, backup/object inventory, rollback, and separation from schema.sql/db/init.ts.
- [x] 1.4 Run only against isolated test DB; prove no PostgreSQL 5432 connection or business-table changes.

## 2. Authentication and sessions

- [x] 2.1 Implement Argon2id memory 64 MiB, time cost 3, parallelism 1 and record target timing without secrets. Implementation and supported-device performance acceptance are recorded in `docs/acceptance/2026-11-11-authentication.md`.
- [x] 2.2 Implement username normalization/validation, random >=32-byte tokens and SHA-256 token hashes.
- [x] 2.3 Implement uniform failures and 5-failures/15-minute username plus 30-attempts/minute source throttling.
- [x] 2.4 Implement login rotation, 24-hour absolute expiry, 2-hour idle expiry, logout, revocation and cleanup.
- [x] 2.5 Enforce disabled-account checks and concurrent last-admin protection.
- [x] 2.6 Implement change-password with current verification, all-session revocation and re-login.

## 3. HTTP boundary

- [x] 3.1 Implement authenticateRequest with non-sensitive context.
- [x] 3.2 Implement login/logout/current-session/change-password/admin-state endpoints without hashes or complete tokens.
- [x] 3.3 Set/clear HttpOnly, SameSite=Lax, Path=/ and HTTPS-only Secure cookies; no long-lived browser tokens.
- [x] 3.4 Require credentials include, explicit localhost Origins, missing/null/untrusted Origin rejection, and the two-stage CSRF lifecycle: anonymous bootstrap, login rotation, session binding, request sending, expiry, reuse and revocation tests.
- [x] 3.5 Test/document that cases, uploads and AI remain outside this Change.

## 4. Account state

- [x] 4.1 Implement admin enable/disable; prohibit self-disable, physical deletion and last-admin disablement.

## 5. Verification

- [x] 5.1 Test usernames, hashing, uniform errors, cookies, credentials, expiry, rotation, revocation, disabled accounts, passwords and throttling.
- [x] 5.2 Test CSRF/Origin, log redaction, last-admin protection and migration rollback.
- [x] 5.3 Run the complete backend test suite and backend build in isolation; separate implementation failures from environment limits. Evidence and limits are recorded in `docs/acceptance/2026-11-11-authentication.md`.
- [x] 5.4 Verify Electron localhost development and packaged localhost login behavior; record file:// as unsupported unless separately approved and proven by real packaged testing. Evidence and platform limits are recorded in `docs/acceptance/2026-11-11-authentication.md`.
- [x] 5.5 Test rate-limit boundaries: fifth failure remains authentication failure, sixth attempt is throttled, success clears username failures, and trusted-proxy source handling is deterministic. Evidence: `backend/tests/auth.http.test.ts:107`, `:121`, `:152` and the 2026-11-11 targeted run.
- [x] 5.6 Record non-goals and prohibition on real patient data before later authorization changes.

Production bootstrap/recovery, OS permissions, lifecycle locks and backup exercises are deferred to `secure-admin-bootstrap-and-recovery`; Windows support is deferred to a separate cross-platform Change. No production recovery is provided and no real patient data or production deployment is permitted before those prerequisites.

## Evidence references and minimum follow-up

- Argon2id parameters and hash verification: `backend/tests/auth.unit.test.ts`, `backend/src/auth/password.ts`; supported-device timing and peak-memory evidence is recorded in `docs/acceptance/2026-11-11-authentication.md`.
- Administrator self-disable rejection and real HTTP enable/disable behavior: 2026-11-11 `/tmp/auth-final-review.mjs`; last-admin rollback substitute: `backend/tests/auth.http.test.ts:175`; two-connection lock race and deadlock fail-closed behavior: same specialized report.
- Audit log redaction: same specialized report captured actual `auditRecord` output with password/hash/token/Cookie sentinel values; HTTP internal error redaction: `backend/tests/auth.http.test.ts:175`.
- Rate-limit boundaries and `Retry-After`: `backend/tests/auth.http.test.ts:107`, `:121`, `:139`, `:152`; targeted command passed 10, skipped 11 by filter.
- CSRF expiry/recovery and session binding/reuse: `backend/tests/auth.http.test.ts:38`, `:192`; cross-session and repeated-use unit coverage: `backend/tests/csrf.test.ts:39`.
- Logout regression: `backend/tests/logout.frontend.test.ts` and 2026-11-11 packaged logout re-test report (exit code 0).
- Full backend tests/build, supported-device Argon2 performance, isolated migration and Electron localhost login/exit acceptance are covered by the durable report at `docs/acceptance/2026-11-11-authentication.md`. Windows and production bootstrap/recovery remain explicitly deferred, not pending acceptance for this Change.
