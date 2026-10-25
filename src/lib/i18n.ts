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

/** A case-insensitive pattern for a word-list message ('coffee|cafe'): its words in every shipped language. */
export const wordPattern = (key: MessageKey) =>
  new RegExp(Object.values(locales).flatMap((l) => l.messages[key].split('|')).filter(Boolean).join('|'), 'i')

const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

/** A name's initials, for a pocket card: the first letter of its first two words. A Thai leading vowel (เ แ โ ใ ไ) is
 * written before its consonant, so the consonant stands for the word, with its marks. */
export const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => (graphemes.segment(word.replace(/^[\u0E40-\u0E44]/, ''))[Symbol.iterator]().next().value?.segment ?? '').toLocaleUpperCase())
    .join('')

const ordinalKeys: Partial<Record<Intl.LDMLPluralRule, MessageKey>> = { one: 'ordinalOne', two: 'ordinalTwo', few: 'ordinalFew' }

/** Day of month for the cycle start picker: 1st, 2nd, 23rd; Thai uses the number alone. */
export const ordinal = (locale: Locale, n: number) =>
  translate(locale, ordinalKeys[new Intl.PluralRules(locales[locale].tag, { type: 'ordinal' }).select(n)] ?? 'ordinalOther', { n })

/** Dates are plain calendar days, so they format in UTC whatever the device's zone. */
const dateFormat = (tag: string, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(tag, { ...options, timeZone: 'UTC' })

// 19 Oct 2026 is a Monday.
const week = Array.from({ length: 7 }, (_, i) => Date.UTC(2026, 9, 19 + i))
const year = Array.from({ length: 12 }, (_, i) => Date.UTC(2026, i, 1))

/**
 * Month and weekday names from the platform, January and Monday first. Engines ship different names ('Sep' or
 * 'Sept'), so the server builds this table and the browser formats from the server's copy: both render the same text.
 */
export function calendarNames(locale: Locale) {
  const { tag } = locales[locale]
  const names = (dates: number[], options: Intl.DateTimeFormatOptions) => dates.map(dateFormat(tag, options).format)
  const year2026 = dateFormat(tag, { year: 'numeric' }).formatToParts(year[0]).find((p) => p.type === 'year')!.value
  return {
    months: names(year, { month: 'short' }),
    monthsLong: names(year, { month: 'long' }),
    weekdays: names(week, { weekday: 'short' }),
    weekdaysLong: names(week, { weekday: 'long' }),
    weekdayInitials: names(week, { weekday: 'narrow' }),
    // What the language's calendar adds to the year: 543 for Thai's Buddhist era.
    yearOffset: Number(year2026) - 2026,
  }
}

export type CalendarNames = ReturnType<typeof calendarNames>

/** '2026-10-16' to '16 Oct' / '16 ต.ค.'; with weekday: 'Fri 16 Oct'. Word order comes from the messages file. */
export function formatDay(locale: Locale, names: CalendarNames, date: string, withWeekday = false) {
  const [y, m, d] = date.split('-').map(Number)
  const vars = { day: d, month: names.months[m - 1], weekday: names.weekdays[(new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7] }
  return translate(locale, withWeekday ? 'dateWeekday' : 'dateDay', vars)
}

/** '2026-10' to 'October 2026' / 'ตุลาคม 2569'. */
export function formatMonth(locale: Locale, names: CalendarNames, month: string) {
  const [y, m] = month.split('-').map(Number)
  return translate(locale, 'dateMonth', { month: names.monthsLong[m - 1], year: y + names.yearOffset })
}
