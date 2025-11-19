export type Modality = '组织切片' | 'CT片' | '核磁共振片'

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

export type CaseSample = {
  id: string
  caseId: string
  displayName: string | null
  modality: Modality
  originalFilename: string
  imageUrl: string
  thumbnailUrl: string | null
  createdAt: string
  updatedAt: string
  analysis?: TissueAnalysis | null
}

export type CaseReport = {
  id: string
  caseId: string
  title: string
  summary: string | null
  content: string
  tags: string[]
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type CaseRecord = {
  id: string
  identifier: string
  displayName: string | null
  notes: string | null
  metadata?: Record<string, unknown>
  createdAt: string
  updatedAt: string
  samples: CaseSample[]
  reports: CaseReport[]
}

export type CaseCreateSample = {
  file: File
  displayName: string
  modality: Modality
}

export type CaseReportDraft = {
  title: string
  summary?: string
  content: string
  tags?: string[]
  metadata?: Record<string, unknown>
}

export type CaseCreatePayload = {
  identifier: string
  samples: CaseCreateSample[]
  textReports: CaseReportDraft[]
}
