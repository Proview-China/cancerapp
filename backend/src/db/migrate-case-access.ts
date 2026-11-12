import { Client } from 'pg'
import { applyCaseAccessMigration } from './caseAccessMigration.js'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { assertAllowedDatabaseTarget, confirmTarget, getDatabaseTarget, targetSummary } from '../auth/operationGuard.js'

const connectionString = process.env.CASE_ACCESS_DATABASE_URL
const mappingFile = process.env.CASE_ACCESS_OWNER_MAPPING
if (!mappingFile || !path.isAbsolute(mappingFile)) throw new Error('An explicit absolute case owner mapping file is required')
const mappingText = await readFile(mappingFile, 'utf8')
const mapping = JSON.parse(mappingText) as Record<string, string>
if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping) || Object.keys(mapping).length === 0) throw new Error('Explicit non-empty legacy case mapping is required')
const target = await assertAllowedDatabaseTarget(getDatabaseTarget(connectionString), 'migration')
const summary = targetSummary(target)
await confirmTarget(summary, process.stdin, process.stdout)
const client = new Client({ connectionString })
const ddl = await readFile(path.resolve(process.cwd(), 'src/db/migrations/002_case_access_control.sql'), 'utf8')
await client.connect()
try {
  await applyCaseAccessMigration(client, mapping, ddl)
  console.log('Case access migration applied to explicitly confirmed target')
} finally { await client.end() }
