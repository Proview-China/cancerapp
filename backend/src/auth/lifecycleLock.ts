import { constants } from 'node:fs'
import { lstat, open } from 'node:fs/promises'
import { spawn } from 'node:child_process'

const directory = '/run/cancerapp'
const filename = `${directory}/lifecycle.lock`

export async function acquireLifecycleLock() {
  if (process.platform !== 'linux') throw new Error('Lifecycle locking requires Linux')
  const dir = await lstat(directory)
  if (!dir.isDirectory() || dir.uid !== 0 || (dir.mode & 0o022) !== 0) throw new Error('Untrusted lifecycle directory')
  const before = await lstat(filename)
  if (!before.isFile() || before.uid !== 0 || before.nlink !== 1 || (before.mode & 0o022) !== 0) throw new Error('Untrusted lifecycle lock')
  const handle = await open(filename, constants.O_RDONLY | constants.O_NOFOLLOW)
  try {
    const actual = await handle.stat()
    if (!actual.isFile() || actual.uid !== 0 || actual.nlink !== 1 || (actual.mode & 0o022) !== 0 || actual.ino !== before.ino || actual.dev !== before.dev) throw new Error('Untrusted lifecycle lock')
    const child = spawn('/usr/bin/flock', ['-n', '3', '/bin/sh', '-c', 'printf "ready\\n"; exec /bin/cat >/dev/null'], { stdio: ['pipe', 'pipe', 'ignore', handle.fd] })
    await new Promise<void>((resolve, reject) => {
      child.once('error', reject)
      child.once('exit', () => reject(new Error('Lifecycle lock unavailable')))
      child.stdout!.once('data', (data: Buffer) => data.toString() === 'ready\n' ? resolve() : reject(new Error('Lifecycle lock unavailable')))
    })
    let releasing = false
    child.once('exit', () => { if (!releasing) process.exit(1) })
    child.unref()
    return { release: async () => { releasing = true; child.stdin!.end(); await new Promise<void>((resolve) => { if (child.exitCode !== null) resolve(); else child.once('exit', () => resolve()) }) } }
  } finally { await handle.close() }
}
