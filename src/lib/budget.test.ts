import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  cycleFor,
  cycleLimitState,
  dayStrip,
  householdDay,
  previousCycle,
  sortByState,
} from './budget.ts'

test('cycle runs payday to the day before next payday', () => {
  assert.deepEqual(cycleFor('2026-10-16', 25), { start: '2026-09-25', end: '2026-10-24', length: 30, dayIndex: 22 })
  assert.deepEqual(cycleFor('2026-10-25', 25), { start: '2026-10-25', end: '2026-11-24', length: 31, dayIndex: 1 })
})

test('start day past month end clamps to the last day', () => {
  // Paid on the last day: 31 Jan, 28 Feb, 31 Mar.
  assert.deepEqual(cycleFor('2026-02-15', 31), { start: '2026-01-31', end: '2026-02-27', length: 28, dayIndex: 16 })
  assert.equal(cycleFor('2026-02-28', 31).start, '2026-02-28')
  assert.equal(cycleFor('2026-02-28', 31).end, '2026-03-30')
})

test('cycle crosses the year boundary', () => {
  assert.deepEqual(cycleFor('2027-01-03', 25), { start: '2026-12-25', end: '2027-01-24', length: 31, dayIndex: 10 })
})

test('previous cycle keeps the same day index', () => {
  const prev = previousCycle(cycleFor('2026-10-16', 25), 25)
  assert.equal(prev.start, '2026-08-25')
  assert.equal(prev.end, '2026-09-24')
  assert.equal(prev.dayIndex, 22)
})

test('cycle limit states: ok, ahead of pace, over', () => {
  // Gas 3,000 at day 22 of 30: pace 2,200.
  assert.equal(cycleLimitState(210_000, 300_000, 22, 30).state, 'ok')
  assert.equal(cycleLimitState(398_000, 450_000, 22, 30).state, 'ahead')
  const over = cycleLimitState(115_000, 100_000, 22, 30)
  assert.equal(over.state, 'over')
  assert.equal(over.left, -15_000)
})

test('day strip marks over days, today and future', () => {
  const cycle = cycleFor('2026-09-27', 25)
  const strip = dayStrip(cycle, '2026-09-27', new Map([['2026-09-25', 15_000], ['2026-09-26', 26_000]]), 20_000)
  assert.deepEqual(strip.slice(0, 4).map((d) => d.state), ['under', 'over', 'today', 'future'])
  assert.equal(strip.length, 30)
})

test('problems sort first', () => {
  const rows = [
    { name: 'Fun', state: 'ok' as const, spent: 1, limit: 10 },
    { name: 'Travel', state: 'over' as const, spent: 12, limit: 10 },
    { name: 'Bills', state: 'ahead' as const, spent: 9, limit: 10 },
  ]
  assert.deepEqual(sortByState(rows).map((r) => r.name), ['Travel', 'Bills', 'Fun'])
})

test('household day falls back to UTC when APP_TZ is unset', () => {
  const saved = process.env.APP_TZ
  // 23:30 UTC on 1 Jan is already 2 Jan in Bangkok.
  const late = new Date('2026-01-01T23:30:00Z')
  try {
    delete process.env.APP_TZ
    assert.equal(householdDay(late), '2026-01-01')
    process.env.APP_TZ = ''
    assert.equal(householdDay(late), '2026-01-01')
    process.env.APP_TZ = 'Asia/Bangkok'
    assert.equal(householdDay(late), '2026-01-02')
  } finally {
    if (saved === undefined) delete process.env.APP_TZ
    else process.env.APP_TZ = saved
  }
})
