import { Router } from 'express'
import type { Request, Response, NextFunction } from 'express'
import multer from 'multer'
import crypto from 'node:crypto'
import { pool } from '../db/pool.js'
import {
  ensureCaseReportsSortOrder,
  ensureCaseReportsTable,
  ensureCaseSamplesSortOrder,
  ensureSampleTissueAnalysisTable,
} from '../db/init.js'
import { storeFile, deleteStoredFile } from '../utils/fileStorage.js'
import { authenticateRequest } from '../auth/middleware.js'
import { validateCsrf } from '../auth/csrf.js'
import { CaseAccessError, canAccessCase, effectiveCaseCapabilities, grantCasePermission, recordCaseAudit, revokeCasePermission, visibleCasesSql, withAuthorizedCaseMutation } from '../auth/caseAccess.js'
import type { CasePermission } from '../auth/caseAccess.js'
import type { SessionContext } from '../auth/types.js'
import type {
  CaseReportRecord,
  CaseSampleRecord,
  CaseWithRelations,
  Modality,
  TissueAnalysis,
} from '../types.js'

const allowedModalities: Modality[] = ['组织切片', 'CT片', '核磁共振片']

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 200 * 1024 * 1024, // 200MB 上限
    files: 20,
  },
})

const casesRouter = Router()

const caseApiGuard = async (req: Request, res: Response, next: NextFunction) => {
  await authenticateRequest(req, res, () => {
    const user = res.locals.auth as SessionContext | undefined
    if (!user) return
    const allowedOrigins = req.app.locals.allowedOrigins as Set<string>
    const origin = req.get('origin')
    if (!origin || origin === 'null' || !allowedOrigins.has(origin)) {
      res.status(403).json({ message: '来源不受信任' })
      return
    }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !validateCsrf(req, user.sessionId)) {
      res.status(403).json({ message: '安全令牌无效或已过期' })
      return
    }
    next()
  })
}
casesRouter.use(caseApiGuard)

const currentUser = (res: Response) => res.locals.auth as SessionContext

const requireCaseCapability = async (req: Request, res: Response, permission: 'read' | 'edit' | 'upload') => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 1))', [`case-access:${req.params.caseId}`])
    const capability = await canAccessCase(currentUser(res), req.params.caseId, permission, client)
    if (!capability) { await client.query('ROLLBACK'); res.status(404).json({ message: '病例不存在或无权访问' }); return false }
    res.locals.caseCapabilities = capability
    await client.query('COMMIT')
    return true
  } catch (error) { await client.query('ROLLBACK').catch(() => undefined); throw error }
  finally { client.release() }
}

const withAdminCaseMutation = async <T>(user: SessionContext, caseId: string, operation: (client: import('pg').PoolClient) => Promise<T>) =>
  withAuthorizedCaseMutation(user, caseId, 'edit', operation)

const mapAccessError = (error: unknown) => error instanceof CaseAccessError ? new HttpError(404, '病例不存在或无权访问') : error

const capabilitiesForCase = async (user: SessionContext, caseId: string, ownerId: string | null) => {
  if (user.role === 'admin' || user.role === 'researcher' || !ownerId) return effectiveCaseCapabilities(user, ownerId, [])
  const result = await pool.query('SELECT permission FROM case_access_grants WHERE case_id=$1 AND user_id=$2 AND revoked_at IS NULL', [caseId, user.id])
  return effectiveCaseCapabilities(user, ownerId, result.rows.map((row) => row.permission as CasePermission))
}

const canCreateClinicalCase = (res: Response) => {
  const user = currentUser(res)
  return user.role === 'admin' || user.role === 'pathologist'
}

const MAX_REPORT_TITLE_LENGTH = 200
const MAX_REPORT_SUMMARY_LENGTH = 1000
const MAX_REPORT_CONTENT_LENGTH = 10000

class HttpError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const hasOwn = (value: Record<string, unknown>, key: string) => Object.prototype.hasOwnProperty.call(value, key)

const mapSamples = (rows: Array<Record<string, unknown>>): CaseSampleRecord[] =>
  rows.map((row) => ({
    id: String(row.id),
    case_id: String(row.case_id),
    modality: row.modality as Modality,
    description: (row.description as string | null) ?? null,
    original_filename: String(row.original_filename),
    storage_path: String(row.storage_path),
    storage_thumbnail: (row.storage_thumbnail as string | null) ?? null,
    checksum: (row.checksum as string | null) ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    analysis: undefined,
  }))

const mapReports = (rows: Array<Record<string, unknown>>): CaseReportRecord[] =>
  rows.map((row) => ({
    id: String(row.id),
    case_id: String(row.case_id),
    title: String(row.title),
    summary: (row.summary as string | null) ?? null,
    content: String(row.content),
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  }))

const parseNonEmptyString = (value: unknown, field: string, maxLength: number) => {
  if (typeof value !== 'string') {
    throw new HttpError(400, `${field} 必须是字符串`)
  }
  const trimmed = value.trim()
  if (!trimmed) {
    throw new HttpError(400, `${field} 不能为空`)
  }
  if (trimmed.length > maxLength) {
    throw new HttpError(400, `${field} 长度不能超过 ${maxLength} 字`)
  }
  return trimmed
}

const parseOptionalString = (value: unknown, field: string, maxLength: number) => {
  if (value === undefined || value === null) {
    return null
  }
  if (typeof value !== 'string') {
    throw new HttpError(400, `${field} 必须是字符串`)
  }
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }
  if (trimmed.length > maxLength) {
    throw new HttpError(400, `${field} 长度不能超过 ${maxLength} 字`)
  }
  return trimmed
}

const parseTags = (value: unknown) => {
  if (value === undefined || value === null) {
    return []
  }
  if (!Array.isArray(value)) {
    throw new HttpError(400, 'tags 必须是字符串数组')
  }
  return value.map((item, index) => {
    if (typeof item !== 'string') {
      throw new HttpError(400, `tags 第 ${index + 1} 项必须是字符串`)
    }
    const trimmed = item.trim()
    if (!trimmed) {
      throw new HttpError(400, `tags 第 ${index + 1} 项不能为空`)
    }
    if (trimmed.length > 50) {
      throw new HttpError(400, `tags 第 ${index + 1} 项长度不能超过 50 字`)
    }
    return trimmed
  })
}

const parseMetadata = (value: unknown) => {
  if (value === undefined || value === null) {
    return {}
  }
  if (!isPlainObject(value)) {
    throw new HttpError(400, 'metadata 必须是对象')
  }
  return value as Record<string, unknown>
}

const parseModality = (value: unknown) => {
  if (typeof value !== 'string') {
    throw new HttpError(400, 'modality 必须是字符串')
  }
  if (!allowedModalities.includes(value as Modality)) {
    throw new HttpError(400, '不支持的 modality')
  }
  return value as Modality
}

type ReportPayload = {
  title: string
  summary: string | null
  content: string
  tags: string[]
  metadata: Record<string, unknown>
}

type ReportPatchPayload = Partial<ReportPayload>

const normalizeReportForInsert = (input: unknown): ReportPayload => {
  if (!isPlainObject(input)) {
    throw new HttpError(400, '文字病历格式错误')
  }
  const data = input as Record<string, unknown>
  const title = parseNonEmptyString(data.title, 'title', MAX_REPORT_TITLE_LENGTH)
  const content = parseNonEmptyString(data.content, 'content', MAX_REPORT_CONTENT_LENGTH)
  const summary = parseOptionalString(data.summary, 'summary', MAX_REPORT_SUMMARY_LENGTH)
  const tags = parseTags(data.tags)
  const metadata = parseMetadata(data.metadata)
  return { title, content, summary, tags, metadata }
}

const normalizeReportForPatch = (input: unknown): ReportPatchPayload => {
  if (!isPlainObject(input)) {
    throw new HttpError(400, '文字病历格式错误')
  }
  const data = input as Record<string, unknown>
  const result: ReportPatchPayload = {}
  let touched = 0

  if (hasOwn(data, 'title')) {
    result.title = parseNonEmptyString(data.title, 'title', MAX_REPORT_TITLE_LENGTH)
    touched += 1
  }

  if (hasOwn(data, 'summary')) {
    result.summary = parseOptionalString(data.summary, 'summary', MAX_REPORT_SUMMARY_LENGTH)
    touched += 1
  }

  if (hasOwn(data, 'content')) {
    result.content = parseNonEmptyString(data.content, 'content', MAX_REPORT_CONTENT_LENGTH)
    touched += 1
  }

  if (hasOwn(data, 'tags')) {
    result.tags = parseTags(data.tags)
    touched += 1
  }

  if (hasOwn(data, 'metadata')) {
    result.metadata = parseMetadata(data.metadata)
    touched += 1
  }

  if (touched === 0) {
    throw new HttpError(400, '需要至少提供一个可更新字段')
  }

  return result
}

const normalizeSampleForPatch = (input: unknown) => {
  if (!isPlainObject(input)) {
    throw new HttpError(400, '影像样例参数格式错误')
  }

  const data = input as Record<string, unknown>
  const result: { description?: string; modality?: Modality } = {}
  let touched = 0

  if (hasOwn(data, 'displayName')) {
    result.description = parseNonEmptyString(data.displayName, 'displayName', 200)
    touched += 1
  }

  if (hasOwn(data, 'modality')) {
    result.modality = parseModality(data.modality)
    touched += 1
  }

  if (touched === 0) {
    throw new HttpError(400, '需要至少提供一个可更新字段')
  }

  return result
}

const parseTextReportsField = (rawValue: string): ReportPayload[] => {
  if (!rawValue) {
    return []
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(rawValue)
  } catch (error) {
    throw new HttpError(400, '文字病历格式错误')
  }

  if (!Array.isArray(parsed)) {
    throw new HttpError(400, '文字病历必须是数组')
  }

  return parsed.map((item, index) => {
    try {
      return normalizeReportForInsert(item)
    } catch (error) {
      if (error instanceof HttpError) {
        throw new HttpError(error.status, `第 ${index + 1} 条文字病历错误: ${error.message}`)
      }
      throw error
    }
  })
}

const assertCaseExists = async (caseId: string) => {
  const result = await pool.query('SELECT id FROM cases WHERE id = $1', [caseId])
  if (result.rowCount === 0) {
    throw new HttpError(404, '病例不存在')
  }
  return result.rows[0].id as string
}

const fetchReportRow = async (caseId: string, reportId: string) => {
  const result = await pool.query('SELECT * FROM case_reports WHERE id = $1 AND case_id = $2', [reportId, caseId])
  if (result.rowCount === 0) {
    throw new HttpError(404, '文字病历不存在')
  }
  return result.rows[0]
}

const fetchRowsByCaseIds = async (table: 'case_samples' | 'case_reports', ids: string[]) => {
  if (ids.length === 0) {
    return []
  }
  const placeholders = ids.map((_, index) => `$${index + 1}`).join(', ')
  const orderClause = `${table}.sort_order ASC NULLS LAST, ${table}.created_at DESC`
  const query = `SELECT * FROM ${table} WHERE case_id IN (${placeholders}) ORDER BY ${orderClause}`
  const result = await pool.query(query, ids)
  return result.rows
}

const fetchCaseWithRelations = async (caseId: string, user: SessionContext): Promise<CaseWithRelations | null> => {
  await Promise.all([ensureCaseSamplesSortOrder(), ensureCaseReportsSortOrder(), ensureSampleTissueAnalysisTable()])

  const caseResult = await pool.query('SELECT * FROM cases WHERE id = $1', [caseId])
  if (caseResult.rowCount === 0) {
    return null
  }

  const row = caseResult.rows[0]
  const [samplesResult, reportsResult] = await Promise.all([
    pool.query(
      'SELECT * FROM case_samples WHERE case_id = $1 ORDER BY sort_order ASC NULLS LAST, created_at DESC',
      [caseId],
    ),
    pool.query(
      'SELECT * FROM case_reports WHERE case_id = $1 ORDER BY sort_order ASC NULLS LAST, created_at DESC',
      [caseId],
    ),
  ])

  const samples = mapSamples(samplesResult.rows)
  const tissueSampleIds = samples.filter((s) => s.modality === '组织切片').map((s) => s.id)

  if (tissueSampleIds.length > 0) {
    const placeholders = tissueSampleIds.map((_, i) => `$${i + 1}`).join(', ')
    const analysisResult = await pool.query(
      `SELECT * FROM sample_tissue_analysis WHERE sample_id IN (${placeholders})`,
      tissueSampleIds,
    )
    const bySampleId = new Map<string, TissueAnalysis>()
    for (const r of analysisResult.rows) {
      bySampleId.set(String(r.sample_id), {
        raw: {
          pos_cells_1_weak: r.pos_cells_1_weak ?? null,
          pos_cells_2_moderate: r.pos_cells_2_moderate ?? null,
          pos_cells_3_strong: r.pos_cells_3_strong ?? null,
          iod_total_cells: r.iod_total_cells ?? null,
          positive_area_mm2: r.positive_area_mm2 ?? null,
          tissue_area_mm2: r.tissue_area_mm2 ?? null,
          positive_area_px: r.positive_area_px ?? null,
          tissue_area_px: r.tissue_area_px ?? null,
          positive_intensity: r.positive_intensity ?? null,
        },
        derived: {
          positive_cells_ratio: r.positive_cells_ratio ?? null,
          positive_cells_density: r.positive_cells_density ?? null,
          mean_density: r.mean_density ?? null,
          h_score: r.h_score ?? null,
          irs: r.irs ?? null,
        },
        images: {
          raw_image_path: r.raw_image_path ?? null,
          parsed_image_path: r.parsed_image_path ?? null,
        },
        metadata: r.metadata ?? {},
      })
    }
    for (const s of samples) {
      if (s.modality === '组织切片') {
        s.analysis = bySampleId.get(s.id) ?? null
      }
    }
  }

  return {
    id: row.id,
    identifier: row.identifier,
    display_name: row.display_name,
    notes: row.notes,
    metadata: row.metadata ?? {},
    created_at: row.created_at,
    updated_at: row.updated_at,
    samples,
    reports: mapReports(reportsResult.rows),
    capabilities: await capabilitiesForCase(user, caseId, row.owner_user_id),
  }
}

casesRouter.get('/', async (_req, res) => {
  try {
    await Promise.all([
      ensureCaseReportsTable(),
      ensureCaseSamplesSortOrder(),
      ensureCaseReportsSortOrder(),
      ensureSampleTissueAnalysisTable(),
    ])
    const visible = visibleCasesSql(currentUser(res))
    const casesResult = await pool.query(`SELECT c.* FROM cases c WHERE ${visible.sql} ORDER BY c.created_at DESC`, visible.values)
    const caseRows = casesResult.rows

    if (caseRows.length === 0) {
      res.json([])
      return
    }

    const ids = caseRows.map((row) => row.id)
    const grantsResult = ['admin', 'researcher'].includes(currentUser(res).role) ? { rows: [] } : await pool.query("SELECT case_id, permission FROM case_access_grants WHERE user_id=$1 AND revoked_at IS NULL", [currentUser(res).id])
    const grantsByCase = new Map<string, CasePermission[]>()
    for (const grant of grantsResult.rows) grantsByCase.set(grant.case_id, [...(grantsByCase.get(grant.case_id) ?? []), grant.permission])
    const [samplesResult, reportsResult] = await Promise.all([
      fetchRowsByCaseIds('case_samples', ids),
      fetchRowsByCaseIds('case_reports', ids),
    ])

    const samplesMap = new Map<string, CaseSampleRecord[]>()
    for (const sample of mapSamples(samplesResult)) {
      if (!samplesMap.has(sample.case_id)) {
        samplesMap.set(sample.case_id, [])
      }
      samplesMap.get(sample.case_id)!.push(sample)
    }

    const reportsMap = new Map<string, CaseReportRecord[]>()
    for (const report of mapReports(reportsResult)) {
      if (!reportsMap.has(report.case_id)) {
        reportsMap.set(report.case_id, [])
      }
      reportsMap.get(report.case_id)!.push(report)
    }

    // 关联组织切片分析
    const allSamples = Array.from(samplesMap.values()).flat()
    const tissueSampleIdsAll = allSamples.filter((s) => s.modality === '组织切片').map((s) => s.id)
    if (tissueSampleIdsAll.length > 0) {
      const placeholders = tissueSampleIdsAll.map((_, i) => `$${i + 1}`).join(', ')
      const analysisResult = await pool.query(
        `SELECT * FROM sample_tissue_analysis WHERE sample_id IN (${placeholders})`,
        tissueSampleIdsAll,
      )
      const bySampleId = new Map<string, TissueAnalysis>()
      for (const r of analysisResult.rows) {
        bySampleId.set(String(r.sample_id), {
          raw: {
            pos_cells_1_weak: r.pos_cells_1_weak ?? null,
            pos_cells_2_moderate: r.pos_cells_2_moderate ?? null,
            pos_cells_3_strong: r.pos_cells_3_strong ?? null,
            iod_total_cells: r.iod_total_cells ?? null,
            positive_area_mm2: r.positive_area_mm2 ?? null,
            tissue_area_mm2: r.tissue_area_mm2 ?? null,
            positive_area_px: r.positive_area_px ?? null,
            tissue_area_px: r.tissue_area_px ?? null,
            positive_intensity: r.positive_intensity ?? null,
          },
          derived: {
            positive_cells_ratio: r.positive_cells_ratio ?? null,
            positive_cells_density: r.positive_cells_density ?? null,
            mean_density: r.mean_density ?? null,
            h_score: r.h_score ?? null,
            irs: r.irs ?? null,
          },
          images: {
            raw_image_path: r.raw_image_path ?? null,
            parsed_image_path: r.parsed_image_path ?? null,
          },
          metadata: r.metadata ?? {},
        })
      }
      for (const sample of allSamples) {
        if (sample.modality === '组织切片') {
          sample.analysis = bySampleId.get(sample.id) ?? null
        }
      }
    }

    const data: CaseWithRelations[] = caseRows.map((row) => ({
      id: row.id,
      identifier: row.identifier,
      display_name: row.display_name,
      notes: row.notes,
      metadata: row.metadata ?? {},
      created_at: row.created_at,
      updated_at: row.updated_at,
      samples: samplesMap.get(row.id) ?? [],
      reports: reportsMap.get(row.id) ?? [],
      capabilities: effectiveCaseCapabilities(currentUser(res), row.owner_user_id, grantsByCase.get(row.id) ?? []),
    }))

    res.json(data)
  } catch (error) {
    console.error('获取病例列表失败', error)
    res.status(500).json({ message: '获取病例列表失败' })
  }
})

casesRouter.post('/', upload.array('sampleFiles'), async (req, res) => {
  if (!canCreateClinicalCase(res)) { res.status(403).json({ message: '无权创建病例' }); return }
  const identifier = typeof req.body.identifier === 'string' ? req.body.identifier.trim() : ''
  const displayName = typeof req.body.displayName === 'string' ? req.body.displayName.trim() : null
  const notes = typeof req.body.notes === 'string' ? req.body.notes.trim() : null
  const files = (req.files as Express.Multer.File[]) ?? []

  const rawSamplesMeta = typeof req.body.samplesMeta === 'string' ? req.body.samplesMeta : '[]'
  const rawTextReports = typeof req.body.textReports === 'string' ? req.body.textReports : ''

  if (!identifier) {
    res.status(400).json({ message: '需要提供病例 identifier' })
    return
  }

  let textReportsPayload: ReportPayload[] = []
  try {
    textReportsPayload = parseTextReportsField(rawTextReports)
  } catch (error) {
    if (error instanceof HttpError) {
      res.status(error.status).json({ message: error.message })
      return
    }
    throw error
  }

  if (files.length === 0 && textReportsPayload.length === 0) {
    res.status(400).json({ message: '请至少提供一个样例文件或文字病历' })
    return
  }

  let samplesMeta: Array<{ displayName: string; modality: Modality }>
  try {
    const parsed = JSON.parse(rawSamplesMeta) as Array<Record<string, unknown>>
    samplesMeta = parsed.map((item) => ({
      displayName: typeof item.displayName === 'string' ? item.displayName.trim() : '',
      modality: item.modality as Modality,
    }))
  } catch (error) {
    console.error('解析样例元数据失败', error)
    res.status(400).json({ message: '样例元数据格式错误' })
    return
  }

  if (samplesMeta.length !== files.length) {
    res.status(400).json({ message: '样例元数据与文件数量不匹配' })
    return
  }

  for (const meta of samplesMeta) {
    if (!meta.modality || !allowedModalities.includes(meta.modality)) {
      res.status(400).json({ message: `不支持的样例类别: ${meta.modality}` })
      return
    }
  }

  const client = await pool.connect()

  try {
    await Promise.all([ensureCaseSamplesSortOrder(), ensureCaseReportsSortOrder(), ensureCaseReportsTable()])
    await client.query('BEGIN')

    const caseResult = await client.query(
      `INSERT INTO cases (identifier, display_name, notes, owner_user_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [identifier, displayName, notes, currentUser(res).id],
    )

    if (caseResult.rowCount === 0) throw new HttpError(409, '病例编号已存在')

    const caseRow = caseResult.rows[0]

    if (files.length > 0) {
      const countsResult = await client.query(
        `SELECT modality, COUNT(*)::int AS count
         FROM case_samples
         WHERE case_id = $1
         GROUP BY modality`,
        [caseRow.id],
      )

      const sortResult = await client.query(
        'SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM case_samples WHERE case_id = $1',
        [caseRow.id],
      )

      let nextSampleOrder = Number(sortResult.rows[0]?.max_order ?? 0)

      const modalityCounters = new Map<Modality, number>()
      for (const row of countsResult.rows) {
        const modality = row.modality as Modality
        if (allowedModalities.includes(modality)) {
          modalityCounters.set(modality, Number(row.count) || 0)
        }
      }

      for (let index = 0; index < files.length; index += 1) {
        const file = files[index]
        const meta = samplesMeta[index]

        const checksum = crypto.createHash('sha256').update(file.buffer).digest('hex')
        const nextIndex = (modalityCounters.get(meta.modality) ?? 0) + 1
        modalityCounters.set(meta.modality, nextIndex)

        const stored = await storeFile(file)
        const storedFilename = stored.publicPath.split('/').pop() ?? file.originalname
        const friendlyName = meta.displayName || `${caseRow.identifier}_${meta.modality}_${nextIndex}`

        nextSampleOrder += 1

        await client.query(
          `INSERT INTO case_samples (case_id, modality, description, original_filename, storage_path, storage_thumbnail, checksum, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            caseRow.id,
            meta.modality,
            friendlyName || null,
            storedFilename,
            stored.publicPath,
            stored.publicPath,
            checksum,
            nextSampleOrder,
          ],
        )
      }
    }

    if (textReportsPayload.length > 0) {
      const sortResult = await client.query(
        'SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM case_reports WHERE case_id = $1',
        [caseRow.id],
      )
      let nextOrder = Number(sortResult.rows[0]?.max_order ?? 0)
      for (const report of textReportsPayload) {
        nextOrder += 1
        await client.query(
          `INSERT INTO case_reports (case_id, title, summary, content, tags, metadata, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [caseRow.id, report.title, report.summary, report.content, report.tags, report.metadata, nextOrder],
        )
      }
    }

    await recordCaseAudit(client, currentUser(res), caseRow.id, caseRow.identifier, 'case.create')

    await client.query('COMMIT')

    const [samplesResult, reportsResult] = await Promise.all([
      pool.query(
        'SELECT * FROM case_samples WHERE case_id = $1 ORDER BY sort_order ASC NULLS LAST, created_at DESC',
        [caseRow.id],
      ),
      pool.query(
        'SELECT * FROM case_reports WHERE case_id = $1 ORDER BY sort_order ASC NULLS LAST, created_at DESC',
        [caseRow.id],
      ),
    ])

    const response: CaseWithRelations = {
      id: caseRow.id,
      identifier: caseRow.identifier,
      display_name: caseRow.display_name,
      notes: caseRow.notes,
      metadata: caseRow.metadata ?? {},
      created_at: caseRow.created_at,
      updated_at: caseRow.updated_at,
      samples: mapSamples(samplesResult.rows),
      reports: mapReports(reportsResult.rows),
      capabilities: await capabilitiesForCase(currentUser(res), caseRow.id, caseRow.owner_user_id),
    }

    res.status(201).json(response)
  } catch (error) {
    await client.query('ROLLBACK')
    if ((error as { code?: string })?.code === '23505') {
      res.status(409).json({ message: '病例编号已存在' })
      return
    }
    if (error instanceof HttpError) {
      res.status(error.status).json({ message: error.message })
      return
    }
    console.error('创建病例失败', error)
    res.status(500).json({ message: '创建病例失败' })
  } finally {
    client.release()
  }
})

casesRouter.post('/:caseId/samples', upload.array('sampleFiles'), async (req, res) => {
  const { caseId } = req.params
  const files = (req.files as Express.Multer.File[]) ?? []
  let metas: Array<{ displayName: string; modality: Modality }>
  try {
    const raw = typeof req.body.samplesMeta === 'string' ? JSON.parse(req.body.samplesMeta) : []
    metas = raw.map((item: Record<string, unknown>) => ({ displayName: typeof item.displayName === 'string' ? item.displayName.trim() : '', modality: item.modality as Modality }))
  } catch { res.status(400).json({ message: '样例元数据格式错误' }); return }
  if (!files.length || metas.length !== files.length || metas.some((item) => !allowedModalities.includes(item.modality))) { res.status(400).json({ message: '样例文件或元数据无效' }); return }
  const ownedFiles: string[] = []
  try {
    const result = await withAuthorizedCaseMutation(currentUser(res), caseId, 'upload', async (client) => {
      const caseRow = await client.query('SELECT identifier FROM cases WHERE id=$1 FOR UPDATE', [caseId])
      if (!caseRow.rowCount) throw new HttpError(404, '病例不存在或无权访问')
      const count = await client.query('SELECT COUNT(*)::int AS count FROM case_samples WHERE case_id=$1', [caseId])
      const order = await client.query('SELECT COALESCE(MAX(sort_order),0)::int AS n FROM case_samples WHERE case_id=$1', [caseId])
      const rows = []
      for (let i = 0; i < files.length; i++) {
        const stored = await storeFile(files[i]); ownedFiles.push(stored.publicPath)
        const inserted = await client.query(`INSERT INTO case_samples(case_id,modality,description,original_filename,storage_path,storage_thumbnail,checksum,sort_order)
          VALUES($1,$2,$3,$4,$5,$5,$6,$7) RETURNING *`, [caseId, metas[i].modality, metas[i].displayName || null, stored.publicPath.split('/').pop(), stored.publicPath, crypto.createHash('sha256').update(files[i].buffer).digest('hex'), Number(order.rows[0].n) + i + 1])
        rows.push(inserted.rows[0])
      }
      await recordCaseAudit(client, currentUser(res), caseId, caseRow.rows[0].identifier, 'sample.append')
      return { rows, previousSampleCount: Number(count.rows[0].count) }
    })
    res.status(201).json({ samples: mapSamples(result.rows), previousSampleCount: result.previousSampleCount })
  } catch (error) {
    await Promise.all(ownedFiles.map((file) => deleteStoredFile(file)))
    const mapped = mapAccessError(error)
    if (mapped instanceof HttpError) { res.status(mapped.status).json({ message: mapped.message }); return }
    console.error('追加病例样本失败', error); res.status(500).json({ message: '追加病例样本失败' })
  }
})

casesRouter.post('/:caseId/access-grants', async (req, res) => {
  if (currentUser(res).role !== 'admin') { res.status(403).json({ message: '无权管理病例授权' }); return }
  const { userId, permission } = req.body ?? {}
  if (typeof userId !== 'string' || !['read', 'edit', 'upload'].includes(permission)) { res.status(400).json({ message: '授权参数无效' }); return }
  try { await grantCasePermission(currentUser(res), req.params.caseId, userId, permission); res.status(204).send() }
  catch (error) { console.error('病例授权失败', { name: (error as Error)?.name, code: (error as { code?: string })?.code }); res.status((error as Error).message === 'not-found' ? 404 : 400).json({ message: '无法授予病例权限' }) }
})

casesRouter.delete('/:caseId/access-grants/:userId/:permission', async (req, res) => {
  if (currentUser(res).role !== 'admin') { res.status(403).json({ message: '无权管理病例授权' }); return }
  const { userId, permission } = req.params
  if (!['read', 'edit', 'upload'].includes(permission)) { res.status(400).json({ message: '授权参数无效' }); return }
  try { await revokeCasePermission(currentUser(res), req.params.caseId, userId, permission as 'read' | 'edit' | 'upload'); res.status(204).send() }
  catch { res.status(404).json({ message: '病例不存在或无权访问' }) }
})

casesRouter.delete('/:caseId', async (req, res) => {
  const { caseId } = req.params
  if (currentUser(res).role !== 'admin') { res.status(403).json({ message: '无权删除病例' }); return }

  try {
    const samplesResult = await withAdminCaseMutation(currentUser(res), caseId, async (client) => {
      const samples = await client.query('SELECT storage_path FROM case_samples WHERE case_id=$1', [caseId])
      const row = await client.query('SELECT identifier FROM cases WHERE id=$1 FOR UPDATE', [caseId])
      if (!row.rowCount) throw new HttpError(404, '病例不存在或无权访问')
      await recordCaseAudit(client, currentUser(res), caseId, row.rows[0].identifier, 'case.delete')
      await client.query('DELETE FROM cases WHERE id=$1', [caseId])
      return samples.rows
    })
    await Promise.all(samplesResult.map((row) => deleteStoredFile(row.storage_path as string)))

    res.status(204).send()
  } catch (error) {
    const mapped = mapAccessError(error)
    if (mapped instanceof HttpError) { res.status(mapped.status).json({ message: mapped.message }); return }
    console.error('删除病例失败', error)
    res.status(500).json({ message: '删除病例失败' })
  }
})

casesRouter.patch('/:caseId/samples/:sampleId', async (req, res) => {
  const { caseId, sampleId } = req.params
  try {
    await withAuthorizedCaseMutation(currentUser(res), caseId, 'edit', async (client) => {
      const existing = await client.query('SELECT id FROM case_samples WHERE id = $1 AND case_id = $2 FOR UPDATE', [sampleId, caseId])
      if (existing.rowCount === 0) {
        throw new HttpError(404, '影像样例不存在')
      }

      const payload = normalizeSampleForPatch(req.body)
      const assignments: string[] = []
      const values: unknown[] = []

      if (Object.prototype.hasOwnProperty.call(payload, 'description')) {
        assignments.push(`description = $${assignments.length + 1}`)
        values.push(payload.description)
      }

      if (Object.prototype.hasOwnProperty.call(payload, 'modality')) {
        assignments.push(`modality = $${assignments.length + 1}`)
        values.push(payload.modality)
      }

      assignments.push('updated_at = NOW()')
      values.push(caseId, sampleId)

      const caseIndex = values.length - 1
      const sampleIndex = values.length

      const updateSql = `UPDATE case_samples SET ${assignments.join(', ')} WHERE case_id = $${caseIndex} AND id = $${sampleIndex}`
      await client.query(updateSql, values)
    })

    const updated = await fetchCaseWithRelations(caseId, currentUser(res))
    if (!updated) {
      throw new HttpError(500, '更新影像样例失败')
    }

    res.json(updated)
  } catch (error) {
    error = mapAccessError(error)
    if (error instanceof HttpError) {
      res.status(error.status).json({ message: error.message })
      return
    }
    console.error('更新影像样例失败', error)
    res.status(500).json({ message: '更新影像样例失败' })
  }
})

casesRouter.delete('/:caseId/samples/:sampleId', async (req, res) => {
  const { caseId, sampleId } = req.params
  if (currentUser(res).role !== 'admin') { res.status(403).json({ message: '无权删除样例' }); return }

  try {
    const storedPath = await withAdminCaseMutation(currentUser(res), caseId, async (client) => {
      const sample = await client.query('SELECT storage_path FROM case_samples WHERE id=$1 AND case_id=$2 FOR UPDATE', [sampleId, caseId])
      if (!sample.rowCount) throw new HttpError(404, '病例不存在或无权访问')
      const parent = await client.query('SELECT identifier FROM cases WHERE id=$1', [caseId])
      await recordCaseAudit(client, currentUser(res), caseId, parent.rows[0].identifier, 'sample.delete')
      await client.query('DELETE FROM case_samples WHERE id=$1 AND case_id=$2', [sampleId, caseId])
      return sample.rows[0].storage_path as string
    })

    await deleteStoredFile(storedPath)

    res.status(204).send()
  } catch (error) {
    const mapped = mapAccessError(error)
    if (mapped instanceof HttpError) { res.status(mapped.status).json({ message: mapped.message }); return }
    console.error('删除样例失败', error)
    res.status(500).json({ message: '删除样例失败' })
  }
})

casesRouter.patch('/:caseId', async (req, res) => {
  const { caseId } = req.params
  const { displayName } = req.body ?? {}

  try {
    await ensureCaseReportsTable()
    await withAuthorizedCaseMutation(currentUser(res), caseId, 'edit', async (client) => {

      const normalizedName = parseNonEmptyString(displayName, 'displayName', 120)
      await client.query('UPDATE cases SET display_name = $1, updated_at = NOW() WHERE id = $2', [normalizedName, caseId])
    })
    const updated = await fetchCaseWithRelations(caseId, currentUser(res))

    if (!updated) {
      res.status(404).json({ message: '病例不存在' })
      return
    }

    res.json(updated)
  } catch (error) {
    error = mapAccessError(error)
    if (error instanceof HttpError) {
      res.status(error.status).json({ message: error.message })
      return
    }
    console.error('更新病例失败', error)
    res.status(500).json({ message: '更新病例失败' })
  }
})

// GET /cases/:caseId/samples/:sampleId/analysis
casesRouter.get('/:caseId/samples/:sampleId/analysis', async (req, res) => {
  const { caseId, sampleId } = req.params
  if (!await requireCaseCapability(req, res, 'read')) return
  try {
    await ensureSampleTissueAnalysisTable()

    // 校验样本归属与模态
    const sampleResult = await pool.query('SELECT * FROM case_samples WHERE id = $1 AND case_id = $2', [sampleId, caseId])
    if (sampleResult.rowCount === 0) {
      res.status(404).json({ message: '样例不存在' })
      return
    }
    const sample = sampleResult.rows[0]
    if (sample.modality !== '组织切片') {
      res.status(403).json({ message: '该样例类型不支持此分析' })
      return
    }

    const analysisResult = await pool.query('SELECT * FROM sample_tissue_analysis WHERE sample_id = $1', [sampleId])
    if (analysisResult.rowCount === 0) {
      res.json(null)
      return
    }
    const r = analysisResult.rows[0]
    const payload: TissueAnalysis = {
      raw: {
        pos_cells_1_weak: r.pos_cells_1_weak ?? null,
        pos_cells_2_moderate: r.pos_cells_2_moderate ?? null,
        pos_cells_3_strong: r.pos_cells_3_strong ?? null,
        iod_total_cells: r.iod_total_cells ?? null,
        positive_area_mm2: r.positive_area_mm2 ?? null,
        tissue_area_mm2: r.tissue_area_mm2 ?? null,
        positive_area_px: r.positive_area_px ?? null,
        tissue_area_px: r.tissue_area_px ?? null,
        positive_intensity: r.positive_intensity ?? null,
      },
      derived: {
        positive_cells_ratio: r.positive_cells_ratio ?? null,
        positive_cells_density: r.positive_cells_density ?? null,
        mean_density: r.mean_density ?? null,
        h_score: r.h_score ?? null,
        irs: r.irs ?? null,
      },
      images: {
        raw_image_path: r.raw_image_path ?? null,
        parsed_image_path: r.parsed_image_path ?? null,
      },
      metadata: r.metadata ?? {},
    }
    res.json(payload)
  } catch (error) {
    console.error('获取样例分析失败', error)
    res.status(500).json({ message: '获取样例分析失败' })
  }
})

casesRouter.get('/:caseId/reports', async (req, res) => {
  const { caseId } = req.params
  try {
    if (!await requireCaseCapability(req, res, 'read')) return
    await Promise.all([ensureCaseReportsTable(), ensureCaseReportsSortOrder()])
    await assertCaseExists(caseId)
    const reportsResult = await pool.query(
      'SELECT * FROM case_reports WHERE case_id = $1 ORDER BY sort_order ASC NULLS LAST, created_at DESC',
      [caseId],
    )
    res.json(mapReports(reportsResult.rows))
  } catch (error) {
    if (error instanceof HttpError) {
      res.status(error.status).json({ message: error.message })
      return
    }
    console.error('获取文字病历失败', error)
    res.status(500).json({ message: '获取文字病历失败' })
  }
})

casesRouter.post('/:caseId/reports', async (req, res) => {
  const { caseId } = req.params
  try {
    await Promise.all([ensureCaseReportsTable(), ensureCaseReportsSortOrder()])
    const payload = normalizeReportForInsert(req.body)
    const inserted = await withAuthorizedCaseMutation(currentUser(res), caseId, 'edit', async (client) => {
        const orderResult = await client.query('SELECT COALESCE(MAX(sort_order),0) AS max_order FROM case_reports WHERE case_id=$1', [caseId])
        const nextOrder = Number(orderResult.rows[0]?.max_order ?? 0) + 1
        const result = await client.query(`INSERT INTO case_reports(case_id,title,summary,content,tags,metadata,sort_order)
          VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`, [caseId, payload.title, payload.summary, payload.content, payload.tags, payload.metadata, nextOrder])
        return result.rows[0]
    })
    res.status(201).json(mapReports([inserted])[0])
  } catch (error) {
    const mapped = mapAccessError(error)
    if (mapped instanceof HttpError) {
      res.status(mapped.status).json({ message: mapped.message })
      return
    }
    console.error('新增文字病历失败', error)
    res.status(500).json({ message: '新增文字病历失败' })
  }
})

casesRouter.patch('/:caseId/reports/:reportId', async (req, res) => {
  const { caseId, reportId } = req.params
  try {
    const mutationResult = await withAuthorizedCaseMutation(currentUser(res), caseId, 'edit', async (client) => {
      await ensureCaseReportsTable()
      const belongs = await client.query('SELECT 1 FROM case_reports WHERE id=$1 AND case_id=$2 FOR UPDATE', [reportId, caseId])
      if (!belongs.rowCount) throw new HttpError(404, '病例不存在或无权访问')
      const payload = normalizeReportForPatch(req.body)
      const setFragments: string[] = []
      const values: unknown[] = []

      if (payload.title !== undefined) {
        values.push(payload.title)
        setFragments.push(`title = $${values.length}`)
      }
      if (payload.summary !== undefined) {
        values.push(payload.summary)
        setFragments.push(`summary = $${values.length}`)
      }
      if (payload.content !== undefined) {
        values.push(payload.content)
        setFragments.push(`content = $${values.length}`)
      }
      if (payload.tags !== undefined) {
        values.push(payload.tags)
        setFragments.push(`tags = $${values.length}`)
      }
      if (payload.metadata !== undefined) {
        values.push(payload.metadata)
        setFragments.push(`metadata = $${values.length}`)
      }

      const reportIdIndex = values.length + 1
      const caseIdIndex = values.length + 2
      const updateQuery = `UPDATE case_reports SET ${setFragments.join(', ')}, updated_at = NOW()
        WHERE id = $${reportIdIndex} AND case_id = $${caseIdIndex}
        RETURNING *`
      values.push(reportId, caseId)

      const updateResult = await client.query(updateQuery, values)
      if (updateResult.rowCount === 0) {
        throw new HttpError(404, '文字病历不存在')
      }

      return updateResult.rows
    })
    res.json(mapReports(mutationResult)[0])
  } catch (error) {
    error = mapAccessError(error)
    if (error instanceof HttpError) {
      res.status(error.status).json({ message: error.message })
      return
    }
    console.error('更新文字病历失败', error)
    res.status(500).json({ message: '更新文字病历失败' })
  }
})

casesRouter.put('/:caseId/samples/order', async (req, res) => {
  const { caseId } = req.params
  const { ids } = (req.body ?? {}) as { ids?: unknown }

  try {
    await withAuthorizedCaseMutation(currentUser(res), caseId, 'edit', async (client) => {
      await ensureCaseSamplesSortOrder()

      if (!Array.isArray(ids) || ids.length === 0) {
        throw new HttpError(400, 'ids 必须是非空数组')
      }

      const orderedIds = ids.map((id, index) => {
        if (typeof id !== 'string') {
          throw new HttpError(400, `第 ${index + 1} 项 id 必须是字符串`)
        }
        const trimmed = id.trim()
        if (!trimmed) {
          throw new HttpError(400, `第 ${index + 1} 项 id 不能为空`)
        }
        return trimmed
    })

    const existingResult = await client.query('SELECT id FROM case_samples WHERE case_id = $1', [caseId])
    const existingIds = existingResult.rows.map((row) => String(row.id))

    if (existingIds.length !== orderedIds.length) {
      throw new HttpError(400, 'ids 数量必须与当前样本数一致')
    }

    const setExisting = new Set(existingIds)
    const setIncoming = new Set(orderedIds)

    if (setExisting.size !== setIncoming.size) {
      throw new HttpError(400, 'ids 列表存在重复项或缺失项')
    }

    for (const id of orderedIds) {
      if (!setExisting.has(id)) {
        throw new HttpError(400, 'ids 列表包含不属于该病例的样本')
      }
    }

    for (let index = 0; index < orderedIds.length; index += 1) {
      const sortOrder = index + 1
      await client.query('UPDATE case_samples SET sort_order = $1, updated_at = NOW() WHERE id = $2 AND case_id = $3', [sortOrder, orderedIds[index], caseId])
    }
    })

    res.status(204).send()
  } catch (error) {
    error = mapAccessError(error)
    if (error instanceof HttpError) {
      res.status(error.status).json({ message: error.message })
      return
    }
    console.error('重排样本顺序失败', error)
    res.status(500).json({ message: '重排样本顺序失败' })
  }
})

casesRouter.put('/:caseId/reports/order', async (req, res) => {
  const { caseId } = req.params
  const { ids } = (req.body ?? {}) as { ids?: unknown }

  try {
    await withAuthorizedCaseMutation(currentUser(res), caseId, 'edit', async (client) => {
      await ensureCaseReportsSortOrder()

      if (!Array.isArray(ids) || ids.length === 0) {
        throw new HttpError(400, 'ids 必须是非空数组')
      }

      const orderedIds = ids.map((id, index) => {
        if (typeof id !== 'string') {
          throw new HttpError(400, `第 ${index + 1} 项 id 必须是字符串`)
        }
        const trimmed = id.trim()
        if (!trimmed) {
          throw new HttpError(400, `第 ${index + 1} 项 id 不能为空`)
        }
        return trimmed
    })

    const existingResult = await client.query('SELECT id FROM case_reports WHERE case_id = $1', [caseId])
    const existingIds = existingResult.rows.map((row) => String(row.id))

    if (existingIds.length !== orderedIds.length) {
      throw new HttpError(400, 'ids 数量必须与当前文字病历数一致')
    }

    const setExisting = new Set(existingIds)
    const setIncoming = new Set(orderedIds)

    if (setExisting.size !== setIncoming.size) {
      throw new HttpError(400, 'ids 列表存在重复项或缺失项')
    }

    for (const id of orderedIds) {
      if (!setExisting.has(id)) {
        throw new HttpError(400, 'ids 列表包含不属于该病例的文字病历')
      }
    }

    for (let index = 0; index < orderedIds.length; index += 1) {
      const sortOrder = index + 1
      await client.query('UPDATE case_reports SET sort_order = $1, updated_at = NOW() WHERE id = $2 AND case_id = $3', [sortOrder, orderedIds[index], caseId])
    }
    })

    res.status(204).send()
  } catch (error) {
    error = mapAccessError(error)
    if (error instanceof HttpError) {
      res.status(error.status).json({ message: error.message })
      return
    }
    console.error('重排文字病历顺序失败', error)
    res.status(500).json({ message: '重排文字病历顺序失败' })
  }
})

casesRouter.delete('/:caseId/reports/:reportId', async (req, res) => {
  const { caseId, reportId } = req.params
  try {
    if (currentUser(res).role !== 'admin') { res.status(403).json({ message: '无权删除文字病历' }); return }
    await ensureCaseReportsTable()
    await withAdminCaseMutation(currentUser(res), caseId, async (client) => {
      const parent = await client.query('SELECT identifier FROM cases WHERE id=$1 FOR UPDATE', [caseId])
      if (!parent.rowCount) throw new HttpError(404, '病例不存在或无权访问')
      const exists = await client.query('SELECT 1 FROM case_reports WHERE id=$1 AND case_id=$2 FOR UPDATE', [reportId, caseId])
      if (!exists.rowCount) throw new HttpError(404, '病例不存在或无权访问')
      await recordCaseAudit(client, currentUser(res), caseId, parent.rows[0].identifier, 'report.delete')
      await client.query('DELETE FROM case_reports WHERE id = $1 AND case_id = $2', [reportId, caseId])
    })
    res.status(204).send()
  } catch (error) {
    const mapped = mapAccessError(error)
    if (mapped instanceof HttpError) {
      res.status(mapped.status).json({ message: mapped.message })
      return
    }
    console.error('删除文字病历失败', error)
    res.status(500).json({ message: '删除文字病历失败' })
  }
})

export { casesRouter }
