# Authentication Change Acceptance Record

Date: 2026-11-11
Change: `add-user-authentication-sessions`
Branch: `feature/ihc-pathology-analysis`

## Results

- The approved authentication scope passed professional acceptance. No security failure requiring implementation repair was found.
- Backend regression: `npm test -- --run tests/auth.http.test.ts tests/csrf.test.ts -t '第六次|成功后清除|来源限流覆盖|会话令牌|会话 CSRF|过期|账户事务'` passed 10 tests; 11 tests were skipped by the name filter. The complete 56-test backend suite and build passed in the separate backend acceptance report; this targeted run did not rerun them.
- Administrator operations: a specialized real-HTTP run against synthetic accounts on the isolated PostgreSQL test service at `127.0.0.1:5433` observed enable/disable responses of 204 and self-disable rejection of 400. `backend/tests/auth.http.test.ts` last-admin transaction case returned 400, rolled back, did not commit, and released its connection.
- Concurrent last-admin protection: a two-connection PostgreSQL race locked distinct administrator rows while exercising the implementation's administrator-set lock SQL. One transaction received PostgreSQL `40P01`, the other obtained the set lock; both transactions were rolled back. This is fail-closed: no administrator protection bypass was observed. The deadlock can surface as HTTP 500 and is a known behavior, not a security acceptance failure.
- Login throttling: the first five username failures returned 401; the sixth was limited with `Retry-After`. Successful authentication cleared the username failure count. Source throttling returned `Retry-After: 60`; an untrusted `X-Forwarded-For` did not bypass the limit, while the explicitly configured loopback trusted-proxy case resolved the source as expected.
- Audit redaction: the specialized run captured `auditRecord` output with password, hash, token, and Cookie sentinel values; none appeared in output. HTTP error handling also has an assertion that private error detail is absent from the response.
- CSRF: expired proof was rejected and a trusted request received the expiry marker; refreshing the session-bound token permitted logout. Cross-session use was rejected and repeated valid use within the same session succeeded.
- Frontend/packaged logout: the latest packaged Electron logout re-test exited with code 0. `backend/tests/logout.frontend.test.ts` also covers logout token refresh and failure handling.
- Argon2id: implementation and tests use memory cost 64 MiB, time cost 3, parallelism 1; the separate supported-device performance report passed its acceptance. Detailed timing and memory measurements remain in that source report and are not reproduced here.
- Database and Electron: the separate real-database/Electron acceptance report confirmed migration and localhost login behavior in the reported environments. Migration ran on the isolated test instance at port 5433; PostgreSQL 5432 was not used.

## Environment and limits

- Database verification used synthetic authentication accounts in the isolated local PostgreSQL test instance at `127.0.0.1:5433`; no real patient data was used.
- Electron acceptance covered the reported localhost development/packaged path. `file://` and `null` Origin remain unsupported.
- The final targeted run did not rerun performance tests, the full backend suite, backend build, or Electron acceptance; those results are from the separate acceptance reports cited above.
- Windows/NTFS support is deferred to a separate cross-platform Change. Do not infer Windows support from Linux results.
- Production administrator bootstrap/recovery, OS permissions, lifecycle locking, and production backup/restore exercises are deferred to `secure-admin-bootstrap-and-recovery`. Until then, no production deployment or real-patient-data use is allowed.
- `/cases`, `/uploads`, and `/ai` authorization is outside this Change.

## Verification commands and evidence

- Targeted command: shown above; result 10 passed, 11 skipped by filter.
- Separate acceptance reports: Argon2 performance; backend 56-test suite/build; isolated database migration; Electron localhost login and logout. These reports supplied the results for this record; the targeted command above is the only command rerun for the 2026-11-11 specialist check.
- Last-admin automated case: `backend/tests/auth.http.test.ts:175`.
- Rate-limit cases: `backend/tests/auth.http.test.ts:107`, `:121`, `:152`.
- CSRF cases: `backend/tests/auth.http.test.ts:38`, `:192`; `backend/tests/csrf.test.ts:39`.
- Logout regression: `backend/tests/logout.frontend.test.ts`.

## Known behavior

The concurrent administrator-set lock may deadlock when competing transactions lock different administrator rows first. PostgreSQL aborts one transaction with `40P01`; the request may return 500. This is fail-closed and did not disable the last administrator or bypass the protection in acceptance. Any behavior change is a separate implementation decision and is not an acceptance blocker for this Change.
