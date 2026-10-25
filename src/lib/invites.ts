// Letters and digits that can't be read as one another out loud or in a chat font: no 0/O and no 1/I/L.
export const inviteAlphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

/** An invite works this long after the admin makes it. */
export const inviteDays = 7

/** A fresh invite code, XXXX-XXXX from the alphabet above, drawn without modulo bias. */
export function newInviteCode() {
  const chars: string[] = []
  // 248 is the largest multiple of the alphabet's 31 under 256; bytes at or above it are redrawn.
  while (chars.length < 8) {
    for (const b of crypto.getRandomValues(new Uint8Array(8))) if (b < 248 && chars.length < 8) chars.push(inviteAlphabet[b % 31])
  }
  return `${chars.slice(0, 4).join('')}-${chars.slice(4).join('')}`
}

/** A typed code as stored (XXXX-XXXX), whatever its case, spaces or dashes; null when it can't be a code. */
export function normalizeInviteCode(input: string) {
  const s = input.toUpperCase().replace(/[\s-]/g, '')
  return s.length === 8 && [...s].every((c) => inviteAlphabet.includes(c)) ? `${s.slice(0, 4)}-${s.slice(4)}` : null
}

/**
 * Who may sign up (ADR 0002): anyone when the instance is open; on an empty instance the first person, who becomes the
 * admin; otherwise only someone with an invite.
 */
export const signupGate = (open: boolean, members: number): 'open' | 'first' | 'invite' => (open ? 'open' : members === 0 ? 'first' : 'invite')
