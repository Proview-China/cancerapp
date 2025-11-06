#!/usr/bin/env node
const { execSync } = require('node:child_process')
const port = process.argv[2] ?? process.env.PORT ?? '5173'
if (!/^[0-9]+$/.test(port)) {
  console.error(`Invalid port: ${port}`)
  process.exit(1)
}
try {
  const output = execSync(`lsof -t -i :${port}`, { stdio: ['ignore', 'pipe', 'ignore'] })
  const pids = output.toString().split('\n').filter(Boolean)
  if (pids.length === 0) {
    console.log(`Port ${port} is free.`)
    process.exit(0)
  }
  console.log(`Killing processes on port ${port}: ${pids.join(', ')}`)
  execSync(`kill -9 ${pids.join(' ')}`)
  console.log(`Port ${port} cleared.`)
  process.exit(0)
} catch (error) {
  if (error.status === 1) {
    console.log(`Port ${port} is already free.`)
    process.exit(0)
  }
  console.error(`Failed to clear port ${port}:`, error.message)
  process.exit(1)
}
