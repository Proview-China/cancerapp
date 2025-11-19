import type { CaseRecord } from '../types/cases'
import { demoCases, findCaseById } from './demoData'
import { http, httpConfig } from './http'

export const fetchCases = async (): Promise<CaseRecord[]> => {
  if (httpConfig.useDemo) {
    return demoCases
  }
  return http<CaseRecord[]>('/cases')
}

export const fetchCaseDetail = async (caseId: string): Promise<CaseRecord | undefined> => {
  if (httpConfig.useDemo) {
    return findCaseById(caseId)
  }

  const record = await http<CaseRecord>(`/cases/${caseId}`)
  return record ?? undefined
}
