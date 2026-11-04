import { createTransport } from 'nodemailer'

/**
 * How Pao sends email, or null when it can't (ADR 0004). Needs SMTP_URL and BETTER_AUTH_URL: without a fixed public
 * address, Better Auth builds a reset link from the request's Host header, which anyone asking can set to their own site.
 * The sender is MAIL_FROM, else SMTP_URL's user when that is an address.
 */
export function mailSettings(env: Record<string, string | undefined>) {
  if (!env.SMTP_URL || !env.BETTER_AUTH_URL) return null
  let user = ''
  try {
    user = decodeURIComponent(new URL(env.SMTP_URL).username)
  } catch {
    return null
  }
  const from = env.MAIL_FROM || (user.includes('@') ? `Pao <${user}>` : '')
  return from ? { smtp: env.SMTP_URL, from } : null
}

const settings = mailSettings(process.env)
const transport = settings && createTransport(settings.smtp)

export const mailReady = () => !!settings

export async function sendMail(to: string, subject: string, text: string) {
  if (!settings || !transport) throw new Error('Email is not set up.')
  await transport.sendMail({ from: settings.from, to, subject, text })
}
