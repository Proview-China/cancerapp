import { demoTaskDetails, demoTaskList } from '../demo/tasks'
import type {
  TaskDetail,
  TaskListItem,
  TaskListResponse,
  TaskLog,
  TaskStatus,
  TaskType,
} from '../types/tasks'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000'
const USE_DEMO_TASKS = (import.meta.env.VITE_USE_DEMO_TASKS ?? 'true') === 'true'

type ListFilters = {
  status?: TaskStatus | TaskStatus[]
  type?: TaskType | TaskType[]
  assignee?: string
  from?: string
  to?: string
  page?: number
  pageSize?: number
}

const toArrayParam = (value?: string | string[]) => {
  if (!value) return undefined
  return Array.isArray(value) ? value.join(',') : value
}

const buildQuery = (filters?: ListFilters) => {
  if (!filters) return ''
  const params = new URLSearchParams()
  const statusValue = toArrayParam(filters.status as any)
  const typeValue = toArrayParam(filters.type as any)
  if (statusValue) params.set('status', statusValue)
  if (typeValue) params.set('type', typeValue)
  if (filters.assignee) params.set('assignee', filters.assignee)
  if (filters.from) params.set('from', filters.from)
  if (filters.to) params.set('to', filters.to)
  if (filters.page !== undefined) params.set('page', String(filters.page))
  if (filters.pageSize !== undefined) params.set('page_size', String(filters.pageSize))
  const query = params.toString()
  return query ? `?${query}` : ''
}

const mapTaskItem = (data: any): TaskListItem => ({
  id: data.id,
  name: data.name,
  type: data.type,
  status: data.status,
  assignee: data.assignee,
  createdAt: data.created_at ?? data.createdAt,
  updatedAt: data.updated_at ?? data.updatedAt,
  progress: data.progress ?? null,
  eta: data.eta ?? null,
  modelVersion: data.model_version ?? data.modelVersion ?? null,
  dataSource: {
    caseId: data.data_source?.case_id ?? data.data_source?.caseId ?? data.dataSource?.caseId ?? '',
    sourceType: data.data_source?.source_type ?? data.data_source?.sourceType ?? data.dataSource?.sourceType ?? null,
    modality: data.data_source?.modality ?? data.dataSource?.modality ?? null,
    note: data.data_source?.note ?? data.dataSource?.note ?? null,
  },
  summary: data.summary ?? null,
})

const mapLogs = (data: any): TaskDetail['logs'] => ({
  items: Array.isArray(data?.items)
    ? data.items.map((log: any): TaskLog => ({
        ts: log.ts,
        level: log.level,
        message: log.message,
      }))
    : [],
  hasMore: Boolean(data?.has_more ?? data?.hasMore ?? false),
  nextOffset: data?.next_offset ?? data?.nextOffset ?? undefined,
  nextSince: data?.next_since ?? data?.nextSince ?? undefined,
})

const mapDetail = (data: any): TaskDetail => ({
  ...mapTaskItem(data),
  steps: Array.isArray(data.steps)
    ? data.steps.map((step: any) => ({
        name: step.name,
        status: step.status,
        progress: step.progress ?? null,
        startedAt: step.started_at ?? step.startedAt ?? null,
        endedAt: step.ended_at ?? step.endedAt ?? null,
        responsible: step.responsible ?? null,
      }))
    : [],
  logs: mapLogs(data.logs ?? { items: [], has_more: false }),
  retryCount: data.retry_count ?? data.retryCount ?? 0,
  failureReason: data.failure_reason ?? data.failureReason ?? null,
  queuePosition: data.queue_position ?? data.queuePosition ?? null,
  canStop: data.can_stop ?? data.canStop ?? false,
  canRetry: data.can_retry ?? data.canRetry ?? false,
  canExport: data.can_export ?? data.canExport ?? false,
})

export const fetchTaskList = async (filters?: ListFilters): Promise<TaskListResponse> => {
  if (USE_DEMO_TASKS) {
    return demoTaskList
  }
  const query = buildQuery(filters)
  const response = await fetch(`${API_BASE_URL}/tasks${query}`)
  if (!response.ok) {
    throw new Error('获取任务列表失败')
  }
  const data = await response.json()
  const items = Array.isArray(data?.items) ? data.items.map(mapTaskItem) : []
  return {
    items,
    total: data?.total ?? items.length,
    summary: data?.summary ?? { queued: 0, pending: 0, in_progress: 0, done: 0, failed: 0 },
  }
}

export const fetchTaskDetail = async (taskId: string): Promise<TaskDetail> => {
  if (USE_DEMO_TASKS) {
    const detail = demoTaskDetails[taskId]
    if (!detail) {
      throw new Error('未找到对应的任务详情')
    }
    return detail
  }
  const response = await fetch(`${API_BASE_URL}/tasks/${taskId}`)
  if (!response.ok) {
    throw new Error('获取任务详情失败')
  }
  const data = await response.json()
  return mapDetail(data)
}

export const fetchTaskLogs = async (
  taskId: string,
  params?: { offset?: number; limit?: number; since?: string },
): Promise<TaskDetail['logs']> => {
  if (USE_DEMO_TASKS) {
    const detail = demoTaskDetails[taskId]
    return detail?.logs ?? { items: [], hasMore: false }
  }

  const searchParams = new URLSearchParams()
  if (params?.offset !== undefined) searchParams.set('offset', String(params.offset))
  if (params?.limit !== undefined) searchParams.set('limit', String(params.limit))
  if (params?.since) searchParams.set('since', params.since)
  const query = searchParams.toString()
  const response = await fetch(`${API_BASE_URL}/tasks/${taskId}/logs${query ? `?${query}` : ''}`)
  if (!response.ok) {
    throw new Error('获取任务日志失败')
  }
  const data = await response.json()
  return mapLogs(data)
}

export const stopTask = async (taskId: string, payload?: { reason?: string }): Promise<void> => {
  if (USE_DEMO_TASKS) {
    return
  }
  const response = await fetch(`${API_BASE_URL}/tasks/${taskId}/stop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload?.reason ? JSON.stringify(payload) : undefined,
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.message ?? '停止任务失败')
  }
}

export const retryTask = async (taskId: string, payload?: { reason?: string; force?: boolean }): Promise<void> => {
  if (USE_DEMO_TASKS) {
    return
  }
  const response = await fetch(`${API_BASE_URL}/tasks/${taskId}/retry`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload ? JSON.stringify(payload) : undefined,
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.message ?? '重新运行任务失败')
  }
}

export const exportTask = async (taskId: string, format: 'pdf' | 'json' | 'excel'): Promise<Blob> => {
  if (USE_DEMO_TASKS) {
    throw new Error('导出功能尚未开通')
  }
  const response = await fetch(`${API_BASE_URL}/tasks/${taskId}/export?format=${format}`)
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.message ?? '导出任务失败')
  }
  return response.blob()
}
