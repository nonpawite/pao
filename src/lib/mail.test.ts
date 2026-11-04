import assert from 'node:assert/strict'
import { test } from 'node:test'

import { mailSettings } from './mail.ts'

const url = 'https://pao.example.com'

test('email stays off without an SMTP server or a fixed public address', () => {
  assert.equal(mailSettings({}), null)
  assert.equal(mailSettings({ SMTP_URL: 'smtps://me%40example.com:pw@smtp.example.com' }), null)
  assert.equal(mailSettings({ BETTER_AUTH_URL: url }), null)
  assert.equal(mailSettings({ SMTP_URL: 'not a url', BETTER_AUTH_URL: url, MAIL_FROM: 'a@b.c' }), null)
})

test('the sender is MAIL_FROM, else the SMTP user when it is an address', () => {
  assert.equal(mailSettings({ SMTP_URL: 'smtps://me%40example.com:pw@smtp.example.com', BETTER_AUTH_URL: url })?.from, 'Pao <me@example.com>')
  assert.equal(mailSettings({ SMTP_URL: 'smtps://apikey:pw@smtp.example.com', BETTER_AUTH_URL: url, MAIL_FROM: 'Pao <pao@example.com>' })?.from, 'Pao <pao@example.com>')
  // A user that isn't an address gives no sender, so email stays off rather than every message bouncing.
  assert.equal(mailSettings({ SMTP_URL: 'smtps://apikey:pw@smtp.example.com', BETTER_AUTH_URL: url }), null)
})
