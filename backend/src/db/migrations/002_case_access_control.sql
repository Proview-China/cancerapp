ALTER TABLE cases ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES users(id);

CREATE TABLE IF NOT EXISTS case_access_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  permission TEXT NOT NULL CHECK (permission IN ('read', 'edit', 'upload')),
  granted_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS case_access_grants_active_unique
  ON case_access_grants(case_id, user_id, permission) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS case_access_grants_user_case_active
  ON case_access_grants(user_id, case_id) WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS case_access_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID NOT NULL,
  case_id UUID NOT NULL,
  case_identifier TEXT NOT NULL,
  target_user_id UUID,
  action TEXT NOT NULL,
  permission TEXT CHECK (permission IS NULL OR permission IN ('read', 'edit', 'upload')),
  result TEXT NOT NULL CHECK (result IN ('success', 'denied')),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS case_access_audit_case_time ON case_access_audit(case_id, occurred_at);

CREATE TABLE IF NOT EXISTS case_access_migrations (
  version TEXT PRIMARY KEY,
  mapping_sha256 TEXT NOT NULL,
  case_count BIGINT NOT NULL,
  sample_count BIGINT NOT NULL,
  report_count BIGINT NOT NULL,
  analysis_count BIGINT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
