export type TaskStatus = 'queued' | 'pending' | 'in_progress' | 'done' | 'failed' | 'paused' | 'canceled'

export type TaskType =
  | 'upload'
  | 'auto_analysis'
  | 'review'
  | 'training'
  | 'prediction'
  | 'report'
  | 'annotation'

export type TaskDataSource = {
  caseId: string
  sourceType?: string | null
  modality?: string | null
  note?: string | null
}

export type TaskListItem = {
  id: string
  name: string
  type: TaskType
  status: TaskStatus
  assignee: string
  createdAt: string
  updatedAt: string
  progress: number | null
  eta: string | null
  modelVersion: string | null
  dataSource: TaskDataSource
  summary?: string | null
}

export type TaskStep = {
  name: string
  status: TaskStatus
  progress: number | null
  startedAt?: string | null
  endedAt?: string | null
  responsible?: string | null
}

export type TaskLogLevel = 'info' | 'warn' | 'error'

export type TaskLog = {
  ts: string
  level: TaskLogLevel
  message: string
}

export type TaskDetail = TaskListItem & {
  steps: TaskStep[]
  logs: {
    items: TaskLog[]
    hasMore: boolean
    nextOffset?: number
    nextSince?: string
  }
  retryCount: number
  failureReason: string | null
  queuePosition?: number | null
  canStop: boolean
  canRetry: boolean
  canExport: boolean
}

export type TaskSummary = {
  queued: number
  pending: number
  in_progress: number
  done: number
  failed: number
}

export type TaskListResponse = {
  items: TaskListItem[]
  total: number
  summary: TaskSummary
}
