// Pure money logic. Amounts are integer hundredths in the pocket's ISO 4217 currency, never converted.

import { locales } from './i18n.ts'

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

/** The symbol formatMoney writes for `currency`: ฿, $, ¥, CHF. */
export const currencySymbol = (currency: string, locale: string) =>
  new Intl.NumberFormat(locale, { style: 'currency', currency, currencyDisplay: 'narrowSymbol' }).formatToParts(0).find((p) => p.type === 'currency')!.value

let letterSymbols: Set<string> | undefined

/** ISO codes (USD, CHF) and code-style symbols (US$, HK$) for every currency the platform knows. */
function isLetterSymbol(s: string) {
  // Code-style symbols as each shipped language writes them.
  letterSymbols ??= new Set(
    Intl.supportedValuesOf('currency').flatMap((currency) => [
      currency,
      ...Object.values(locales).map(
        ({ tag }) => new Intl.NumberFormat(tag, { style: 'currency', currency }).formatToParts(0).find((p) => p.type === 'currency')!.value,
      ),
    ]),
  )
  return letterSymbols.has(s.toUpperCase())
}

/** Parse a typed amount, allowing simple sums like "120+45+30". Returns hundredths, or null if invalid. */
export function parseAmount(input: string): number | null {
  // Symbols ($, ฿) may go anywhere; letters only as a currency code or code-style symbol at either end.
  const clean = input
    .replace(/[,\s]/g, '')
    .replace(/^\p{L}+\p{Sc}?|\p{L}+\p{Sc}?$/gu, (s) => (isLetterSymbol(s) ? '' : s))
    .replace(/\p{Sc}/gu, '')
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

/** Every ISO 4217 code the platform supports, A to Z: the choices for a pocket's currency. */
export const currencies = Intl.supportedValuesOf('currency')

/** True for an ISO 4217 code the platform knows ('JPY'), false for anything else ('jpy', 'BAHT'). */
export const isCurrency = (code: string) => currencies.includes(code)

/** The instance's DEFAULT_CURRENCY setting as a code; unset or unknown falls back to USD, a neutral default like UTC. */
export function defaultCurrency(setting: string | undefined) {
  const code = setting?.trim().toUpperCase() ?? ''
  return isCurrency(code) ? code : 'USD'
}
