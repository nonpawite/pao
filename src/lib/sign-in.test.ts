import assert from 'node:assert/strict'
import { test } from 'node:test'

import { requireVerifiedPerson } from './sign-in.ts'

test('a passkey counts only when the device verified the person', () => {
  assert.doesNotThrow(() => requireVerifiedPerson(true))
  assert.throws(() => requireVerifiedPerson(false), (e: { body: { code: string } }) => e.body.code === 'PASSKEY_NOT_VERIFIED')
})
