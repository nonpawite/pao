import { relations } from 'drizzle-orm'
import {
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

import { user } from './auth-schema.ts'

export * from './auth-schema.ts'

// Every budget lives in a pocket. A personal pocket has one member; a shared pocket has several.
export const pocket = pgTable('pocket', {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  color: text().notNull(),
  kind: text({ enum: ['personal', 'shared'] }).notNull(),
  // 1-31; a day past the month's end means the last day of that month.
  cycleStartDay: integer('cycle_start_day').notNull(),
  // ISO 4217 code. Amounts are never converted: changing it only relabels them (ADR 0001).
  currency: text().notNull(),
  createdBy: text('created_by')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const pocketMember = pgTable(
  'pocket_member',
  {
    pocketId: uuid('pocket_id')
      .notNull()
      .references(() => pocket.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    role: text({ enum: ['owner', 'member'] }).notNull(),
    joinedAt: timestamp('joined_at').defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.pocketId, t.userId] }),
    index('pocket_member_user_idx').on(t.userId),
  ],
)

export const category = pgTable(
  'category',
  {
    id: uuid().primaryKey().defaultRandom(),
    pocketId: uuid('pocket_id')
      .notNull()
      .references(() => pocket.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    limitType: text('limit_type', { enum: ['day', 'cycle', 'none'] }).notNull(),
    // Hundredths of the pocket currency. 0 when limitType is 'none'.
    limitAmount: integer('limit_amount').notNull().default(0),
    sortOrder: integer('sort_order').notNull().default(0),
    archivedAt: timestamp('archived_at'),
  },
  (t) => [index('category_pocket_idx').on(t.pocketId)],
)

// Named bankAccount because Better Auth owns the `account` table.
export const bankAccount = pgTable('bank_account', {
  id: uuid().primaryKey().defaultRandom(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  name: text().notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  archivedAt: timestamp('archived_at'),
})

export const entry = pgTable(
  'entry',
  {
    id: uuid().primaryKey().defaultRandom(),
    pocketId: uuid('pocket_id')
      .notNull()
      .references(() => pocket.id, { onDelete: 'cascade' }),
    // Who logged it.
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    kind: text({ enum: ['expense', 'income'] }).notNull(),
    categoryId: uuid('category_id').references(() => category.id, {
      onDelete: 'set null',
    }),
    bankAccountId: uuid('bank_account_id').references(() => bankAccount.id, {
      onDelete: 'set null',
    }),
    // Hundredths, always positive; kind gives the direction.
    amount: integer().notNull(),
    note: text().notNull().default(''),
    occurredOn: date('occurred_on', { mode: 'string' }).notNull(),
    // Set when the entry pays a bill: which bill, and the due date it pays.
    billId: uuid('bill_id').references(() => bill.id, { onDelete: 'set null' }),
    billFor: date('bill_for', { mode: 'string' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('entry_pocket_day_idx').on(t.pocketId, t.occurredOn)],
)

// A bill that comes back every month or year. Paying one logs an entry linked to it.
export const bill = pgTable(
  'bill',
  {
    id: uuid().primaryKey().defaultRandom(),
    pocketId: uuid('pocket_id')
      .notNull()
      .references(() => pocket.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    // Hundredths; null when it varies, then the last paid amount is set aside.
    amount: integer(),
    categoryId: uuid('category_id').references(() => category.id, { onDelete: 'set null' }),
    // The creator's account; accounts are private, so others pay it from none.
    bankAccountId: uuid('bank_account_id').references(() => bankAccount.id, { onDelete: 'set null' }),
    repeat: text({ enum: ['monthly', 'yearly'] }).notNull(),
    // 1-31; a day past the month's end means the last day of that month.
    day: integer().notNull(),
    // 1-12, yearly bills only.
    month: integer(),
    // The due date skipped this time; a later due date un-skips it.
    skippedOn: date('skipped_on', { mode: 'string' }),
    createdBy: text('created_by')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('bill_pocket_idx').on(t.pocketId)],
)

export const entryRelations = relations(entry, ({ one }) => ({
  category: one(category, {
    fields: [entry.categoryId],
    references: [category.id],
  }),
  user: one(user, { fields: [entry.userId], references: [user.id] }),
}))
