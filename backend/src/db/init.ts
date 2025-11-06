import { pool } from './pool.js'

let initialized = false

export const ensureCaseReportsTable = async () => {
  if (initialized) {
    return
  }

  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS case_reports (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      summary TEXT,
      content TEXT NOT NULL,
      tags TEXT[] DEFAULT '{}',
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_case_reports_case ON case_reports (case_id);
    CREATE INDEX IF NOT EXISTS idx_case_reports_title ON case_reports (title);
  `

  const triggerSQL = `
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trg_case_reports_updated_at'
      ) THEN
        EXECUTE 'CREATE TRIGGER trg_case_reports_updated_at
                 BEFORE UPDATE ON case_reports
                 FOR EACH ROW EXECUTE FUNCTION touch_updated_at();';
      END IF;
    END;
    $$;
  `

  await pool.query(createTableSQL)
  await pool.query(triggerSQL)

  initialized = true
}
