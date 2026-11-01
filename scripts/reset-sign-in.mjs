// Gets a locked-out member back in (ADR 0003): clears their 2FA and passkeys, signs them out everywhere,
// and prints a temporary password. Usage: bun scripts/reset-sign-in.mjs <email>
import { randomBytes } from 'node:crypto'

import { hashPassword } from 'better-auth/crypto'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'

const email = process.argv[2]?.trim().toLowerCase()
if (!email) {
  console.error('Usage: bun scripts/reset-sign-in.mjs <email>')
  process.exit(1)
}

const temporary = randomBytes(12).toString('base64url')
const hashed = await hashPassword(temporary)
const db = drizzle(process.env.DATABASE_URL)

const found = await db.transaction(async (tx) => {
  const { rows } = await tx.execute(sql`SELECT id FROM "user" WHERE email = ${email}`)
  if (!rows.length) return false
  const id = rows[0].id
  await tx.execute(sql`DELETE FROM two_factor WHERE user_id = ${id}`)
  await tx.execute(sql`UPDATE "user" SET two_factor_enabled = false, updated_at = now() WHERE id = ${id}`)
  await tx.execute(sql`DELETE FROM passkey WHERE user_id = ${id}`)
  await tx.execute(sql`DELETE FROM session WHERE user_id = ${id}`)
  const { rowCount } = await tx.execute(sql`UPDATE account SET password = ${hashed}, updated_at = now() WHERE user_id = ${id} AND provider_id = 'credential'`)
  // Every member signs up with a password; rolling back beats leaving someone with no way in.
  if (rowCount !== 1) throw new Error(`${email} has no password to replace. Nothing changed.`)
  return true
})
await db.$client.end()

if (!found) {
  console.error(`No member uses ${email}. Nothing changed.`)
  process.exit(1)
}
console.log(`${email}: 2FA and passkeys cleared, signed out everywhere.`)
console.log(`Temporary password: ${temporary}`)
console.log('Ask them to change it in Settings after signing in.')
