# user-authentication-sessions Specification

## Purpose
TBD - created by archiving change add-user-authentication-sessions. Update Purpose after archive.
## Requirements
### Requirement: Normalized Username
The system SHALL trim surrounding ASCII whitespace, apply Unicode NFKC, locale-independent toLowerCase and NFKC, reject empty values, control or format characters and values exceeding 64 Unicode code points, and enforce normalized uniqueness. Full Unicode case-fold is deferred to internationalization work.

#### Scenario: Equivalent usernames
- **WHEN** two creations differ only by case or equivalent NFKC
- **THEN** they resolve to one normalized value
- **AND** at most one account is created

### Requirement: Password Hash
The system SHALL store only Argon2id hashes with memory 64 MiB, time cost 3, and parallelism 1.

#### Scenario: Password creation
- **WHEN** an approved operation sets a password
- **THEN** only the approved hash is persisted
- **AND** plaintext is absent from logs, responses, and application data

### Requirement: Account State
The system SHALL support only admin, pathologist, and researcher roles, enabled/disabled state, no physical deletion, no administrator self-disable, and no disabling of the last enabled administrator.

#### Scenario: Concurrent last-admin disable
- **WHEN** concurrent operations disable the last enabled administrator
- **THEN** at most one proceeds
- **AND** at least one enabled administrator remains

### Requirement: Cookie Sessions
The system SHALL generate at least 32 random bytes, persist only SHA-256(token), and deliver the token only in an HttpOnly Cookie with 24-hour absolute and 2-hour idle expiry.

#### Scenario: Login
- **WHEN** an enabled user submits valid credentials
- **THEN** a new token hash and session are stored
- **AND** the complete token is absent from JSON, logs, and database fields

### Requirement: Uniform Failure and Throttling
The system SHALL use one externally visible failure for unknown, disabled, and incorrect-password attempts and apply 5 failures/15 minutes per username plus 30 attempts/minute per source in single-machine mode.

#### Scenario: Repeated invalid login
- **WHEN** invalid credentials are repeated
- **THEN** responses remain indistinguishable
- **AND** the first five failures remain authentication failures
- **AND** the sixth attempt is throttled for the remainder of the 15-minute window
- **AND** a successful login clears the normalized username failure counter
- **AND** source counting uses only the configured trusted-proxy boundary

### Requirement: Session Revocation
The system SHALL create a new session on login, reject expired/revoked sessions, revoke current session on logout, and revoke all sessions after password change or disablement.

#### Scenario: Password change
- **WHEN** a user changes password with the current password
- **THEN** all sessions are revoked
- **AND** the client must log in again

### Requirement: Authentication Middleware
The system SHALL provide authenticateRequest that checks Cookie, expiry, revocation, and current enabled state before attaching non-sensitive context.

#### Scenario: Disabled existing session
- **WHEN** the account is disabled after login
- **THEN** the next authenticated request is rejected
- **AND** the middleware does not make case/image/AI authorization decisions

### Requirement: Cookie and CSRF
The system SHALL require credentials include, use HttpOnly/SameSite=Lax/Path=/ cookies, use Secure for HTTPS, allow only configured localhost Origins, reject missing/null/untrusted Origins on state changes, and use a two-stage CSRF token lifecycle.

#### Scenario: CSRF bootstrap and login
- **WHEN** an anonymous client requests CSRF bootstrap
- **THEN** the server returns a short-lived token in a non-HttpOnly CSRF Cookie and response body
- **AND** login requires an allowed Origin and matching `X-CSRF-Token` header and Cookie
- **AND** successful login rotates and binds a new token to the session

#### Scenario: Invalid or stale CSRF proof
- **WHEN** a state-changing request has missing, null, or untrusted Origin, a missing/mismatched/expired token, or a token bound to another session
- **THEN** it is rejected before state changes
- **AND** logout, password change, disablement, and session expiry invalidate the old token

#### Scenario: Consecutive authenticated requests
- **WHEN** valid session-bound CSRF credentials are used for consecutive state-changing requests
- **THEN** validation does not consume the session-bound token

### Requirement: Electron Source Boundary
The system SHALL use a configured localhost HTTP page source for the initial Electron authentication path and SHALL NOT treat `file://` or `null` Origin as an allowed authentication source without a separately approved design and real packaged verification.

#### Scenario: Unverified file source
- **WHEN** the packaged Electron path still uses `file://` without an approved verified design
- **THEN** it is recorded as unsupported for this Change
- **AND** the implementation does not allow `null` Origin as a compatibility bypass

### Requirement: Authentication Migration
The system SHALL use a versioned, single-transaction migration with backup/object inventory in an isolated database; it SHALL not connect to/init 5432 or modify business tables or ordinary GET paths.

#### Scenario: Migration failure
- **WHEN** migration fails
- **THEN** it rolls back or restores the approved backup
- **AND** business tables and records remain unchanged

### Requirement: Explicit Protection Boundary
The system SHALL protect authentication, session, password, and administrator-state operations. It SHALL NOT add authentication enforcement to /cases, /uploads, or /ai in this Change.

#### Scenario: Existing route boundary
- **WHEN** this Change is complete before later authorization Changes
- **THEN** those routes retain current access behavior
- **AND** records state that the system is not for real patient data

### Requirement: Authentication Testing
The system SHALL test username rules, hashing, uniform errors, throttling, Cookie/credentials, Origin/CSRF, expiry, rotation, revocation, disabled accounts, password changes, log redaction, migration rollback, and the non-goal boundary.

#### Scenario: Isolated suite
- **WHEN** the suite runs
- **THEN** it uses an isolated database or approved equivalent
- **AND** separates implementation failures from environment limits

### Requirement: Deployment Recovery Boundary
The system SHALL NOT claim production administrator bootstrap or recovery is provided by this Change. These capabilities, OS permissions, lifecycle locking and production backup and recovery exercises belong to the later `secure-admin-bootstrap-and-recovery` Change, which is a prerequisite for real deployment and real patient data.

#### Scenario: Before deployment recovery exists
- **WHEN** application-layer authentication is completed without the later Change
- **THEN** production administrator recovery is not claimed available
- **AND** real patient data is not used
- **AND** recovery is not exposed through HTTP, Electron renderer, IPC or ordinary application interfaces
