import express from 'express'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { newDb } from 'pg-mem'
import { randomUUID } from 'node:crypto'

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
  return { pool }
})

import { pool } from '../src/db/pool.js'
import { casesRouter } from '../src/routes/cases.js'

const app = express()
app.use(express.json())
app.use('/cases', casesRouter)

const bootstrapSchema = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cases (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      identifier TEXT NOT NULL UNIQUE,
      display_name TEXT,
      notes TEXT,
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `)
}

const resetTables = async () => {
  await pool.query('DELETE FROM case_reports')
  await pool.query('DELETE FROM case_samples')
  await pool.query('DELETE FROM cases')
}

describe('文字病历 API', () => {
  beforeAll(async () => {
    await bootstrapSchema()
  })

  beforeEach(async () => {
    await resetTables()
  })

  afterAll(async () => {
    await pool.end()
  })

  it('支持仅文字病历导入病例', async () => {
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

    const listResponse = await request(app).get('/cases')
    expect(listResponse.status).toBe(200)
    expect(listResponse.body[0].reports).toHaveLength(1)
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
})
