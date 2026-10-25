import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { tanstackStartCookies } from 'better-auth/tanstack-start'

import { db } from '../db/index.ts'
import * as schema from '../db/schema.ts'

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg', schema }),
  emailAndPassword: {
    enabled: true,
    // Household instance: turn sign-up off once everyone has an account.
    disableSignUp: process.env.ALLOW_SIGNUP === 'false',
  },
  user: {
    additionalFields: {
      locale: { type: 'string', defaultValue: 'en', input: true },
      weekStart: { type: 'number', defaultValue: 0, input: false },
    },
  },
  advanced: {
    // Browsers drop Secure cookies over plain http (http://<LAN IP>:3000), so only an HTTPS address gets them.
    useSecureCookies: process.env.BETTER_AUTH_URL?.startsWith('https://') ?? false,
  },
  plugins: [tanstackStartCookies()],
})
