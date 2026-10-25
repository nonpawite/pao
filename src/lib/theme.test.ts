import assert from 'node:assert/strict'
import { test } from 'node:test'

import { parseTheme } from './theme.ts'

test('a stored colour mode is Light, Dark or System', () => {
  assert.equal(parseTheme('light'), 'light')
  assert.equal(parseTheme('dark'), 'dark')
  assert.equal(parseTheme('system'), 'system')
})

test('a missing or unknown cookie follows the system', () => {
  assert.equal(parseTheme(undefined), 'system')
  assert.equal(parseTheme(''), 'system')
  assert.equal(parseTheme('Dark'), 'system')
  assert.equal(parseTheme('constructor'), 'system')
})
