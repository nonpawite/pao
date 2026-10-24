import { db } from '../db/index.ts'
import { bankAccount, category, pocket, pocketMember } from '../db/schema.ts'
import { translate } from '../lib/i18n.ts'
import type { Locale, MessageKey } from '../lib/i18n.ts'
import { defaultCurrency } from '../lib/money.ts'

// Owner's example limits: Food 200/day, Gas 3,000 and Travel 1,000 per cycle. Others start without a limit.
const defaultLimits: Array<['day' | 'cycle' | 'none', number]> = [
  ['day', 20_000],
  ['cycle', 300_000],
  ['cycle', 100_000],
  ['none', 0],
  ['none', 0],
  ['none', 0],
  ['none', 0],
]
const starterCategories: MessageKey[] = ['starterFood', 'starterGas', 'starterTravel', 'starterShopping', 'starterBills', 'starterHealth', 'starterFun']
const starterAccounts: MessageKey[] = ['starterMain', 'starterSaving', 'starterInvestment']

/** Runs once per new user: a personal pocket with starter categories, and three bank accounts. */
export async function createPersonalSpace(userId: string, locale: Locale) {
  const t = (key: MessageKey) => translate(locale, key)
  const names = { pocket: t('starterPocket'), categories: starterCategories.map(t), accounts: starterAccounts.map(t) }
  await db.transaction(async (tx) => {
    const [p] = await tx
      .insert(pocket)
      // Salary lands at month end, so the cycle starts on the last day by default.
      .values({
        name: names.pocket,
        color: 'teal',
        kind: 'personal',
        cycleStartDay: 31,
        currency: defaultCurrency(process.env.DEFAULT_CURRENCY),
        createdBy: userId,
      })
      .returning({ id: pocket.id })
    await tx.insert(pocketMember).values({ pocketId: p.id, userId, role: 'owner' })
    await tx.insert(category).values(
      names.categories.map((name, i) => ({
        pocketId: p.id,
        name,
        limitType: defaultLimits[i][0],
        limitAmount: defaultLimits[i][1],
        sortOrder: i,
      })),
    )
    await tx.insert(bankAccount).values(names.accounts.map((name, i) => ({ userId, name, sortOrder: i })))
  })
}
