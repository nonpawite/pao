import assert from 'node:assert/strict'
import { test } from 'node:test'

import { formatDay, monthNames, ordinal, pickLocale, weekdayInitials, weekdayNames } from './i18n.ts'

test('signup takes the first browser language the registry has', () => {
  assert.equal(pickLocale(['th-TH', 'en-US']), 'th')
  assert.equal(pickLocale(['TH']), 'th')
  assert.equal(pickLocale(['en-US', 'th']), 'en')
  assert.equal(pickLocale(['fr-FR', 'th']), 'th')
})

test('a language the registry lacks falls back to English', () => {
  assert.equal(pickLocale(['fr-FR', 'de']), 'en')
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

// September is left out of English cases: engines disagree on en-GB 'Sep' and 'Sept'.
test('English dates keep en-GB conventions', () => {
  assert.equal(formatDay('en', '2026-10-16'), '16 Oct')
  assert.equal(formatDay('en', '2026-10-16', true), 'Fri 16 Oct')
  assert.deepEqual([monthNames('en')[0], monthNames('en')[11]], ['Jan', 'Dec'])
  assert.deepEqual(weekdayNames('en'), ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
  assert.deepEqual(weekdayInitials('en'), ['M', 'T', 'W', 'T', 'F', 'S', 'S'])
})

test('Thai month and weekday names come from the platform', () => {
  assert.equal(formatDay('th', '2026-10-16'), '16 ต.ค.')
  assert.equal(formatDay('th', '2026-10-16', true), 'ศุกร์ 16 ต.ค.')
  assert.deepEqual(monthNames('th'), ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'])
  assert.deepEqual(weekdayNames('th'), ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัส', 'ศุกร์', 'เสาร์', 'อาทิตย์'])
  assert.deepEqual(weekdayInitials('th'), ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'])
})
