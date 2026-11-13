# Subly's subscriptions are folded into bills

Subly, a separate subscription tracker, moves into Pao. Rather than a new kind of record next to bills, its subscriptions become bills: a bill now repeats every N weeks, months or years from a first due date, can start with a free trial, can be paused, and can end after a number of charges or on a date. Subly's list of 128 known services pre-fills a new bill's name and repeat, and offers plan prices when the plan's currency matches the pocket's. The bills page shows what each of the viewer's own bank accounts pays per month. Subly's accounts and data are not carried over; its members start fresh in Pao.

A bill can now be due several times in one cycle (a weekly bill, say). Each due date gets its own state, and the bill sets aside the sum of the ones still unpaid.

## Considered Options

- **A separate subscription record and page**: keeps Subly's code shape, but gives the household two words for one thing: a charge that comes back.
- **A per-bill currency, converted to the pocket's**: Subly's way. ADR 0001 rejected conversion, and paying a bill logs an entry against the pocket's limits, so the amount is the one the card actually charges, in the pocket's currency.
- **Reminders by web push or email**: push needs a background job and a browser vendor's push service, and email needs an outside mail provider, which ADR 0003 already ruled out. A bill's in-app states (soon, today, late, trial ending) are the reminder.
- **Service logos from Google's favicon service**: every page view would tell Google which services the household pays for. Bills show a letter badge instead.
- **Cost splitting for family plans**: a bill several members share belongs in a shared pocket. Paybacks from people outside the household are out of scope.
- **Price history**: dropped. A member edits the amount when the price changes.

## Consequences

- The bill's `repeat`, `day` and `month` columns give way to a first due date, a unit and an interval. Existing bills are converted once: their first due date on or after the day they were added, every 1 month or year. A day past a month's end still falls on its last day.
- Ended bills move to an "Ended" section and keep their paid entries. Paused bills set nothing aside until resumed. Skipping one due date still works as before.
- The service list is kept by hand inside Pao, with no live price fetch, so its prices go stale and need an occasional check.
- "Per month" on the bills page converts each bill's repeat to a monthly figure (weekly × 52 ÷ 12, yearly ÷ 12, every N months ÷ N), shown per currency, never summed across currencies.
