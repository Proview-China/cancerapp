import type { PoolClient } from 'pg'
import { caseLockPool, pool } from '../db/pool.js'
import type { SessionContext } from './types.js'

export type CasePermission = 'read' | 'edit' | 'upload'
export type CaseCapabilities = { read: boolean; edit: boolean; upload: boolean; delete: boolean; manageAccess: boolean }
export class CaseAccessError extends Error {
  constructor() { super('case-not-authorized') }
}
export const acquireCaseMutationLock = async (client: PoolClient, caseId: string) => {
  await client.query('SELECT pg_advisory_lock(hashtextextended($1, 1))', [`case-access:${caseId}`])
}
export const releaseCaseMutationLock = async (client: PoolClient, caseId: string) => {
  await client.query('SELECT pg_advisory_unlock(hashtextextended($1, 1))', [`case-access:${caseId}`])
}

export const effectiveCaseCapabilities = (user: SessionContext, ownerId: string | null, grants: CasePermission[]): CaseCapabilities => {
  const admin = user.role === 'admin'
  const owner = user.role === 'pathologist' && ownerId === user.id
  const read = admin || owner || (user.role === 'pathologist' && grants.includes('read'))
  return {
    read,
    edit: read && (admin || owner || grants.includes('edit')),
    upload: read && (admin || owner || grants.includes('upload')),
    delete: admin,
    manageAccess: admin,
  }
}

export const canAccessCase = async (user: SessionContext, caseId: string, permission: 'read' | 'edit' | 'upload', client?: PoolClient) => {
  if (user.role === 'researcher') return null
  const query = client ? client.query.bind(client) : pool.query.bind(pool)
  const result = await query(
    `SELECT c.owner_user_id,
            COALESCE(array_agg(g.permission) FILTER (WHERE g.permission IS NOT NULL), '{}') AS grants
       FROM cases c
       LEFT JOIN case_access_grants g ON g.case_id = c.id AND g.user_id = $2 AND g.revoked_at IS NULL
      WHERE c.id = $1 GROUP BY c.id`,
    [caseId, user.id],
  )
  if (!result.rows[0]) return null
  const capabilities = effectiveCaseCapabilities(user, result.rows[0].owner_user_id, result.rows[0].grants)
  return capabilities[permission] ? capabilities : null
}

export const assertCaseCapabilityInTransaction = async (client: PoolClient, user: SessionContext, caseId: string, permission: 'read' | 'edit' | 'upload') => {
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 1))', [`case-access:${caseId}`])
  const capability = await canAccessCase(user, caseId, permission, client)
  if (!capability) throw new CaseAccessError()
  return capability
}

export const withAuthorizedCaseMutation = async <T>(user: SessionContext, caseId: string, permission: 'edit' | 'upload', operation: (client: PoolClient, capability: CaseCapabilities) => Promise<T>): Promise<T> => {
  const lease = await caseLockPool.connect()
  let leaseHeld = false
  let client: PoolClient | undefined
  try {
    await acquireCaseMutationLock(lease, caseId)
    leaseHeld = true
    client = await pool.connect()
    await client.query('BEGIN')
    // The session-level lock on `lease` already serializes this transaction
    // with every case writer and grant change. Do not take the matching
    // transaction-level lock on `client`: those are different connections,
    // so the second lock would wait forever for the first one held here.
    const capability = await canAccessCase(user, caseId, permission, client)
    if (!capability) throw new CaseAccessError()
    const value = await operation(client, capability)
    await client.query('COMMIT')
    return value
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally {
    client?.release()
    if (leaseHeld) {
      try { await releaseCaseMutationLock(lease, caseId); lease.release() }
      catch { lease.release(true) }
    } else lease.release(true)
  }
}

export const visibleCasesSql = (user: SessionContext) => user.role === 'admin'
  ? { sql: 'TRUE', values: [] as unknown[] }
  : user.role === 'researcher'
    ? { sql: 'FALSE', values: [] as unknown[] }
    : { sql: '(c.owner_user_id = $1 OR EXISTS (SELECT 1 FROM case_access_grants g WHERE g.case_id = c.id AND g.user_id = $1 AND g.permission = \'read\' AND g.revoked_at IS NULL))', values: [user.id] }

export const grantCasePermission = async (actor: SessionContext, caseId: string, userId: string, permission: CasePermission) => {
  const lockClient = await caseLockPool.connect()
  let lockHeld = false
  let client: PoolClient | undefined
  try {
    await acquireCaseMutationLock(lockClient, caseId)
    lockHeld = true
    client = await pool.connect()
    await client.query('BEGIN')
    const target = await client.query("SELECT id FROM users WHERE id = $1 AND role = 'pathologist' AND is_active = TRUE FOR UPDATE", [userId])
    const caseRow = await client.query('SELECT identifier FROM cases WHERE id = $1 FOR UPDATE', [caseId])
    if (!target.rowCount || !caseRow.rowCount) throw new Error('not-found')
    if (permission !== 'read') {
      const read = await client.query("SELECT 1 FROM case_access_grants WHERE case_id=$1 AND user_id=$2 AND permission='read' AND revoked_at IS NULL", [caseId, userId])
      const owner = await client.query('SELECT 1 FROM cases WHERE id=$1 AND owner_user_id=$2', [caseId, userId])
      if (!read.rowCount && !owner.rowCount) throw new Error('read-required')
    }
    const active = await client.query('SELECT 1 FROM case_access_grants WHERE case_id=$1 AND user_id=$2 AND permission=$3 AND revoked_at IS NULL', [caseId, userId, permission])
    if (!active.rowCount) await client.query('INSERT INTO case_access_grants(case_id,user_id,permission,granted_by) VALUES($1,$2,$3,$4)', [caseId, userId, permission, actor.id])
    await client.query("INSERT INTO case_access_audit(actor_user_id,case_id,case_identifier,target_user_id,action,permission,result) VALUES($1,$2,$3,$4,'grant',$5,'success')", [actor.id, caseId, caseRow.rows[0].identifier, userId, permission])
    await client.query('COMMIT')
  } catch (error) { if (client) await client.query('ROLLBACK').catch(() => undefined); throw error }
  finally {
    client?.release()
    if (lockHeld) {
      try { await releaseCaseMutationLock(lockClient, caseId); lockClient.release() }
      catch { lockClient.release(true) }
    } else lockClient.release(true)
  }
}

export const revokeCasePermission = async (actor: SessionContext, caseId: string, userId: string, permission: CasePermission) => {
  const lockClient = await caseLockPool.connect()
  let lockHeld = false
  let client: PoolClient | undefined
  try {
    await acquireCaseMutationLock(lockClient, caseId)
    lockHeld = true
    client = await pool.connect()
    await client.query('BEGIN')
    const caseRow = await client.query('SELECT identifier FROM cases WHERE id=$1 FOR UPDATE', [caseId])
    if (!caseRow.rowCount) throw new Error('not-found')
    if (permission === 'read') {
      await client.query("UPDATE case_access_grants SET revoked_at=NOW() WHERE case_id=$1 AND user_id=$2 AND permission IN ('read','edit','upload') AND revoked_at IS NULL", [caseId, userId])
    } else {
      await client.query('UPDATE case_access_grants SET revoked_at=NOW() WHERE case_id=$1 AND user_id=$2 AND permission=$3 AND revoked_at IS NULL', [caseId, userId, permission])
    }
    await client.query("INSERT INTO case_access_audit(actor_user_id,case_id,case_identifier,target_user_id,action,permission,result) VALUES($1,$2,$3,$4,'revoke',$5,'success')", [actor.id, caseId, caseRow.rows[0].identifier, userId, permission])
    await client.query('COMMIT')
  } catch (error) { if (client) await client.query('ROLLBACK').catch(() => undefined); throw error }
  finally {
    client?.release()
    if (lockHeld) {
      try { await releaseCaseMutationLock(lockClient, caseId); lockClient.release() }
      catch { lockClient.release(true) }
    } else lockClient.release(true)
  }
}

export const recordCaseAudit = async (client: PoolClient, actor: SessionContext, caseId: string, identifier: string, action: string) => {
  await client.query("INSERT INTO case_access_audit(actor_user_id,case_id,case_identifier,action,result) VALUES($1,$2,$3,$4,'success')", [actor.id, caseId, identifier, action])
}
