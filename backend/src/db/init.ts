import { pool } from './pool.js'

const isTestEnv = process.env.NODE_ENV === 'test'

let initialized = false

export const ensureCaseReportsTable = async () => {
  if (initialized || isTestEnv) {
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
      sort_order INTEGER,
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

let ensuredCaseSamplesSortOrder = false

export const ensureCaseSamplesSortOrder = async () => {
  if (ensuredCaseSamplesSortOrder) {
    return
  }

  await pool.query('ALTER TABLE case_samples ADD COLUMN IF NOT EXISTS sort_order INTEGER')

  const result = await pool.query<{ id: string; case_id: string; created_at: Date }>(
    'SELECT id, case_id, created_at FROM case_samples WHERE sort_order IS NULL ORDER BY case_id, created_at DESC',
  )

  const groups = new Map<string, string[]>()
  for (const row of result.rows) {
    const list = groups.get(row.case_id) ?? []
    list.push(row.id)
    groups.set(row.case_id, list)
  }

  for (const [caseId, ids] of groups) {
    let order = 0
    for (const id of ids) {
      order += 1
      // eslint-disable-next-line no-await-in-loop
      await pool.query('UPDATE case_samples SET sort_order = $1 WHERE id = $2 AND case_id = $3', [order, id, caseId])
    }
  }

  ensuredCaseSamplesSortOrder = true
}

let ensuredCaseReportsSortOrder = false

export const ensureCaseReportsSortOrder = async () => {
  if (ensuredCaseReportsSortOrder) {
    return
  }

  await pool.query('ALTER TABLE case_reports ADD COLUMN IF NOT EXISTS sort_order INTEGER')

  const result = await pool.query<{ id: string; case_id: string; created_at: Date }>(
    'SELECT id, case_id, created_at FROM case_reports WHERE sort_order IS NULL ORDER BY case_id, created_at DESC',
  )

  const groups = new Map<string, string[]>()
  for (const row of result.rows) {
    const list = groups.get(row.case_id) ?? []
    list.push(row.id)
    groups.set(row.case_id, list)
  }

  for (const [caseId, ids] of groups) {
    let order = 0
    for (const id of ids) {
      order += 1
      // eslint-disable-next-line no-await-in-loop
      await pool.query('UPDATE case_reports SET sort_order = $1 WHERE id = $2 AND case_id = $3', [order, id, caseId])
    }
  }

  ensuredCaseReportsSortOrder = true
}

let ensuredTissueAnalysis = false

export const ensureSampleTissueAnalysisTable = async () => {
  if (isTestEnv) return
  if (ensuredTissueAnalysis) return

  const sql = `
    CREATE TABLE IF NOT EXISTS sample_tissue_analysis (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      sample_id UUID NOT NULL UNIQUE REFERENCES case_samples(id) ON DELETE CASCADE,
      pos_cells_1_weak INTEGER,
      pos_cells_2_moderate INTEGER,
      pos_cells_3_strong INTEGER,
      iod_total_cells INTEGER,
      positive_area_mm2 NUMERIC,
      tissue_area_mm2 NUMERIC,
      positive_area_px BIGINT,
      tissue_area_px BIGINT,
      positive_intensity NUMERIC,
      positive_cells_ratio NUMERIC,
      positive_cells_density NUMERIC,
      mean_density NUMERIC,
      h_score NUMERIC,
      irs NUMERIC,
      raw_image_path TEXT,
      parsed_image_path TEXT,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_tissue_analysis_sample ON sample_tissue_analysis (sample_id);

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sample_tissue_analysis_updated_at'
      ) THEN
        EXECUTE 'CREATE TRIGGER trg_sample_tissue_analysis_updated_at
                 BEFORE UPDATE ON sample_tissue_analysis
                 FOR EACH ROW EXECUTE FUNCTION touch_updated_at();';
      END IF;
    END;
    $$;
  `

  await pool.query(sql)
  ensuredTissueAnalysis = true
}
