import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { randomUUID } from 'node:crypto'
import { hashPassword } from '../src/auth/password.js'
import { normalizeUsername } from '../src/auth/username.js'
import { assertAllowedDatabaseTarget, assertApprovedOperator, confirmTarget, getDatabaseTarget, readProtectedSecret, targetSummary } from '../src/auth/operationGuard.js'
import { acquireLifecycleLock } from '../src/auth/lifecycleLock.js'

const operator = await assertApprovedOperator()
const lock = await acquireLifecycleLock()
try {
const target = await assertAllowedDatabaseTarget(getDatabaseTarget(process.env.AUTH_DATABASE_URL), 'initialize')
const summary = targetSummary(target)
  await confirmTarget(summary, input, output)
  process.env.DATABASE_URL = process.env.AUTH_DATABASE_URL
  const { pool } = await import('../src/db/pool.js')
  const rl = createInterface({ input, output })
  const username = normalizeUsername(await rl.question('Admin username: '))
  rl.close()
  const password = await readProtectedSecret('Admin password: ', input, output)
  if (password.length < 12) throw new Error('Password must be at least 12 characters')
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const existing = await client.query('SELECT 1 FROM users LIMIT 1 FOR UPDATE')
    if (existing.rowCount) throw new Error('Admin initialization is already complete')
    await client.query('INSERT INTO users(id, username, password_hash, role) VALUES ($1, $2, $3, $4)', [randomUUID(), username, await hashPassword(password), 'admin'])
    await client.query('COMMIT')
    console.log('Initial administrator created')
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally { client.release(); await pool.end() }
} finally { await lock.release() }
