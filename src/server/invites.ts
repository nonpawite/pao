import { createServerFn } from '@tanstack/react-start'
import { and, asc, desc, eq, gt, isNull } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db/index'
import { invite, user } from '#/db/schema'
import { householdDay } from '#/lib/budget'
import { inviteDays, newInviteCode } from '#/lib/invites'
import { adminId, requireAdmin, requireUser } from './session'

/** The admin's view in Settings: everyone on the instance and the invites still waiting. Null for anyone else. */
export const getMembers = createServerFn({ method: 'GET' }).handler(async () => {
  const u = await requireUser()
  const admin = await adminId()
  if (u.id !== admin) return null
  const members = await db.select({ id: user.id, name: user.name, email: user.email }).from(user).orderBy(asc(user.createdAt), asc(user.id))
  const pending = await db
    .select({ id: invite.id, code: invite.code, name: invite.name, expiresAt: invite.expiresAt })
    .from(invite)
    .where(and(isNull(invite.usedAt), gt(invite.expiresAt, new Date())))
    .orderBy(desc(invite.createdAt))
  // The last day it works, on the household's calendar (APP_TZ), not UTC's.
  return { admin, members, pending: pending.map(({ expiresAt, ...i }) => ({ ...i, until: householdDay(expiresAt) })) }
})

export const createInvite = createServerFn({ method: 'POST' })
  .validator(z.object({ name: z.string().trim().max(40) }))
  .handler(async ({ data }) => {
    const u = await requireAdmin()
    const expiresAt = new Date(Date.now() + inviteDays * 86_400_000)
    // A repeated code is one in 850 billion; drawing again keeps the unique column happy if it ever happens.
    for (let tries = 0; tries < 3; tries++) {
      const [row] = await db
        .insert(invite)
        .values({ code: newInviteCode(), name: data.name || null, createdBy: u.id, expiresAt })
        .onConflictDoNothing()
        .returning({ code: invite.code })
      if (row) return row
    }
    throw new Error('Could not make an invite code')
  })

/** Takes back an invite nobody has used yet, and returns it so Undo can put it back. */
export const revokeInvite = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.uuid() }))
  .handler(async ({ data }) => {
    await requireAdmin()
    const [gone] = await db
      .delete(invite)
      .where(and(eq(invite.id, data.id), isNull(invite.usedAt)))
      .returning({ code: invite.code, name: invite.name, expiresAt: invite.expiresAt })
    return gone ?? null
  })

/** Undo for a revoke: the same code, name and expiry come back. */
export const restoreInvite = createServerFn({ method: 'POST' })
  .validator(z.object({ code: z.string().regex(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/), name: z.string().max(40).nullable(), expiresAt: z.coerce.date() }))
  .handler(async ({ data }) => {
    const u = await requireAdmin()
    await db.insert(invite).values({ ...data, createdBy: u.id }).onConflictDoNothing()
  })
