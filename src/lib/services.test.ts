import assert from 'node:assert/strict'
import { test } from 'node:test'

import { prefill, searchServices } from './services.ts'

test('a service is found by its name or its Thai alias, closest match first', () => {
  assert.equal(searchServices('netflix')[0].name, 'Netflix')
  assert.equal(searchServices('เน็ตฟลิกซ์')[0].name, 'Netflix')
  assert.equal(searchServices('youtube')[0].name, 'YouTube Premium')
  assert.deepEqual(searchServices('n'), [])
})

test('picking a service offers its plans in the pocket currency, in hundredths', () => {
  const netflix = searchServices('netflix')[0]
  const thb = prefill(netflix, 'THB')
  assert.equal(thb.name, 'Netflix')
  assert.equal(thb.unit, 'month')
  assert.deepEqual(thb.plans[0], { name: 'Mobile', amount: 9900, unit: 'month' })
  assert.equal(thb.plans.length, 4)
  assert.deepEqual(prefill(netflix, 'USD').plans, [])
})

test('a service with no plans still fills its repeat', () => {
  const p = prefill(searchServices('namecheap')[0], 'THB')
  assert.deepEqual([p.unit, p.plans], ['year', []])
})
