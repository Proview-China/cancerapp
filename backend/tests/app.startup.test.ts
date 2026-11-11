import { describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'

describe('application creation', () => {
  it('creates the application without starting the production listener', () => {
    expect(typeof createApp().listen).toBe('function')
  })
})
