import { createHash } from 'node:crypto'
import type { Client } from 'pg'

export const applyCaseAccessMigration = async (client: Client, mapping: Record<string, string>, ddl: string) => {
  try {
    await client.query('BEGIN')
    await client.query('LOCK TABLE cases, case_samples, case_reports, sample_tissue_analysis, users IN ACCESS EXCLUSIVE MODE')
    await client.query(ddl)
    const existingVersion = await client.query("SELECT 1 FROM case_access_migrations WHERE version='002_case_access_control'")
    if (existingVersion.rowCount) throw new Error('Case access migration version is already applied')

    const before = await client.query('SELECT id::text FROM cases ORDER BY id')
    const keys = Object.keys(mapping).sort()
    if (keys.length !== before.rows.length || keys.some((id, i) => id !== before.rows[i].id)) throw new Error('Case owner mapping coverage mismatch')
    const ownerIds = [...new Set(Object.values(mapping))]
    const admins = await client.query("SELECT id::text FROM users WHERE id = ANY($1::uuid[]) AND role='admin' AND is_active=TRUE FOR UPDATE", [ownerIds])
    if (admins.rows.length !== ownerIds.length) throw new Error('Mapping references missing or disabled administrators')

    const sampleCount = Number((await client.query('SELECT COUNT(*)::bigint AS count FROM case_samples')).rows[0].count)
    const reportCount = Number((await client.query('SELECT COUNT(*)::bigint AS count FROM case_reports')).rows[0].count)
    const analysisCount = Number((await client.query('SELECT COUNT(*)::bigint AS count FROM sample_tissue_analysis')).rows[0].count)
    const associationFingerprint = async () => {
      const result = await client.query(`SELECT md5(concat_ws('|',
        (SELECT string_agg(id::text || ':' || case_id::text, ',' ORDER BY id) FROM case_samples),
        (SELECT string_agg(id::text || ':' || case_id::text, ',' ORDER BY id) FROM case_reports),
        (SELECT string_agg(id::text || ':' || sample_id::text, ',' ORDER BY id) FROM sample_tissue_analysis)
      )) AS fingerprint`)
      return result.rows[0].fingerprint
    }
    const beforeFingerprint = await associationFingerprint()
    for (const [caseId, ownerId] of Object.entries(mapping)) await client.query('UPDATE cases SET owner_user_id=$2 WHERE id=$1', [caseId, ownerId])
    await client.query('ALTER TABLE cases ALTER COLUMN owner_user_id SET NOT NULL')
    const after = await client.query('SELECT COUNT(*)::bigint AS count, COUNT(owner_user_id)::bigint AS owned FROM cases')
    const afterSamples = Number((await client.query('SELECT COUNT(*)::bigint AS count FROM case_samples')).rows[0].count)
    const afterReports = Number((await client.query('SELECT COUNT(*)::bigint AS count FROM case_reports')).rows[0].count)
    const afterAnalysis = Number((await client.query('SELECT COUNT(*)::bigint AS count FROM sample_tissue_analysis')).rows[0].count)
    const afterFingerprint = await associationFingerprint()
    const ownerIdentity = await client.query(`SELECT COUNT(*)::bigint AS count FROM cases c
      JOIN users u ON u.id=c.owner_user_id AND u.role='admin' AND u.is_active=TRUE`)
    if (Number(after.rows[0].count) !== before.rows.length || Number(after.rows[0].owned) !== before.rows.length || Number(ownerIdentity.rows[0].count) !== before.rows.length || sampleCount !== afterSamples || reportCount !== afterReports || analysisCount !== afterAnalysis || beforeFingerprint !== afterFingerprint) throw new Error('Post-migration case or association count mismatch')
    const assigned = await client.query('SELECT id::text, owner_user_id::text FROM cases ORDER BY id')
    if (assigned.rows.some(row => mapping[row.id] !== row.owner_user_id)) throw new Error('Post-migration owner mapping identity mismatch')

    const version = '002_case_access_control'
    const digest = createHash('sha256').update(JSON.stringify(Object.fromEntries(keys.map(id => [id, mapping[id]])))).digest('hex')
    await client.query('INSERT INTO case_access_migrations(version,mapping_sha256,case_count,sample_count,report_count,analysis_count) VALUES($1,$2,$3,$4,$5,$6)', [version, digest, before.rows.length, sampleCount, reportCount, analysisCount])
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw error
  }
}
