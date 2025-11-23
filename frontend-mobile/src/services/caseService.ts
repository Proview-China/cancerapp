import type { CaseRecord, CaseReport, TissueAnalysis } from '../types/cases'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000'

const mapReport = (report: any): CaseReport => ({
  id: report.id,
  caseId: report.case_id,
  title: report.title,
  summary: report.summary ?? null,
  content: report.content,
  tags: Array.isArray(report.tags) ? report.tags : [],
  metadata: report.metadata ?? {},
  createdAt: report.created_at,
  updatedAt: report.updated_at,
})

const mapCaseRecord = (data: any): CaseRecord => ({
  id: data.id,
  identifier: data.identifier,
  displayName: data.display_name ?? null,
  notes: data.notes ?? null,
  metadata: data.metadata ?? {},
  createdAt: data.created_at,
  updatedAt: data.updated_at,
  samples:
    Array.isArray(data.samples)
      ? data.samples.map((sample: any) => ({
          id: sample.id,
          caseId: sample.case_id,
          displayName: sample.description ?? null,
          modality: sample.modality,
          originalFilename: sample.original_filename,
          imageUrl: new URL(sample.storage_path, API_BASE_URL).href,
          thumbnailUrl: sample.storage_thumbnail
            ? new URL(sample.storage_thumbnail, API_BASE_URL).href
            : new URL(sample.storage_path, API_BASE_URL).href,
          createdAt: sample.created_at,
          updatedAt: sample.updated_at,
          analysis: sample.analysis ?? null,
        }))
      : [],
  reports: Array.isArray(data.reports) ? data.reports.map(mapReport) : [],
})

export const fetchCases = async (): Promise<CaseRecord[]> => {
  const response = await fetch(`${API_BASE_URL}/cases`)
  if (!response.ok) {
    throw new Error('获取病例列表失败')
  }
  const data = await response.json()
  if (!Array.isArray(data)) {
    return []
  }
  return data.map(mapCaseRecord)
}

export const fetchSampleAnalysis = async (
  caseId: string,
  sampleId: string,
): Promise<TissueAnalysis | null> => {
  const response = await fetch(`${API_BASE_URL}/cases/${caseId}/samples/${sampleId}/analysis`)
  if (!response.ok) {
    if (response.status === 404) return null
    const errorBody = await response.json().catch(() => null)
    const message = errorBody?.message ?? '获取样例分析失败'
    throw new Error(message)
  }
  const data = await response.json()
  return data ?? null
}
