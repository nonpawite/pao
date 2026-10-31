import { APIError } from 'better-auth/api'

/** A passkey skips the password and the code, so it only counts when the device checked the person too (ADR 0003). */
export function requireVerifiedPerson(verified: boolean) {
  if (!verified) throw new APIError('UNAUTHORIZED', { message: 'This passkey did not verify you.', code: 'PASSKEY_NOT_VERIFIED' })
}
