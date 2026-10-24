import { createServerFn } from '@tanstack/react-start'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db/index'
import { category } from '#/db/schema'
import { cycleFor, cycleLimitState, dayLimitState, dayStrip, diffDays } from '#/lib/budget'
import { pocketEntries, requirePocket, requireUser, todayISO } from './session'

export const getCategoryDetail = createServerFn({ method: 'GET' })
  .validator(z.object({ categoryId: z.uuid() }))
  .handler(async ({ data }) => {
    const u = await requireUser()
    const [c] = await db.select().from(category).where(eq(category.id, data.categoryId))
    if (!c) throw new Error('Category not found')
    const p = await requirePocket(u.id, c.pocketId)
    const today = todayISO()
    const cycle = cycleFor(today, p.cycleStartDay)
    const rows = (await pocketEntries(p.id, cycle.start, cycle.end)).filter(
      (r) => r.kind === 'expense' && r.categoryId === c.id,
    )

    const byDay = new Map<string, number>()
    for (const r of rows) byDay.set(r.occurredOn, (byDay.get(r.occurredOn) ?? 0) + r.amount)
    const spent = rows.reduce((s, r) => s + r.amount, 0)
    const daysLeft = diffDays(today, cycle.end) + 1

    const strip = c.limitType === 'day' ? dayStrip(cycle, today, byDay, c.limitAmount) : null
    const spentToday = byDay.get(today) ?? 0

    // Newest day first, each with its entries.
    const days = [...byDay.keys()]
      .sort((a, b) => b.localeCompare(a))
      .map((date) => ({
        date,
        total: byDay.get(date)!,
        entries: rows
          .filter((r) => r.occurredOn === date)
          .reverse()
          .map((r) => ({ id: r.id, amount: r.amount, note: r.note, occurredOn: r.occurredOn, userId: r.userId, userName: r.userName })),
      }))

    return {
      id: c.id,
      name: c.name,
      limitType: c.limitType,
      limit: c.limitAmount,
      pocketName: p.name,
      pocketColor: p.color,
      pocketKind: p.kind,
      canEdit: p.role === 'owner',
      pocketId: c.pocketId,
      today,
      cycle,
      spent,
      daysLeft,
      day:
        c.limitType === 'day'
          ? {
              spentToday,
              left: c.limitAmount - spentToday,
              state: dayLimitState(spentToday, c.limitAmount),
              strip: strip!.map((d) => ({ date: d.date, state: d.state })),
              overDays: strip!.filter((d) => d.state === 'over').length,
              pastDays: cycle.dayIndex - 1,
              avgPerDay: Math.round(spent / cycle.dayIndex / 100) * 100,
            }
          : null,
      cycleLimit:
        c.limitType === 'cycle'
          ? {
              ...cycleLimitState(spent, c.limitAmount, cycle.dayIndex, cycle.length),
              perDayToStayUnder: Math.max(0, Math.floor((c.limitAmount - spent) / daysLeft / 100) * 100),
            }
          : null,
      days,
    }
  })

export type CategoryDetail = Awaited<ReturnType<typeof getCategoryDetail>>
