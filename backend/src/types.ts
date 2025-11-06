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
