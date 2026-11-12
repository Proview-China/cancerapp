import { afterAll, describe, expect, it, vi } from 'vitest'
import { Client, Pool } from 'pg'
import { readFile, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { applyCaseAccessMigration } from '../src/db/caseAccessMigration.js'
import express from 'express'
import request from 'supertest'

// Explicit opt-in. Never use the application configuration or a default target.
const enabled = process.env.CASE_ACCESS_PG_ACCEPTANCE === '5433-synthetic'
const state = vi.hoisted(() => ({ schema: '', pool: undefined as Pool | undefined, locks: undefined as Pool | undefined }))
vi.mock('../src/db/pool.js', async () => {
  const { Pool } = await import('pg')
  if (process.env.CASE_ACCESS_PG_ACCEPTANCE !== '5433-synthetic') throw new Error('Explicit synthetic PostgreSQL opt-in required')
  const options = { host: '127.0.0.1', port: 5433, database: 'cancerapp_test', user: 'cancerapp_test_app', options: `-c search_path=${state.schema}`, statement_timeout: 4000 }
  state.pool = new Pool(options)
  state.locks = new Pool(options)
  return { pool: state.pool, caseLockPool: state.locks }
})
vi.mock('../src/auth/middleware.js', () => ({ authenticateRequest: (req: express.Request, res: express.Response, next: express.NextFunction) => {
  res.locals.auth = { id: req.get('x-test-user') ?? '00000000-0000-4000-8000-000000000001', role: req.get('x-test-role') ?? 'admin', username: 'synthetic', sessionId: 'synthetic' }; next()
} }))
vi.mock('../src/auth/csrf.js', () => ({ validateCsrf: () => true }))
vi.mock('../src/utils/fileStorage.js', () => ({ storeFile: async () => ({ publicPath: '/uploads/synthetic.png' }), deleteStoredFile: async () => undefined }))

const admin = '00000000-0000-4000-8000-000000000001'
const doctor = '00000000-0000-4000-8000-000000000002'
const caseId = '00000000-0000-4000-8000-000000000010'
const secondAdmin = '00000000-0000-4000-8000-000000000003'
const otherCase = '00000000-0000-4000-8000-000000000011'
const ddl = await readFile('src/db/migrations/002_case_access_control.sql', 'utf8')
let sequence = 0
const clients: Client[] = []
const fixture = async () => {
  const client = new Client({ host: '127.0.0.1', port: 5433, database: 'cancerapp_test', user: 'cancerapp_test_app' })
  await client.connect(); clients.push(client)
  const schema = `case_acceptance_${Date.now()}_${++sequence}`
  await client.query(`CREATE SCHEMA ${schema}; SET search_path TO ${schema}`)
  await client.query(`
    CREATE TABLE users(id UUID PRIMARY KEY, role TEXT, is_active BOOLEAN);
    INSERT INTO users VALUES('${admin}','admin',true),('${doctor}','pathologist',true),('${secondAdmin}','admin',true);
    CREATE TABLE cases(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),identifier TEXT UNIQUE,display_name TEXT,notes TEXT,metadata JSONB DEFAULT '{}',created_at TIMESTAMPTZ DEFAULT NOW(),updated_at TIMESTAMPTZ DEFAULT NOW());
    CREATE TABLE case_samples(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),case_id UUID REFERENCES cases ON DELETE CASCADE,modality TEXT,description TEXT,original_filename TEXT,storage_path TEXT,storage_thumbnail TEXT,checksum TEXT,sort_order INTEGER,created_at TIMESTAMPTZ DEFAULT NOW(),updated_at TIMESTAMPTZ DEFAULT NOW());
    CREATE TABLE case_reports(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),case_id UUID REFERENCES cases ON DELETE CASCADE,title TEXT,content TEXT,summary TEXT,tags TEXT[],metadata JSONB DEFAULT '{}',sort_order INTEGER,created_at TIMESTAMPTZ DEFAULT NOW(),updated_at TIMESTAMPTZ DEFAULT NOW());
    CREATE TABLE sample_tissue_analysis(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),sample_id UUID REFERENCES case_samples ON DELETE CASCADE);
    INSERT INTO cases(id,identifier) VALUES('${caseId}','synthetic-legacy');
    INSERT INTO case_samples(id,case_id,modality,sort_order) VALUES('00000000-0000-4000-8000-000000000020','${caseId}','CT片',1);
    INSERT INTO case_reports(id,case_id,title,content,sort_order) VALUES('00000000-0000-4000-8000-000000000030','${caseId}','synthetic','synthetic',1);
  `)
  return { client, schema }
}
const runCli = async (schema: string, mapping: Record<string, string>) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'case-owner-mapping-'))
  const filename = path.join(directory, 'mapping.json')
  await writeFile(filename, JSON.stringify(mapping), { mode: 0o600 })
  return await new Promise<{ code: number | null; output: string }>((resolve, reject) => {
    const child = spawn(process.execPath, ['--import', 'tsx', 'src/db/migrate-case-access.ts'], {
      env: { ...process.env, CASE_ACCESS_DATABASE_URL: 'postgresql://cancerapp_test_app@127.0.0.1:5433/cancerapp_test', CASE_ACCESS_OWNER_MAPPING: filename, AUTH_TARGET_CONFIG: '/etc/cancerapp/auth-targets.json', PGOPTIONS: `-c search_path=${schema}` }, stdio: ['pipe', 'pipe', 'pipe'],
    })
    let output = ''; child.stdout.on('data', data => { output += String(data) }); child.stderr.on('data', data => { output += String(data) })
    child.on('error', reject); child.on('close', code => resolve({ code, output }))
    child.stdin.end('cancerapp_test_app@127.0.0.1:5433/cancerapp_test\n')
  })
}

describe.skipIf(!enabled)('isolated PostgreSQL 16 case access acceptance (synthetic only)', () => {
  afterAll(async () => { await state.pool?.end(); await state.locks?.end(); await Promise.all(clients.map(client => client.end())) })

  it('runs the migration transaction with explicit owner mapping', async () => {
    const { client, schema } = await fixture()
    await applyCaseAccessMigration(client, { [caseId]: admin }, ddl)
    expect((await client.query('SELECT owner_user_id FROM cases')).rows[0].owner_user_id).toBe(admin)
    expect((await client.query('SELECT case_count,sample_count,report_count FROM case_access_migrations')).rows[0]).toEqual({ case_count: '1', sample_count: '1', report_count: '1' })
  })

  it.each(['incomplete', 'missing-admin', 'disabled-admin', 'count', 'association', 'sql-error', 'wrong-owner'])('real transaction rolls back %s failure including DDL/owner/version', async failure => {
    const { client, schema } = await fixture()
    const mapping = { [caseId]: admin }
    if (failure === 'incomplete') await client.query(`INSERT INTO cases(id,identifier) VALUES('${otherCase}','unmapped')`)
    if (failure === 'missing-admin') mapping[caseId] = otherCase
    if (failure === 'disabled-admin') await client.query('UPDATE users SET is_active=false WHERE id=$1', [admin])
    if (['count', 'association', 'sql-error', 'wrong-owner'].includes(failure)) {
      let action = failure === 'count' ? `INSERT INTO cases(id,identifier) VALUES('${otherCase}','unexpected');` : failure === 'association' ? 'DELETE FROM case_samples;' : failure === 'sql-error' ? "RAISE EXCEPTION 'injected migration failure';" : `NEW.owner_user_id := '${secondAdmin}';`
      await client.query(`CREATE FUNCTION migration_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN ${action} RETURN NEW; END $$;
        CREATE TRIGGER injected BEFORE UPDATE ON cases FOR EACH ROW EXECUTE FUNCTION migration_fault()`)
    }
    const before = (await client.query('SELECT id,case_id FROM case_samples')).rows
    await expect(applyCaseAccessMigration(client, mapping, ddl)).rejects.toThrow(failure === 'wrong-owner' ? 'Post-migration owner mapping identity mismatch' : undefined)
    expect((await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name='cases' AND column_name='owner_user_id'", [schema])).rows).toHaveLength(0)
    expect((await client.query("SELECT tablename FROM pg_tables WHERE schemaname=$1 AND tablename='case_access_migrations'", [schema])).rows).toHaveLength(0)
    expect((await client.query('SELECT id,case_id FROM case_samples')).rows).toEqual(before)
  })

  it('guarded CLI fails closed for untrusted configuration', async () => {
    const { schema } = await fixture()
    const result = await runCli(schema, { [caseId]: admin })
    expect(result.code).not.toBe(0)
    expect(result.output).toContain('Untrusted configuration owner or permissions')
  })

  it('HTTP revoke wins before queued writes: all five edit endpoints recheck inside their transaction', async () => {
    const { client, schema } = await fixture(); state.schema = schema
    await client.query(ddl)
    await client.query('UPDATE cases SET owner_user_id=$1', [admin])
    const { casesRouter } = await import('../src/routes/cases.js')
    const { grantCasePermission } = await import('../src/auth/caseAccess.js')
    const actor = { id: admin, username: 'synthetic', role: 'admin' as const, sessionId: 'synthetic' }
    await grantCasePermission(actor, caseId, doctor, 'read'); await grantCasePermission(actor, caseId, doctor, 'edit')
    const app = express(); app.locals.allowedOrigins = new Set(['http://localhost:5173']); app.use(express.json()); app.use('/cases', casesRouter)
    // Hold the same database lock; queue revoke first, verify its DB waiter,
    // then queue edits. PostgreSQL grants these locks in request order.
    await client.query('SELECT pg_advisory_lock(hashtextextended($1,1))', [`case-access:${caseId}`])
    const revoke = request(app).delete(`/cases/${caseId}/access-grants/${doctor}/read`).set('Origin', 'http://localhost:5173').then(response => response)
    const ownLock = (await client.query("SELECT classid,objid,objsubid FROM pg_locks WHERE locktype='advisory' AND pid=pg_backend_pid() AND granted")).rows[0]
    const waiters = async () => (await client.query("SELECT pid FROM pg_locks WHERE locktype='advisory' AND database=(SELECT oid FROM pg_database WHERE datname=current_database()) AND classid=$1 AND objid=$2 AND objsubid=$3 AND NOT granted", [ownLock.classid,ownLock.objid,ownLock.objsubid])).rows
    let waiting = false
    for (let attempt = 0; attempt < 100; attempt++) {
      const row = await waiters()
      if (row.length === 1) { waiting = true; break }
      await new Promise(resolve => setTimeout(resolve, 10))
    }
    expect(waiting).toBe(true)
    const sid = '00000000-0000-4000-8000-000000000020', rid = '00000000-0000-4000-8000-000000000030'
    const calls = [
      request(app).patch(`/cases/${caseId}`).send({ displayName: 'blocked' }),
      request(app).patch(`/cases/${caseId}/samples/${sid}`).send({ displayName: 'blocked' }),
      request(app).patch(`/cases/${caseId}/reports/${rid}`).send({ title: 'blocked' }),
      request(app).put(`/cases/${caseId}/samples/order`).send({ ids: [sid] }),
      request(app).put(`/cases/${caseId}/reports/order`).send({ ids: [rid] }),
    ].map(call => call.set('Origin', 'http://localhost:5173').set('x-test-user', doctor).set('x-test-role', 'pathologist').then(response => response))
    let queued: Array<{ pid: number }> = []
    for (let attempt = 0; attempt < 200; attempt++) {
      queued = await waiters(); if (queued.length === 6) break
      await new Promise(resolve => setTimeout(resolve,10))
    }
    expect(new Set(queued.map(row => row.pid)).size).toBe(6)
    await client.query('SELECT pg_advisory_unlock(hashtextextended($1,1))', [`case-access:${caseId}`])
    expect((await revoke).status).toBe(204)
    expect((await Promise.all(calls)).map(response => response.status)).toEqual([404,404,404,404,404])
    expect((await client.query('SELECT display_name FROM cases')).rows[0].display_name).toBeNull()
    expect((await client.query('SELECT title FROM case_reports')).rows[0].title).toBe('synthetic')
  }, 15000)
})
