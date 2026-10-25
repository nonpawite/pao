import { createServerFn } from '@tanstack/react-start'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db/index'
import { bankAccount, category, pocket, pocketMember } from '#/db/schema'
import { calendarNames, pickLocale, translate } from '#/lib/i18n'
import type { MessageKey } from '#/lib/i18n'
import { defaultCurrency, isCurrency } from '#/lib/money'
import { requireUser, todayISO } from './session'

const starterCategories: MessageKey[] = ['starterFood', 'starterGas', 'starterTravel', 'starterShopping', 'starterBills', 'starterHealth', 'starterFun']
const starterAccounts: MessageKey[] = ['starterMain', 'starterSaving', 'starterInvestment']

/** What Setup starts from: the member's language, the instance's default currency, and names to suggest. */
export const getSetup = createServerFn({ method: 'GET' }).handler(async () => {
  const u = await requireUser()
  const locale = pickLocale([(u as { locale?: string }).locale ?? ''])
  const t = (key: MessageKey) => translate(locale, key)
  return {
    name: u.name,
    locale,
    names: calendarNames(locale),
    today: todayISO(),
    currency: defaultCurrency(process.env.DEFAULT_CURRENCY),
    pocketName: t('starterPocket'),
    categories: starterCategories.map(t),
    accounts: starterAccounts.map(t),
  }
})

const name = z.string().trim().min(1).max(40)

/** Finish: the member's personal pocket, its categories and their bank accounts, all at once or not at all. */
export const finishSetup = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      currency: z.string().refine(isCurrency, 'Not an ISO 4217 currency code'),
      cycleStartDay: z.number().int().min(1).max(31),
      categories: z
        .array(z.object({ name, limitType: z.enum(['day', 'cycle', 'none']), limitAmount: z.number().int().min(0).max(2_000_000_000) }))
        .min(1)
        .max(50),
      accounts: z.array(name).max(20),
    }),
  )
  .handler(async ({ data }) => {
    const u = await requireUser()
    const locale = pickLocale([(u as { locale?: string }).locale ?? ''])
    if (data.categories.some((c) => c.limitType !== 'none' && c.limitAmount <= 0)) throw new Error('Set a limit above zero')
    await db.transaction(async (tx) => {
      // A second Finish (a double tap, a stale tab) finds the pocket already there and leaves it alone.
      const [own] = await tx
        .select({ id: pocket.id })
        .from(pocket)
        .where(and(eq(pocket.createdBy, u.id), eq(pocket.kind, 'personal')))
      if (own) return
      const [p] = await tx
        .insert(pocket)
        .values({
          name: translate(locale, 'starterPocket'),
          color: 'teal',
          kind: 'personal',
          cycleStartDay: data.cycleStartDay,
          currency: data.currency,
          createdBy: u.id,
        })
        .returning({ id: pocket.id })
      await tx.insert(pocketMember).values({ pocketId: p.id, userId: u.id, role: 'owner' })
      await tx.insert(category).values(
        data.categories.map((c, i) => ({
          pocketId: p.id,
          name: c.name,
          limitType: c.limitType,
          limitAmount: c.limitType === 'none' ? 0 : c.limitAmount,
          sortOrder: i,
        })),
      )
      if (data.accounts.length) await tx.insert(bankAccount).values(data.accounts.map((n, i) => ({ userId: u.id, name: n, sortOrder: i })))
    })
  })
