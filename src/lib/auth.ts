import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { tanstackStartCookies } from 'better-auth/tanstack-start'

import { db } from '../db/index.ts'
import * as schema from '../db/schema.ts'
import { createPersonalSpace } from '../server/setup.ts'

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg', schema }),
  emailAndPassword: {
    enabled: true,
    // Family instance: turn sign-up off once everyone has an account.
    disableSignUp: process.env.ALLOW_SIGNUP === 'false',
  },
  user: {
    additionalFields: {
      locale: { type: 'string', defaultValue: 'en', input: true },
      weekStart: { type: 'number', defaultValue: 0, input: false },
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          await createPersonalSpace(user.id, user.locale === 'th' ? 'th' : 'en')
        },
      },
    },
  },
  plugins: [tanstackStartCookies()],
})
