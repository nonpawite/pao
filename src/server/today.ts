import { createServerFn } from '@tanstack/react-start'

import {
  cycleFor,
  cycleLimitState,
  dayLimitState,
  dayStrip,
  previousCycle,
  sortByState,
} from '#/lib/budget'
import { activePocket, pocketBills, pocketCategories, pocketEntries, requireUser, todayISO } from './session'

export const getToday = createServerFn({ method: 'GET' }).handler(async () => {
  const u = await requireUser()
  const p = await activePocket(u.id)
  const today = todayISO()
  const cycle = cycleFor(today, p.cycleStartDay)
  const [cats, rows, allBills] = await Promise.all([
    pocketCategories(p.id),
    pocketEntries(p.id, cycle.start, cycle.end),
    pocketBills(p.id, cycle, today, u.id),
  ])
  const bills = allBills.filter((b) => b.state)
  // Bills still to pay are already spoken for: they come off what is left.
  const asideBy = new Map<string, { amount: number; count: number }>()
  for (const b of bills) {
    if (!b.setAside || !b.categoryId) continue
    const a = asideBy.get(b.categoryId) ?? { amount: 0, count: 0 }
    asideBy.set(b.categoryId, { amount: a.amount + b.setAside, count: a.count + 1 })
  }

  const byCategory = new Map<string, number>()
  const byCategoryDay = new Map<string, Map<string, number>>()
  const byMember = new Map<string, { name: string; spent: number }>()
  let spent = 0
  let earned = 0
  for (const r of rows) {
    if (r.kind === 'income') {
      earned += r.amount
      continue
    }
    spent += r.amount
    const m = byMember.get(r.userId) ?? { name: r.userName, spent: 0 }
    m.spent += r.amount
    byMember.set(r.userId, m)
    if (!r.categoryId) continue
    byCategory.set(r.categoryId, (byCategory.get(r.categoryId) ?? 0) + r.amount)
    const days = byCategoryDay.get(r.categoryId) ?? new Map<string, number>()
    days.set(r.occurredOn, (days.get(r.occurredOn) ?? 0) + r.amount)
    byCategoryDay.set(r.categoryId, days)
  }

  const daily = cats
    .filter((c) => c.limitType === 'day')
    .map((c) => {
      const days = byCategoryDay.get(c.id) ?? new Map<string, number>()
      const spentToday = days.get(today) ?? 0
      const strip = dayStrip(cycle, today, days, c.limitAmount)
      return {
        id: c.id,
        name: c.name,
        limit: c.limitAmount,
        spentToday,
        left: c.limitAmount - spentToday,
        state: dayLimitState(spentToday, c.limitAmount),
        strip: strip.map((d) => d.state),
        overDays: strip.filter((d) => d.state === 'over').length,
      }
    })

  const limited = sortByState(
    cats
      .filter((c) => c.limitType === 'cycle')
      .map((c) => {
        const s = byCategory.get(c.id) ?? 0
        const aside = asideBy.get(c.id) ?? { amount: 0, count: 0 }
        return {
          id: c.id,
          name: c.name,
          limit: c.limitAmount,
          spent: s,
          aside,
          ...cycleLimitState(s + aside.amount, c.limitAmount, cycle.dayIndex, cycle.length),
        }
      }),
  )
  const open = cats
    .filter((c) => c.limitType === 'none')
    .map((c) => ({ id: c.id, name: c.name, spent: byCategory.get(c.id) ?? 0 }))
    .sort((a, b) => b.spent - a.spent)

  const catName = new Map(cats.map((c) => [c.id, c.name]))
  const recent = [...rows]
    .sort((a, b) => b.occurredOn.localeCompare(a.occurredOn) || +b.createdAt - +a.createdAt)
    .slice(0, 8)
    .map((r) => ({
      id: r.id,
      kind: r.kind,
      amount: r.amount,
      note: r.note,
      occurredOn: r.occurredOn,
      categoryName: r.categoryId ? (catName.get(r.categoryId) ?? null) : null,
      userId: r.userId,
      userName: r.userName,
    }))

  // A recap is offered in the first three days of a cycle, when the last cycle has entries.
  let recapFor: { start: string; end: string } | null = null
  if (cycle.dayIndex <= 3) {
    const prev = previousCycle(cycle, p.cycleStartDay)
    const prevRows = await pocketEntries(p.id, prev.start, prev.end)
    if (prevRows.length) recapFor = { start: prev.start, end: prev.end }
  }


  return {
    pocketId: p.id,
    kind: p.kind,
    today,
    cycle,
    spent,
    earned,
    cycleLeft: limited.reduce((s, r) => s + r.left, 0),
    cycleLimit: limited.reduce((s, r) => s + r.limit, 0),
    cycleAside: limited.reduce((s, r) => s + r.aside.amount, 0),
    bills,
    setAside: bills.reduce((s, b) => s + b.setAside, 0),
    setAsideCount: bills.filter((b) => b.setAside > 0).length,
    daily,
    limited,
    open,
    members: [...byMember.entries()].map(([id, m]) => ({ id, ...m })),
    recent,
    recapFor,
    hasCategories: cats.length > 0,
  }
})

export type TodayData = Awaited<ReturnType<typeof getToday>>
