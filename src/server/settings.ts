import { createServerFn } from '@tanstack/react-start'
import { setCookie } from '@tanstack/react-start/server'
import { and, eq, max } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db/index'
import { bankAccount, pocket, pocketMember, user } from '#/db/schema'
import { pocketColors } from '#/lib/colors'
import { requireOwner, requirePocket, requireUser } from './session'

const name = z.string().trim().min(1).max(40)
const color = z.enum(pocketColors)

export const renameUser = createServerFn({ method: 'POST' })
  .validator(z.object({ name }))
  .handler(async ({ data }) => {
    const u = await requireUser()
    await db.update(user).set({ name: data.name }).where(eq(user.id, u.id))
  })

/** This server sends no mail, so the new email applies at once. */
export const changeEmail = createServerFn({ method: 'POST' })
  .validator(z.object({ email: z.email() }))
  .handler(async ({ data }) => {
    const u = await requireUser()
    const email = data.email.toLowerCase()
    const [owner] = await db.select({ id: user.id }).from(user).where(eq(user.email, email))
    if (owner && owner.id !== u.id) return { taken: true }
    await db.update(user).set({ email }).where(eq(user.id, u.id))
    return { taken: false }
  })

export const addBankAccount = createServerFn({ method: 'POST' })
  .validator(z.object({ name }))
  .handler(async ({ data }) => {
    const u = await requireUser()
    const [{ top }] = await db.select({ top: max(bankAccount.sortOrder) }).from(bankAccount).where(eq(bankAccount.userId, u.id))
    await db.insert(bankAccount).values({ userId: u.id, name: data.name, sortOrder: (top ?? -1) + 1 })
  })

export const archiveBankAccount = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.uuid() }))
  .handler(async ({ data }) => {
    const u = await requireUser()
    await db
      .update(bankAccount)
      .set({ archivedAt: new Date() })
      .where(and(eq(bankAccount.id, data.id), eq(bankAccount.userId, u.id)))
  })

/** Undo for archiveBankAccount. */
export const restoreBankAccount = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.uuid() }))
  .handler(async ({ data }) => {
    const u = await requireUser()
    await db
      .update(bankAccount)
      .set({ archivedAt: null })
      .where(and(eq(bankAccount.id, data.id), eq(bankAccount.userId, u.id)))
  })

export const createPocket = createServerFn({ method: 'POST' })
  .validator(z.object({ name, color, cycleStartDay: z.number().int().min(1).max(31) }))
  .handler(async ({ data }) => {
    const u = await requireUser()
    const id = await db.transaction(async (tx) => {
      const [p] = await tx
        .insert(pocket)
        .values({ ...data, kind: 'shared', createdBy: u.id })
        .returning({ id: pocket.id })
      await tx.insert(pocketMember).values({ pocketId: p.id, userId: u.id, role: 'owner' })
      return p.id
    })
    setCookie('pocket', id, { path: '/', httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 365 })
    return { id }
  })

export const updatePocket = createServerFn({ method: 'POST' })
  .validator(z.object({ pocketId: z.uuid(), name, color }))
  .handler(async ({ data }) => {
    const u = await requireUser()
    await requireOwner(u.id, data.pocketId)
    await db.update(pocket).set({ name: data.name, color: data.color }).where(eq(pocket.id, data.pocketId))
  })

/** Adds someone who already has an account on this server; `found: false` when nobody uses that email. */
export const addMember = createServerFn({ method: 'POST' })
  .validator(z.object({ pocketId: z.uuid(), email: z.email() }))
  .handler(async ({ data }) => {
    const u = await requireUser()
    const p = await requireOwner(u.id, data.pocketId)
    if (p.kind !== 'shared') throw new Error('Only shared pockets have members')
    const [target] = await db.select({ id: user.id }).from(user).where(eq(user.email, data.email.toLowerCase()))
    if (!target) return { found: false }
    await db.insert(pocketMember).values({ pocketId: p.id, userId: target.id, role: 'member' }).onConflictDoNothing()
    return { found: true }
  })

export const removeMember = createServerFn({ method: 'POST' })
  .validator(z.object({ pocketId: z.uuid(), userId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const u = await requireUser()
    await requireOwner(u.id, data.pocketId)
    if (data.userId === u.id) throw new Error('The owner cannot be removed')
    await db.delete(pocketMember).where(and(eq(pocketMember.pocketId, data.pocketId), eq(pocketMember.userId, data.userId)))
  })

/** Deletes a shared pocket for every member; its categories and entries go with it (the foreign keys cascade). */
export const deletePocket = createServerFn({ method: 'POST' })
  .validator(z.object({ pocketId: z.uuid() }))
  .handler(async ({ data }) => {
    const u = await requireUser()
    const p = await requireOwner(u.id, data.pocketId)
    if (p.kind !== 'shared') throw new Error('Your personal pocket cannot be deleted')
    await db.delete(pocket).where(eq(pocket.id, p.id))
  })

export const leavePocket = createServerFn({ method: 'POST' })
  .validator(z.object({ pocketId: z.uuid() }))
  .handler(async ({ data }) => {
    const u = await requireUser()
    const p = await requirePocket(u.id, data.pocketId)
    if (p.role === 'owner') throw new Error('The owner cannot leave')
    await db.delete(pocketMember).where(and(eq(pocketMember.pocketId, data.pocketId), eq(pocketMember.userId, u.id)))
    setCookie('pocket', '', { path: '/', maxAge: 0 })
  })
