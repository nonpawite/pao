import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { APIError, createAuthMiddleware } from 'better-auth/api'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { and, count, eq, gt, isNull } from 'drizzle-orm'

import { db } from '../db/index.ts'
import * as schema from '../db/schema.ts'
import { normalizeInviteCode, signupGate } from './invites.ts'

/** ALLOW_SIGNUP "true" lets anyone sign up; anything else, unset included, means sign-up by invite (ADR 0002). */
export const signupOpen = () => process.env.ALLOW_SIGNUP === 'true'

/** The invite code a sign-up carries, sent by the sign-up page as a header. */
const inviteFrom = (headers: Headers | undefined) => normalizeInviteCode(headers?.get('x-invite') ?? '')

const inviteInvalid = () => new APIError('FORBIDDEN', { message: 'This invite code does not work.', code: 'INVITE_INVALID' })
const live = (code: string) => and(eq(schema.invite.code, code), isNull(schema.invite.usedAt), gt(schema.invite.expiresAt, new Date()))

/** Whether this sign-up must bring an invite: not while sign-up is open, nor for an empty instance's first account. */
async function needsInvite() {
  const [{ members }] = await db.select({ members: count() }).from(schema.user)
  return signupGate(signupOpen(), members) === 'invite'
}

// The invite each sign-up claimed, from the create hook to the after hook (the same request context reaches both).
const claimedBy = new WeakMap<object, string>()

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg', schema }),
  emailAndPassword: { enabled: true },
  user: {
    additionalFields: {
      locale: { type: 'string', defaultValue: 'en', input: true },
      weekStart: { type: 'number', defaultValue: 0, input: false },
    },
  },
  hooks: {
    // Refuses a sign-up without a working invite before Better Auth looks the email up, so the answer never tells an
    // outsider whether an email already has an account. Only checks; the create hook claims.
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== '/sign-up/email' || !(await needsInvite())) return
      const code = inviteFrom(ctx.headers)
      const [found] = code ? await db.select({ id: schema.invite.id }).from(schema.invite).where(live(code)) : []
      if (!found) throw inviteInvalid()
    }),
  },
  databaseHooks: {
    user: {
      create: {
        // Runs after the email is known to be free, so a taken email never uses up an invite.
        before: async (_user, ctx) => {
          const code = inviteFrom(ctx?.headers)
          // Claimed in one statement, so one code can't make two accounts.
          const [claimed] = code
            ? await db.update(schema.invite).set({ usedAt: new Date() }).where(live(code)).returning({ id: schema.invite.id })
            : []
          if (claimed && ctx) claimedBy.set(ctx, claimed.id)
          if (!claimed && (await needsInvite())) throw inviteInvalid()
        },
        after: async (user, ctx) => {
          const id = ctx && claimedBy.get(ctx)
          if (id) await db.update(schema.invite).set({ usedBy: user.id }).where(eq(schema.invite.id, id))
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
