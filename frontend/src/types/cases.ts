export type Modality = '组织切片' | 'CT片' | '核磁共振片'

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
