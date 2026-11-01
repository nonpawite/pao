import { randomCode } from './invites.ts'

/** Ten XXXXX-XXXXX codes in the invite alphabet: a member may copy these out by hand, so nothing can be read as something else. */
export const newBackupCodes = () =>
  Array.from({ length: 10 }, () => {
    const code = randomCode(10)
    return `${code.slice(0, 5)}-${code.slice(5)}`
  })

/** A typed backup code as stored, whatever its case, spaces or dashes. Anything else goes through as typed, for the server to refuse. */
export function normalizeBackupCode(input: string) {
  const s = input.toUpperCase().replace(/[\s-]/g, '')
  return s.length === 10 ? `${s.slice(0, 5)}-${s.slice(5)}` : input.trim()
}
