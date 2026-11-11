import { addDays, daysInMonth, diffDays, iso, parts } from './budget.ts'
import type { ISODate } from './budget.ts'

export type Schedule = {
  firstDue: ISODate
  unit: 'week' | 'month' | 'year'
  every: number
  // Stops after this many charges, or after this date; null or missing runs on.
  endsAfter?: number | null
  endsOn?: ISODate | null
}

/** Every due date between two dates (inclusive). A day past the month's end falls on its last day. */
export function duesBetween(s: Schedule, from: ISODate, to: ISODate): ISODate[] {
  const { y, m, d } = parts(s.firstDue)
  const out: ISODate[] = []
  const months = s.unit === 'year' ? 12 * s.every : s.every
  const last = s.endsOn && s.endsOn < to ? s.endsOn : to
  // ponytail: walks from the first due date each call; fine for decades of bills.
  for (let k = 0; !s.endsAfter || k < s.endsAfter; k++) {
    let due: ISODate
    if (s.unit === 'week') due = addDays(s.firstDue, 7 * s.every * k)
    else {
      const mm = m - 1 + k * months
      const [yy, mo] = [y + Math.floor(mm / 12), (mm % 12) + 1]
      due = iso(yy, mo, Math.min(d, daysInMonth(yy, mo)))
    }
    if (due > last) break
    if (due >= from) out.push(due)
  }
  return out
}

/** How often a schedule falls due in a year, for "a month" and "a year" totals. */
export const timesAYear = (s: Schedule) => ({ week: 52, month: 12, year: 1 })[s.unit] / s.every

/**
 * What each bank account pays a month for its running bills (paused and ended ones cost nothing), in hundredths.
 * A bill that varies counts its last payment. Bills paid from no account group under null.
 */
export function perMonthByAccount(
  bills: (Schedule & { bankAccountId: string | null; amount: number | null; lastPaid: number | null; paused: boolean; ended: boolean })[],
) {
  const year = new Map<string | null, number>()
  for (const b of bills)
    if (!b.paused && !b.ended) year.set(b.bankAccountId, (year.get(b.bankAccountId) ?? 0) + (b.amount ?? b.lastPaid ?? 0) * timesAYear(b))
  return new Map([...year].map(([k, v]) => [k, Math.round(v / 12)]))
}

/** The next due date on or after `today`, or null once the schedule has ended. */
export function nextDue(s: Schedule, today: ISODate): ISODate | null {
  const from = s.firstDue > today ? s.firstDue : today
  // A year per step of the schedule covers the longest gap between two due dates.
  return duesBetween(s, from, addDays(from, 366 * s.every))[0] ?? null
}

/**
 * Converts a bill from the old monthly/yearly shape. The schedule starts at the first due date on or after `since`
 * in a month long enough for its day, so a "31st" bill keeps its 31st.
 * ponytail: a bill added in a short month misses that month's clamped due date; only matters in the cycle it was added.
 */
export function toSchedule(r: { repeat: 'monthly' | 'yearly'; day: number; month: number | null }, since: ISODate): Schedule {
  let { y, m } = parts(since)
  // A yearly "31 Feb" can never fit; it meant the month's last day, at most the 29th.
  const day = r.repeat === 'yearly' ? Math.min(r.day, daysInMonth(2024, r.month!)) : r.day
  for (;;) {
    const due = iso(y, m, day)
    if (day <= daysInMonth(y, m) && due >= since && (r.repeat === 'monthly' || m === r.month))
      return { unit: r.repeat === 'monthly' ? 'month' : 'year', every: 1, firstDue: due }
    if (++m > 12) [y, m] = [y + 1, 1]
  }
}

export type BillState ='paid' | 'skipped' | 'late' | 'today' | 'soon'

/** Still to pay this cycle. */
export const isOwed = (s: BillState | null) => s === 'late' || s === 'today' || s === 'soon'

type Bill = Schedule & {
  id: string
  name: string
  amount: number | null
  categoryId: string | null
  skippedOn: ISODate | null
  // On a free trial until firstDue, its first charge.
  trial?: boolean
  // No due dates from pausedOn on; due dates before resumedOn were missed while paused.
  pausedOn?: ISODate | null
  resumedOn?: ISODate | null
}
type Paying = { id: string; kind: 'expense' | 'income'; amount: number; note: string; categoryId: string | null; occurredOn: ISODate; billId: string | null; billFor: ISODate | null }

/** How near a hand-logged entry must be to the due date to count as paying it. */
const MATCH_DAYS = 3

/**
 * One row per bill and due date this cycle; a bill with no due date this cycle gives one row with none.
 * A due date is paid by an entry linked to it, or by an unlinked expense in the bill's category
 * within 3 days that has its amount or its name in the note; each entry pays one due date.
 * Due dates still to pay set aside the bill's amount, or the last amount paid when it varies.
 * A paused bill has no due dates from the day it was paused; once resumed it skips the ones it missed.
 */
type BillRow<B> = B & {
  due: ISODate | null
  state: BillState | null
  lastPaid: number | null
  paidAmount: number | null
  setAside: number
  // Null while paused or once ended.
  next: ISODate | null
  paused: boolean
  ended: boolean
  // Days until a free trial's first charge; null when not on one.
  trialDaysLeft: number | null
}

export function billStates<B extends Bill>(bills: B[], entries: Paying[], cycle: { start: ISODate; end: ISODate }, today: ISODate): BillRow<B>[] {
  const used = new Set(entries.filter((e) => e.billId).map((e) => e.id))
  return bills.flatMap((b): BillRow<B>[] => {
    const linked = entries.filter((e) => e.billId === b.id).sort((x, y) => y.occurredOn.localeCompare(x.occurredOn))
    const lastPaid = linked[0]?.amount ?? null
    const name = b.name.trim().toLowerCase()
    const paused = !!b.pausedOn
    const after = (x: ISODate) => (b.resumedOn && b.resumedOn > x ? b.resumedOn : x)
    const next = paused ? null : nextDue(b, after(today))
    const flags = { paused, ended: !paused && !next, trialDaysLeft: b.trial && today < b.firstDue ? diffDays(today, b.firstDue) : null, next }
    const end = b.pausedOn && addDays(b.pausedOn, -1) < cycle.end ? addDays(b.pausedOn, -1) : cycle.end
    const dues = duesBetween(b, after(cycle.start), end)
    if (!dues.length) return [{ ...b, ...flags, due: null, state: null, lastPaid, paidAmount: null, setAside: 0 }]
    return dues.map((due) => {
      let paidBy = linked.find((e) => e.billFor === due)
      if (!paidBy) {
        paidBy = entries.find(
          (e) =>
            !used.has(e.id) &&
            e.kind === 'expense' &&
            e.categoryId === b.categoryId &&
            Math.abs(diffDays(due, e.occurredOn)) <= MATCH_DAYS &&
            (e.amount === b.amount || (!!name && e.note.toLowerCase().includes(name))),
        )
        if (paidBy) used.add(paidBy.id)
      }
      const state: BillState = paidBy ? 'paid' : b.skippedOn === due ? 'skipped' : due < today ? 'late' : due === today ? 'today' : 'soon'
      return { ...b, ...flags, due, state, lastPaid, paidAmount: paidBy?.amount ?? null, setAside: isOwed(state) ? (b.amount ?? lastPaid ?? 0) : 0 }
    })
  })
}

/** Late first, then due today, then soon; paid and skipped last; each by due date. */
const order: Record<BillState, number> = { late: 0, today: 1, soon: 2, paid: 3, skipped: 4 }
export const byUrgency = <T extends { state: BillState | null; due: ISODate | null }>(a: T, b: T) =>
  order[a.state ?? 'skipped'] - order[b.state ?? 'skipped'] || (a.due ?? '').localeCompare(b.due ?? '')
