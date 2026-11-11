import assert from 'node:assert/strict'
import { test } from 'node:test'

import { billStates, duesBetween, nextDue, perMonthByAccount, timesAYear, toSchedule } from './bills.ts'

const every = (unit: 'week' | 'month' | 'year', n: number, firstDue: string) => ({ unit, every: n, firstDue })
const cycle = { start: '2026-09-25', end: '2026-10-24' }

const bill = (over: object = {}) => ({ id: 'b1', name: 'Phone bill', amount: 59900, categoryId: 'bills', skippedOn: null, ...every('month', 1, '2026-01-15'), ...over })
const entry = (over: object = {}) => ({ id: 'e1', kind: 'expense' as const, amount: 59900, note: '', categoryId: 'bills', occurredOn: '2026-10-15', billId: null, billFor: null, ...over })

test('unpaid bills are late, due today or soon, and set aside their amount', () => {
  const [late] = billStates([bill()], [], cycle, '2026-10-18')
  assert.equal(late.state, 'late')
  assert.equal(late.setAside, 59900)
  assert.equal(billStates([bill()], [], cycle, '2026-10-15')[0].state, 'today')
  assert.equal(billStates([bill({ firstDue: '2026-01-24' })], [], cycle, '2026-10-18')[0].state, 'soon')
})

test('a bill whose first due date is after this cycle starts next cycle', () => {
  const [b] = billStates([bill({ firstDue: '2026-11-15' })], [], cycle, '2026-10-18')
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


test('a monthly schedule is due once in a pay cycle', () => {
  assert.deepEqual(duesBetween(every('month', 1, '2026-01-15'), cycle.start, cycle.end), ['2026-10-15'])
  assert.deepEqual(duesBetween(every('month', 1, '2026-01-25'), cycle.start, cycle.end), ['2026-09-25'])
})

test('every N months skips cycles and keeps its day after a short month', () => {
  const quarterly = every('month', 3, '2026-08-15')
  assert.deepEqual(duesBetween(quarterly, cycle.start, cycle.end), [])
  assert.deepEqual(duesBetween(quarterly, '2026-10-25', '2026-11-24'), ['2026-11-15'])
  assert.deepEqual(duesBetween(every('month', 1, '2027-01-31'), '2027-02-01', '2027-03-31'), ['2027-02-28', '2027-03-31'])
})

test('a weekly schedule is due several times in a pay cycle', () => {
  assert.deepEqual(duesBetween(every('week', 1, '2026-09-01'), cycle.start, cycle.end), ['2026-09-29', '2026-10-06', '2026-10-13', '2026-10-20'])
  assert.deepEqual(duesBetween(every('week', 2, '2026-09-01'), cycle.start, cycle.end), ['2026-09-29', '2026-10-13'])
})

test('a yearly schedule is due only on its date', () => {
  assert.deepEqual(duesBetween(every('year', 1, '2026-03-09'), cycle.start, cycle.end), [])
  assert.deepEqual(duesBetween(every('year', 1, '2024-02-29'), '2027-02-01', '2027-03-01'), ['2027-02-28'])
})

test('the next due date is on or after today, or the first due date when that is later', () => {
  assert.equal(nextDue(every('month', 1, '2026-01-31'), '2026-11-02'), '2026-11-30')
  assert.equal(nextDue(every('year', 1, '2026-03-09'), '2026-10-18'), '2027-03-09')
  assert.equal(nextDue(every('week', 2, '2026-12-01'), '2026-10-18'), '2026-12-01')
})

test('a weekly bill gives one row per due date, each with its own state', () => {
  const weekly = bill({ ...every('week', 1, '2026-09-01'), amount: 20000 })
  const paid = entry({ billId: 'b1', billFor: '2026-09-29', occurredOn: '2026-09-29', amount: 20000 })
  const rows = billStates([weekly], [paid], cycle, '2026-10-13')
  assert.deepEqual(rows.map((r) => [r.due, r.state, r.setAside]), [
    ['2026-09-29', 'paid', 0],
    ['2026-10-06', 'late', 20000],
    ['2026-10-13', 'today', 20000],
    ['2026-10-20', 'soon', 20000],
  ])
})

test('an old monthly or yearly bill becomes a schedule from its first due date on or after the day it was added', () => {
  assert.deepEqual(toSchedule({ repeat: 'monthly', day: 15, month: null }, '2026-10-18'), every('month', 1, '2026-11-15'))
  assert.deepEqual(toSchedule({ repeat: 'monthly', day: 15, month: null }, '2026-10-15'), every('month', 1, '2026-10-15'))
  assert.deepEqual(toSchedule({ repeat: 'yearly', day: 9, month: 3 }, '2026-10-18'), every('year', 1, '2027-03-09'))
  // A short month would clamp the day and lose it, so the schedule starts at the first month that has it.
  assert.deepEqual(toSchedule({ repeat: 'monthly', day: 31, month: null }, '2026-11-02'), every('month', 1, '2026-12-31'))
})

test('an old yearly bill past its month end becomes that month\'s last day', () => {
  assert.deepEqual(toSchedule({ repeat: 'yearly', day: 31, month: 2 }, '2026-10-18'), every('year', 1, '2028-02-29'))
})

test('a schedule is due 52 times a year weekly, 12 monthly, and fewer when every N', () => {
  assert.equal(timesAYear(every('week', 1, '2026-01-01')), 52)
  assert.equal(timesAYear(every('week', 2, '2026-01-01')), 26)
  assert.equal(timesAYear(every('month', 3, '2026-01-01')), 4)
  assert.equal(timesAYear(every('year', 2, '2026-01-01')), 0.5)
})

test('a schedule stops after its number of charges or on its end date', () => {
  const sixMonths = { ...every('month', 1, '2026-06-15'), endsAfter: 6 }
  assert.deepEqual(duesBetween(sixMonths, '2026-10-01', '2027-03-01'), ['2026-10-15', '2026-11-15'])
  const untilDec = { ...every('week', 1, '2026-12-01'), endsOn: '2026-12-15' }
  assert.deepEqual(duesBetween(untilDec, '2026-11-01', '2027-01-31'), ['2026-12-01', '2026-12-08', '2026-12-15'])
})

test('an ended schedule has no next due date', () => {
  assert.equal(nextDue({ ...every('month', 1, '2026-06-15'), endsAfter: 3 }, '2026-10-18'), null)
  assert.equal(nextDue({ ...every('month', 1, '2026-06-15'), endsOn: '2026-11-30' }, '2026-10-18'), '2026-11-15')
})

test('a paused bill has no due dates from the day it was paused and sets nothing aside', () => {
  const [b] = billStates([bill({ pausedOn: '2026-10-10' })], [], cycle, '2026-10-18')
  assert.deepEqual([b.due, b.state, b.setAside, b.paused, b.next], [null, null, 0, true, null])
})

test('a resumed bill skips the due dates it missed while paused', () => {
  const [b] = billStates([bill({ resumedOn: '2026-10-16' })], [], cycle, '2026-10-18')
  assert.deepEqual([b.due, b.paused, b.next], [null, false, '2026-11-15'])
})

test('a bill on a free trial counts the days until its first charge', () => {
  const trial = bill({ trial: true, firstDue: '2026-11-01' })
  assert.equal(billStates([trial], [], cycle, '2026-10-18')[0].trialDaysLeft, 14)
  assert.equal(billStates([trial], [], { start: '2026-10-25', end: '2026-11-24' }, '2026-11-02')[0].trialDaysLeft, null)
})

test('a bill past its last charge has ended', () => {
  const [b] = billStates([bill({ firstDue: '2026-06-15', endsAfter: 3 })], [], cycle, '2026-10-18')
  assert.deepEqual([b.ended, b.next, b.setAside], [true, null, 0])
  assert.equal(billStates([bill()], [], cycle, '2026-10-18')[0].ended, false)
})

test('each bank account pays the monthly share of its running bills; bills with none group together', () => {
  const b = (bankAccountId: string | null, amount: number | null, over: object = {}) => ({ bankAccountId, amount, lastPaid: null, paused: false, ended: false, ...every('month', 1, '2026-01-01'), ...over })
  const totals = perMonthByAccount([
    b('kbank', 39900),
    b('kbank', 120000, { unit: 'year' }),
    b('scb', 1500, { unit: 'week' }),
    b('scb', 9900, { paused: true }),
    b('scb', 9900, { ended: true }),
    b(null, null, { lastPaid: 30000 }),
  ])
  assert.deepEqual([...totals], [['kbank', 49900], ['scb', 6500], [null, 30000]])
})
