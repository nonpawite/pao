import { createServerFn } from '@tanstack/react-start'
import { and, asc, desc, eq, gte, ilike, inArray, isNull, lte, or, sql } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db/index'
import { bankAccount, category, entry, pocket, pocketMember, user } from '#/db/schema'
import { cycleFor, previousCycle } from '#/lib/budget'
import { totalsByCurrency } from '#/lib/money'
import { activePocket, requireUser, todayISO } from './session'

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const spendingFilters = z.object({
  period: z.enum(['cycle', 'last', 'three', 'all', 'custom']),
  from: isoDate.optional(),
  to: isoDate.optional(),
  pocket: z.enum(['active', 'all']),
  kind: z.enum(['all', 'expense', 'income']),
  category: z.uuid().optional(),
  member: z.string().max(100).optional(),
  account: z.uuid().optional(),
  q: z.string().trim().max(100).optional(),
  limit: z.number().int().min(1).max(2000),
})

export type SpendingFilters = z.infer<typeof spendingFilters>

/** Every entry the user can see, filtered. Periods follow the active pocket's cycle, even across all pockets. */
export const getSpending = createServerFn({ method: 'GET' })
  .validator(spendingFilters)
  .handler(async ({ data: f }) => {
    const u = await requireUser()
    const today = todayISO()
    const active = await activePocket(u.id)

    // Only pockets the user belongs to; every filter below narrows inside these.
    const pockets = await db
      .select({ id: pocket.id, name: pocket.name, color: pocket.color, kind: pocket.kind, currency: pocket.currency })
      .from(pocketMember)
      .innerJoin(pocket, eq(pocket.id, pocketMember.pocketId))
      .where(eq(pocketMember.userId, u.id))
      .orderBy(asc(pocket.createdAt))
    const pocketIds = f.pocket === 'all' ? pockets.map((p) => p.id) : [active.id]

    const cycle = cycleFor(today, active.cycleStartDay)
    const last = previousCycle(cycle, active.cycleStartDay)
    let from: string | null = null
    let to: string | null = null
    if (f.period === 'cycle') [from, to] = [cycle.start, cycle.end]
    else if (f.period === 'last') [from, to] = [last.start, last.end]
    else if (f.period === 'three') [from, to] = [previousCycle(last, active.cycleStartDay).start, cycle.end]
    else if (f.period === 'custom') {
      from = f.from ?? null
      to = f.to ?? null
      if (from && to && from > to) [from, to] = [to, from]
    }

    const where: SQL[] = [inArray(entry.pocketId, pocketIds)]
    if (from) where.push(gte(entry.occurredOn, from))
    if (to) where.push(lte(entry.occurredOn, to))
    if (f.kind !== 'all') where.push(eq(entry.kind, f.kind))
    if (f.category) where.push(eq(entry.categoryId, f.category))
    if (f.member) where.push(eq(entry.userId, f.member))
    // Accounts are private: filtering by one only ever matches the user's own entries.
    if (f.account) where.push(and(eq(entry.bankAccountId, f.account), eq(entry.userId, u.id))!)
    if (f.q) {
      const like = `%${f.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
      where.push(or(ilike(entry.note, like), ilike(category.name, like))!)
    }
    const filter = and(...where)

    const spentSum = sql<number>`sum(${entry.amount})`.mapWith(Number)
    const [rows, perPocket, byCategory, categories, members, accounts] = await Promise.all([
      db
        .select({
          id: entry.id,
          kind: entry.kind,
          amount: entry.amount,
          note: entry.note,
          occurredOn: entry.occurredOn,
          categoryName: category.name,
          pocketId: entry.pocketId,
          userId: entry.userId,
          userName: user.name,
          accountName: bankAccount.name,
        })
        .from(entry)
        .innerJoin(user, eq(user.id, entry.userId))
        .leftJoin(category, eq(category.id, entry.categoryId))
        .leftJoin(bankAccount, eq(bankAccount.id, entry.bankAccountId))
        .where(filter)
        .orderBy(desc(entry.occurredOn), desc(entry.createdAt))
        .limit(f.limit + 1),
      // Per pocket, in pocket order; folded into one figure per currency below.
      db
        .select({
          currency: pocket.currency,
          count: sql<number>`count(*)`.mapWith(Number),
          spent: sql<number>`coalesce(sum(${entry.amount}) filter (where ${entry.kind} = 'expense'), 0)`.mapWith(Number),
          earned: sql<number>`coalesce(sum(${entry.amount}) filter (where ${entry.kind} = 'income'), 0)`.mapWith(Number),
        })
        .from(entry)
        .innerJoin(pocket, eq(pocket.id, entry.pocketId))
        .leftJoin(category, eq(category.id, entry.categoryId))
        .where(filter)
        .groupBy(pocket.id)
        .orderBy(asc(pocket.createdAt)),
      // By currency, then name: Food in two THB pockets reads as one Food, a JPY Food stays apart.
      db
        .select({ currency: pocket.currency, name: category.name, value: spentSum })
        .from(entry)
        .innerJoin(pocket, eq(pocket.id, entry.pocketId))
        .leftJoin(category, eq(category.id, entry.categoryId))
        .where(and(filter, eq(entry.kind, 'expense')))
        .groupBy(pocket.currency, category.name)
        .orderBy(desc(spentSum)),
      db
        .select({ id: category.id, name: category.name, pocketId: category.pocketId })
        .from(category)
        .where(and(inArray(category.pocketId, pocketIds), isNull(category.archivedAt)))
        .orderBy(asc(category.sortOrder), asc(category.name)),
      db
        .selectDistinct({ id: user.id, name: user.name })
        .from(pocketMember)
        .innerJoin(user, eq(user.id, pocketMember.userId))
        .where(inArray(pocketMember.pocketId, pocketIds))
        .orderBy(asc(user.name)),
      db
        .select({ id: bankAccount.id, name: bankAccount.name })
        .from(bankAccount)
        .where(and(eq(bankAccount.userId, u.id), isNull(bankAccount.archivedAt)))
        .orderBy(asc(bankAccount.sortOrder), asc(bankAccount.name)),
    ])

    const byId = new Map(pockets.map((p) => [p.id, p]))
    // One figure per currency, never a sum across them (ADR 0001). Currencies with nothing to show drop out.
    const fold = (key: 'spent' | 'earned') => totalsByCurrency(perPocket.filter((p) => p[key]).map((p) => ({ currency: p.currency, total: p[key] })))
    const spent = fold('spent')
    return {
      today,
      from,
      to,
      pockets: pocketIds.map((id) => byId.get(id)!),
      categories: categories.map((c) => ({ ...c, pocketName: byId.get(c.pocketId)!.name })),
      members,
      accounts,
      totals: {
        count: perPocket.reduce((n, p) => n + p.count, 0),
        // Nothing spent still reads as zero, in the active pocket's currency.
        spent: spent.length ? spent : [{ currency: active.currency, total: 0 }],
        earned: fold('earned'),
      },
      // One breakdown per currency, in the same order as the totals.
      byCategory: spent.map(({ currency }) => ({
        currency,
        categories: byCategory.filter((c) => c.currency === currency).map((c) => ({ id: c.name ?? '', name: c.name ?? '', value: c.value })),
      })),
      hasMore: rows.length > f.limit,
      entries: rows.slice(0, f.limit).map(({ accountName, ...r }) => ({
        ...r,
        currency: byId.get(r.pocketId)!.currency,
        // Someone else's account names stay theirs, even inside a shared pocket.
        accountName: r.userId === u.id ? accountName : null,
      })),
    }
  })

export type SpendingData = Awaited<ReturnType<typeof getSpending>>
