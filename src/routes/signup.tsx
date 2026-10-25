import { Link, createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { Welcome, useWelcome, welcomeSearch } from '#/components/app/welcome'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { authClient } from '#/lib/auth-client'
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
  const [error, setError] = useState('')
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
    if (res.error) return setError(res.error.code === 'INVITE_INVALID' ? t('inviteInvalid') : res.error.message || t('signUpFailed'))
    await router.navigate({ to: '/setup' })
  }

  return (
    <Welcome welcome={welcome} title={t('signUp')}>
      {data.signup === 'first' && <p className="-mt-4 text-[15px] text-ink-2">{t('firstAdmin')}</p>}
      {/* method=post: if scripts fail to load, credentials must never land in the URL. */}
      <form
        method="post"
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          void submit(new FormData(e.currentTarget))
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
              aria-describedby={search.invite ? undefined : 'invite-hint'}
              className="font-board font-medium tracking-wider uppercase"
            />
            {!search.invite && (
              <p id="invite-hint" className="text-[13px] text-ink-2">
                {t('inviteOnlyHint')}
              </p>
            )}
          </div>
        )}
        <div className="grid gap-1.5">
          <Label htmlFor="name">{t('yourName')}</Label>
          <Input id="name" name="name" required autoComplete="name" maxLength={40} defaultValue={data.invite?.name ?? ''} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="email">{t('email')}</Label>
          <Input id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="new-password">{t('password')}</Label>
          <Input id="new-password" name="password" type="password" required minLength={8} autoComplete="new-password" />
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
