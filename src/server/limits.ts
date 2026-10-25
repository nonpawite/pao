import { createServerFn } from '@tanstack/react-start'
import { and, eq, isNull, max } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db/index'
import { category, pocket } from '#/db/schema'
import { maxAmount } from '#/lib/money'
import { requireOwner, requireUser } from './session'

export const saveCategory = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      pocketId: z.uuid(),
      id: z.uuid().nullable(),
      name: z.string().trim().min(1).max(40),
      limitType: z.enum(['day', 'cycle', 'none']),
      limitAmount: z.number().int().min(0).max(maxAmount),
    }),
  )
  .handler(async ({ data }) => {
    const u = await requireUser()
    await requireOwner(u.id, data.pocketId)
    const limitAmount = data.limitType === 'none' ? 0 : data.limitAmount
    if (data.limitType !== 'none' && limitAmount <= 0) throw new Error('Set a limit above zero')
    if (data.id) {
      const [row] = await db
        .update(category)
        .set({ name: data.name, limitType: data.limitType, limitAmount })
        .where(and(eq(category.id, data.id), eq(category.pocketId, data.pocketId)))
        .returning({ id: category.id })
      if (!row) throw new Error('Category not found')
      return
    }
    const [{ top }] = await db
      .select({ top: max(category.sortOrder) })
      .from(category)
      .where(and(eq(category.pocketId, data.pocketId), isNull(category.archivedAt)))
    await db.insert(category).values({
      pocketId: data.pocketId,
      name: data.name,
      limitType: data.limitType,
      limitAmount,
      sortOrder: (top ?? -1) + 1,
    })
  })

/** Archived, not deleted, so past entries keep their category. */
export const archiveCategory = createServerFn({ method: 'POST' })
  .validator(z.object({ pocketId: z.uuid(), id: z.uuid() }))
  .handler(async ({ data }) => {
    const u = await requireUser()
    await requireOwner(u.id, data.pocketId)
    await db
      .update(category)
      .set({ archivedAt: new Date() })
      .where(and(eq(category.id, data.id), eq(category.pocketId, data.pocketId)))
  })

/** Undo for archiveCategory. */
export const restoreCategory = createServerFn({ method: 'POST' })
  .validator(z.object({ pocketId: z.uuid(), id: z.uuid() }))
  .handler(async ({ data }) => {
    const u = await requireUser()
    await requireOwner(u.id, data.pocketId)
    await db
      .update(category)
      .set({ archivedAt: null })
      .where(and(eq(category.id, data.id), eq(category.pocketId, data.pocketId)))
  })

export const setCycleStartDay = createServerFn({ method: 'POST' })
  .validator(z.object({ pocketId: z.uuid(), day: z.number().int().min(1).max(31) }))
  .handler(async ({ data }) => {
    const u = await requireUser()
    await requireOwner(u.id, data.pocketId)
    await db.update(pocket).set({ cycleStartDay: data.day }).where(eq(pocket.id, data.pocketId))
  })
