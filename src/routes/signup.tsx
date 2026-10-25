import { Link, createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { Welcome, emailShape, useFieldErrors, useWelcome, welcomeSearch } from '#/components/app/welcome'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { authClient } from '#/lib/auth-client'
import type { MessageKey } from '#/lib/i18n'
import { normalizeInviteCode } from '#/lib/invites'
import { getSessionUser, getWelcome } from '#/server/shell'

// Its own page, not a mode of sign-in: password managers judge a form once, and one that starts as a login
// stays a login to them, so they never offered to save the new password.
export const Route = createFileRoute('/signup')({
  validateSearch: welcomeSearch,
  loaderDeps: ({ search }) => ({ invite: search.invite }),
  beforeLoad: async () => {
    if (await getSessionUser()) throw redirect({ to: '/' })
  },
  loader: ({ deps }) => getWelcome({ data: { invite: deps.invite } }),
  component: Signup,
})

function Signup() {
  const router = useRouter()
  const search = Route.useSearch()
  const data = Route.useLoaderData()
  const welcome = useWelcome(search.lang, data)
  const { t, locale } = welcome
  // While sign-up is by invite the code is required; an invite link brings one either way.
  const askCode = data.signup === 'invite' || !!search.invite
  // A link whose invite is used, expired or revoked says so on arrival, before anything is typed.
  const [codeEdited, setCodeEdited] = useState(false)
  const deadInvite = !!search.invite && !data.invite && !codeEdited
  const [error, setError] = useState('')
  const { check, field, message } = useFieldErrors()
  const [busy, setBusy] = useState(false)
  // Until the page is live, the form would post natively and reload; wait for hydration instead.
  const [live, setLive] = useState(false)
  useEffect(() => setLive(true), [])

  async function submit(form: FormData) {
    setBusy(true)
    setError('')
    const code = String(form.get('invite') ?? '').trim()
    const res = await authClient.signUp.email(
      {
        email: String(form.get('email')).trim().toLowerCase(),
        password: String(form.get('password')),
        name: String(form.get('name')).trim(),
        locale,
      },
      // The server checks and uses up the invite as it makes the account (ADR 0002).
      code ? { headers: { 'x-invite': code } } : undefined,
    )
    setBusy(false)
    // Plain sentences in the member's language, never the server's own message.
    const known: Record<string, MessageKey> = {
      INVITE_INVALID: 'inviteInvalid',
      USER_ALREADY_EXISTS: 'emailTaken',
      USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'emailTaken',
      PASSWORD_TOO_SHORT: 'passwordShort',
      INVALID_EMAIL: 'emailInvalid',
    }
    if (res.error) return setError(t(known[res.error.code ?? ''] ?? 'signUpFailed'))
    await router.navigate({ to: '/setup' })
  }

  return (
    <Welcome welcome={welcome} title={t('signUp')}>
      {data.signup === 'first' && <p className="-mt-4 text-[15px] text-ink-2">{t('firstAdmin')}</p>}
      {/* method=post: if scripts fail to load, credentials must never land in the URL. */}
      <form
        method="post"
        noValidate
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          const ok = check(e.currentTarget, {
            ...(askCode && {
              invite: (v: string) => (!v ? (data.signup === 'invite' ? t('fieldRequired') : null) : !normalizeInviteCode(v) ? t('inviteShape') : null),
            }),
            name: (v) => (!v ? t('fieldRequired') : null),
            email: (v) => (!v ? t('fieldRequired') : !emailShape.test(v) ? t('emailInvalid') : null),
            password: (v) => (!v ? t('fieldRequired') : v.length < 8 ? t('passwordShort') : null),
          })
          if (ok) void submit(new FormData(e.currentTarget))
        }}
      >
        {askCode && (
          <div className="grid gap-1.5">
            <Label htmlFor="invite">{t('inviteCode')}</Label>
            <Input
              id="invite"
              name="invite"
              required={data.signup === 'invite'}
              defaultValue={data.invite?.code ?? search.invite ?? ''}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={20}
              {...field('invite', !search.invite && 'invite-hint', deadInvite && 'invite-dead')}
              {...(deadInvite && { 'aria-invalid': true })}
              onChange={() => setCodeEdited(true)}
              className="font-board font-medium tracking-wider uppercase"
            />
            {message('invite')}
            {deadInvite && (
              <p id="invite-dead" className="text-[13px] text-over-text">
                {t('inviteInvalid')}
              </p>
            )}
            {!search.invite && (
              <p id="invite-hint" className="text-[13px] text-ink-2">
                {t('inviteOnlyHint')}
              </p>
            )}
          </div>
        )}
        <div className="grid gap-1.5">
          <Label htmlFor="name">{t('yourName')}</Label>
          <Input id="name" name="name" required autoComplete="name" maxLength={40} defaultValue={data.invite?.name ?? ''} {...field('name')} />
          {message('name')}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="email">{t('email')}</Label>
          <Input id="email" name="email" type="email" required autoComplete="email" {...field('email')} />
          {message('email')}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="new-password">{t('password')}</Label>
          <Input id="new-password" name="password" type="password" required minLength={8} autoComplete="new-password" {...field('password')} />
          {message('password')}
        </div>
        {error && (
          <p role="alert" className="text-[14px] text-over-text">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" disabled={busy || !live} className="mt-1 w-full">
          {t('signUp')}
        </Button>
      </form>

      <Link to="/login" search={{ lang: locale }} className="-my-3 grid h-11 place-items-center text-[15px] font-medium underline decoration-2 underline-offset-4">
        {t('haveAccount')}
      </Link>
    </Welcome>
  )
}
