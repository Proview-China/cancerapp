export type Modality = '组织切片' | 'CT片' | '核磁共振片'

export type CaseRecord = {
  id: string
  identifier: string
  display_name: string | null
  notes: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type CaseSampleRecord = {
  id: string
  case_id: string
  modality: Modality
  description: string | null
  original_filename: string
  storage_path: string
  storage_thumbnail: string | null
  checksum: string | null
  created_at: string
  updated_at: string
  analysis?: TissueAnalysis | null
}
export type CaseReportRecord = {
  id: string
  case_id: string
  title: string
  summary: string | null
  content: string
  tags: string[]
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type CaseReportInput = {
  title: string
  summary?: string | null
  content: string
  tags?: string[]
  metadata?: Record<string, unknown>
}

export type CaseWithRelations = CaseRecord & {
  samples: CaseSampleRecord[]
  reports: CaseReportRecord[]
}

export type CaseCreateRequest = {
  identifier: string
  displayName?: string
  notes?: string
  samples: Array<{
    description: string
    modality: Modality
    file: Express.Multer.File
  }>
  textReports: CaseReportInput[]
}

export type TissueAnalysisRaw = {
  pos_cells_1_weak: number | null
  pos_cells_2_moderate: number | null
  pos_cells_3_strong: number | null
  iod_total_cells: number | null
  positive_area_mm2: number | null
  tissue_area_mm2: number | null
  positive_area_px: number | null
  tissue_area_px: number | null
  positive_intensity: number | null
}

export type TissueAnalysisDerived = {
  positive_cells_ratio: number | null
  positive_cells_density: number | null
  mean_density: number | null
  h_score: number | null
  irs: number | null
}

export type TissueAnalysisImages = {
  raw_image_path: string | null
  parsed_image_path: string | null
}

export type TissueAnalysis = {
  raw: TissueAnalysisRaw
  derived: TissueAnalysisDerived
  images: TissueAnalysisImages
  metadata?: Record<string, unknown>
}
