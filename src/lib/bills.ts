import { addDays, daysInMonth, diffDays, iso, parts } from './budget.ts'
import type { ISODate } from './budget.ts'

export type Repeat = { repeat: 'monthly' | 'yearly'; day: number; month: number | null }

/** The first due date between two dates (inclusive), or null. A day past the month's end falls on its last day. */
export function dueBetween(r: Repeat, from: ISODate, to: ISODate): ISODate | null {
  let { y, m } = parts(from)
  // Thirteen months covers the longest gap between two due dates.
  for (let i = 0; i < 13; i++) {
    const d = iso(y, m, Math.min(r.day, daysInMonth(y, m)))
    if (d > to) return null
    if (d >= from && (r.repeat === 'monthly' || m === r.month)) return d
    if (++m > 12) [y, m] = [y + 1, 1]
  }
  return null
}

/** The next due date on or after `today`. */
export const nextDue = (r: Repeat, today: ISODate) => dueBetween(r, today, addDays(today, 366))!

export type BillState = 'paid' | 'skipped' | 'late' | 'today' | 'soon'

/** Still to pay this cycle. */
export const isOwed = (s: BillState | null) => s === 'late' || s === 'today' || s === 'soon'

type Bill = Repeat & { id: string; name: string; amount: number | null; categoryId: string | null; skippedOn: ISODate | null; since: ISODate }
type Paying = { id: string; kind: 'expense' | 'income'; amount: number; note: string; categoryId: string | null; occurredOn: ISODate; billId: string | null; billFor: ISODate | null }

/** How near a hand-logged entry must be to the due date to count as paying it. */
const MATCH_DAYS = 3

/**
 * Each bill's state this cycle. A bill starts at its first due date on or after the day it was added.
 * It is paid by an entry linked to that due date, or by an unlinked
 * expense in its category within 3 days that has its amount or its name in the note; each entry pays one bill.
 * Bills still to pay set aside their amount, or the last amount paid when it varies.
 */
export function billStates<B extends Bill>(bills: B[], entries: Paying[], cycle: { start: ISODate; end: ISODate }, today: ISODate) {
  const used = new Set(entries.filter((e) => e.billId).map((e) => e.id))
  return bills.map((b) => {
    const due = dueBetween(b, b.since > cycle.start ? b.since : cycle.start, cycle.end)
    const linked = entries.filter((e) => e.billId === b.id).sort((x, y) => y.occurredOn.localeCompare(x.occurredOn))
    const lastPaid = linked[0]?.amount ?? null
    let paidBy = due ? linked.find((e) => e.billFor === due) : undefined
    if (due && !paidBy) {
      const name = b.name.trim().toLowerCase()
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
    const state: BillState | null = !due
      ? null
      : paidBy
        ? 'paid'
        : b.skippedOn === due
          ? 'skipped'
          : due < today
            ? 'late'
            : due === today
              ? 'today'
              : 'soon'
    return { ...b, due, state, lastPaid, paidAmount: paidBy?.amount ?? null, setAside: isOwed(state) ? (b.amount ?? lastPaid ?? 0) : 0, next: nextDue(b, today) }
  })
}

/** Late first, then due today, then soon; paid and skipped last; each by due date. */
const order: Record<BillState, number> = { late: 0, today: 1, soon: 2, paid: 3, skipped: 4 }
export const byUrgency = <T extends { state: BillState | null; due: ISODate | null }>(a: T, b: T) =>
  order[a.state ?? 'skipped'] - order[b.state ?? 'skipped'] || (a.due ?? '').localeCompare(b.due ?? '')
