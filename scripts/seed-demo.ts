// Synthetic demo data for local development and screenshots. Never run against real household data.
// Needs two accounts created through the app first: demo@example.com and mint@example.com.
// Run: bun scripts/seed-demo.ts (Bun loads .env itself)
import { and, eq, inArray } from 'drizzle-orm'

import { db } from '../src/db/index.ts'
import { bankAccount, category, entry, pocket, pocketMember, user } from '../src/db/schema.ts'
import { addDays, cycleFor, householdDay } from '../src/lib/budget.ts'

const today = householdDay()

let seed = 7
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)]
// Whole units of the pocket's currency (baht, yen) as stored hundredths.
const whole = (n: number) => Math.round(n) * 100

async function userId(email: string) {
  const [u] = await db.select({ id: user.id }).from(user).where(eq(user.email, email))
  if (!u) throw new Error(`Create ${email} in the app first`)
  return u.id
}

const ploy = await userId('demo@example.com')
const mint = await userId('mint@example.com')

// Personal pocket: payday on the 25th, the owner's example limits, in baht whatever DEFAULT_CURRENCY says.
const [me] = await db
  .select({ id: pocket.id })
  .from(pocket)
  .innerJoin(pocketMember, eq(pocketMember.pocketId, pocket.id))
  .where(and(eq(pocketMember.userId, ploy), eq(pocket.kind, 'personal')))
await db.update(pocket).set({ cycleStartDay: 25, currency: 'THB' }).where(eq(pocket.id, me.id))
const limits: Record<string, ['day' | 'cycle' | 'none', number]> = {
  Food: ['day', 200],
  Gas: ['cycle', 3000],
  Travel: ['cycle', 1000],
  Shopping: ['cycle', 2500],
  Bills: ['cycle', 4500],
  Fun: ['cycle', 1500],
  Health: ['none', 0],
}
const cats = await db.select().from(category).where(eq(category.pocketId, me.id))
for (const c of cats) {
  const l = limits[c.name]
  if (l) await db.update(category).set({ limitType: l[0], limitAmount: whole(l[1]) }).where(eq(category.id, c.id))
}
const cat = (name: string) => cats.find((c) => c.name === name)!.id
const [main] = await db.select().from(bankAccount).where(and(eq(bankAccount.userId, ploy), eq(bankAccount.name, 'Main')))

// Shared pockets with Mint.
await db.delete(pocket).where(and(eq(pocket.createdBy, ploy), eq(pocket.kind, 'shared')))
async function shared(name: string, color: string, startDay: number, categories: Array<[string, number]>, currency = 'THB') {
  const [p] = await db.insert(pocket).values({ name, color, kind: 'shared', cycleStartDay: startDay, currency, createdBy: ploy }).returning()
  await db.insert(pocketMember).values([
    { pocketId: p.id, userId: ploy, role: 'owner' },
    { pocketId: p.id, userId: mint, role: 'member' },
  ])
  const rows = await db
    .insert(category)
    .values(categories.map(([n, amount], i) => ({ pocketId: p.id, name: n, limitType: 'cycle' as const, limitAmount: whole(amount), sortOrder: i })))
    .returning()
  return { id: p.id, cat: (n: string) => rows.find((r) => r.name === n)!.id }
}
const household = await shared('Household', 'blue', 1, [
  ['Groceries', 8000],
  ['Utilities', 4000],
  ['Home supplies', 1500],
])
const trip = await shared('Chiang Mai trip', 'orange', 1, [
  ['Hotels', 6000],
  ['Food', 4000],
  ['Transport', 3000],
])
// A trip abroad in yen, so all-pockets Spending shows one total per currency.
const tokyo = await shared(
  'Tokyo trip',
  'teal',
  1,
  [
    ['Hotels', 60000],
    ['Food', 30000],
    ['Transport', 15000],
  ],
  'JPY',
)

await db.delete(entry).where(inArray(entry.pocketId, [me.id]))

type Row = typeof entry.$inferInsert
const rows: Row[] = []
const spend = (pocketId: string, userId: string, categoryId: string, amount: number, note: string, occurredOn: string) =>
  rows.push({ pocketId, userId, kind: 'expense', categoryId, amount: whole(amount), note, occurredOn, bankAccountId: userId === ploy ? main.id : null })

// Four cycles of personal history up to today.
const first = cycleFor(addDays(cycleFor(today, 25).start, -100), 25).start
for (let d = first; d <= today; d = addDays(d, 1)) {
  const dom = Number(d.slice(8))
  const wd = new Date(`${d}T00:00:00Z`).getUTCDay()
  if (dom === 25) rows.push({ pocketId: me.id, userId: ploy, kind: 'income', amount: whole(32000), note: 'Salary', occurredOn: d, bankAccountId: main.id })
  if (d === today) {
    spend(me.id, ploy, cat('Food'), 65, 'Coffee', d)
    spend(me.id, ploy, cat('Food'), 85, 'Khao man gai', d)
    continue
  }
  spend(me.id, ploy, cat('Food'), 65, 'Coffee', d)
  // Saturdays tend to go over.
  if (wd === 6) spend(me.id, ploy, cat('Food'), pick([199, 240, 180]), pick(['Shabu dinner', 'Brunch', 'Mookata']), d)
  else spend(me.id, ploy, cat('Food'), pick([85, 95, 110, 120]), pick(['Lunch', 'Khao man gai', 'Pad kra pao', 'Noodles']), d)
  if (wd === 3) spend(me.id, ploy, cat('Gas'), pick([500, 600]), pick(['PTT gas', 'Shell', 'Bangchak']), d)
  if (dom === 1) spend(me.id, ploy, cat('Bills'), 1850, 'Condo fee', d)
  if (dom === 2) spend(me.id, ploy, cat('Bills'), 899, 'AIS phone', d)
  if (dom === 29) spend(me.id, ploy, cat('Bills'), 231, 'Water', d)
  if (dom === 27 && d > addDays(today, -30)) spend(me.id, ploy, cat('Bills'), 1000, 'Insurance', d)
  if (rand() < 0.12) spend(me.id, ploy, cat('Shopping'), pick([290, 450, 690, 1200]), pick(['Shopee', 'Uniqlo', 'Central', 'Lazada']), d)
  if (rand() < 0.08) spend(me.id, ploy, cat('Fun'), pick([220, 300, 450]), pick(['Cinema', 'Concert', 'Board games']), d)
  if (rand() < 0.05) spend(me.id, ploy, cat('Travel'), pick([350, 600, 800]), pick(['Bus to Hua Hin', 'Hotel', 'Train']), d)
  if (rand() < 0.03) spend(me.id, ploy, cat('Health'), pick([150, 480]), pick(['Pharmacy', 'Clinic']), d)
}

// Household this month, logged by both.
const hhStart = cycleFor(today, 1).start
for (let d = hhStart; d <= today; d = addDays(d, 1)) {
  const who = rand() < 0.55 ? mint : ploy
  if (rand() < 0.3) spend(household.id, who, household.cat('Groceries'), pick([356, 540, 820, 1240]), pick(['Big C', 'Tops', 'Lotus', 'Makro']), d)
  if (rand() < 0.1) spend(household.id, who, household.cat('Home supplies'), pick([120, 249, 390]), pick(['Watsons', 'HomePro', 'Daiso']), d)
}
spend(household.id, ploy, household.cat('Utilities'), 2180, 'Electricity', addDays(today, -2))
spend(household.id, mint, household.cat('Utilities'), 1940, 'Internet + water', addDays(today, -9))

// A trip in progress.
spend(trip.id, ploy, trip.cat('Hotels'), 2400, 'Nimman hotel', addDays(today, -3))
spend(trip.id, mint, trip.cat('Food'), 680, 'Khao soi tour', addDays(today, -2))
spend(trip.id, ploy, trip.cat('Transport'), 420, 'Songthaew', addDays(today, -1))

// The same days in Tokyo, in yen.
spend(tokyo.id, mint, tokyo.cat('Hotels'), 24000, 'Shinjuku hotel', addDays(today, -3))
spend(tokyo.id, ploy, tokyo.cat('Transport'), 3000, 'Suica top-up', addDays(today, -3))
spend(tokyo.id, ploy, tokyo.cat('Food'), 1200, 'Ramen', addDays(today, -2))
spend(tokyo.id, mint, tokyo.cat('Food'), 4200, 'Izakaya', addDays(today, -1))

await db.insert(entry).values(rows)
console.log(`Seeded ${rows.length} synthetic entries.`)
process.exit(0)
