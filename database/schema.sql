-- PostgreSQL 初始化脚本：针对「图片 + 文本叙述」训练样本的结构化管理
-- 连接示例：psql postgresql://user:password@localhost:5432/cancerapp -f database/schema.sql

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE IF NOT EXISTS datasets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            CITEXT NOT NULL UNIQUE,
    display_name    TEXT NOT NULL,
    description     TEXT,
    modality        TEXT,
    version         TEXT,
    tags            TEXT[] DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 病例主表：记录患者或病例标识
CREATE TABLE IF NOT EXISTS cases (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier      CITEXT NOT NULL UNIQUE,
    display_name    TEXT,
    notes           TEXT,
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 病例样例：存储关联的医学影像或其他资料
CREATE TABLE IF NOT EXISTS case_samples (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id             UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    modality            TEXT NOT NULL CHECK (modality IN ('组织切片', 'CT片', '核磁共振片')),
    description         TEXT,
    original_filename   TEXT NOT NULL,
    storage_path        TEXT NOT NULL,
    storage_thumbnail   TEXT,
    checksum            TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_case_samples_case ON case_samples (case_id);
CREATE INDEX IF NOT EXISTS idx_case_samples_modality ON case_samples (modality);

-- 病例文字病历：演示病例识别/读取
CREATE TABLE IF NOT EXISTS case_reports (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id         UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    summary         TEXT,
    content         TEXT NOT NULL,
    tags            TEXT[] DEFAULT '{}',
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_case_reports_case ON case_reports (case_id);
CREATE INDEX IF NOT EXISTS idx_case_reports_title ON case_reports (title);

CREATE TABLE IF NOT EXISTS dataset_sources (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_id      UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    source_type     TEXT NOT NULL CHECK (source_type IN ('upload', 'sync', 'import')),
    source_uri      TEXT,
    checksum        TEXT,
    metadata        JSONB,
    imported_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS samples (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_id      UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    external_id     TEXT,
    image_uri       TEXT NOT NULL,
    image_checksum  TEXT,
    text_summary    TEXT,
    structured_data JSONB,
    split           TEXT NOT NULL DEFAULT 'unassigned' CHECK (split IN ('train', 'valid', 'test', 'unassigned')),
    status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'pending')),
    collected_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (dataset_id, external_id)
);

CREATE TABLE IF NOT EXISTS sample_attributes (
    id              BIGSERIAL PRIMARY KEY,
    sample_id       UUID NOT NULL REFERENCES samples(id) ON DELETE CASCADE,
    key             TEXT NOT NULL,
    value_text      TEXT,
    value_numeric   NUMERIC,
    unit            TEXT,
    metadata        JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sample_labels (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sample_id       UUID NOT NULL REFERENCES samples(id) ON DELETE CASCADE,
    label_type      TEXT NOT NULL,
    label_value     TEXT NOT NULL,
    confidence      NUMERIC(5,4) CHECK (confidence BETWEEN 0 AND 1),
    annotator       TEXT,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dataset_versions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_id      UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    version_name    TEXT NOT NULL,
    description     TEXT,
    frozen_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata        JSONB,
    UNIQUE (dataset_id, version_name)
);

CREATE INDEX IF NOT EXISTS idx_samples_dataset_split ON samples (dataset_id, split);
CREATE INDEX IF NOT EXISTS idx_samples_status ON samples (status);
CREATE INDEX IF NOT EXISTS idx_sample_attributes_key ON sample_attributes (key);
CREATE INDEX IF NOT EXISTS idx_sample_labels_type ON sample_labels (label_type);

CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
    rec RECORD;
BEGIN
    FOR rec IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('datasets', 'samples', 'cases', 'case_samples', 'case_reports')
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_updated_at ON %I;', rec.tablename, rec.tablename);
        EXECUTE format('CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION touch_updated_at();', rec.tablename, rec.tablename);
    END LOOP;
END;
$$;

-- 组织切片分析结果（每个样本一条汇总记录）
CREATE TABLE IF NOT EXISTS sample_tissue_analysis (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sample_id                   UUID NOT NULL UNIQUE REFERENCES case_samples(id) ON DELETE CASCADE,
    -- 原始指标 a–i
    pos_cells_1_weak            INTEGER,
    pos_cells_2_moderate        INTEGER,
    pos_cells_3_strong          INTEGER,
    iod_total_cells             INTEGER,
    positive_area_mm2           NUMERIC,
    tissue_area_mm2             NUMERIC,
    positive_area_px            BIGINT,
    tissue_area_px              BIGINT,
    positive_intensity          NUMERIC,
    -- 衍生指标 a–e
    positive_cells_ratio        NUMERIC,
    positive_cells_density      NUMERIC,
    mean_density                NUMERIC,
    h_score                     NUMERIC,
    irs                         NUMERIC,
    -- 图像路径
    raw_image_path              TEXT,
    parsed_image_path           TEXT,
    -- 元信息
    metadata                    JSONB DEFAULT '{}',
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
