// Pure money logic. Amounts are integer hundredths in the pocket's ISO 4217 currency, never converted.

/** Format hundredths in `currency` for an Intl locale tag such as 'th-TH' or 'en-GB'. */
export function formatMoney(hundredths: number, currency: string, locale: string, opts: { sign?: boolean } = {}) {
  const abs = Math.abs(hundredths)
  const style = { style: 'currency', currency, currencyDisplay: 'narrowSymbol' } as const
  // The currency's own decimals (JPY 0, USD 2, KWD 3), capped at the 2 that hundredths can hold.
  const digits = Math.min(2, new Intl.NumberFormat(locale, style).resolvedOptions().maximumFractionDigits ?? 2)
  const n = new Intl.NumberFormat(locale, {
    ...style,
    minimumFractionDigits: abs % 100 === 0 ? 0 : digits,
    maximumFractionDigits: digits,
  }).format(abs / 100)
  const sign = hundredths < 0 ? '−' : opts.sign ? '+' : ''
  return `${sign}${n}`
}

/** Parse a typed amount, allowing simple sums like "120+45+30". Returns hundredths, or null if invalid. */
export function parseAmount(input: string): number | null {
  // Separators and symbols ($, ฿) go anywhere; letter symbols (US$, CHF) only at either end.
  const clean = input.replace(/[,\s\p{Sc}]/gu, '').replace(/^\p{L}+|\p{L}+$/gu, '')
  if (!/^\d+(\.\d{1,2})?(\+\d+(\.\d{1,2})?)*$/.test(clean)) return null
  const hundredths = clean.split('+').reduce((sum, p) => sum + Math.round(Number(p) * 100), 0)
  return hundredths > 0 ? hundredths : null
}

export type CurrencyTotal = { currency: string; total: number }

/** Fold per-pocket totals into one total per currency, in first-seen order. Never adds two currencies. */
export function totalsByCurrency(pockets: CurrencyTotal[]): CurrencyTotal[] {
  const totals = new Map<string, number>()
  for (const p of pockets) totals.set(p.currency, (totals.get(p.currency) ?? 0) + p.total)
  return [...totals].map(([currency, total]) => ({ currency, total }))
}
