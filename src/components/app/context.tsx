import { createContext, useContext } from 'react'

import { formatDay, formatMonth, locales, translate } from '#/lib/i18n'
import type { CalendarNames, Locale, MessageKey } from '#/lib/i18n'
import { compactMoney, currencySymbol, formatMoney } from '#/lib/money'
import type { Shell } from '#/server/shell'

const ShellContext = createContext<Shell | null>(null)

export const ShellProvider = ShellContext.Provider

export function useShell() {
  const shell = useContext(ShellContext)
  if (!shell) throw new Error('useShell outside the app shell')
  return shell
}

/** Messages and dates in `locale`; `names` is the server's calendar table, so the browser renders what the server did. */
export function makeT(locale: Locale, names: CalendarNames) {
  return {
    locale,
    names,
    t: (key: MessageKey, vars?: Record<string, string | number>) => translate(locale, key, vars),
    day: (date: string, withWeekday = false) => formatDay(locale, names, date, withWeekday),
    range: (start: string, end: string) => `${formatDay(locale, names, start)} – ${formatDay(locale, names, end)}`,
    month: (month: string) => formatMonth(locale, names, month),
  }
}

export function useT() {
  const shell = useShell()
  return makeT(shell.user.locale, shell.names)
}

/** The user's language, or English outside the app shell (sign-in), for shared pieces like dialogs. */
export const useLocale = (): Locale => useContext(ShellContext)?.user.locale ?? 'en'

export function useActivePocket() {
  const shell = useShell()
  return shell.pockets.find((p) => p.id === shell.activePocketId) ?? shell.pockets[0]
}

/**
 * Amounts in the member's language and a pocket's currency: the active pocket's, or `currency` when given.
 * `money(n, { currency })` writes one amount in another pocket's currency.
 */
export function useMoney(currency?: string) {
  const tag = locales[useShell().user.locale].tag
  const active = useActivePocket()
  const bound = currency ?? active.currency
  return {
    money: (hundredths: number, opts: { sign?: boolean; symbol?: boolean; currency?: string } = {}) => formatMoney(hundredths, opts.currency ?? bound, tag, opts),
    compact: (hundredths: number) => compactMoney(hundredths, bound, tag),
    symbol: currencySymbol(bound, tag),
  }
}
