import { createServerFn } from '@tanstack/react-start'
import { and, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db/index'
import { bankAccount, bill, category, entry } from '#/db/schema'
import { cycleFor, daysInMonth, iso } from '#/lib/budget'
import { maxAmount } from '#/lib/money'
import { activePocket, pocketBills, requireOwner, requirePocket, requireUser, todayISO } from './session'

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

/**
 * The Bills page: every bill of the active pocket with its state this cycle, soonest first,
 * and the bills due in one calendar month (this month by default) for the calendar.
 */
export const getBillsPage = createServerFn({ method: 'GET' })
  .validator(z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional() }))
  .handler(async ({ data }) => {
    const u = await requireUser()
    const p = await activePocket(u.id)
    const today = todayISO()
    const month = data.month ?? today.slice(0, 7)
    const [y, m] = month.split('-').map(Number)
    const [bills, monthBills] = await Promise.all([
      pocketBills(p.id, cycleFor(today, p.cycleStartDay), today, u.id),
      pocketBills(p.id, { start: iso(y, m, 1), end: iso(y, m, daysInMonth(y, m)) }, today, u.id),
    ])
    return {
      month,
      today,
      payday: p.cycleStartDay,
      bills: bills.sort((a, b) => a.next.localeCompare(b.next) || a.name.localeCompare(b.name)),
      monthBills: monthBills.filter((b) => b.state),
    }
  })

export type BillsPage = Awaited<ReturnType<typeof getBillsPage>>

const billInput = z
  .object({
    pocketId: z.uuid(),
    id: z.uuid().nullable(),
    name: z.string().trim().min(1).max(40),
    // Hundredths; null when it varies.
    amount: z.number().int().positive().max(maxAmount).nullable(),
    categoryId: z.uuid(),
    bankAccountId: z.uuid().nullable(),
    repeat: z.enum(['monthly', 'yearly']),
    day: z.number().int().min(1).max(31),
    month: z.number().int().min(1).max(12).nullable(),
  })
  .refine((b) => (b.repeat === 'yearly') === (b.month !== null), 'Yearly bills need a month')

/** Bills are planned money, so like categories only the pocket's owner adds or changes them. */
export const saveBill = createServerFn({ method: 'POST' })
  .validator(billInput)
  .handler(async ({ data: { id, ...data } }) => {
    const u = await requireUser()
    await requireOwner(u.id, data.pocketId)
    const [c] = await db
      .select({ id: category.id })
      .from(category)
      .where(and(eq(category.id, data.categoryId), eq(category.pocketId, data.pocketId), isNull(category.archivedAt)))
    if (!c) throw new Error('Category not found')
    if (data.bankAccountId) {
      const [a] = await db
        .select({ id: bankAccount.id })
        .from(bankAccount)
        .where(and(eq(bankAccount.id, data.bankAccountId), eq(bankAccount.userId, u.id)))
      if (!a) throw new Error('Account not found')
    }
    if (!id) {
      await db.insert(bill).values({ ...data, createdBy: u.id })
      return
    }
    const [row] = await db
      .update(bill)
      .set(data)
      .where(and(eq(bill.id, id), eq(bill.pocketId, data.pocketId)))
      .returning({ id: bill.id })
    if (!row) throw new Error('Bill not found')
  })

/** Entries that paid it stay, unlinked. */
export const deleteBill = createServerFn({ method: 'POST' })
  .validator(z.object({ pocketId: z.uuid(), id: z.uuid() }))
  .handler(async ({ data }) => {
    const u = await requireUser()
    await requireOwner(u.id, data.pocketId)
    await db.delete(bill).where(and(eq(bill.id, data.id), eq(bill.pocketId, data.pocketId)))
  })

/** The bill, only if the user belongs to its pocket. Paying and skipping are open to every member. */
async function memberBill(userId: string, id: string) {
  const [b] = await db.select().from(bill).where(eq(bill.id, id))
  if (!b) throw new Error('Bill not found')
  await requirePocket(userId, b.pocketId)
  return b
}

/** Skips one due date, or un-skips it. */
export const skipBill = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.uuid(), dueOn: isoDate }))
  .handler(async ({ data }) => {
    const u = await requireUser()
    const b = await memberBill(u.id, data.id)
    await db
      .update(bill)
      .set({ skippedOn: b.skippedOn === data.dueOn ? null : data.dueOn })
      .where(eq(bill.id, b.id))
  })

/** Logs a fixed-amount bill as paid today. Returns the entry so the payment can be undone. */
export const payBill = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.uuid(), dueOn: isoDate }))
  .handler(async ({ data }) => {
    const u = await requireUser()
    const b = await memberBill(u.id, data.id)
    if (b.amount === null) throw new Error('This bill varies; enter its amount')
    if (!b.categoryId) throw new Error('Pick a category for this bill')
    const [row] = await db
      .insert(entry)
      .values({
        pocketId: b.pocketId,
        userId: u.id,
        kind: 'expense',
        categoryId: b.categoryId,
        bankAccountId: b.createdBy === u.id ? b.bankAccountId : null,
        amount: b.amount,
        note: b.name,
        occurredOn: todayISO(),
        billId: b.id,
        billFor: data.dueOn,
      })
      .returning({ id: entry.id })
    return { id: row.id }
  })
