import assert from 'node:assert/strict'
import { test } from 'node:test'

import { securityPrint } from './colors.ts'

test('a pocket keeps its own security print', () => {
  const id = '0b6f2d7e-3c1a-4f8e-9d2b-5a7c1e4f9b03'
  assert.equal(securityPrint(id), securityPrint(id))
  assert.notEqual(securityPrint(id), securityPrint('6d1e8a40-2f9b-4c7d-8e3a-1b5f7c9d2e64'))
})

test('the print stays inside the card', () => {
  const ys = [...securityPrint('any pocket').matchAll(/[ML][\d.]+ (-?[\d.]+)/g)].map((m) => Number(m[1]))
  assert.ok(ys.length > 100)
  assert.ok(ys.every((y) => y >= 0 && y <= 40))
})
