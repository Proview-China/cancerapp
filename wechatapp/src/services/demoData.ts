import type { CaseRecord } from '../types/cases'
import demoCasesJson from '../assets/demo-cases.json'

export const demoCases: CaseRecord[] = demoCasesJson as CaseRecord[]

export const findCaseById = (caseId: string): CaseRecord | undefined =>
  demoCases.find((item) => item.id === caseId)
