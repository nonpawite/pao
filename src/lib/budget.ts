// Pure date and limit math. Dates are local calendar days as 'YYYY-MM-DD'; money is integer satang.

export type ISODate = string

export type Cycle = {
  start: ISODate
  end: ISODate
  length: number
  // 1-based day of the cycle that `today` falls on.
  dayIndex: number
}

export type LimitState = 'over' | 'ahead' | 'ok' | 'none'

const pad = (n: number) => String(n).padStart(2, '0')

export const iso = (y: number, m: number, d: number): ISODate => `${y}-${pad(m)}-${pad(d)}`

export function parts(date: ISODate) {
  const [y, m, d] = date.split('-').map(Number)
  return { y, m, d }
}

export const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate()

const toUTC = (date: ISODate) => {
  const { y, m, d } = parts(date)
  return Date.UTC(y, m - 1, d)
}

export function addDays(date: ISODate, n: number): ISODate {
  const t = new Date(toUTC(date) + n * 86_400_000)
  return iso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate())
}

export const diffDays = (from: ISODate, to: ISODate) => Math.round((toUTC(to) - toUTC(from)) / 86_400_000)

export const weekday = (date: ISODate) => new Date(toUTC(date)).getUTCDay()

/** The cycle start in a given month: startDay clamped to that month's length. */
function startIn(y: number, m: number, startDay: number): ISODate {
  return iso(y, m, Math.min(startDay, daysInMonth(y, m)))
}

export function cycleFor(today: ISODate, startDay: number): Cycle {
  const { y, m } = parts(today)
  const thisMonth = startIn(y, m, startDay)
  const start =
    today >= thisMonth ? thisMonth : startIn(m === 1 ? y - 1 : y, m === 1 ? 12 : m - 1, startDay)
  const s = parts(start)
  const nextStart = startIn(s.m === 12 ? s.y + 1 : s.y, s.m === 12 ? 1 : s.m + 1, startDay)
  const end = addDays(nextStart, -1)
  return { start, end, length: diffDays(start, end) + 1, dayIndex: diffDays(start, today) + 1 }
}

/** The cycle before `cycle`, with today set to its matching day (capped at its last day). */
export function previousCycle(cycle: Cycle, startDay: number): Cycle {
  const prev = cycleFor(addDays(cycle.start, -1), startDay)
  const dayIndex = Math.min(cycle.dayIndex, prev.length)
  return { ...prev, dayIndex }
}

/** State of a per-cycle limit: over the limit, ahead of an even pace, or fine. */
export function cycleLimitState(spent: number, limit: number, dayIndex: number, length: number) {
  const pace = Math.round((limit * dayIndex) / length)
  const state: LimitState = spent > limit ? 'over' : spent > pace ? 'ahead' : 'ok'
  return { state, pace, left: limit - spent }
}

/** State of a strict per-day limit. */
export const dayLimitState = (spent: number, limit: number): LimitState => (spent > limit ? 'over' : 'ok')

export type StripDay = { date: ISODate; spent: number; state: 'under' | 'over' | 'today' | 'future' }

/** One square per day of the cycle for a per-day limit. */
export function dayStrip(cycle: Cycle, today: ISODate, spentByDay: Map<ISODate, number>, limit: number): StripDay[] {
  return Array.from({ length: cycle.length }, (_, i) => {
    const date = addDays(cycle.start, i)
    const spent = spentByDay.get(date) ?? 0
    const state = date > today ? 'future' : date === today ? 'today' : spent > limit ? 'over' : 'under'
    return { date, spent, state }
  })
}

const rank: Record<LimitState, number> = { over: 0, ahead: 1, ok: 2, none: 3 }

/** Problems first: over, then ahead of pace, then the rest by share of limit used. */
export function sortByState<T extends { state: LimitState; spent: number; limit: number }>(rows: T[]): T[] {
  const used = (r: T) => (r.limit > 0 ? r.spent / r.limit : 0)
  return [...rows].sort((a, b) => rank[a.state] - rank[b.state] || used(b) - used(a) || b.spent - a.spent)
}

/** Parse a typed amount, allowing simple sums like "120+45+30". Returns satang, or null if invalid. */
export function parseAmount(input: string): number | null {
  const clean = input.replace(/[,\s฿]/g, '')
  if (!/^\d+(\.\d{1,2})?(\+\d+(\.\d{1,2})?)*$/.test(clean)) return null
  const satang = clean.split('+').reduce((sum, p) => sum + Math.round(Number(p) * 100), 0)
  return satang > 0 ? satang : null
}

export function formatBaht(satang: number, opts: { sign?: boolean } = {}) {
  const abs = Math.abs(satang)
  const whole = abs % 100 === 0
  const n = (abs / 100).toLocaleString('en-US', {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  })
  const sign = satang < 0 ? '−' : opts.sign ? '+' : ''
  return `${sign}฿${n}`
}
