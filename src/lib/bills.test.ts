import assert from 'node:assert/strict'
import { test } from 'node:test'

import { billStates, dueBetween, nextDue } from './bills.ts'

const monthly = (day: number) => ({ repeat: 'monthly' as const, day, month: null })
const cycle = { start: '2026-09-25', end: '2026-10-24' }

test('a monthly bill is due once in a pay cycle', () => {
  assert.equal(dueBetween(monthly(15), cycle.start, cycle.end), '2026-10-15')
  assert.equal(dueBetween(monthly(24), cycle.start, cycle.end), '2026-10-24')
  assert.equal(dueBetween(monthly(25), cycle.start, cycle.end), '2026-09-25')
})

test('a day past the month end falls on its last day', () => {
  assert.equal(dueBetween(monthly(31), '2027-02-01', '2027-02-28'), '2027-02-28')
  assert.equal(nextDue(monthly(31), '2026-11-02'), '2026-11-30')
})

test('a yearly bill is due only in its month', () => {
  const yearly = { repeat: 'yearly' as const, day: 9, month: 3 }
  assert.equal(dueBetween(yearly, cycle.start, cycle.end), null)
  assert.equal(nextDue(yearly, '2026-10-18'), '2027-03-09')
})

const bill = (over: object = {}) => ({ id: 'b1', name: 'Phone bill', amount: 59900, categoryId: 'bills', skippedOn: null, since: '2026-01-01', ...monthly(15), ...over })
const entry = (over: object = {}) => ({ id: 'e1', kind: 'expense' as const, amount: 59900, note: '', categoryId: 'bills', occurredOn: '2026-10-15', billId: null, billFor: null, ...over })

test('unpaid bills are late, due today or soon, and set aside their amount', () => {
  const [late] = billStates([bill()], [], cycle, '2026-10-18')
  assert.equal(late.state, 'late')
  assert.equal(late.setAside, 59900)
  assert.equal(billStates([bill()], [], cycle, '2026-10-15')[0].state, 'today')
  assert.equal(billStates([bill({ day: 24 })], [], cycle, '2026-10-18')[0].state, 'soon')
})

test('a bill added after its day this cycle starts next cycle', () => {
  const [b] = billStates([bill({ since: '2026-10-18' })], [], cycle, '2026-10-18')
  assert.equal(b.state, null)
  assert.equal(b.setAside, 0)
  assert.equal(b.next, '2026-11-15')
})

test('a linked entry pays the due date it names', () => {
  const [b] = billStates([bill()], [entry({ billId: 'b1', billFor: '2026-10-15', occurredOn: '2026-10-20' })], cycle, '2026-10-21')
  assert.equal(b.state, 'paid')
  assert.equal(b.setAside, 0)
})

test('a hand-logged entry pays a bill when it is close and alike', () => {
  assert.equal(billStates([bill()], [entry({ occurredOn: '2026-10-17' })], cycle, '2026-10-18')[0].state, 'paid')
  assert.equal(billStates([bill()], [entry({ amount: 61200, note: 'phone bill Oct' })], cycle, '2026-10-18')[0].state, 'paid')
  // Too far from the due date, another category, or neither amount nor name.
  assert.equal(billStates([bill()], [entry({ occurredOn: '2026-10-19' })], cycle, '2026-10-20')[0].state, 'late')
  assert.equal(billStates([bill()], [entry({ categoryId: 'food' })], cycle, '2026-10-18')[0].state, 'late')
  assert.equal(billStates([bill()], [entry({ amount: 100 })], cycle, '2026-10-18')[0].state, 'late')
})

test('one entry pays only one bill', () => {
  const states = billStates([bill(), bill({ id: 'b2', name: 'Internet' })], [entry()], cycle, '2026-10-18')
  assert.deepEqual(states.map((s) => s.state), ['paid', 'late'])
})

test('a skipped due date sets nothing aside; a bill that varies sets aside its last payment', () => {
  assert.equal(billStates([bill({ skippedOn: '2026-10-15' })], [], cycle, '2026-10-18')[0].state, 'skipped')
  const last = entry({ id: 'e0', billId: 'b1', billFor: '2026-09-15', occurredOn: '2026-09-15', amount: 118000 })
  const [varies] = billStates([bill({ amount: null })], [last], cycle, '2026-10-18')
  assert.equal(varies.setAside, 118000)
})
