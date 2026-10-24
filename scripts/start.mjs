// Docker entry: creates the auth secret on first start (kept in the app-data volume), applies migrations, starts the server.
import { randomBytes } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'

const secretFile = '/app/data/auth-secret'
try {
  process.env.BETTER_AUTH_SECRET = readFileSync(secretFile, 'utf8')
} catch (error) {
  if (error.code !== 'ENOENT') throw error
  process.env.BETTER_AUTH_SECRET = randomBytes(32).toString('base64')
  writeFileSync(secretFile, process.env.BETTER_AUTH_SECRET, { mode: 0o600 })
  console.log('Auth secret created.')
}

await import('./migrate.mjs')
await import('../.output/server/index.mjs')
