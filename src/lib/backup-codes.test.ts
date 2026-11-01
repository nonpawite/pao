import assert from 'node:assert/strict'
import { test } from 'node:test'

import { newBackupCodes, normalizeBackupCode } from './backup-codes.ts'

test('backup codes are ten different codes with nothing that reads as something else', () => {
  const codes = newBackupCodes()
  assert.equal(new Set(codes).size, 10)
  for (const code of codes) assert.match(code, /^[A-HJKMNP-Z2-9]{5}-[A-HJKMNP-Z2-9]{5}$/)
})

test('a backup code still counts when typed in lower case, with spaces or without its dash', () => {
  for (const typed of ['abcde-fghjk', 'ABCDEFGHJK', ' abcde fghjk ']) assert.equal(normalizeBackupCode(typed), 'ABCDE-FGHJK')
})

test('a typed code of the wrong length goes through as typed, for the server to refuse', () => {
  assert.equal(normalizeBackupCode(' abc '), 'abc')
})
