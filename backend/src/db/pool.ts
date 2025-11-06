import { Pool } from 'pg'
import { config } from '../config.js'

export const pool = new Pool({
  connectionString: config.databaseUrl,
})

pool.on('error', (error: Error) => {
  console.error('数据库连接池错误', error)
})
