import { Client } from 'pg'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { assertAllowedDatabaseTarget, confirmTarget, getDatabaseTarget, targetSummary } from '../auth/operationGuard.js'

const connectionString = process.env.AUTH_DATABASE_URL
const parsed = await assertAllowedDatabaseTarget(getDatabaseTarget(connectionString), 'migration')
const summary = targetSummary(parsed)
await confirmTarget(summary, process.stdin, process.stdout)

const client = new Client({ connectionString })
const sql = await readFile(path.resolve(process.cwd(), 'src/db/migrations/001_auth.sql'), 'utf8')
await client.connect()
try {
  await client.query('BEGIN')
  await client.query(sql)
  await client.query(`INSERT INTO auth_migrations(version) VALUES ('001_auth') ON CONFLICT DO NOTHING`)
  await client.query('COMMIT')
  console.log('Authentication migration applied to explicitly configured isolated target')
} catch (error) {
  await client.query('ROLLBACK').catch(() => undefined)
  throw error
} finally {
  await client.end()
}
