// Pure money logic. Amounts are integer hundredths in the pocket's ISO 4217 currency, never converted.

import { locales } from './i18n.ts'

const currencyStyle = (currency: string) => ({ style: 'currency', currency, currencyDisplay: 'narrowSymbol' }) as const

/** The decimals an amount in `currency` shows: its own (JPY 0, USD 2, KWD 3), at most 2. */
const shownDigits = (currency: string) =>
  // Capped at 2 because amounts are integer hundredths (ADR 0001).
  Math.min(2, new Intl.NumberFormat('en', currencyStyle(currency)).resolvedOptions().maximumFractionDigits ?? 2)

/** Format hundredths in `currency` for an Intl locale tag such as 'th-TH' or 'en-GB'. */
export function formatMoney(hundredths: number, currency: string, locale: string, opts: { sign?: boolean } = {}) {
  const abs = Math.abs(hundredths)
  const style = currencyStyle(currency)
  const digits = shownDigits(currency)
  const n = new Intl.NumberFormat(locale, {
    ...style,
    minimumFractionDigits: abs % 100 === 0 ? 0 : digits,
    maximumFractionDigits: digits,
  }).format(abs / 100)
  const sign = hundredths < 0 ? '−' : opts.sign ? '+' : ''
  return `${sign}${n}`
}

/** Whole units with thousands as K, for chart axes: ฿1,284 → ฿1.3K, ¥850. */
export function compactMoney(hundredths: number, currency: string, locale: string) {
  const units = hundredths / 100
  const n = units >= 1000 ? `${(units / 1000).toFixed(units >= 10000 ? 0 : 1).replace(/\.0$/, '')}K` : `${Math.round(units)}`
  // The symbol sits where formatMoney puts it (฿0, CHF 0).
  return formatMoney(0, currency, locale).replace('0', n)
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
