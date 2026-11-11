type Entry = { failures: number[]; attempts: number[] }
const users = new Map<string, Entry>()
const sources = new Map<string, number[]>()

const prune = (values: number[], windowMs: number) => values.filter((time) => time > Date.now() - windowMs)

export const checkLoginRate = (username: string, source: string) => {
  const now = Date.now()
  const user = users.get(username) ?? { failures: [], attempts: [] }
  user.failures = prune(user.failures, 15 * 60 * 1000)
  user.attempts = prune(user.attempts, 60 * 1000)
  const sourceAttempts = prune(sources.get(source) ?? [], 60 * 1000)
  sources.set(source, sourceAttempts)
  return user.failures.length >= 5 || sourceAttempts.length > 30
}

export const recordLoginFailure = (username: string, source: string) => {
  const user = users.get(username) ?? { failures: [], attempts: [] }
  user.failures.push(Date.now())
  user.attempts.push(Date.now())
  users.set(username, user)
}

export const recordSourceAttempt = (source: string) => {
  const list = prune(sources.get(source) ?? [], 60 * 1000)
  list.push(Date.now())
  sources.set(source, list)
}

export const clearLoginFailures = (username: string) => users.delete(username)
