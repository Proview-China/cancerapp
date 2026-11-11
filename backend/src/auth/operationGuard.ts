import os from 'node:os'
import { access, lstat, open, readFile, stat, unlink } from 'node:fs/promises'
import { constants } from 'node:fs'
import { randomUUID } from 'node:crypto'
import path from 'node:path'

const DEPLOYMENT_GROUP = 'cancerapp-deploy'
const BACKEND_RUNTIME_USERS = new Set(['cancerapp-backend'])

export type AllowedDatabaseTarget = {
  host: string
  port: number
  database: string
  user: string
  purpose: DatabasePurpose
}

export type DatabasePurpose = 'migration' | 'initialize' | 'recovery'
export type DatabaseTarget = Omit<AllowedDatabaseTarget, 'purpose'>

export const getDatabaseTarget = (value: string | undefined): DatabaseTarget => {
  if (!value) throw new Error('AUTH_DATABASE_URL is required; refusing implicit database target')
  const url = new URL(value)
  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') throw new Error('Unsupported database protocol')
  if (!url.hostname || !url.port || !url.pathname.slice(1) || !url.username || url.search || url.hash) throw new Error('Incomplete or ambiguous database target')
  if (!Number.isInteger(Number(url.port)) || Number(url.port) < 1 || Number(url.port) > 65535) throw new Error('Invalid database port')
  return { host: url.hostname, port: Number(url.port), database: decodeURIComponent(url.pathname.slice(1)), user: decodeURIComponent(url.username) }
}

// Every path component must be controlled by root, so changing the environment
// cannot redirect the operation to an attacker-owned allowlist.
const readControlledConfiguration = async (): Promise<string> => {
  if (process.platform !== 'linux') throw new Error('Controlled configuration requires Linux')
  const filename = process.env.AUTH_TARGET_CONFIG
  if (!filename || !path.isAbsolute(filename) || path.normalize(filename) !== filename) throw new Error('An absolute controlled configuration path is required')
  let current = path.parse(filename).root
  const components = filename.slice(current.length).split('/')
  for (let i = 0; i < components.length; i++) {
    current = path.join(current, components[i])
    const info = await lstat(current)
    if (info.uid !== 0 || (info.mode & 0o022) !== 0 || (i < components.length - 1 ? !info.isDirectory() : !info.isFile())) throw new Error('Untrusted configuration owner or permissions')
  }
  const handle = await open(filename, constants.O_RDONLY | constants.O_NOFOLLOW)
  try {
    const info = await handle.stat()
    if (!info.isFile() || info.uid !== 0 || (info.mode & 0o022) !== 0) throw new Error('Untrusted configuration owner or permissions')
    return await handle.readFile('utf8')
  } finally { await handle.close() }
}

const parseAllowedTargets = async (): Promise<AllowedDatabaseTarget[]> => {
  const raw = await readControlledConfiguration()
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { throw new Error('Invalid target configuration') }
  if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('Target configuration must contain at least one target')
  return parsed.map((item) => {
    if (!item || typeof item !== 'object') throw new Error('Invalid allowed database target')
    const target = item as Record<string, unknown>
    if (typeof target.host !== 'string' || !target.host.trim() || typeof target.port !== 'number' || !Number.isInteger(target.port) || target.port < 1 || target.port > 65535 || typeof target.database !== 'string' || !target.database.trim() || typeof target.user !== 'string' || !target.user.trim() || !['migration', 'initialize', 'recovery'].includes(String(target.purpose))) throw new Error('Incomplete allowed database target')
    if (target.port === 5432) throw new Error('PostgreSQL 5432 is never an allowed authentication target')
    return { host: target.host, port: target.port, database: target.database, user: target.user, purpose: target.purpose as DatabasePurpose }
  })
}

export const assertAllowedDatabaseTarget = async (target: DatabaseTarget, purpose: DatabasePurpose) => {
  if (target.port === 5432) throw new Error('Refusing PostgreSQL 5432')
  const allowed = (await parseAllowedTargets()).some((candidate) => candidate.host === target.host && candidate.port === target.port && candidate.database === target.database && candidate.user === target.user && candidate.purpose === purpose)
  if (!allowed) throw new Error('Database target is not explicitly allowlisted')
  return target
}

export const targetSummary = (target: DatabaseTarget) => `${target.user}@${target.host}:${target.port}/${target.database}`

const isDeploymentGroupMember = async () => {
  const groupLines = (await readFile('/etc/group', 'utf8').catch(() => '')).split('\n')
  const username = os.userInfo().username
  const line = groupLines.find((entry) => entry.split(':')[0] === DEPLOYMENT_GROUP)
  if (!line) return false
  const fields = line.split(':')
  const gid = Number(fields[2])
  const members = (fields[3] ?? '').split(',').filter(Boolean)
  return members.includes(username) || (process.getgroups?.() ?? []).includes(gid)
}

export const assertApprovedOperator = async () => {
  if (process.platform !== 'linux') throw new Error('Administrator recovery is only supported on Linux in this Change')
  const username = os.userInfo().username
  if (BACKEND_RUNTIME_USERS.has(username)) throw new Error('Backend runtime account cannot run administrator recovery')
  if (process.getuid?.() !== 0 && !(await isDeploymentGroupMember())) throw new Error('Only root or the approved deployment OS group may run this command')
  return username
}

export const assertBackendStopped = async () => {
  // A process scan cannot exclude wrappers or prevent a concurrent start.
  throw new Error('Backend stopped state cannot be verified without a shared lifecycle lock')
}

export const acquireExclusiveLock = async (lockPath: string) => {
  const handle = await open(lockPath, 'wx', 0o600).catch(() => { throw new Error('Another authentication operation is already running') })
  return { release: async () => { await handle.close().catch(() => undefined); await unlink(lockPath).catch(() => undefined) } }
}

export const createAuditEventId = () => randomUUID()

export const auditRecord = (event: { eventId: string; operator: string; targetUser: string; database: string; result: 'success' | 'failure'; stage: string; code?: string }) => {
  console.log(JSON.stringify({ auditEventId: event.eventId, timestamp: new Date().toISOString(), operator: event.operator, targetUser: event.targetUser, database: event.database, result: event.result, stage: event.stage, code: event.code ?? null }))
}

export const confirmTarget = async (summary: string, input: NodeJS.ReadableStream, output: NodeJS.WritableStream) => {
  const { createInterface } = await import('node:readline/promises')
  const rl = createInterface({ input, output })
  const answer = await rl.question(`Target ${summary}. Type the exact target to continue: `)
  rl.close()
  if (answer !== summary) throw new Error('Database target confirmation did not match')
}

export const readProtectedSecret = async (prompt: string, input: NodeJS.ReadStream, output: NodeJS.WriteStream) => {
  if (!input.isTTY || typeof input.setRawMode !== 'function') throw new Error('Protected interactive password input requires a Linux TTY')
  output.write(prompt)
  input.setRawMode(true)
  input.resume()
  return new Promise<string>((resolve, reject) => {
    let value = ''
    const finish = (error?: Error) => {
      input.setRawMode(false)
      input.pause()
      input.removeListener('data', onData)
      output.write('\n')
      if (error) reject(error)
      else resolve(value)
    }
    const onData = (chunk: Buffer | string) => {
      const text = String(chunk)
      if (text === '\u0003') return finish(new Error('Password input cancelled'))
      if (text.includes('\n') || text.includes('\r')) return finish()
      if (text === '\u007f') value = value.slice(0, -1)
      else value += text
    }
    input.on('data', onData)
  })
}

export const assertLockDirectory = async (lockPath: string) => {
  await access(lockPath, constants.F_OK).catch(() => undefined)
  const parent = lockPath.slice(0, lockPath.lastIndexOf('/')) || '.'
  const details = await stat(parent)
  if ((details.mode & 0o077) !== 0) throw new Error('Lock directory permissions are too broad')
}
