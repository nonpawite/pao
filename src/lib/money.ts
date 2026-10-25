// Pure money logic. Amounts are integer hundredths in the pocket's ISO 4217 currency, never converted.

import { locales } from './i18n.ts'

const currencyStyle = (currency: string, currencyDisplay: 'narrowSymbol' | 'symbol' = 'narrowSymbol') =>
  ({ style: 'currency', currency, currencyDisplay }) as const

/** The decimals an amount in `currency` shows: its own (JPY 0, USD 2, KWD 3), at most 2. */
const shownDigits = (currency: string) =>
  // Capped at 2 because amounts are integer hundredths (ADR 0001).
  Math.min(2, new Intl.NumberFormat('en', currencyStyle(currency)).resolvedOptions().maximumFractionDigits ?? 2)

/** A positive amount as Intl parts, with decimals only when it has some. */
function moneyParts(abs: number, currency: string, locale: string) {
  const digits = shownDigits(currency)
  return new Intl.NumberFormat(locale, {
    ...currencyStyle(currency),
    minimumFractionDigits: abs % 100 === 0 ? 0 : digits,
    maximumFractionDigits: digits,
  }).formatToParts(abs / 100)
}

/**
 * Format hundredths in `currency` for an Intl locale tag such as 'th-TH' or 'en-GB'.
 * `symbol: false` drops the currency sign and the space beside it, for tight cells: CHF 12 → 12.
 */
export function formatMoney(hundredths: number, currency: string, locale: string, opts: { sign?: boolean; symbol?: boolean } = {}) {
  const n = moneyParts(Math.abs(hundredths), currency, locale)
    .filter((p) => opts.symbol !== false || (p.type !== 'currency' && p.type !== 'literal'))
    .map((p) => p.value)
    .join('')
  const sign = hundredths < 0 ? '−' : opts.sign ? '+' : ''
  return `${sign}${n}`
}

/** Whole units with thousands as K, for chart axes: ฿1,284 → ฿1.3K, ¥850. */
export function compactMoney(hundredths: number, currency: string, locale: string) {
  const units = hundredths / 100
  const n = units >= 1000 ? `${(units / 1000).toFixed(units >= 10000 ? 0 : 1).replace(/\.0$/, '')}K` : `${Math.round(units)}`
  // The symbol sits where formatMoney puts it (฿0, CHF 0).
  return moneyParts(0, currency, locale)
    .map((p) => (p.type === 'integer' ? n : p.value))
    .join('')
}

/** The symbol formatMoney writes for `currency`: ฿, $, ¥, CHF. `'symbol'` gives the code-style one instead: US$. */
export const currencySymbol = (currency: string, locale: string, display: 'narrowSymbol' | 'symbol' = 'narrowSymbol') =>
  new Intl.NumberFormat(locale, currencyStyle(currency, display)).formatToParts(0).find((p) => p.type === 'currency')!.value

let letterSymbols: Set<string> | undefined

/** ISO codes (USD, CHF) and code-style symbols (US$, HK$) for every currency the platform knows. */
function isLetterSymbol(s: string) {
  // Code-style symbols as each shipped language writes them.
  letterSymbols ??= new Set(
    Intl.supportedValuesOf('currency').flatMap((currency) => [
      currency,
      ...Object.values(locales).map(({ tag }) => currencySymbol(currency, tag, 'symbol')),
    ]),
  )
  return letterSymbols.has(s.toUpperCase())
}

/** The largest amount Pao stores, in hundredths (20,000,000): the database column is a 32-bit integer. */
export const maxAmount = 2_000_000_000

/**
 * What an amount field keeps of what is typed: digits and one decimal point, at most 7 digits before it and 2 after,
 * so a typed amount stays under maxAmount. `sums` keeps + for "120+45", each term capped the same way.
 */
export function typedAmount(input: string, sums = false) {
  return input
    .replace(sums ? /[^\d.+]/g : /[^\d.]/g, '')
    .split('+')
    .map((term) => {
      const [whole, ...rest] = term.split('.')
      return rest.length ? `${whole.slice(0, 7)}.${rest.join('').slice(0, 2)}` : whole.slice(0, 7)
    })
    .join('+')
}

/** Parse a typed amount in `currency`, allowing simple sums like "120+45+30". Returns hundredths, or null if invalid. */
export function parseAmount(input: string, currency: string): number | null {
  // Symbols ($, ฿) may go anywhere; letters only as a currency code or code-style symbol at either end.
  const clean = input
    .replace(/[,\s]/g, '')
    .replace(/^\p{L}+\p{Sc}?|\p{L}+\p{Sc}?$/gu, (s) => (isLetterSymbol(s) ? '' : s))
    .replace(/\p{Sc}/gu, '')
  if (!/^\d+(\.\d{1,2})?(\+\d+(\.\d{1,2})?)*$/.test(clean)) return null
  // Rounded to what the currency shows (¥12.5 is ¥13), so the stored amount is the shown one.
  const step = 10 ** (2 - shownDigits(currency))
  const hundredths = Math.round(clean.split('+').reduce((sum, p) => sum + Math.round(Number(p) * 100), 0) / step) * step
  return hundredths > 0 && hundredths <= maxAmount ? hundredths : null
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
