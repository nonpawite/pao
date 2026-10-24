import assert from 'node:assert/strict'
import { test } from 'node:test'

import { formatMoney, parseAmount, totalsByCurrency } from './money.ts'

test('THB looks the same in English and Thai', () => {
  for (const locale of ['en-GB', 'th-TH']) {
    assert.equal(formatMoney(123_400, 'THB', locale), '฿1,234')
    assert.equal(formatMoney(1_250, 'THB', locale), '฿12.50')
  }
})

test('negatives get a minus sign; the sign option adds a plus', () => {
  for (const locale of ['en-GB', 'th-TH']) {
    assert.equal(formatMoney(-500, 'THB', locale), '−฿5')
    assert.equal(formatMoney(-500, 'THB', locale, { sign: true }), '−฿5')
    assert.equal(formatMoney(500, 'THB', locale, { sign: true }), '+฿5')
    assert.equal(formatMoney(1_250, 'USD', locale, { sign: true }), '+$12.50')
  }
})

test('USD shows cents only when there are some', () => {
  for (const locale of ['en-GB', 'th-TH']) {
    assert.equal(formatMoney(123_400, 'USD', locale), '$1,234')
    assert.equal(formatMoney(5, 'USD', locale), '$0.05')
  }
})

test('JPY shows no decimals', () => {
  for (const locale of ['en-GB', 'th-TH']) {
    assert.equal(formatMoney(100_000, 'JPY', locale), '¥1,000')
    assert.equal(formatMoney(12_340, 'JPY', locale), '¥123')
    assert.equal(formatMoney(-12_350, 'JPY', locale), '−¥124')
  }
})

test('KWD is limited to 2 decimals', () => {
  for (const locale of ['en-GB', 'th-TH']) {
    assert.equal(formatMoney(1_250, 'KWD', locale), 'KWD\u00a012.50')
    assert.equal(formatMoney(1_200, 'KWD', locale), 'KWD\u00a012')
    assert.equal(formatMoney(1_250, 'KWD', locale, { sign: true }), '+KWD\u00a012.50')
  }
})

test('parsing sums and thousands separators', () => {
  assert.equal(parseAmount('65'), 6_500)
  assert.equal(parseAmount('120+45'), 16_500)
  assert.equal(parseAmount('120 + 45.50'), 16_550)
  assert.equal(parseAmount('1,250.50'), 125_050)
  assert.equal(parseAmount('1 250'), 125_000)
})

test('parsing ignores a leading or trailing symbol of any currency', () => {
  assert.equal(parseAmount('\u0e3f65'), 6_500)
  assert.equal(parseAmount('$12.50'), 1_250)
  assert.equal(parseAmount('12.50 \u20ac'), 1_250)
  assert.equal(parseAmount('\u00a51,000'), 100_000)
  assert.equal(parseAmount('US$12'), 1_200)
  assert.equal(parseAmount('CHF 12'), 1_200)
  assert.equal(parseAmount('12 KWD'), 1_200)
  assert.equal(parseAmount('\u0e3f120+\u0e3f45'), 16_500)
})

test('parsing rejects junk', () => {
  for (const junk of ['', '0', 'abc', '$', '12-3', '12+', '1.234', '12..5', '1e3', '12abc3']) {
    assert.equal(parseAmount(junk), null, junk)
  }
})

test('pockets in one currency give one total', () => {
  const pockets = [
    { currency: 'THB', total: 10_000 },
    { currency: 'THB', total: 25_050 },
  ]
  assert.deepEqual(totalsByCurrency(pockets), [{ currency: 'THB', total: 35_050 }])
})

test('mixed currencies give one total each, never a sum', () => {
  const pockets = [
    { currency: 'THB', total: 10_000 },
    { currency: 'JPY', total: 500_000 },
    { currency: 'THB', total: 25_050 },
  ]
  assert.deepEqual(totalsByCurrency(pockets), [
    { currency: 'THB', total: 35_050 },
    { currency: 'JPY', total: 500_000 },
  ])
})

test('no pockets give no totals', () => {
  assert.deepEqual(totalsByCurrency([]), [])
})
