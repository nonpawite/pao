import assert from 'node:assert/strict'
import { test } from 'node:test'

import { inviteAlphabet, newInviteCode, normalizeInviteCode, signupGate } from './invites.ts'

test('a new code is 8 characters from the unmistakable set, as XXXX-XXXX', () => {
  for (let i = 0; i < 200; i++) {
    const code = newInviteCode()
    assert.match(code, /^[A-Z0-9]{4}-[A-Z0-9]{4}$/)
    assert.ok([...code.replace('-', '')].every((c) => inviteAlphabet.includes(c)))
  }
})

test('the set leaves out letters and digits read as one another', () => {
  for (const c of ['0', 'O', '1', 'I', 'L']) assert.ok(!inviteAlphabet.includes(c))
})

test('a typed code ignores case, spaces and dashes', () => {
  assert.equal(normalizeInviteCode('k7qf-m2xp'), 'K7QF-M2XP')
  assert.equal(normalizeInviteCode(' K7QF M2XP '), 'K7QF-M2XP')
  assert.equal(normalizeInviteCode('K7QFM2XP'), 'K7QF-M2XP')
})

test('anything that cannot be a code is null', () => {
  assert.equal(normalizeInviteCode(''), null)
  assert.equal(normalizeInviteCode('K7QF-M2X'), null)
  assert.equal(normalizeInviteCode('K7QF-M2XP9'), null)
  assert.equal(normalizeInviteCode('K7QF-M2X0'), null)
})

test('who may sign up: anyone when open, the admin on an empty instance, else by invite', () => {
  assert.equal(signupGate(true, 5), 'open')
  assert.equal(signupGate(false, 0), 'first')
  assert.equal(signupGate(true, 0), 'open')
  assert.equal(signupGate(false, 3), 'invite')
})
