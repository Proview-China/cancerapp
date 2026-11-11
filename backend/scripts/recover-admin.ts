import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { hashPassword } from '../src/auth/password.js'
import { normalizeUsername } from '../src/auth/username.js'
import {
  auditRecord,
  assertAllowedDatabaseTarget,
  assertApprovedOperator,
  confirmTarget,
  createAuditEventId,
  getDatabaseTarget,
  readProtectedSecret,
  targetSummary,
} from '../src/auth/operationGuard.js'
import { acquireLifecycleLock } from '../src/auth/lifecycleLock.js'

const eventId = createAuditEventId()
let operator = 'unknown'
let database = 'unknown'
let targetUsername = 'unknown'
let stage = 'authorization'
let releaseLock: (() => Promise<void>) | null = null

try {
  operator = await assertApprovedOperator()
  stage = 'lock'
  const lock = await acquireLifecycleLock()
  releaseLock = lock.release

  stage = 'database-target'
  const target = await assertAllowedDatabaseTarget(getDatabaseTarget(process.env.AUTH_DATABASE_URL), 'recovery')
  database = targetSummary(target)

  stage = 'confirmation'
  await confirmTarget(database, input, output)
  process.env.DATABASE_URL = process.env.AUTH_DATABASE_URL
  const { pool } = await import('../src/db/pool.js')

  try {
    stage = 'credentials'
    const rl = createInterface({ input, output })
    const username = normalizeUsername(await rl.question('Admin username: '))
    targetUsername = username
    rl.close()
    const password = await readProtectedSecret('New password: ', input, output)
    if (password.length < 12) throw new Error('Password must be at least 12 characters')

    stage = 'database-transaction'
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const user = await client.query<{ id: string }>("SELECT id FROM users WHERE username = $1 AND role = 'admin' FOR UPDATE", [username])
      if (!user.rows[0]) throw new Error('Administrator not found')
      await client.query('UPDATE users SET password_hash = $1, password_changed_at = NOW(), updated_at = NOW() WHERE id = $2', [await hashPassword(password), user.rows[0].id])
      await client.query('UPDATE sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL', [user.rows[0].id])
      await client.query('COMMIT')
      auditRecord({ eventId, operator, targetUser: targetUsername, database, result: 'success', stage: 'completed' })
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined)
      auditRecord({ eventId, operator, targetUser: targetUsername, database, result: 'failure', stage, code: error instanceof Error ? error.name : 'UNKNOWN' })
      throw error
    } finally {
      client.release()
    }
  } finally {
    await pool.end()
  }
} catch (error) {
  if (stage !== 'database-transaction') {
    auditRecord({ eventId, operator, targetUser: targetUsername, database, result: 'failure', stage, code: error instanceof Error ? error.name : 'UNKNOWN' })
  }
  console.error(`Administrator recovery failed at ${stage}`)
  process.exitCode = 1
} finally {
  if (releaseLock) await releaseLock()
}
