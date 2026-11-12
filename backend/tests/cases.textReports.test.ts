import express from 'express'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { newDb } from 'pg-mem'
import { randomUUID } from 'node:crypto'

const auditFailure = vi.hoisted(() => ({ enabled: false }))
const csrfState = vi.hoisted(() => ({ accepted: true }))
const fileCounter = vi.hoisted(() => ({ value: 0 }))
const caseLockCalls = vi.hoisted(() => ({ value: [] as string[] }))

vi.mock('../src/db/pool.js', () => {
  const db = newDb({ autoCreateForeignKeyIndices: true })
  db.public.registerFunction({
    name: 'gen_random_uuid',
    returns: 'uuid',
    implementation: () => randomUUID(),
    impure: true,
  })
  const { Pool } = db.adapters.createPg()
  const pool = new Pool()
  const wrapped = {
    query: async (...args: Parameters<typeof pool.query>) => {
      if (typeof args[0] === 'string' && args[0].includes('DROP TABLE case_access_audit')) {
        await pool.query('DROP TABLE case_access_audit')
        return { rows: [], rowCount: 1 } as Awaited<ReturnType<typeof pool.query>>
      }
      return pool.query(...args)
    },
    connect: async () => {
      const client = await pool.connect()
      return {
        query: (sql: string, values?: unknown[]) => {
          if (/pg_advisory_(?:xact_lock|lock|unlock)/.test(sql)) {
            caseLockCalls.value.push(sql)
            return Promise.resolve({ rows: [], rowCount: 1 })
          }
          if (auditFailure.enabled && /INSERT INTO case_access_audit/.test(sql) && values?.[3] === 'report.delete') {
            return Promise.reject(Object.assign(new Error('audit-failure'), { code: 'XX000' }))
          }
          return client.query(sql, values as never)
        },
        release: () => client.release(),
      }
    },
    end: () => pool.end(),
  }
  return { pool: wrapped, caseLockPool: wrapped }
})

vi.mock('../src/auth/middleware.js', () => ({
  authenticateRequest: (req: { get: (key: string) => string | undefined }, res: { locals: Record<string, unknown> }, next: () => void) => {
    const role = req.get('x-test-role') ?? 'admin'
    const id = req.get('x-test-user') ?? (role === 'admin' ? '00000000-0000-4000-8000-000000000001' : '00000000-0000-4000-8000-000000000002')
    res.locals.auth = { id, username: role, role, sessionId: 'test-session' }
    next()
  },
}))

vi.mock('../src/auth/csrf.js', () => ({ validateCsrf: () => csrfState.accepted }))
vi.mock('../src/utils/fileStorage.js', () => ({
  storeFile: async () => ({ publicPath: `/uploads/synthetic-${++fileCounter.value}.png`, storedPath: '/synthetic' }),
  deleteStoredFile: async () => undefined,
}))

import { pool } from '../src/db/pool.js'
import { casesRouter } from '../src/routes/cases.js'

const app = express()
app.locals.allowedOrigins = new Set(['http://localhost:5173'])
app.use((req, _res, next) => { if (req.get('x-test-no-origin') !== '1') req.headers.origin ??= 'http://localhost:5173'; next() })
app.use(express.json())
app.use('/cases', casesRouter)

const bootstrapSchema = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY, username TEXT NOT NULL UNIQUE, role TEXT NOT NULL, is_active BOOLEAN NOT NULL DEFAULT TRUE
    );
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS case_access_grants (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), case_id UUID NOT NULL, user_id UUID NOT NULL,
      permission TEXT NOT NULL, granted_by UUID NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), revoked_at TIMESTAMPTZ
    );
  `)
  await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS test_case_access_grant_active_unique ON case_access_grants(case_id,user_id,permission) WHERE revoked_at IS NULL')
  await pool.query(`
    CREATE TABLE IF NOT EXISTS case_access_audit (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), actor_user_id UUID NOT NULL, case_id UUID NOT NULL,
      case_identifier TEXT NOT NULL, target_user_id UUID, action TEXT NOT NULL, permission TEXT,
      result TEXT NOT NULL, occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cases (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      identifier TEXT NOT NULL UNIQUE,
      display_name TEXT,
      notes TEXT,
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      sort_order INTEGER
      ,owner_user_id UUID
    );
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS case_samples (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
      modality TEXT NOT NULL,
      description TEXT,
      original_filename TEXT NOT NULL,
      storage_path TEXT NOT NULL,
      storage_thumbnail TEXT,
      checksum TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS case_reports (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      summary TEXT,
      content TEXT NOT NULL,
      tags TEXT[] DEFAULT '{}',
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      sort_order INTEGER
    );
  `)
  await pool.query(`CREATE TABLE IF NOT EXISTS sample_tissue_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), sample_id UUID NOT NULL UNIQUE,
    pos_cells_1_weak INTEGER, pos_cells_2_moderate INTEGER, pos_cells_3_strong INTEGER,
    iod_total_cells INTEGER, positive_area_mm2 NUMERIC, tissue_area_mm2 NUMERIC,
    positive_area_px BIGINT, tissue_area_px BIGINT, positive_intensity NUMERIC,
    positive_cells_ratio NUMERIC, positive_cells_density NUMERIC, mean_density NUMERIC,
    h_score NUMERIC, irs NUMERIC, raw_image_path TEXT, parsed_image_path TEXT,
    metadata JSONB DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`)
}

const resetTables = async () => {
  await pool.query('DELETE FROM case_reports')
  await pool.query('DELETE FROM case_samples')
  await pool.query('DELETE FROM cases')
}

describe('文字病历 API', () => {
  beforeAll(async () => {
    await bootstrapSchema()
    await pool.query("INSERT INTO users(id,username,role,is_active) VALUES('00000000-0000-4000-8000-000000000002','case-pathologist','pathologist',true),('00000000-0000-4000-8000-000000000003','case-reader','pathologist',true) ON CONFLICT DO NOTHING")
  })

  beforeEach(async () => {
    await resetTables()
    caseLockCalls.value = []
  })

  afterAll(async () => {
    await pool.end()
  })

  it('支持仅文字病历导入病例并由服务端赋予创建者 owner', async () => {
    const textReports = [
      {
        title: '肝胆外科入院记录',
        content: '患者男，56 岁，主诉上腹疼痛 3 天入院。',
        summary: '入院评估',
        tags: ['demo'],
      },
    ]

    const response = await request(app)
      .post('/cases')
      .field('identifier', 'CASE-TEXT-001')
      .field('textReports', JSON.stringify(textReports))

    expect(response.status).toBe(201)
    expect(response.body.samples).toHaveLength(0)
    expect(response.body.reports).toHaveLength(1)
    expect(response.body.reports[0].title).toBe('肝胆外科入院记录')
    const owner = await pool.query('SELECT owner_user_id FROM cases WHERE id=$1', [response.body.id])
    expect(owner.rows[0].owner_user_id).toBe('00000000-0000-4000-8000-000000000001')

    const listResponse = await request(app).get('/cases')
    expect(listResponse.status).toBe(200)
    expect(listResponse.body[0].reports).toHaveLength(1)
  })

  it('病理医生创建病例时服务端将其设为 owner', async () => {
    const response = await request(app).post('/cases').set('x-test-role', 'pathologist').set('x-test-user', '00000000-0000-4000-8000-000000000002')
      .field('identifier', 'PATHOLOGIST-OWNER')
      .field('textReports', JSON.stringify([{ title: '合成报告', content: '合成内容' }]))
    expect(response.status).toBe(201)
    const result = await pool.query('SELECT owner_user_id FROM cases WHERE id=$1', [response.body.id])
    expect(result.rows[0].owner_user_id).toBe('00000000-0000-4000-8000-000000000002')
    expect(response.body.capabilities).toMatchObject({ read: true, edit: true, upload: true, delete: false })
  })

  it('在缺少必要字段时返回 400', async () => {
    const invalidReports = [{ title: '', content: '' }]

    const response = await request(app)
      .post('/cases')
      .field('identifier', 'CASE-TEXT-002')
      .field('textReports', JSON.stringify(invalidReports))

    expect(response.status).toBe(400)
    expect(response.body.message).toMatch(/文字病历错误|不能为空/)
  })

  it('提供病例文字病历的 CRUD 能力', async () => {
    const createResponse = await request(app)
      .post('/cases')
      .field('identifier', 'CASE-TEXT-CRUD')
      .field('textReports', JSON.stringify([{ title: '初诊记录', content: '患者初诊描述' }]))

    expect(createResponse.status).toBe(201)
    const caseId = createResponse.body.id
    const reportId = createResponse.body.reports[0].id

    const listResponse = await request(app).get(`/cases/${caseId}/reports`)
    expect(listResponse.status).toBe(200)
    expect(listResponse.body).toHaveLength(1)

    const addResponse = await request(app)
      .post(`/cases/${caseId}/reports`)
      .send({ title: '术后病程', content: '术后第 1 天恢复良好', tags: ['demo', 'progress'] })
    expect(addResponse.status).toBe(201)
    expect(addResponse.body.tags).toEqual(['demo', 'progress'])

    const patchResponse = await request(app)
      .patch(`/cases/${caseId}/reports/${reportId}`)
      .send({ summary: '已更新摘要', content: '补充了检查结论' })
    expect(patchResponse.status).toBe(200)
    expect(patchResponse.body.summary).toBe('已更新摘要')

    const deleteResponse = await request(app).delete(`/cases/${caseId}/reports/${reportId}`)
    expect(deleteResponse.status).toBe(204)

    const finalList = await request(app).get(`/cases/${caseId}/reports`)
    expect(finalList.status).toBe(200)
    expect(finalList.body).toHaveLength(1)
  })

  it('identifier 冲突不返回或改动病例、owner、样本、报告或文件引用', async () => {
    const first = await request(app).post('/cases').field('identifier', 'DUPLICATE-1').field('textReports', JSON.stringify([{ title: '保留报告', content: '合成内容' }]))
      .field('samplesMeta', JSON.stringify([{ displayName: '既有文件', modality: 'CT片' }]))
      .attach('sampleFiles', Buffer.from('existing-synthetic'), 'existing.png')
    expect(first.status).toBe(201)
    const before = await pool.query('SELECT id, owner_user_id, display_name FROM cases WHERE identifier=$1', ['DUPLICATE-1'])
    const samplesBefore = (await pool.query('SELECT * FROM case_samples WHERE case_id=$1', [before.rows[0].id])).rows
    const storedFilesBefore = fileCounter.value
    const retry = await request(app).post('/cases').set('x-test-role', 'pathologist').set('x-test-user', '00000000-0000-4000-8000-000000000002')
      .field('identifier', 'DUPLICATE-1').field('displayName', '恶意替换')
      .field('samplesMeta', JSON.stringify([{ displayName: '不得写入', modality: 'CT片' }]))
      .field('textReports', JSON.stringify([{ title: '新增报告', content: '不应写入' }]))
      .attach('sampleFiles', Buffer.from('synthetic-file'), 'synthetic.png')
    expect(retry.status).toBe(409)
    expect(retry.body).not.toHaveProperty('id')
    const after = await pool.query('SELECT id, owner_user_id, display_name FROM cases WHERE identifier=$1', ['DUPLICATE-1'])
    const reports = await pool.query('SELECT title FROM case_reports WHERE case_id=$1', [before.rows[0].id])
    const samples = await pool.query('SELECT id,storage_path FROM case_samples WHERE case_id=$1', [before.rows[0].id])
    expect(after.rows).toEqual(before.rows)
    expect(reports.rows.map((row) => row.title)).toEqual(['保留报告'])
    expect(samples.rows).toEqual(samplesBefore.map(row => ({ id: row.id, storage_path: row.storage_path })))
    expect(fileCounter.value).toBe(storedFilesBefore)

    const unauthorized = await request(app).post('/cases').set('x-test-role', 'researcher').set('x-test-user', '00000000-0000-4000-8000-000000000004')
      .field('identifier', 'DUPLICATE-1').field('textReports', JSON.stringify([{ title: '不应泄露', content: 'synthetic' }]))
    expect(unauthorized.status).toBe(403)
    expect(unauthorized.body).not.toHaveProperty('id')
    expect((await pool.query('SELECT id, owner_user_id, display_name FROM cases WHERE identifier=$1', ['DUPLICATE-1'])).rows).toEqual(before.rows)
  })

  it('非管理员不能删除，并且病例删除审计不依赖病例外键', async () => {
    const created = await request(app).post('/cases').field('identifier', 'AUDIT-DELETE').field('textReports', JSON.stringify([{ title: '报告', content: '合成文本' }]))
    const caseId = created.body.id
    const denied = await request(app).delete(`/cases/${caseId}`).set('x-test-role', 'pathologist')
    expect(denied.status).toBe(403)
    expect((await pool.query('SELECT 1 FROM cases WHERE id=$1', [caseId])).rowCount).toBe(1)
    const removed = await request(app).delete(`/cases/${caseId}`)
    expect(removed.status).toBe(204)
    const audit = await pool.query("SELECT action, case_identifier FROM case_access_audit WHERE case_id=$1 AND action='case.delete'", [caseId])
    expect(audit.rows).toEqual([{ action: 'case.delete', case_identifier: 'AUDIT-DELETE' }])
    expect((await pool.query('SELECT 1 FROM cases WHERE id=$1', [caseId])).rowCount).toBe(0)
  })

  it('样本、报告、排序和分析端点拒绝跨病例 ID 替换且无状态变化', async () => {
    const create = async (identifier: string) => request(app).post('/cases').field('identifier', identifier)
      .field('samplesMeta', JSON.stringify([{ displayName: '样本目标', modality: '组织切片' }]))
      .field('textReports', JSON.stringify([{ title: '报告目标', content: '合成' }]))
      .attach('sampleFiles', Buffer.from('synthetic-image'), `${identifier}.png`)
    const a = await create('CASE-A')
    const b = await create('CASE-B')
    const sampleId = b.body.samples[0].id
    const reportId = b.body.reports[0].id
    const samplePatch = await request(app).patch(`/cases/${a.body.id}/samples/${sampleId}`).send({ displayName: '跨病例修改' })
    const reportPatch = await request(app).patch(`/cases/${a.body.id}/reports/${reportId}`).send({ title: '跨病例修改' })
    const sampleOrder = await request(app).put(`/cases/${a.body.id}/samples/order`).send({ ids: [sampleId] })
    const reportOrder = await request(app).put(`/cases/${a.body.id}/reports/order`).send({ ids: [reportId] })
    const analysis = await request(app).get(`/cases/${a.body.id}/samples/${sampleId}/analysis`)
    expect([samplePatch.status, reportPatch.status, sampleOrder.status, reportOrder.status, analysis.status]).toEqual([404, 404, 400, 400, 404])
    expect((await pool.query('SELECT description FROM case_samples WHERE id=$1', [sampleId])).rows[0].description).toBe('样本目标')
    expect((await pool.query('SELECT title FROM case_reports WHERE id=$1', [reportId])).rows[0].title).toBe('报告目标')
    expect((await pool.query('SELECT sort_order FROM case_samples WHERE id=$1', [sampleId])).rows[0].sort_order).toBe(1)
    expect((await pool.query('SELECT sort_order FROM case_reports WHERE id=$1', [reportId])).rows[0].sort_order).toBe(1)
    expect((await pool.query('SELECT case_id FROM case_samples WHERE id=$1', [sampleId])).rows[0].case_id).toBe(b.body.id)
  })

  it('受授权写事务只获取一次共享病例锁，避免跨连接重入死锁', async () => {
    const created = await request(app).post('/cases').field('identifier', 'MUTATION-LOCK').field('textReports', JSON.stringify([{ title: '合成', content: 'synthetic' }]))
    const response = await request(app).post(`/cases/${created.body.id}/reports`).send({ title: '新增', content: 'synthetic' })
    expect(response.status).toBe(201)
    expect(caseLockCalls.value).toHaveLength(2)
    expect(caseLockCalls.value[0]).toContain('pg_advisory_lock(')
    expect(caseLockCalls.value[1]).toContain('pg_advisory_unlock(')
    expect(caseLockCalls.value.some((query) => query.includes('pg_advisory_xact_lock('))).toBe(false)
  })

  it('报告列表对缺失病例和不可见病例使用同一拒绝响应', async () => {
    const created = await request(app).post('/cases').field('identifier', 'HIDDEN-CASE').field('textReports', JSON.stringify([{ title: 'private', content: 'synthetic' }]))
    const missing = await request(app).get('/cases/00000000-0000-4000-8000-000000000099/reports').set('x-test-role', 'pathologist').set('x-test-user', '00000000-0000-4000-8000-000000000003')
    const hidden = await request(app).get(`/cases/${created.body.id}/reports`).set('x-test-role', 'pathologist').set('x-test-user', '00000000-0000-4000-8000-000000000003')
    expect(missing.status).toBe(404)
    expect(hidden.status).toBe(404)
    expect(hidden.body).toEqual(missing.body)
  })

  it('管理员授权、read撤销连带撤销依赖能力、regrant保留撤销历史', async () => {
    const created = await request(app).post('/cases').set('x-test-role', 'admin').field('identifier', 'GRANT-LIFECYCLE').field('textReports', JSON.stringify([{ title: 'synthetic', content: 'synthetic' }]))
    const caseId = created.body.id
    const target = '00000000-0000-4000-8000-000000000002'
    for (const permission of ['read', 'edit', 'upload']) {
      const granted = await request(app).post(`/cases/${caseId}/access-grants`).send({ userId: target, permission })
      expect(granted.status).toBe(204)
    }
    const beforeRevoke = await pool.query('SELECT permission, revoked_at FROM case_access_grants WHERE case_id=$1 AND user_id=$2 ORDER BY permission', [caseId, target])
    expect(beforeRevoke.rows).toHaveLength(3)
    const revoked = await request(app).delete(`/cases/${caseId}/access-grants/${target}/read`)
    expect(revoked.status).toBe(204)
    const inactive = await pool.query('SELECT permission, revoked_at FROM case_access_grants WHERE case_id=$1 AND user_id=$2 ORDER BY permission', [caseId, target])
    expect(inactive.rows).toHaveLength(3)
    expect(inactive.rows.every((grant) => grant.revoked_at !== null)).toBe(true)
    const regrant = await request(app).post(`/cases/${caseId}/access-grants`).send({ userId: target, permission: 'read' })
    expect(regrant.status).toBe(204)
    const history = await pool.query('SELECT permission, revoked_at FROM case_access_grants WHERE case_id=$1 AND user_id=$2 AND permission=$3 ORDER BY created_at', [caseId, target, 'read'])
    expect(history.rows).toHaveLength(2)
    expect(history.rows[0].revoked_at).not.toBeNull()
    expect(history.rows[1].revoked_at).toBeNull()
    const nonAdmin = await request(app).post(`/cases/${caseId}/access-grants`).set('x-test-role', 'pathologist').set('x-test-user', '00000000-0000-4000-8000-000000000003').send({ userId: target, permission: 'read' })
    expect(nonAdmin.status).toBe(403)
    const researcher = await request(app).get(`/cases/${caseId}/reports`).set('x-test-role', 'researcher').set('x-test-user', '00000000-0000-4000-8000-000000000004')
    expect(researcher.status).toBe(404)
  })

  it('合法upload能力可追加样本，未授权pathologist被统一拒绝', async () => {
    const ownerId = '00000000-0000-4000-8000-000000000002'
    const created = await request(app).post('/cases').set('x-test-role', 'pathologist').set('x-test-user', ownerId)
      .field('identifier', 'APPEND-OWNER').field('textReports', JSON.stringify([{ title: 'synthetic', content: 'synthetic' }]))
    const caseId = created.body.id
    const append = await request(app).post(`/cases/${caseId}/samples`)
      .field('samplesMeta', JSON.stringify([{ displayName: '追加图像', modality: 'CT片' }]))
      .attach('sampleFiles', Buffer.from('synthetic-image'), 'synthetic.png')
    expect(append.status).toBe(201)
    expect(append.body.samples).toHaveLength(1)
    expect(append.body.samples[0].case_id).toBe(caseId)
    expect((await pool.query('SELECT action FROM case_access_audit WHERE case_id=$1 AND action=$2', [caseId, 'sample.append'])).rows).toHaveLength(1)
    const denied = await request(app).post(`/cases/${caseId}/samples`).set('x-test-role', 'pathologist').set('x-test-user', '00000000-0000-4000-8000-000000000003')
      .field('samplesMeta', JSON.stringify([{ displayName: '拒绝', modality: 'CT片' }]))
      .attach('sampleFiles', Buffer.from('synthetic-image'), 'denied.png')
    expect(denied.status).toBe(404)
    expect((await pool.query('SELECT COUNT(*)::int AS n FROM case_samples WHERE case_id=$1', [caseId])).rows[0].n).toBe(1)
  })

  it('授权病例列表、样本编辑排序、报告排序和分析读取可完成', async () => {
    const created = await request(app).post('/cases').field('identifier', 'CASE-WORKFLOW')
      .field('samplesMeta', JSON.stringify([
        { displayName: '组织样本', modality: '组织切片' },
        { displayName: 'CT样本', modality: 'CT片' },
      ]))
      .attach('sampleFiles', Buffer.from('synthetic-tissue'), 'tissue.png')
      .attach('sampleFiles', Buffer.from('synthetic-ct'), 'ct.png')
      .field('textReports', JSON.stringify([
        { title: '记录一', content: 'synthetic' },
        { title: '记录二', content: 'synthetic' },
      ]))
    expect(created.status).toBe(201)
    const caseId = created.body.id as string
    const [tissueSample, ctSample] = created.body.samples as Array<{ id: string }>
    const [reportOne, reportTwo] = created.body.reports as Array<{ id: string }>

    const list = await request(app).get('/cases')
    expect(list.status).toBe(200)
    expect(list.body[0].samples).toHaveLength(2)
    expect(list.body[0].reports).toHaveLength(2)

    const sampleEdit = await request(app).patch(`/cases/${caseId}/samples/${tissueSample.id}`).send({ displayName: '修订组织样本' })
    expect(sampleEdit.status).toBe(200)
    expect((await pool.query('SELECT description FROM case_samples WHERE id=$1', [tissueSample.id])).rows[0].description).toBe('修订组织样本')

    expect((await request(app).put(`/cases/${caseId}/samples/order`).send({ ids: [ctSample.id, tissueSample.id] })).status).toBe(204)
    expect((await pool.query('SELECT id FROM case_samples WHERE case_id=$1 ORDER BY sort_order', [caseId])).rows.map((row) => row.id)).toEqual([ctSample.id, tissueSample.id])
    expect((await request(app).put(`/cases/${caseId}/reports/order`).send({ ids: [reportTwo.id, reportOne.id] })).status).toBe(204)
    expect((await pool.query('SELECT id FROM case_reports WHERE case_id=$1 ORDER BY sort_order', [caseId])).rows.map((row) => row.id)).toEqual([reportTwo.id, reportOne.id])

    await pool.query('INSERT INTO sample_tissue_analysis(sample_id,h_score,metadata) VALUES($1,42,\'{"origin":"synthetic-test"}\')', [tissueSample.id])
    const analysis = await request(app).get(`/cases/${caseId}/samples/${tissueSample.id}/analysis`)
    expect(analysis.status).toBe(200)
    expect(analysis.body.derived.h_score).toBe(42)
    const hidden = await request(app).get(`/cases/${caseId}/samples/${tissueSample.id}/analysis`)
      .set('x-test-role', 'pathologist').set('x-test-user', '00000000-0000-4000-8000-000000000003')
    expect(hidden.status).toBe(404)
    expect(hidden.body).not.toHaveProperty('derived')
  })

  it('全部病例状态变更端点都要求允许 Origin 和有效 session CSRF', async () => {
    const created = await request(app).post('/cases').field('identifier', 'CSRF-ROUTES').field('textReports', JSON.stringify([{ title: 'synthetic', content: 'synthetic' }]))
    const caseId = created.body.id
    const sampleId = '00000000-0000-4000-8000-000000000099'
    const reportId = created.body.reports[0].id
    const routes: Array<{ method: 'post' | 'patch' | 'delete' | 'put'; url: string }> = [
      { method: 'post', url: '/cases' }, { method: 'patch', url: `/cases/${caseId}` }, { method: 'delete', url: `/cases/${caseId}` },
      { method: 'post', url: `/cases/${caseId}/samples` }, { method: 'patch', url: `/cases/${caseId}/samples/${sampleId}` }, { method: 'delete', url: `/cases/${caseId}/samples/${sampleId}` },
      { method: 'post', url: `/cases/${caseId}/reports` }, { method: 'patch', url: `/cases/${caseId}/reports/${reportId}` }, { method: 'delete', url: `/cases/${caseId}/reports/${reportId}` },
      { method: 'put', url: `/cases/${caseId}/samples/order` }, { method: 'put', url: `/cases/${caseId}/reports/order` },
      { method: 'post', url: `/cases/${caseId}/access-grants` }, { method: 'delete', url: `/cases/${caseId}/access-grants/${sampleId}/read` },
    ]
    csrfState.accepted = false
    for (const route of routes) {
      const response = await request(app)[route.method](route.url).set('Origin', 'http://localhost:5173').send({})
      expect(response.status, `${route.method.toUpperCase()} ${route.url}`).toBe(403)
    }
    for (const route of routes) {
      const response = await request(app)[route.method](route.url).set('Origin', 'https://untrusted.example').send({})
      expect(response.status, `untrusted Origin ${route.method.toUpperCase()} ${route.url}`).toBe(403)
    }
    csrfState.accepted = true
    const missingOrigin = await request(app).patch(`/cases/${caseId}`).set('x-test-no-origin', '1').send({ displayName: 'blocked' })
    expect(missingOrigin.status).toBe(403)
  })

  it('审计写入失败时报告删除回滚', async () => {
    const created = await request(app).post('/cases').field('identifier', 'AUDIT-FAIL').field('textReports', JSON.stringify([{ title: '保留', content: '合成文本' }]))
    const caseId = created.body.id
    const reportId = created.body.reports[0].id
    auditFailure.enabled = true
    const response = await request(app).delete(`/cases/${caseId}/reports/${reportId}`)
    auditFailure.enabled = false
    expect(response.status).toBe(500)
    expect((await pool.query('SELECT id FROM case_reports WHERE id=$1 AND case_id=$2', [reportId, caseId])).rowCount).toBe(1)
  })
})
