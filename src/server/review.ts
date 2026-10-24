import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { addDays, cycleFor, dayStrip } from '#/lib/budget'
import type { Cycle } from '#/lib/budget'
import { activePocket, pocketCategories, pocketEntries, requireUser, todayISO } from './session'
import type { PocketEntry } from './session'

/** The current cycle and the `n - 1` full cycles before it, newest first. */
function cyclesBack(today: string, startDay: number, n: number): Cycle[] {
  const out = [cycleFor(today, startDay)]
  while (out.length < n) {
    const prev = cycleFor(addDays(out[out.length - 1].start, -1), startDay)
    out.push({ ...prev, dayIndex: prev.length })
  }
  return out
}

/** Spent/earned totals per cycle and per category per cycle. */
function tally(cycles: Cycle[], rows: PocketEntry[]) {
  const per = cycles.map(() => ({ spent: 0, earned: 0, count: 0, byCategory: new Map<string, number>() }))
  for (const r of rows) {
    const i = cycles.findIndex((c) => r.occurredOn >= c.start && r.occurredOn <= c.end)
    if (i < 0) continue
    per[i].count++
    if (r.kind === 'income') per[i].earned += r.amount
    else {
      per[i].spent += r.amount
      if (r.categoryId) per[i].byCategory.set(r.categoryId, (per[i].byCategory.get(r.categoryId) ?? 0) + r.amount)
    }
  }
  return per
}

async function load(n: number) {
  const u = await requireUser()
  const p = await activePocket(u.id)
  const today = todayISO()
  const cycles = cyclesBack(today, p.cycleStartDay, n)
  const [cats, rows] = await Promise.all([
    pocketCategories(p.id),
    pocketEntries(p.id, cycles[cycles.length - 1].start, cycles[0].end),
  ])
  return { p, today, cycles, cats, rows, per: tally(cycles, rows) }
}

export const getReview = createServerFn({ method: 'GET' })
  .validator(z.object({ range: z.enum(['cycle', 'last3', 'year']) }))
  .handler(async ({ data }) => {
    const { p, cycles, cats, rows, per } = await load(13)
    const idx = data.range === 'cycle' ? [0] : data.range === 'last3' ? [1, 2, 3] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
    const sum = (ids: number[], f: (i: number) => number) => ids.reduce((s, i) => s + f(i), 0)
    const spent = sum(idx, (i) => per[i].spent)
    const earned = sum(idx, (i) => per[i].earned)

    // Like-for-like comparison: last cycle up to the same day, or the three cycles before.
    let compare: number | null = null
    if (data.range === 'cycle') {
      const prev = cycles[1]
      const cutoff = addDays(prev.start, cycles[0].dayIndex - 1)
      if (per[1].count) {
        compare = rows
          .filter((r) => r.kind === 'expense' && r.occurredOn >= prev.start && r.occurredOn <= cutoff)
          .reduce((s, r) => s + r.amount, 0)
      }
    } else if (data.range === 'last3' && [4, 5, 6].some((i) => per[i].count)) {
      compare = sum([4, 5, 6], (i) => per[i].spent)
    }

    // Average over the three finished cycles before this one that have any entries.
    const avgCycles = [1, 2, 3].filter((i) => per[i].count)
    const categories = cats
      .map((c) => {
        // Averages over several cycles round to whole baht.
        const value = Math.round(sum(idx, (i) => per[i].byCategory.get(c.id) ?? 0) / idx.length / 100) * 100
        const average = avgCycles.length
          ? Math.round(sum(avgCycles, (i) => per[i].byCategory.get(c.id) ?? 0) / avgCycles.length / 100) * 100
          : null
        const history = [5, 4, 3, 2, 1, 0].map((i) => ({
          start: cycles[i].start,
          spent: per[i].byCategory.get(c.id) ?? 0,
          current: i === 0,
          hasData: per[i].count > 0,
        }))
        return { id: c.id, name: c.name, limitType: c.limitType, limit: c.limitAmount, value, average, history }
      })
      .filter((c) => c.value > 0 || (c.average ?? 0) > 0)
      .sort((a, b) => b.value - a.value)

    const first = cycles[idx[idx.length - 1]]
    const last = cycles[idx[0]]
    const catIds = new Set(cats.map((c) => c.id))
    const entries = rows
      .filter((r) => r.kind === 'expense' && r.categoryId && catIds.has(r.categoryId) && r.occurredOn >= first.start && r.occurredOn <= last.end)
      .reverse()
      .slice(0, 400)
      .map((r) => ({ id: r.id, categoryId: r.categoryId!, amount: r.amount, note: r.note, occurredOn: r.occurredOn, userName: r.userName }))

    // Running total per day for this cycle so far and the whole last cycle, against this cycle's plan.
    let burn: { current: number[]; previous: number[] | null; plan: number | null } | null = null
    if (data.range === 'cycle') {
      const byDay = new Map<string, number>()
      for (const r of rows) if (r.kind === 'expense') byDay.set(r.occurredOn, (byDay.get(r.occurredOn) ?? 0) + r.amount)
      const running = (c: Cycle, days: number) => {
        let run = 0
        return Array.from({ length: days }, (_, d) => (run += byDay.get(addDays(c.start, d)) ?? 0))
      }
      const plan =
        cats.filter((c) => c.limitType === 'cycle').reduce((s, c) => s + c.limitAmount, 0) +
        cats.filter((c) => c.limitType === 'day').reduce((s, c) => s + c.limitAmount * cycles[0].length, 0)
      burn = {
        current: running(cycles[0], cycles[0].dayIndex),
        previous: per[1].count ? running(cycles[1], cycles[1].length) : null,
        plan: plan || null,
      }
    }

    return {
      range: data.range,
      kind: p.kind,
      cycle: cycles[0],
      burn,
      from: first.start,
      to: data.range === 'cycle' ? cycles[0].end : last.end,
      spent,
      earned,
      compare,
      history: [5, 4, 3, 2, 1, 0].map((i) => ({ start: cycles[i].start, spent: per[i].spent, current: i === 0, hasData: per[i].count > 0 })),
      categories,
      entries,
    }
  })

export type ReviewData = Awaited<ReturnType<typeof getReview>>

export const getRecap = createServerFn({ method: 'GET' }).handler(async () => {
  const { p, cycles, cats, rows, per } = await load(3)
  const last = cycles[1]
  if (!per[1].count) return { empty: true as const }

  const top = cats
    .map((c) => ({ id: c.id, name: c.name, spent: per[1].byCategory.get(c.id) ?? 0 }))
    .filter((c) => c.spent > 0)
    .sort((a, b) => b.spent - a.spent)
    .slice(0, 3)

  const daily = cats
    .filter((c) => c.limitType === 'day')
    .map((c) => {
      const byDay = new Map<string, number>()
      for (const r of rows)
        if (r.kind === 'expense' && r.categoryId === c.id && r.occurredOn >= last.start && r.occurredOn <= last.end)
          byDay.set(r.occurredOn, (byDay.get(r.occurredOn) ?? 0) + r.amount)
      // The whole cycle is past, so view it from its last day.
      const strip = dayStrip(last, addDays(last.end, 1), byDay, c.limitAmount)
      return { id: c.id, name: c.name, strip: strip.map((d) => d.state), overDays: strip.filter((d) => d.state === 'over').length }
    })

  const best = cats
    .filter((c) => c.limitType === 'cycle' && c.limitAmount > 0)
    .map((c) => ({ id: c.id, name: c.name, ratio: (per[1].byCategory.get(c.id) ?? 0) / c.limitAmount }))
    .filter((c) => c.ratio <= 1)
    .sort((a, b) => a.ratio - b.ratio)[0]

  const kept = per[1].earned - per[1].spent
  const keptBefore = per[2].count ? per[2].earned - per[2].spent : null

  return {
    empty: false as const,
    kind: p.kind,
    cycle: last,
    earned: per[1].earned,
    spent: per[1].spent,
    kept,
    keptDelta: keptBefore === null ? null : kept - keptBefore,
    top,
    daily,
    best: best ? { name: best.name, pct: Math.round(best.ratio * 100) } : null,
    limits: cats
      .filter((c) => c.limitType !== 'none')
      .map((c) => ({ id: c.id, name: c.name, limitType: c.limitType, limit: c.limitAmount })),
  }
})

export type RecapData = Awaited<ReturnType<typeof getRecap>>
