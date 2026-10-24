# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

TanStack Start (server functions and routing), Drizzle ORM, PostgreSQL and Better Auth, on Bun. shadcn/ui as the component base, restyled to the product's own design. Self-hosted only, from a prebuilt Docker image; installable as a PWA so it opens like an app on phones.

## Users

The members of one household sharing a self-hosted instance. A household can be a couple, housemates, parents and children, or one person. Each member has an account and private data.

A typical member is paid on a fixed day each month and keeps money in more than one bank account (main, saving, investment). Their job: know how much they spent this cycle and on what, so they can cut a category and save more.

One member, the self-hoster, installs Pao for the household, closes signup once everyone has joined, and runs upgrades and backups.

## Product Purpose

Track spending against per-category limits. Success means a member always knows what is left today and this cycle in each category, and at the end of a cycle sees where the money went and how much they kept.

## Positioning

A limit tracker, not a bank and not a ledger. No bank sync, no balance reconciliation, no currency conversion. Each pocket's cycle runs from its own start day (default payday), and each category limit is either per day or per cycle. Private and self-hosted per household; sharing happens only through explicit shared pockets.

## Operating Context

- Expenses are entered by hand, usually right after paying. Phone and desktop matter equally, for both entry and review.
- Income such as salary is logged when it arrives. A cycle starts on the pocket's start day, default payday.
- Households live anywhere: the instance sets its time zone and default currency, and each member picks a language.
- Example limits (from the demo data): Food 200 a day, Travel 1,000 a cycle, Gas 3,000 a cycle, in the pocket's currency.

## Capabilities and Constraints

- Multiple members through Better Auth. Each member's data is private and never visible to other members, except inside shared pockets they belong to.
- Signup is open until the self-hoster closes it for the instance. No invite links or admin roles.
- Shared pocket: has its own categories, limits, cycle start day and currency (set by its owner); any invited member logs spending into it; each entry shows who logged it. Spending in a pocket counts only toward that pocket, never toward anyone's personal limits. No splitting or settle-up.
- Category limits are per day or per cycle. Per-day limits are strict: every day resets to the full limit, over-limit days are flagged, and the cycle total is the sum of days. No rollover.
- Bills: monthly or yearly bills per pocket, with due dates. A bill still owed this cycle can be logged in one tap.
- Income and expenses are tagged with an account (main, saving, investment, member-defined). No running balances. A cycle shows earned, spent, and kept.
- Currency is set per pocket, as an ISO 4217 code (ADR 0001). Every amount shows the pocket's currency symbol and decimal rules, for example no decimals for JPY. A new member's personal pocket starts in the instance's default currency; a new shared pocket starts in its creator's personal-pocket currency. Changing a pocket's currency relabels its amounts and never converts them. A view across pockets shows one total per currency and never adds two currencies together.
- Languages: Thai and English ship. Signup starts in the browser's language when Pao has it, otherwise English, and each member can switch in Settings. Month and weekday names, dates and numbers come from the platform's locale data. A new language is one messages file plus one registry entry.
- Manual entry only. Bank sync, CSV import, and receipt or slip scanning are out of scope. CSV export is planned after v1.0.0, as a good first issue for contributors.
- Open: transfers between accounts.

## Brand Commitments

- Feel references: Apple Wallet and N26. "Clean, polished, modern."
- shadcn/ui components as the base, restyled to match the product's design.
- The name is Pao, the same Latin word in every language. There is no logo beyond the app icon.

## Evidence on Hand

None. No real transaction data. Demo data (`scripts/seed-demo.ts`) is synthetic and must be labelled synthetic.

## Product Principles

1. Answer "how much is left" before anything else.
2. Logging an expense takes seconds; every field beyond amount and category is optional.
3. Private by default; sharing is explicit and per pocket.
4. Simple over complete: no balances, no reconciliation, no imports, no exchange rates.
5. A cycle is a pocket's pay cycle, not the calendar month.
6. Every figure is in its pocket's currency; amounts in different currencies are never added together.

## Accessibility & Inclusion

- Thai and English UI: the typeface must render Thai script well (stacked tone marks, taller line height) and mixed Thai/Latin text and numerals must sit on one baseline.
- Dates and numbers follow the member's language through the platform's locale data, so no screen hardcodes a month name, a separator or a currency symbol.
- The bundled fonts cover Latin and Thai. A language in another script falls back to the device's system font.
