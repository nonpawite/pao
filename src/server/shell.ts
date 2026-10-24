import { createServerFn } from '@tanstack/react-start'
import { setCookie } from '@tanstack/react-start/server'
import { and, asc, count, desc, eq, gte, inArray, isNull, max } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db/index'
import { bankAccount, entry, pocket, pocketMember, user } from '#/db/schema'
import { auth } from '#/lib/auth'
import { addDays, cycleFor } from '#/lib/budget'
import { isOwed } from '#/lib/bills'
import { calendarNames, localeCodes, pickLocale } from '#/lib/i18n'
import type { CalendarNames, Locale } from '#/lib/i18n'
import { activePocket, pocketBills, pocketCategories, pocketEntries, requirePocket, requireUser, todayISO } from './session'
import { getRequestHeaders } from '@tanstack/react-start/server'

export const getSessionUser = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await auth.api.getSession({ headers: getRequestHeaders() })
  return session ? { id: session.user.id, name: session.user.name } : null
})

/** Sign-in's welcome board: the household's today, and calendar names for every language its switch can show. */
export const getWelcome = createServerFn({ method: 'GET' }).handler(() => ({
  today: todayISO(),
  names: Object.fromEntries(localeCodes.map((l) => [l, calendarNames(l)])) as Record<Locale, CalendarNames>,
}))

/** Everything the app frame needs: pockets for the switcher, and what the add form needs for every pocket. */
export const getShell = createServerFn({ method: 'GET' }).handler(async () => {
  const u = await requireUser()
  const today = todayISO()
  const active = await activePocket(u.id)

  const memberships = await db
    .select({ pocket, role: pocketMember.role })
    .from(pocketMember)
    .innerJoin(pocket, eq(pocket.id, pocketMember.pocketId))
    .where(eq(pocketMember.userId, u.id))
    .orderBy(asc(pocket.createdAt))
  const pocketIds = memberships.map((m) => m.pocket.id)

  const members = await db
    .select({ pocketId: pocketMember.pocketId, id: user.id, name: user.name, role: pocketMember.role })
    .from(pocketMember)
    .innerJoin(user, eq(user.id, pocketMember.userId))
    .where(inArray(pocketMember.pocketId, pocketIds))
    .orderBy(asc(pocketMember.joinedAt))

  const accounts = await db
    .select({ id: bankAccount.id, name: bankAccount.name })
    .from(bankAccount)
    .where(and(eq(bankAccount.userId, u.id), isNull(bankAccount.archivedAt)))
    .orderBy(asc(bankAccount.sortOrder), asc(bankAccount.name))

  // Repeat purchases from the last 60 days become one-tap chips.
  const repeats = await db
    .select({
      pocketId: entry.pocketId,
      categoryId: entry.categoryId,
      amount: entry.amount,
      note: entry.note,
      n: count(),
      last: max(entry.createdAt),
    })
    .from(entry)
    .where(and(eq(entry.userId, u.id), eq(entry.kind, 'expense'), gte(entry.occurredOn, addDays(today, -60))))
    .groupBy(entry.pocketId, entry.categoryId, entry.amount, entry.note)
    .having(gte(count(), 2))
    .orderBy(desc(count()), desc(max(entry.createdAt)))

  const pockets = await Promise.all(
    memberships.map(async ({ pocket: p, role }) => {
      const cycle = cycleFor(today, p.cycleStartDay)
      const [cats, rows, bills] = await Promise.all([
        pocketCategories(p.id),
        pocketEntries(p.id, cycle.start, cycle.end),
        pocketBills(p.id, cycle, today, u.id),
      ])
      const spentCycle = new Map<string, number>()
      const spentToday = new Map<string, number>()
      for (const r of rows) {
        if (r.kind !== 'expense' || !r.categoryId) continue
        spentCycle.set(r.categoryId, (spentCycle.get(r.categoryId) ?? 0) + r.amount)
        if (r.occurredOn === today) spentToday.set(r.categoryId, (spentToday.get(r.categoryId) ?? 0) + r.amount)
      }
      return {
        id: p.id,
        name: p.name,
        color: p.color,
        kind: p.kind,
        currency: p.currency,
        role,
        cycle,
        cycleStartDay: p.cycleStartDay,
        members: members.filter((m) => m.pocketId === p.id).map(({ id, name, role }) => ({ id, name, role })),
        categories: cats.map((c) => ({
          id: c.id,
          name: c.name,
          limitType: c.limitType,
          limitAmount: c.limitAmount,
          spentCycle: spentCycle.get(c.id) ?? 0,
          spentToday: spentToday.get(c.id) ?? 0,
        })),
        logAgain: repeats
          .filter((r) => r.pocketId === p.id && r.categoryId && cats.some((c) => c.id === r.categoryId))
          .slice(0, 5)
          .map((r) => ({ categoryId: r.categoryId!, amount: r.amount, note: r.note })),
        // Bills still to pay this cycle become one-tap chips in the add sheet.
        dueBills: bills
          .filter((b) => isOwed(b.state))
          .map((b) => ({ id: b.id, name: b.name, amount: b.amount ?? b.lastPaid, varies: b.amount === null, categoryId: b.categoryId, due: b.due!, state: b.state })),
      }
    }),
  )

  const locale = pickLocale([(u as { locale?: string }).locale ?? ''])
  return {
    today,
    user: {
      id: u.id,
      name: u.name,
      email: u.email,
      locale,
      weekStart: (u as { weekStart?: number }).weekStart === 1 ? 1 : 0,
    } as const,
    names: calendarNames(locale),
    activePocketId: active.id,
    pockets,
    accounts,
  }
})

export type Shell = Awaited<ReturnType<typeof getShell>>

export const setActivePocket = createServerFn({ method: 'POST' })
  .validator(z.object({ pocketId: z.uuid() }))
  .handler(async ({ data }) => {
    const u = await requireUser()
    await requirePocket(u.id, data.pocketId)
    setCookie('pocket', data.pocketId, { path: '/', httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 365 })
  })

export const setLocale = createServerFn({ method: 'POST' })
  .validator(z.object({ locale: z.enum(localeCodes) }))
  .handler(async ({ data }) => {
    const u = await requireUser()
    await db.update(user).set({ locale: data.locale }).where(eq(user.id, u.id))
  })

export const setWeekStart = createServerFn({ method: 'POST' })
  .validator(z.object({ weekStart: z.union([z.literal(0), z.literal(1)]) }))
  .handler(async ({ data }) => {
    const u = await requireUser()
    await db.update(user).set({ weekStart: data.weekStart }).where(eq(user.id, u.id))
  })
