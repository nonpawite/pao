import { en } from './messages/en.ts'
import type { MessageKey, Messages } from './messages/en.ts'
import { th } from './messages/th.ts'

export type { MessageKey }

/**
 * Every language the instance ships: code, native name, platform locale tag and messages.
 * A new language is one messages file in ./messages plus one entry here.
 */
export const locales = {
  en: { name: 'English', tag: 'en-GB', messages: en },
  th: { name: 'ไทย', tag: 'th-TH', messages: th },
} satisfies Record<string, { name: string; tag: string; messages: Messages }>

export type Locale = keyof typeof locales

export const localeCodes = Object.keys(locales) as Locale[]

/** The first of these language tags (browser or stored) that the registry has, otherwise English. */
export const pickLocale = (tags: readonly string[]): Locale =>
  tags.map((tag) => tag.toLowerCase().split('-')[0]).find((code): code is Locale => Object.hasOwn(locales, code)) ?? 'en'

export function translate(locale: Locale, key: MessageKey, vars?: Record<string, string | number>) {
  let s: string = locales[locale].messages[key]
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v))
  return s
}

const ordinalKeys: Partial<Record<Intl.LDMLPluralRule, MessageKey>> = { one: 'ordinalOne', two: 'ordinalTwo', few: 'ordinalFew' }

/** Day of month for the cycle start picker: 1st, 2nd, 23rd; Thai uses the number alone. */
export const ordinal = (locale: Locale, n: number) =>
  translate(locale, ordinalKeys[new Intl.PluralRules(locales[locale].tag, { type: 'ordinal' }).select(n)] ?? 'ordinalOther', { n })

/** Dates are plain calendar days, so they format in UTC whatever the device's zone. */
const dateFormat = (locale: Locale, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(locales[locale].tag, { ...options, timeZone: 'UTC' }).format

// 19 Oct 2026 is a Monday.
const week = Array.from({ length: 7 }, (_, i) => Date.UTC(2026, 9, 19 + i))
const year = Array.from({ length: 12 }, (_, i) => Date.UTC(2026, i, 1))

/** Short weekday names, Monday first. */
export const weekdayNames = (locale: Locale) => week.map(dateFormat(locale, { weekday: 'short' }))

/** One-letter weekday names, Monday first. */
export const weekdayInitials = (locale: Locale) => week.map(dateFormat(locale, { weekday: 'narrow' }))

/** Short month names, January first. */
export const monthNames = (locale: Locale) => year.map(dateFormat(locale, { month: 'short' }))

/** '2026-10-16' to '16 Oct' / '16 ต.ค.'; with weekday: 'Fri 16 Oct'. */
export function formatDay(locale: Locale, date: string, withWeekday = false) {
  const [y, m, d] = date.split('-').map(Number)
  return dateFormat(locale, { weekday: withWeekday ? 'short' : undefined, day: 'numeric', month: 'short' })(Date.UTC(y, m - 1, d))
}
