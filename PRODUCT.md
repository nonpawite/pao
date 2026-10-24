# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

User-chosen: TanStack (Start assumed, for server functions and routing), Drizzle ORM, PostgreSQL, Better Auth. shadcn/ui as the component base, restyled to the product's own design. Self-hosted only; installable as a PWA so it opens like an app on phones.

## Users

Members of one family sharing a self-hosted instance. Each person has an account and private data.

Primary user: the owner. Salaried, paid at the end of each month, holds several bank accounts (main, saving, investment). Job: know how much they spent this budget month and on what, so they can cut a category and save more.

## Product Purpose

Track monthly spending against per-category limits. Success means a member always knows what is left today and this month in each category, and at the end of a cycle sees where the money went and how much they kept.

## Positioning

A limit tracker, not a bank and not a ledger. No bank sync, no balance reconciliation. Each person's budget month runs from their own start day (default payday), and each category limit is either per day or per month. Family-private and self-hosted; sharing happens only through explicit shared pockets.

## Operating Context

- Expenses are entered by hand, usually right after paying. Phone and desktop matter equally, for both entry and review.
- Salary is logged as income at the end of the month. The budget month starts on a per-person start day, default payday.
- Owner's example limits: Food 200 per day, Travel 1,000 per month, Gas 3,000 per month.

## Capabilities and Constraints

- Multi-user through Better Auth. Each user's data is private and never visible to other users, except inside shared pockets they belong to.
- Shared pocket: has its own categories, limits, and cycle start day (set by its creator); any invited member logs spending into it; each entry shows who logged it. Spending in a pocket counts only toward that pocket, never toward anyone's personal limits. No splitting or settle-up.
- Category limits are per day or per month. Per-day limits are strict: every day resets to the full limit, over-limit days are flagged, and the cycle total is the sum of days. No rollover.
- Income and expenses are tagged with an account (main, saving, investment, user-defined). No running balances. A cycle shows earned, spent, and kept.
- Currency: Thai baht (฿) only, for every user and pocket.
- UI language: Thai and English, switchable per person.
- Manual entry only. Bank sync, CSV import, and receipt/slip scanning are out of scope.
- Open: recurring expenses, editable category sets per user, transfers between accounts.

## Brand Commitments

- Owner-named feel references: Apple Wallet and N26. "Clean, polished, modern."
- shadcn/ui components as the base, restyled to match the product's design.
- No product name, logo, or visual identity exists yet.

## Evidence on Hand

None. No real transaction data, name, or logo. Demo data must be labeled synthetic.

## Product Principles

1. Answer "how much is left" before anything else.
2. Logging an expense takes seconds; every field beyond amount and category is optional.
3. Private by default; sharing is explicit and per pocket.
4. Simple over complete: no balances, no reconciliation, no imports.
5. A month is a person's pay cycle, not the calendar.

## Accessibility & Inclusion

- Thai and English UI: the typeface must render Thai script well (stacked tone marks, taller line height) and mixed Thai/Latin text and numerals must sit on one baseline.
