import { Pool } from 'pg'
import { config } from '../config.js'

export const pool = new Pool({
  connectionString: config.databaseUrl,
})

// Lock waiters must not consume business-query pool connections while waiting.
export const caseLockPool = new Pool({
  connectionString: config.databaseUrl,
  max: 20,
  connectionTimeoutMillis: 5000,
  statement_timeout: 15000,
})

pool.on('error', (error: Error) => {
  console.error('数据库连接池错误', error)
})

caseLockPool.on('error', (error: Error) => {
  console.error('病例锁连接池错误', error)
})
