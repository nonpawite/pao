import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { APIError } from 'better-auth/api'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { and, count, eq, gt, isNotNull, isNull } from 'drizzle-orm'

import { db } from '../db/index.ts'
import * as schema from '../db/schema.ts'
import { normalizeInviteCode, signupGate } from './invites.ts'

/** ALLOW_SIGNUP "true" lets anyone sign up; anything else, unset included, means sign-up by invite (ADR 0002). */
export const signupOpen = () => process.env.ALLOW_SIGNUP === 'true'

/** The invite code a sign-up carries, sent by the sign-up page as a header. */
const inviteFrom = (headers: Headers | undefined) => normalizeInviteCode(headers?.get('x-invite') ?? '')

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg', schema }),
  emailAndPassword: { enabled: true },
  user: {
    additionalFields: {
      locale: { type: 'string', defaultValue: 'en', input: true },
      weekStart: { type: 'number', defaultValue: 0, input: false },
    },
  },
  databaseHooks: {
    user: {
      create: {
        // Runs after the email is known to be free, so a taken email never uses up an invite.
        before: async (_user, ctx) => {
          const [{ members }] = await db.select({ members: count() }).from(schema.user)
          const code = inviteFrom(ctx?.headers)
          // Claimed in one statement, so one code can't make two accounts.
          const [claimed] = code
            ? await db
                .update(schema.invite)
                .set({ usedAt: new Date() })
                .where(and(eq(schema.invite.code, code), isNull(schema.invite.usedAt), gt(schema.invite.expiresAt, new Date())))
                .returning({ id: schema.invite.id })
            : []
          if (signupGate(signupOpen(), members) === 'invite' && !claimed) {
            throw new APIError('FORBIDDEN', { message: 'This invite code does not work.', code: 'INVITE_INVALID' })
          }
        },
        after: async (user, ctx) => {
          const code = inviteFrom(ctx?.headers)
          // Only an invite this sign-up claimed (an expired code sent while sign-up is open was never claimed).
          if (code) {
            await db
              .update(schema.invite)
              .set({ usedBy: user.id })
              .where(and(eq(schema.invite.code, code), isNotNull(schema.invite.usedAt), isNull(schema.invite.usedBy)))
          }
        },
      },
    },
  },
  advanced: {
    // Browsers drop Secure cookies over plain http (http://<LAN IP>:3000), so only an HTTPS address gets them.
    useSecureCookies: process.env.BETTER_AUTH_URL?.startsWith('https://') ?? false,
  },
  plugins: [tanstackStartCookies()],
})
