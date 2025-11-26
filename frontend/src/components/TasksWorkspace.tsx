import { useEffect, useMemo, useRef, useState } from 'react'
import './TasksWorkspace.css'
import type { TaskDetail, TaskListItem, TaskLog, TaskStatus, TaskType } from '../types/tasks'
import { exportTask, fetchTaskDetail, fetchTaskList, fetchTaskLogs, retryTask, stopTask } from '../services/taskService'

const STATUS_META: Record<
  TaskStatus,
  { label: string; tone: 'gray' | 'blue' | 'green' | 'red' | 'amber'; icon: string }
> = {
  queued: { label: '队列中', tone: 'gray', icon: '⏳' },
  pending: { label: '待处理', tone: 'gray', icon: '⏳' },
  in_progress: { label: '处理中', tone: 'blue', icon: '🔄' },
  done: { label: '已完成', tone: 'green', icon: '✔️' },
  failed: { label: '失败', tone: 'red', icon: '❗' },
  paused: { label: '暂停', tone: 'amber', icon: '⏸' },
  canceled: { label: '已取消', tone: 'gray', icon: '⛔' },
}

const TYPE_LABELS: Record<TaskType, string> = {
  upload: '上传',
  auto_analysis: '自动分析',
  review: '审核',
  training: '训练',
  prediction: '预测',
  report: '报告',
  annotation: '数据标注',
}

const ACTIVE_STATUSES: TaskStatus[] = ['queued', 'pending', 'in_progress', 'paused']

type LogState = {
  items: TaskLog[]
  hasMore: boolean
  nextOffset?: number
  nextSince?: string
  loading: boolean
}

export function TasksWorkspace() {
  const [tasks, setTasks] = useState<TaskListItem[]>([])
  const [summary, setSummary] = useState<Record<string, number>>({})
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loadingList, setLoadingList] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [detail, setDetail] = useState<TaskDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all')
  const [typeFilter, setTypeFilter] = useState<TaskType | 'all'>('all')
  const [logState, setLogState] = useState<LogState>({ items: [], hasMore: false, loading: false })
  const pollTimerRef = useRef<number | null>(null)
  const [exporting, setExporting] = useState(false)

  const formatError = (err: unknown, fallback: string) => {
    if (!navigator.onLine) return '网络未连接，请检查网络后重试'
    if (err instanceof Error) return err.message || fallback
    return fallback
  }

  const loadList = async () => {
    setLoadingList(true)
    setError(null)
    try {
      const data = await fetchTaskList()
      setTasks(data.items)
      setSummary(data.summary ?? {})
      if (!selectedId && data.items.length > 0) {
        setSelectedId(data.items[0].id)
      }
    } catch (err) {
      setError(formatError(err, '加载任务列表失败'))
    } finally {
      setLoadingList(false)
    }
  }

  const loadDetail = async (taskId: string) => {
    setLoadingDetail(true)
    setError(null)
    try {
      const data = await fetchTaskDetail(taskId)
      setDetail(data)
      setLogState({
        items: data.logs.items,
        hasMore: data.logs.hasMore,
        nextOffset: data.logs.nextOffset,
        nextSince: data.logs.nextSince,
        loading: false,
      })
    } catch (err) {
      setError(formatError(err, '加载任务详情失败'))
    } finally {
      setLoadingDetail(false)
    }
  }

  useEffect(() => {
    loadList()
    return () => {
      if (pollTimerRef.current) {
        window.clearInterval(pollTimerRef.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!selectedId && tasks.length > 0) {
      setSelectedId(tasks[0].id)
    }
  }, [selectedId, tasks])

  useEffect(() => {
    if (!selectedId) return
    loadDetail(selectedId)
  }, [selectedId])

  useEffect(() => {
    if (pollTimerRef.current) {
      window.clearInterval(pollTimerRef.current)
    }
    const hasActive = tasks.some((item) => ACTIVE_STATUSES.includes(item.status))
    if (!hasActive) {
      return
    }
    pollTimerRef.current = window.setInterval(() => {
      loadList()
      if (selectedId) {
        loadDetail(selectedId)
      }
    }, 12000)
    return () => {
      if (pollTimerRef.current) {
        window.clearInterval(pollTimerRef.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, selectedId])

  const filteredTasks = useMemo(() => {
    return tasks.filter((item) => {
      const statusOk = statusFilter === 'all' || item.status === statusFilter
      const typeOk = typeFilter === 'all' || item.type === typeFilter
      return statusOk && typeOk
    })
  }, [tasks, statusFilter, typeFilter])

  const handleLoadMoreLogs = async () => {
    if (!detail || !logState.hasMore || logState.loading) return
    setLogState((prev) => ({ ...prev, loading: true }))
    try {
      const logs = await fetchTaskLogs(detail.id, {
        offset: logState.nextOffset,
        since: logState.nextSince,
        limit: 20,
      })
      setLogState((prev) => ({
        items: [...prev.items, ...logs.items],
        hasMore: logs.hasMore,
        nextOffset: logs.nextOffset,
        nextSince: logs.nextSince,
        loading: false,
      }))
    } catch (err) {
      setError(formatError(err, '加载更多日志失败'))
      setLogState((prev) => ({ ...prev, loading: false }))
    }
  }

  const handleStop = async () => {
    if (!detail || !detail.canStop) return
    try {
      await stopTask(detail.id)
      await loadDetail(detail.id)
      await loadList()
    } catch (err) {
      setError(formatError(err, '停止任务失败（可能无权限或状态已变化）'))
    }
  }

  const handleRetry = async () => {
    if (!detail || !detail.canRetry) return
    try {
      await retryTask(detail.id)
      await loadDetail(detail.id)
      await loadList()
    } catch (err) {
      setError(formatError(err, '重新运行任务失败（可能无权限或状态已变化）'))
    }
  }

  const handleExport = async (format: 'pdf' | 'json' | 'excel') => {
    if (!detail || !detail.canExport) return
    setExporting(true)
    setError(null)
    try {
      await exportTask(detail.id, format)
      // 在 demo 模式下 exportTask 会抛出未开通错误
    } catch (err) {
      setError(formatError(err, '导出任务失败或未开通'))
    } finally {
      setExporting(false)
    }
  }

  const activeTasks = useMemo(
    () =>
      tasks
        .filter((item) => ACTIVE_STATUSES.includes(item.status))
        .sort((a, b) => (a.updatedAt > b.updatedAt ? -1 : 1))
        .slice(0, 4),
    [tasks],
  )

  const latestActivities = useMemo(
    () =>
      [...tasks]
        .sort((a, b) => (a.updatedAt > b.updatedAt ? -1 : 1))
        .slice(0, 6),
    [tasks],
  )

  const alerts = useMemo(
    () =>
      tasks
        .filter((item) => item.status === 'failed' || item.status === 'paused')
        .sort((a, b) => (a.updatedAt > b.updatedAt ? -1 : 1))
        .slice(0, 3),
    [tasks],
  )

  const formatTime = (iso?: string | null) => {
    if (!iso) return '--'
    return new Date(iso).toLocaleString('zh-CN', { hour12: false })
  }

  return (
    <div className="tasks-workspace">
      <div className="tasks-header">
        <div>
          <p className="tasks-subtitle">任务中心</p>
          <h2 className="tasks-title">监控训练、分析、上传与报告生成</h2>
        </div>
        <div className="tasks-actions">
          <button className="ghost-button" type="button" onClick={loadList} disabled={loadingList}>
            刷新
          </button>
        </div>
      </div>

      {error ? (
        <div className="tasks-banner tasks-banner--error">
          <div className="tasks-banner__text">{error}</div>
          <div className="tasks-banner__actions">
            <button className="ghost-button" type="button" onClick={loadList} disabled={loadingList}>
              重试加载
            </button>
          </div>
        </div>
      ) : null}

      <div className="tasks-summary">
        {(['queued', 'pending', 'in_progress', 'done', 'failed'] as TaskStatus[]).map((status) => (
          <div key={status} className="tasks-summary__card">
            <div className="tasks-summary__label">
              <span>{STATUS_META[status].icon}</span>
              <span>{STATUS_META[status].label}</span>
            </div>
            <div className="tasks-summary__value">{summary?.[status] ?? 0}</div>
          </div>
        ))}
      </div>

      <div className="tasks-dash">
        <div className="tasks-dash__panel">
          <div className="tasks-dash__head">
            <span className="tasks-card__title">活跃进度</span>
            <span className="tasks-dash__hint">队列/处理中/暂停</span>
          </div>
          {activeTasks.length === 0 ? (
            <div className="tasks-empty">暂无活跃任务</div>
          ) : (
            <ul className="tasks-active">
              {activeTasks.map((task) => (
                <li key={task.id} className="tasks-active__item">
                  <div>
                    <div className="tasks-active__title">
                      <span>{task.name}</span>
                      <span className={['task-badge', `tone-${STATUS_META[task.status].tone}`].join(' ')}>
                        {STATUS_META[task.status].label}
                      </span>
                    </div>
                    <div className="tasks-active__meta">
                      <span>{TYPE_LABELS[task.type]}</span>
                      {task.dataSource?.caseId ? <span>{task.dataSource.caseId}</span> : null}
                    </div>
                  </div>
                  <div className="tasks-active__progress">
                    <div className="tasks-progress__bar">
                      <div
                        className="tasks-progress__fill"
                        style={{ width: `${Math.min(Math.max(task.progress ?? 0, 0), 100)}%` }}
                      />
                    </div>
                    <span className="tasks-active__eta">{task.eta ? `ETA ${new Date(task.eta).toLocaleTimeString('zh-CN', { hour12: false })}` : '无 ETA'}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="tasks-dash__panel">
          <div className="tasks-dash__head">
            <span className="tasks-card__title">最新动态</span>
            <span className="tasks-dash__hint">按更新时间</span>
          </div>
          {latestActivities.length === 0 ? (
            <div className="tasks-empty">暂无动态</div>
          ) : (
            <ul className="tasks-feed">
              {latestActivities.map((task) => (
                <li key={task.id} className="tasks-feed__item">
                  <div>
                    <div className="tasks-feed__title">{task.name}</div>
                    <div className="tasks-feed__meta">
                      <span>{STATUS_META[task.status].icon} {STATUS_META[task.status].label}</span>
                      <span>{TYPE_LABELS[task.type]}</span>
                    </div>
                  </div>
                  <span className="tasks-feed__time">{formatTime(task.updatedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="tasks-dash__panel">
          <div className="tasks-dash__head">
            <span className="tasks-card__title">预警</span>
            <span className="tasks-dash__hint">失败/暂停</span>
          </div>
          {alerts.length === 0 ? (
            <div className="tasks-empty">暂无预警</div>
          ) : (
            <ul className="tasks-alerts">
              {alerts.map((task) => (
                <li key={task.id} className="tasks-alerts__item">
                  <div>
                    <div className="tasks-alerts__title">{task.name}</div>
                    <div className="tasks-alerts__meta">
                      <span className={['task-badge', `tone-${STATUS_META[task.status].tone}`].join(' ')}>
                        {STATUS_META[task.status].icon} {STATUS_META[task.status].label}
                      </span>
                      <span className="task-chip">{TYPE_LABELS[task.type]}</span>
                    </div>
                  </div>
                  <span className="tasks-alerts__time">{formatTime(task.updatedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="tasks-filters">
        <div className="pill-group" role="tablist" aria-label="状态筛选">
          {(['all', 'queued', 'pending', 'in_progress', 'done', 'failed', 'paused', 'canceled'] as Array<
            TaskStatus | 'all'
          >).map((status) => (
            <button
              key={status}
              className={['pill-button', statusFilter === status ? 'is-active' : ''].join(' ').trim()}
              type="button"
              onClick={() => setStatusFilter(status)}
            >
              {status === 'all' ? '全部' : STATUS_META[status].label}
            </button>
          ))}
        </div>
        <div className="pill-group" role="tablist" aria-label="类型筛选">
          {(['all', 'upload', 'auto_analysis', 'review', 'training', 'prediction', 'report', 'annotation'] as Array<
            TaskType | 'all'
          >).map((type) => (
            <button
              key={type}
              className={['pill-button', typeFilter === type ? 'is-active' : ''].join(' ').trim()}
              type="button"
              onClick={() => setTypeFilter(type)}
            >
              {type === 'all' ? '全部类型' : TYPE_LABELS[type]}
            </button>
          ))}
        </div>
      </div>

      <div className="tasks-panels">
        <div className="tasks-list" aria-label="任务列表">
          {loadingList ? <div className="tasks-loading">加载中...</div> : null}
          {!loadingList && filteredTasks.length === 0 ? (
            <div className="tasks-empty">暂无任务</div>
          ) : (
            filteredTasks.map((item) => (
              <button
                key={item.id}
                className={['task-row', selectedId === item.id ? 'is-active' : ''].join(' ').trim()}
                type="button"
                onClick={() => setSelectedId(item.id)}
              >
                <div className="task-row__head">
                  <div className="task-row__title">
                    <span className="task-row__name">{item.name}</span>
                    <span className={['task-badge', `tone-${STATUS_META[item.status].tone}`].join(' ')}>
                      {STATUS_META[item.status].icon} {STATUS_META[item.status].label}
                    </span>
                  </div>
                  <span className="task-row__time">
                    创建 {new Date(item.createdAt).toLocaleString('zh-CN', { hour12: false })}
                  </span>
                </div>
                <div className="task-row__meta">
                  <span className="task-chip">{TYPE_LABELS[item.type]}</span>
                  <span className="task-chip">责任人：{item.assignee}</span>
                  {item.modelVersion ? <span className="task-chip">模型：{item.modelVersion}</span> : null}
                  {item.progress !== null ? <span className="task-chip">进度：{item.progress}%</span> : null}
                  {item.eta ? <span className="task-chip">ETA：{new Date(item.eta).toLocaleTimeString('zh-CN', { hour12: false })}</span> : null}
                </div>
                {item.summary ? <p className="task-row__summary">{item.summary}</p> : null}
              </button>
            ))
          )}
        </div>

        <div className="tasks-detail" aria-label="任务详情">
          {!detail ? (
            <div className="tasks-empty">请选择左侧任务</div>
          ) : (
            <>
              <div className="tasks-detail__header">
                <div>
                  <p className="tasks-detail__subtitle">{TYPE_LABELS[detail.type]}</p>
                  <h3 className="tasks-detail__title">{detail.name}</h3>
                  <div className="tasks-detail__chips">
                    <span className={['task-badge', `tone-${STATUS_META[detail.status].tone}`].join(' ')}>
                      {STATUS_META[detail.status].icon} {STATUS_META[detail.status].label}
                    </span>
                    <span className="task-chip">责任人：{detail.assignee}</span>
                    {detail.dataSource?.caseId ? <span className="task-chip">病例：{detail.dataSource.caseId}</span> : null}
                    {detail.dataSource?.sourceType ? <span className="task-chip">来源：{detail.dataSource.sourceType}</span> : null}
                  </div>
                </div>
                <div className="tasks-detail__actions">
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={handleRetry}
                    disabled={!detail.canRetry || loadingDetail}
                  >
                    重跑
                  </button>
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={handleStop}
                    disabled={!detail.canStop || loadingDetail}
                  >
                    停止
                  </button>
                  <div className="tasks-export">
                    <select
                      className="tasks-export__select"
                      aria-label="导出格式"
                      onChange={(e) => {
                        const format = e.target.value as 'pdf' | 'json' | 'excel'
                        if (format) handleExport(format)
                      }}
                      disabled={!detail.canExport || exporting}
                      defaultValue=""
                    >
                      <option value="" disabled>
                        导出
                      </option>
                      <option value="pdf">PDF</option>
                      <option value="json">JSON</option>
                      <option value="excel">Excel</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="tasks-detail__grid">
                <div className="tasks-card">
                  <div className="tasks-card__title">进度</div>
                  <div className="tasks-progress">
                    <div className="tasks-progress__bar">
                      <div
                        className="tasks-progress__fill"
                        style={{ width: `${Math.min(Math.max(detail.progress ?? 0, 0), 100)}%` }}
                      />
                    </div>
                    <div className="tasks-progress__meta">
                      <span>{detail.progress ?? 0}%</span>
                      {detail.eta ? (
                        <span>ETA {new Date(detail.eta).toLocaleTimeString('zh-CN', { hour12: false })}</span>
                      ) : (
                        <span>无 ETA</span>
                      )}
                    </div>
                  </div>
                  <ul className="tasks-steps">
                    {detail.steps.map((step) => (
                      <li key={step.name} className="tasks-step">
                        <div className="tasks-step__head">
                          <span className="tasks-step__name">{step.name}</span>
                          <span className={['task-badge', `tone-${STATUS_META[step.status].tone}`].join(' ')}>
                            {STATUS_META[step.status].label}
                          </span>
                        </div>
                        <div className="tasks-step__progress">
                          <div
                            className="tasks-progress__fill"
                            style={{ width: `${Math.min(Math.max(step.progress ?? 0, 0), 100)}%` }}
                          />
                          <span className="tasks-step__percent">{step.progress ?? 0}%</span>
                        </div>
                        <div className="tasks-step__meta">
                          {step.startedAt ? <span>开始：{step.startedAt}</span> : null}
                          {step.endedAt ? <span>结束：{step.endedAt}</span> : null}
                          {step.responsible ? <span>责任：{step.responsible}</span> : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="tasks-card">
                  <div className="tasks-card__title">模型 / 数据</div>
                  <div className="tasks-meta">
                    <p>模型版本：{detail.modelVersion ?? '未提供'}</p>
                    <p>重试次数：{detail.retryCount}</p>
                    <p>失败原因：{detail.failureReason ?? '无'}</p>
                    {detail.queuePosition ? <p>队列位置：{detail.queuePosition}</p> : null}
                    {detail.dataSource?.modality ? <p>模态：{detail.dataSource.modality}</p> : null}
                    {detail.eta ? <p>ETA：{formatTime(detail.eta)}</p> : <p>ETA：无</p>}
                  </div>
                </div>
                <div className="tasks-card tasks-card--logs">
                  <div className="tasks-card__title">任务日志</div>
                  <div className="tasks-logs">
                    {logState.items.length === 0 ? (
                      <div className="tasks-empty">暂无日志</div>
                    ) : (
                      logState.items.map((log) => (
                        <div key={`${log.ts}-${log.message}`} className={`task-log task-log--${log.level}`}>
                          <span className="task-log__ts">{new Date(log.ts).toLocaleTimeString('zh-CN', { hour12: false })}</span>
                          <span className="task-log__level">{log.level.toUpperCase()}</span>
                          <span className="task-log__msg">{log.message}</span>
                        </div>
                      ))
                    )}
                    {logState.hasMore ? (
                      <button
                        className="ghost-button ghost-button--full"
                        type="button"
                        onClick={handleLoadMoreLogs}
                        disabled={logState.loading}
                      >
                        {logState.loading ? '加载中...' : '加载更多日志'}
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
