import assert from 'node:assert/strict'
import { test } from 'node:test'

import { calendarNames, formatDay, formatMonth, localeCodes, ordinal, pickLocale } from './i18n.ts'
import type { CalendarNames } from './i18n.ts'

test('signup takes the first browser language the registry has', () => {
  assert.equal(pickLocale(['th-TH', 'en-US']), 'th')
  assert.equal(pickLocale(['TH']), 'th')
  assert.equal(pickLocale(['en-US', 'th']), 'en')
  assert.equal(pickLocale(['qaa-QM', 'th']), 'th')
})

// qaa to qtz are reserved for private use, so no translation will ever claim them.
test('a language the registry lacks falls back to English', () => {
  assert.equal(pickLocale(['qaa-QM', 'qtz']), 'en')
  assert.equal(pickLocale([]), 'en')
  // Stored codes go through the same door; prototype names are not languages.
  assert.equal(pickLocale(['constructor']), 'en')
})

test('English days of month take their ordinal suffix, Thai takes none', () => {
  const days = [1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 31]
  assert.deepEqual(
    days.map((n) => ordinal('en', n)),
    ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '31st'],
  )
  assert.deepEqual(
    days.map((n) => ordinal('th', n)),
    ['1', '2', '3', '4', '11', '12', '13', '21', '22', '23', '31'],
  )
})

// Engines name days differently ('Sep' or 'Sept', 'ศุกร์' or 'ศ.'): assert only what every engine agrees on.
test('calendar names come from the platform, weeks Monday first', () => {
  for (const locale of localeCodes) {
    const names = calendarNames(locale)
    assert.equal(new Set(names.months).size, 12)
    assert.equal(new Set(names.monthsLong).size, 12)
    assert.equal(new Set(names.weekdays).size, 7)
    assert.equal(new Set(names.weekdaysLong).size, 7)
    assert.equal(names.weekdayInitials.length, 7)
  }
  assert.deepEqual(calendarNames('en').weekdays, ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
  assert.equal(calendarNames('en').yearOffset, 0)
  // Thai counts years in the Buddhist era: 2026 is 2569.
  assert.equal(calendarNames('th').yearOffset, 543)
})

const names: CalendarNames = {
  months: ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9', 'm10', 'm11', 'm12'],
  monthsLong: ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8', 'M9', 'M10', 'M11', 'M12'],
  weekdays: ['w1', 'w2', 'w3', 'w4', 'w5', 'w6', 'w7'],
  weekdaysLong: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7'],
  weekdayInitials: ['i1', 'i2', 'i3', 'i4', 'i5', 'i6', 'i7'],
  yearOffset: 543,
}

test("dates set the shipped names in the language's word order", () => {
  // 16 Oct 2026 is a Friday, day five of a Monday-first week; 1 Mar 2026 is a Sunday.
  assert.equal(formatDay('en', names, '2026-10-16'), '16 m10')
  assert.equal(formatDay('en', names, '2026-10-16', true), 'w5 16 m10')
  assert.equal(formatDay('th', names, '2026-03-01', true), 'w7 1 m3')
  assert.equal(formatMonth('th', names, '2026-10'), 'M10 2569')
})
