import assert from 'node:assert/strict'
import { test } from 'node:test'

import { compactMoney, currencySymbol, defaultCurrency, formatMoney, isCurrency, parseAmount, totalsByCurrency } from './money.ts'

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

test('THB axis ticks shorten thousands to K, the same in English and Thai', () => {
  for (const locale of ['en-GB', 'th-TH']) {
    assert.equal(compactMoney(0, 'THB', locale), '\u0e3f0')
    assert.equal(compactMoney(85_000, 'THB', locale), '\u0e3f850')
    assert.equal(compactMoney(100_000, 'THB', locale), '\u0e3f1K')
    assert.equal(compactMoney(128_400, 'THB', locale), '\u0e3f1.3K')
    assert.equal(compactMoney(1_500_000, 'THB', locale), '\u0e3f15K')
  }
})

test('axis ticks write the pocket currency where its amounts put it', () => {
  for (const locale of ['en-GB', 'th-TH']) {
    assert.equal(compactMoney(85_000, 'JPY', locale), '\u00a5850')
    assert.equal(compactMoney(4_500_000, 'JPY', locale), '\u00a545K')
    assert.equal(compactMoney(128_400, 'CHF', locale), 'CHF\u00a01.3K')
  }
})

test('parsing sums and thousands separators', () => {
  assert.equal(parseAmount('65', 'THB'), 6_500)
  assert.equal(parseAmount('120+45', 'THB'), 16_500)
  assert.equal(parseAmount('120+45+30', 'THB'), 19_500)
  assert.equal(parseAmount('120 + 45.50', 'THB'), 16_550)
  assert.equal(parseAmount('1,250.50', 'THB'), 125_050)
  assert.equal(parseAmount('1 250', 'THB'), 125_000)
})

test('parsing ignores a leading or trailing symbol of any currency', () => {
  assert.equal(parseAmount('฿65', 'THB'), 6_500)
  assert.equal(parseAmount('$12.50', 'THB'), 1_250)
  assert.equal(parseAmount('12.50 €', 'THB'), 1_250)
  assert.equal(parseAmount('¥1,000', 'THB'), 100_000)
  assert.equal(parseAmount('US$12', 'THB'), 1_200)
  assert.equal(parseAmount('CHF 12', 'THB'), 1_200)
  assert.equal(parseAmount('12 KWD', 'THB'), 1_200)
  assert.equal(parseAmount('USD 12', 'THB'), 1_200)
  assert.equal(parseAmount('KWD 12.5', 'THB'), 1_250)
  assert.equal(parseAmount('12 US$', 'THB'), 1_200)
  assert.equal(parseAmount('฿120+฿45', 'THB'), 16_500)
})

test('parsing rejects junk', () => {
  for (const junk of ['', '0', 'abc', '$', '12-3', '12+', '1.234', '12..5', '1e3', '12abc3', '12abc', '12 xyz', 'abc12', 'xyz$12']) {
    assert.equal(parseAmount(junk, 'THB'), null, junk)
  }
})

test('parsing keeps the decimals the currency shows, so rows and totals agree', () => {
  assert.equal(parseAmount('12.5', 'JPY'), 1_300)
  assert.equal(formatMoney(2 * parseAmount('12.5', 'JPY')!, 'JPY', 'en-GB'), '¥26')
  // The typed sum is one amount: 12.4 + 0.4 is ¥12.8, shown as ¥13.
  assert.equal(parseAmount('12.4+0.4', 'JPY'), 1_300)
  assert.equal(parseAmount('0.4', 'JPY'), null)
  assert.equal(parseAmount('12.55', 'KWD'), 1_255)
  assert.equal(parseAmount('12.55', 'USD'), 1_255)
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

test('a currency is an ISO 4217 code the platform knows', () => {
  for (const code of ['THB', 'USD', 'JPY', 'CHF', 'KWD']) assert.equal(isCurrency(code), true)
  for (const code of ['', 'thb', 'BAHT', 'XYZ', '฿', 'TH']) assert.equal(isCurrency(code), false)
})

test('the instance default currency falls back to USD when unset or unknown', () => {
  assert.equal(defaultCurrency('JPY'), 'JPY')
  assert.equal(defaultCurrency(' thb '), 'THB')
  assert.equal(defaultCurrency(undefined), 'USD')
  assert.equal(defaultCurrency(''), 'USD')
  assert.equal(defaultCurrency('BAHT'), 'USD')
})

test('the currency symbol is the one formatted amounts use', () => {
  for (const locale of ['en-GB', 'th-TH']) {
    assert.equal(currencySymbol('THB', locale), '฿')
    assert.equal(currencySymbol('USD', locale), '$')
    assert.equal(currencySymbol('JPY', locale), '¥')
    assert.equal(currencySymbol('CHF', locale), 'CHF')
  }
})
