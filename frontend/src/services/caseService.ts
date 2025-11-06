import type {
  CaseCreatePayload,
  CaseRecord,
  CaseReport,
  CaseReportDraft,
} from '../types/cases'

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

export const createCase = async (payload: CaseCreatePayload): Promise<CaseRecord> => {
  const formData = new FormData()
  formData.append('identifier', payload.identifier)

  if (payload.samples.length > 0) {
    const samplesMeta = payload.samples.map((sample) => ({
      displayName: sample.displayName,
      modality: sample.modality,
    }))

    formData.append('samplesMeta', JSON.stringify(samplesMeta))

    payload.samples.forEach((sample) => {
      formData.append('sampleFiles', sample.file, sample.file.name)
    })
  }

  if (payload.textReports.length > 0) {
    formData.append('textReports', JSON.stringify(payload.textReports))
  }

  const response = await fetch(`${API_BASE_URL}/cases`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null)
    const message = errorBody?.message ?? '创建病例失败'
    throw new Error(message)
  }

  const data = await response.json()
  return mapCaseRecord(data)
}

const deleteRequest = async (url: string) => {
  const response = await fetch(url, { method: 'DELETE' })
  if (!response.ok && response.status !== 204) {
    const errorBody = await response.json().catch(() => null)
    const message = errorBody?.message ?? '操作失败'
    throw new Error(message)
  }
}

export const deleteCase = async (caseId: string): Promise<void> => {
  await deleteRequest(`${API_BASE_URL}/cases/${caseId}`)
}

export const deleteCaseSample = async (caseId: string, sampleId: string): Promise<void> => {
  await deleteRequest(`${API_BASE_URL}/cases/${caseId}/samples/${sampleId}`)
}

export const deleteCaseReport = async (caseId: string, reportId: string): Promise<void> => {
  await deleteRequest(`${API_BASE_URL}/cases/${caseId}/reports/${reportId}`)
}

const jsonRequest = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...init,
  })

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null)
    const message = errorBody?.message ?? '操作失败'
    throw new Error(message)
  }

  return response.json()
}

export const createCaseReport = async (caseId: string, payload: CaseReportDraft): Promise<CaseReport> => {
  const data = await jsonRequest<any>(`${API_BASE_URL}/cases/${caseId}/reports`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return mapReport(data)
}

export const updateCaseReport = async (
  caseId: string,
  reportId: string,
  payload: Partial<CaseReportDraft> & { content?: string },
): Promise<CaseReport> => {
  const data = await jsonRequest<any>(`${API_BASE_URL}/cases/${caseId}/reports/${reportId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  return mapReport(data)
}

export const fetchCaseReports = async (caseId: string): Promise<CaseReport[]> => {
  const response = await fetch(`${API_BASE_URL}/cases/${caseId}/reports`)
  if (!response.ok) {
    const errorBody = await response.json().catch(() => null)
    const message = errorBody?.message ?? '获取文字病历失败'
    throw new Error(message)
  }
  const data = await response.json()
  if (!Array.isArray(data)) {
    return []
  }
  return data.map(mapReport)
}
