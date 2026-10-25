import { and, asc, eq, gte, inArray, isNull, lte, or } from 'drizzle-orm'
import { getCookie, getRequestHeaders } from '@tanstack/react-start/server'

import { db } from '#/db/index'
import { bill, category, entry, pocket, pocketMember, user } from '#/db/schema'
import { auth } from '#/lib/auth'
import { billStates, byUrgency } from '#/lib/bills'
import { addDays, householdDay } from '#/lib/budget'
import type { Cycle } from '#/lib/budget'

export async function requireUser() {
  const session = await auth.api.getSession({ headers: getRequestHeaders() })
  if (!session) throw new Error('Not signed in')
  return session.user
}

/** The admin is the instance's oldest account (ADR 0002): worked out, not stored, so upgrades need nothing. */
export async function adminId() {
  const [first] = await db.select({ id: user.id }).from(user).orderBy(asc(user.createdAt), asc(user.id)).limit(1)
  return first?.id ?? null
}

export async function requireAdmin() {
  const u = await requireUser()
  if (u.id !== (await adminId())) throw new Error('Only the admin can do that')
  return u
}

/** The pocket, only if the user belongs to it. Every pocket-scoped read and write goes through here. */
export async function requirePocket(userId: string, pocketId: string) {
  const [row] = await db
    .select({ pocket, role: pocketMember.role })
    .from(pocketMember)
    .innerJoin(pocket, eq(pocket.id, pocketMember.pocketId))
    .where(and(eq(pocketMember.pocketId, pocketId), eq(pocketMember.userId, userId)))
  if (!row) throw new Error('Pocket not found')
  return { ...row.pocket, role: row.role }
}

export async function requireOwner(userId: string, pocketId: string) {
  const p = await requirePocket(userId, pocketId)
  if (p.role !== 'owner') throw new Error('Only the pocket owner can do that')
  return p
}

/** The active pocket from the cookie, falling back to the user's personal pocket. */
export async function activePocket(userId: string) {
  const fromCookie = getCookie('pocket')
  if (fromCookie) {
    const p = await requirePocket(userId, fromCookie).catch(() => null)
    if (p) return p
  }
  const [row] = await db
    .select({ pocket, role: pocketMember.role })
    .from(pocketMember)
    .innerJoin(pocket, eq(pocket.id, pocketMember.pocketId))
    .where(and(eq(pocketMember.userId, userId), eq(pocket.kind, 'personal')))
  if (!row) throw new Error('No personal pocket')
  return { ...row.pocket, role: row.role }
}

/** Today in the household's time zone. */
export const todayISO = () => householdDay()

export const pocketCategories = (pocketId: string) =>
  db
    .select()
    .from(category)
    .where(and(eq(category.pocketId, pocketId), isNull(category.archivedAt)))
    .orderBy(asc(category.sortOrder), asc(category.name))

/** Entries of a pocket between two dates, with who logged them. */
export const pocketEntries = (pocketId: string, from: string, to: string) =>
  db
    .select({
      id: entry.id,
      kind: entry.kind,
      amount: entry.amount,
      note: entry.note,
      occurredOn: entry.occurredOn,
      createdAt: entry.createdAt,
      categoryId: entry.categoryId,
      bankAccountId: entry.bankAccountId,
      userId: entry.userId,
      userName: user.name,
    })
    .from(entry)
    .innerJoin(user, eq(user.id, entry.userId))
    .where(and(eq(entry.pocketId, pocketId), gte(entry.occurredOn, from), lte(entry.occurredOn, to)))
    .orderBy(entry.occurredOn, entry.createdAt)

export type PocketEntry = Awaited<ReturnType<typeof pocketEntries>>[number]

/**
 * A pocket's bills with their state this cycle, most urgent first.
 * The creator's account stays theirs: anyone else paying the bill pays from no account.
 */
export async function pocketBills(pocketId: string, cycle: Pick<Cycle, 'start' | 'end'>, today: string, userId: string) {
  const bills = await db.select().from(bill).where(eq(bill.pocketId, pocketId)).orderBy(asc(bill.day), asc(bill.name))
  if (!bills.length) return []
  const paying = await db
    .select({
      id: entry.id,
      kind: entry.kind,
      amount: entry.amount,
      note: entry.note,
      categoryId: entry.categoryId,
      occurredOn: entry.occurredOn,
      billId: entry.billId,
      billFor: entry.billFor,
    })
    .from(entry)
    .where(
      and(
        eq(entry.pocketId, pocketId),
        or(
          // Linked payments from the last year give each bill its last amount paid.
          and(inArray(entry.billId, bills.map((b) => b.id)), gte(entry.occurredOn, addDays(today, -400))),
          // Unlinked entries near this cycle may have paid a bill by hand.
          and(isNull(entry.billId), gte(entry.occurredOn, addDays(cycle.start, -3)), lte(entry.occurredOn, addDays(cycle.end, 3))),
        ),
      ),
    )
  return billStates(bills.map((b) => ({ ...b, since: householdDay(b.createdAt) })), paying, cycle, today)
    .map(({ createdBy, createdAt: _, ...b }) => ({ ...b, bankAccountId: createdBy === userId ? b.bankAccountId : null }))
    .sort(byUrgency)
}

export type PocketBill = Awaited<ReturnType<typeof pocketBills>>[number]
