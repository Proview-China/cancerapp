const { test } = require('node:test')
const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')
const { listenOwned, startOwnedChild } = require('./startup.cjs')

test('waits for the owned socket to listen', async () => {
  const server = new EventEmitter()
  let ready = false
  const result = listenOwned({ listen: (port, host) => {
    assert.equal(port, 4000)
    assert.equal(host, '127.0.0.1')
    return server
  } }, 4000, '127.0.0.1').then(value => { ready = true; return value })
  await Promise.resolve()
  assert.equal(ready, false)
  server.emit('listening')
  assert.equal(await result, server)
})

test('development waits for child readiness and reports unexpected exit', async () => {
  const child = new EventEmitter()
  let exited = false
  let ready = false
  const pending = startOwnedChild((_exe, _args, options) => {
    assert.equal(options.stdio[3], 'ipc')
    return child
  }, 'node', 'dev-server.cjs', () => { exited = true }).then(value => { ready = true; return value })
  await Promise.resolve()
  assert.equal(ready, false)
  child.emit('message', { type: 'ready' })
  assert.equal(await pending, child)
  child.emit('exit', 1)
  assert.equal(exited, true)
})

test('development rejects occupied port and suppresses child error details', async () => {
  const child = new EventEmitter()
  let killed = false
  child.kill = () => { killed = true }
  const pending = startOwnedChild(() => child, 'node', 'dev-server.cjs', () => {})
  child.emit('message', { type: 'error', code: 'EADDRINUSE', detail: 'secret' })
  await assert.rejects(pending, { message: '端口 4000 已被占用' })
  assert.equal(killed, true)
})

test('rejects an occupied port without connecting to it', async () => {
  const server = new EventEmitter()
  const result = listenOwned({ listen: () => server }, 4000, '127.0.0.1')
  const error = Object.assign(new Error('address in use'), { code: 'EADDRINUSE' })
  server.emit('error', error)
  await assert.rejects(result, { code: 'EADDRINUSE' })
})
