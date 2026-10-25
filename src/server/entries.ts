import { createServerFn } from '@tanstack/react-start'
import { and, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db/index'
import { bankAccount, bill, category, entry } from '#/db/schema'
import { addDays } from '#/lib/budget'
import { maxAmount } from '#/lib/money'
import { pocketEntries, requirePocket, requireUser, todayISO } from './session'

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const entryInput = z.object({
  pocketId: z.uuid(),
  kind: z.enum(['expense', 'income']),
  categoryId: z.uuid().nullable(),
  bankAccountId: z.uuid().nullable(),
  // Hundredths. Upper bound keeps it inside a Postgres integer.
  amount: z.number().int().positive().max(maxAmount),
  note: z.string().trim().max(200),
  occurredOn: isoDate,
})
type EntryInput = z.infer<typeof entryInput>

/** The checks every write shares: the user's pocket, a sane date, a live category in that pocket, the user's own account. */
async function checkEntry(userId: string, data: EntryInput) {
  await requirePocket(userId, data.pocketId)
  const today = todayISO()
  if (data.occurredOn > addDays(today, 1) || data.occurredOn < addDays(today, -400)) throw new Error('Date out of range')

  if (data.kind === 'expense') {
    if (!data.categoryId) throw new Error('Pick a category')
    const [c] = await db
      .select({ id: category.id })
      .from(category)
      .where(and(eq(category.id, data.categoryId), eq(category.pocketId, data.pocketId), isNull(category.archivedAt)))
    if (!c) throw new Error('Category not found')
  }
  if (data.bankAccountId) {
    const [a] = await db
      .select({ id: bankAccount.id })
      .from(bankAccount)
      .where(and(eq(bankAccount.id, data.bankAccountId), eq(bankAccount.userId, userId)))
    if (!a) throw new Error('Account not found')
  }
  return {
    pocketId: data.pocketId,
    kind: data.kind,
    categoryId: data.kind === 'expense' ? data.categoryId : null,
    bankAccountId: data.bankAccountId,
    amount: data.amount,
    note: data.note,
    occurredOn: data.occurredOn,
  }
}

// An entry logged from a due bill pays that bill's due date.
export const addEntry = createServerFn({ method: 'POST' })
  .validator(entryInput.extend({ billId: z.uuid().optional(), billFor: isoDate.optional() }))
  .handler(async ({ data: { billId, billFor, ...data } }) => {
    const u = await requireUser()
    const values = await checkEntry(u.id, data)
    if (billId) {
      const [b] = await db.select({ id: bill.id }).from(bill).where(and(eq(bill.id, billId), eq(bill.pocketId, data.pocketId)))
      if (!b || !billFor) throw new Error('Bill not found')
    }
    const [row] = await db
      .insert(entry)
      .values({ ...values, userId: u.id, billId: billId ?? null, billFor: billId ? billFor : null })
      .returning({ id: entry.id })
    return { id: row.id }
  })

/** Only the person who logged an entry can change it. */
export const updateEntry = createServerFn({ method: 'POST' })
  .validator(entryInput.extend({ id: z.uuid() }))
  .handler(async ({ data: { id, ...data } }) => {
    const u = await requireUser()
    const values = await checkEntry(u.id, data)
    const [row] = await db
      .update(entry)
      .set(values)
      .where(and(eq(entry.id, id), eq(entry.userId, u.id)))
      .returning({ id: entry.id })
    if (!row) throw new Error('Entry not found')
  })

/** A pocket's entries on one day, oldest first: the add sheet's tape. Someone else's account stays theirs. */
export const getDayEntries = createServerFn({ method: 'GET' })
  .validator(z.object({ pocketId: z.uuid(), date: isoDate }))
  .handler(async ({ data }) => {
    const u = await requireUser()
    await requirePocket(u.id, data.pocketId)
    const rows = await pocketEntries(data.pocketId, data.date, data.date)
    return rows.map(({ createdAt: _, ...r }) => ({ ...r, bankAccountId: r.userId === u.id ? r.bankAccountId : null }))
  })

export type DayEntry = Awaited<ReturnType<typeof getDayEntries>>[number]

/** Only the person who logged an entry can remove it. Returns what it was, so Undo can log it again as it stood. */
export const deleteEntry = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.uuid() }))
  .handler(async ({ data }) => {
    const u = await requireUser()
    const [row] = await db
      .delete(entry)
      .where(and(eq(entry.id, data.id), eq(entry.userId, u.id)))
      .returning({
        pocketId: entry.pocketId,
        kind: entry.kind,
        categoryId: entry.categoryId,
        bankAccountId: entry.bankAccountId,
        amount: entry.amount,
        note: entry.note,
        occurredOn: entry.occurredOn,
        billId: entry.billId,
        billFor: entry.billFor,
      })
    if (!row) throw new Error('Entry not found')
    const { billId, billFor, ...rest } = row
    return billId && billFor ? { ...rest, billId, billFor } : rest
  })
