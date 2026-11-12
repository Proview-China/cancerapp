import { describe, expect, it } from 'vitest'
import { effectiveCaseCapabilities, recordCaseAudit } from '../src/auth/caseAccess.js'
import type { SessionContext } from '../src/auth/types.js'

const user = (role: SessionContext['role'], id = 'path-1'): SessionContext => ({ id, username: id, role, sessionId: 'session' })

describe('case capability policy', () => {
  it('grants admins all capabilities and ignores researcher grants', () => {
    expect(effectiveCaseCapabilities(user('admin', 'admin-1'), 'other', [])).toEqual({ read: true, edit: true, upload: true, delete: true, manageAccess: true })
    expect(effectiveCaseCapabilities(user('researcher'), null, ['read', 'edit', 'upload'])).toEqual({ read: false, edit: false, upload: false, delete: false, manageAccess: false })
  })

  it('limits explicit edit and upload to read-capable pathologists', () => {
    expect(effectiveCaseCapabilities(user('pathologist'), null, ['read'])).toMatchObject({ read: true, edit: false, upload: false, delete: false })
    expect(effectiveCaseCapabilities(user('pathologist'), null, ['read', 'edit'])).toMatchObject({ read: true, edit: true, upload: false })
    expect(effectiveCaseCapabilities(user('pathologist'), null, ['read', 'upload'])).toMatchObject({ read: true, edit: false, upload: true })
    expect(effectiveCaseCapabilities(user('pathologist'), null, ['edit', 'upload'])).toMatchObject({ read: false, edit: false, upload: false })
    expect(effectiveCaseCapabilities(user('pathologist'), 'path-1', [])).toMatchObject({ read: true, edit: true, upload: true })
  })

  it('writes only minimal audit fields and propagates audit failure to the caller', async () => {
    const client = { query: async () => ({ rowCount: 1 }) }
    await recordCaseAudit(client as never, user('admin', 'admin-1'), 'case-1', 'CASE-1', 'case.delete')
    await expect(recordCaseAudit({ query: async () => { throw new Error('audit-failure') } } as never, user('admin', 'admin-1'), 'case-1', 'CASE-1', 'case.delete')).rejects.toThrow('audit-failure')
  })
})
