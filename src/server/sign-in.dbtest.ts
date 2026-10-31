// Sign-in through Better Auth's real HTTP handler against real Postgres. Run with `bun run test:db`; see CONTRIBUTING.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash, createHmac, createSign, generateKeyPairSync, randomBytes, randomUUID } from 'node:crypto'
import { test } from 'node:test'

import { eq } from 'drizzle-orm'

import { db } from '../db/index.ts'
import { passkey, twoFactor, user } from '../db/schema.ts'
import { auth } from '../lib/auth.ts'

const origin = process.env.BETTER_AUTH_URL!

/** One device: keeps its own cookies and sends what a browser would send. */
function device() {
  const cookies = new Map<string, string>()
  const send = async (method: string, path: string, body?: object) => {
    const res = await auth.handler(
      new Request(`${origin}/api/auth${path}`, {
        method,
        headers: {
          origin,
          'content-type': 'application/json',
          cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join('; '),
        },
        body: body && JSON.stringify(body),
      }),
    )
    for (const line of res.headers.getSetCookie()) {
      const [pair] = line.split(';')
      const at = pair.indexOf('=')
      if (/max-age=0/i.test(line) || pair.slice(at + 1) === '') cookies.delete(pair.slice(0, at))
      else cookies.set(pair.slice(0, at), pair.slice(at + 1))
    }
    const text = await res.text()
    return { status: res.status, data: text ? JSON.parse(text) : null }
  }
  return {
    post: (path: string, body: object = {}) => send('POST', path, body),
    get: (path: string) => send('GET', path),
    signedIn: async () => !!(await send('GET', '/get-session')).data?.session,
  }
}

const password = 'correct-horse-9'

/** A new member, signed in on the returned device. */
async function newMember() {
  const email = `${randomUUID()}@example.com`
  const phone = device()
  const res = await phone.post('/sign-up/email', { email, password, name: 'Test member' })
  assert.equal(res.status, 200)
  return { email, phone, signIn: (on = device()) => on.post('/sign-in/email', { email, password }).then((r) => ({ ...r, on })) }
}

/** What an authenticator app computes from the scanned QR code (RFC 6238). */
function appCode(totpURI: string) {
  const secret = new URL(totpURI).searchParams.get('secret')!
  let bits = ''
  for (const c of secret.replace(/=+$/, '')) bits += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.indexOf(c).toString(2).padStart(5, '0')
  const key = Buffer.from((bits.match(/.{8}/g) ?? []).map((b) => parseInt(b, 2)))
  const step = Buffer.alloc(8)
  step.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)))
  const mac = createHmac('sha1', key).update(step).digest()
  const at = mac[19] & 0xf
  return String((mac.readUInt32BE(at) & 0x7fffffff) % 1_000_000).padStart(6, '0')
}

/** A member who finished turning on two-step sign-in. */
async function memberWithTwoStep() {
  const member = await newMember()
  const { data } = await member.phone.post('/two-factor/enable', { password })
  const verified = await member.phone.post('/two-factor/verify-totp', { code: appCode(data.totpURI) })
  assert.equal(verified.status, 200)
  return { ...member, totpURI: data.totpURI as string, backupCodes: data.backupCodes as string[] }
}

test('with two-step sign-in on, the right password alone gives no session', async () => {
  const member = await memberWithTwoStep()
  const { data, on } = await member.signIn()
  assert.equal(data.twoFactorRedirect, true)
  assert.equal(await on.signedIn(), false)
})

test('a member with neither feature signs in with a password, as before', async () => {
  const member = await newMember()
  const { data, on } = await member.signIn()
  assert.notEqual(data.twoFactorRedirect, true)
  assert.equal(await on.signedIn(), true)
})

test('the second step takes the right code and refuses a wrong one', async () => {
  const member = await memberWithTwoStep()
  const { on } = await member.signIn()
  const wrong = await on.post('/two-factor/verify-totp', { code: appCode(member.totpURI) === '000000' ? '000001' : '000000' })
  assert.equal(wrong.data.code, 'INVALID_CODE')
  assert.equal(await on.signedIn(), false)
  await on.post('/two-factor/verify-totp', { code: appCode(member.totpURI) })
  assert.equal(await on.signedIn(), true)
})

test('a backup code signs in once and fails the second time', async () => {
  const member = await memberWithTwoStep()
  assert.equal(member.backupCodes.length, 10)
  const first = await member.signIn()
  await first.on.post('/two-factor/verify-backup-code', { code: member.backupCodes[0] })
  assert.equal(await first.on.signedIn(), true)
  const second = await member.signIn()
  const again = await second.on.post('/two-factor/verify-backup-code', { code: member.backupCodes[0] })
  assert.equal(again.data.code, 'INVALID_BACKUP_CODE')
  assert.equal(await second.on.signedIn(), false)
})

test('backup codes are not stored as plain text', async () => {
  const member = await memberWithTwoStep()
  const [row] = await db.select({ backupCodes: twoFactor.backupCodes }).from(twoFactor).innerJoin(user, eq(user.id, twoFactor.userId)).where(eq(user.email, member.email))
  for (const code of member.backupCodes) assert.ok(!row.backupCodes.includes(code))
})

test('turning on two-step sign-in signs out other devices and keeps this one', async () => {
  const member = await newMember()
  const { on: laptop } = await member.signIn()
  const { data } = await member.phone.post('/two-factor/enable', { password })
  assert.equal(await laptop.signedIn(), true)
  await member.phone.post('/two-factor/verify-totp', { code: appCode(data.totpURI) })
  assert.equal(await laptop.signedIn(), false)
  assert.equal(await member.phone.signedIn(), true)
})

test('setup left unfinished keeps two-step sign-in off', async () => {
  const member = await newMember()
  await member.phone.post('/two-factor/enable', { password })
  const { on } = await member.signIn()
  assert.equal(await on.signedIn(), true)
})

test('turning on and off need the current password', async () => {
  const member = await newMember()
  const refused = await member.phone.post('/two-factor/enable', { password: 'not-the-password' })
  assert.equal(refused.data.code, 'INVALID_PASSWORD')

  const on = await memberWithTwoStep()
  const stays = await on.phone.post('/two-factor/disable', { password: 'not-the-password' })
  assert.equal(stays.data.code, 'INVALID_PASSWORD')
  assert.equal((await on.signIn()).data.twoFactorRedirect, true)
  await on.phone.post('/two-factor/disable', { password })
  assert.notEqual((await on.signIn()).data.twoFactorRedirect, true)
})

test('new backup codes need the password and replace the old ones', async () => {
  const member = await memberWithTwoStep()
  const refused = await member.phone.post('/two-factor/generate-backup-codes', { password: 'not-the-password' })
  assert.equal(refused.data.code, 'INVALID_PASSWORD')
  const { data } = await member.phone.post('/two-factor/generate-backup-codes', { password })
  const { on } = await member.signIn()
  const old = await on.post('/two-factor/verify-backup-code', { code: member.backupCodes[0] })
  assert.equal(old.data.code, 'INVALID_BACKUP_CODE')
  await on.post('/two-factor/verify-backup-code', { code: data.backupCodes[0] })
  assert.equal(await on.signedIn(), true)
})

test('a passkey must be findable without an email and verify the person, on this address', async () => {
  const member = await newMember()
  const { status, data } = await member.phone.get('/passkey/generate-register-options')
  assert.equal(status, 200)
  assert.equal(data.rp.id, new URL(origin).hostname)
  assert.equal(data.authenticatorSelection.residentKey, 'required')
  assert.equal(data.authenticatorSelection.userVerification, 'required')
})

/** Runs the recovery command the way a self-hoster does. */
function resetSignIn(email: string) {
  const run = spawnSync('bun', ['scripts/reset-sign-in.mjs', email], { encoding: 'utf8' })
  return { exit: run.status, err: run.stderr, temporary: /Temporary password: (\S+)/.exec(run.stdout)?.[1] }
}

const addPasskeyRow = (userId: string) =>
  db.insert(passkey).values({ id: randomUUID(), userId, publicKey: 'key', credentialID: randomUUID(), counter: 0, deviceType: 'singleDevice', backedUp: false })

test('the recovery command clears everything for that member and hands back a way in', async () => {
  const member = await memberWithTwoStep()
  const { on: lostPhone } = await member.signIn().then(async (s) => {
    await s.on.post('/two-factor/verify-totp', { code: appCode(member.totpURI) })
    return s
  })
  const [row] = await db.select({ id: user.id }).from(user).where(eq(user.email, member.email))
  await addPasskeyRow(row.id)

  const other = await memberWithTwoStep()
  const [otherRow] = await db.select({ id: user.id }).from(user).where(eq(user.email, other.email))
  await addPasskeyRow(otherRow.id)

  const { exit, temporary } = resetSignIn(member.email)
  assert.equal(exit, 0)
  assert.ok(temporary && temporary.length >= 16)

  assert.equal(await lostPhone.signedIn(), false)
  assert.equal(await member.phone.signedIn(), false)
  assert.equal((await member.signIn()).data.code, 'INVALID_EMAIL_OR_PASSWORD')

  const back = device()
  await back.post('/sign-in/email', { email: member.email, password: temporary })
  assert.equal(await back.signedIn(), true)
  assert.deepEqual((await back.get('/passkey/list-user-passkeys')).data, [])
  // They can set it all up again the usual way.
  assert.equal((await back.post('/two-factor/enable', { password: temporary })).status, 200)

  // Nobody else is touched.
  assert.equal(await other.phone.signedIn(), true)
  assert.equal((await other.signIn()).data.twoFactorRedirect, true)
  assert.equal((await other.phone.get('/passkey/list-user-passkeys')).data.length, 1)
})

test('the recovery command changes nothing for an unknown email', async () => {
  const member = await newMember()
  const { exit, err, temporary } = resetSignIn(`typo-${member.email}`)
  assert.equal(exit, 1)
  assert.match(err, /No member uses/)
  assert.equal(temporary, undefined)
  assert.equal(await member.phone.signedIn(), true)
})

/** A software passkey: signs what the server asks, and says whether it verified the person. */
async function softwarePasskey(userId: string) {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' })
  const jwk = publicKey.export({ format: 'jwk' })
  // COSE EC2 P-256 key: kty 2, alg -7, crv 1, x, y.
  const cose = Buffer.concat([Buffer.from('a5010203262001215820', 'hex'), Buffer.from(jwk.x!, 'base64url'), Buffer.from('225820', 'hex'), Buffer.from(jwk.y!, 'base64url')])
  const id = randomBytes(16).toString('base64url')
  await db.insert(passkey).values({ id: randomUUID(), userId, publicKey: cose.toString('base64'), credentialID: id, counter: 0, deviceType: 'singleDevice', backedUp: false })
  const sha256 = (data: Buffer | string) => createHash('sha256').update(data).digest()

  return async (on: ReturnType<typeof device>, verifiedPerson: boolean) => {
    const { data: options } = await on.get('/passkey/generate-authenticate-options')
    const clientData = Buffer.from(JSON.stringify({ type: 'webauthn.get', challenge: options.challenge, origin }))
    const flags = Buffer.from([verifiedPerson ? 0x05 : 0x01])
    const authData = Buffer.concat([sha256(options.rpId), flags, Buffer.from([0, 0, 0, 1])])
    const signature = createSign('sha256').update(authData).update(sha256(clientData)).sign(privateKey)
    return on.post('/passkey/verify-authentication', {
      response: {
        id,
        rawId: id,
        type: 'public-key',
        clientExtensionResults: {},
        response: { clientDataJSON: clientData.toString('base64url'), authenticatorData: authData.toString('base64url'), signature: signature.toString('base64url') },
      },
    })
  }
}

const memberId = async (email: string) => (await db.select({ id: user.id }).from(user).where(eq(user.email, email)))[0].id

test('a passkey that verified the person signs in with no password or code', async () => {
  const member = await memberWithTwoStep()
  const signInWith = await softwarePasskey(await memberId(member.email))
  const on = device()
  assert.equal((await signInWith(on, true)).status, 200)
  assert.equal(await on.signedIn(), true)
})

test('a passkey that did not verify the person is refused, with no session', async () => {
  const member = await newMember()
  const signInWith = await softwarePasskey(await memberId(member.email))
  const on = device()
  const res = await signInWith(on, false)
  assert.equal(res.data.code, 'PASSKEY_NOT_VERIFIED')
  assert.equal(await on.signedIn(), false)
})
