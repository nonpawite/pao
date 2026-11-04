import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { Welcome, emailShape, useFieldErrors, useWelcome, welcomeSearch } from '#/components/app/welcome'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { authClient } from '#/lib/auth-client'
import { getSessionUser, getWelcome } from '#/server/shell'

export const Route = createFileRoute('/forgot-password')({
  validateSearch: welcomeSearch,
  beforeLoad: async () => {
    if (await getSessionUser()) throw redirect({ to: '/' })
  },
  loader: () => getWelcome(),
  component: ForgotPassword,
})

function ForgotPassword() {
  const data = Route.useLoaderData()
  const welcome = useWelcome(Route.useSearch().lang, data)
  const { t, locale } = welcome
  const { check, field, message } = useFieldErrors()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  // The address the link went to; the answer is the same whether or not it has an account.
  const [sentTo, setSentTo] = useState('')
  const [live, setLive] = useState(false)
  useEffect(() => setLive(true), [])

  async function submit(email: string) {
    setBusy(true)
    setError('')
    const res = await authClient.requestPasswordReset({ email, redirectTo: `/reset-password?lang=${locale}` })
    setBusy(false)
    if (res.error) return setError(t(res.error.status === 429 ? 'resetTooMany' : 'somethingWrong'))
    setSentTo(email)
  }

  return (
    <Welcome welcome={welcome} title={t('resetTitle')}>
      {!data.resetByEmail ? (
        <p className="-mt-4 text-[15px] text-ink-2">{t('resetOff')}</p>
      ) : sentTo ? (
        <p role="status" className="-mt-4 text-[15px]">
          {t('resetSent', { email: sentTo })}
        </p>
      ) : (
        <>
          <p className="-mt-4 text-[15px] text-ink-2">{t('resetIntro')}</p>
          <form
            method="post"
            noValidate
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              const ok = check(e.currentTarget, { email: (v) => (!v ? t('fieldRequired') : !emailShape.test(v) ? t('emailInvalid') : null) })
              if (ok) void submit(String(new FormData(e.currentTarget).get('email')).trim().toLowerCase())
            }}
          >
            <div className="grid gap-1.5">
              <Label htmlFor="email">{t('email')}</Label>
              <Input id="email" name="email" type="email" required autoFocus autoComplete="email" {...field('email')} />
              {message('email')}
            </div>
            {error && (
              <p role="alert" className="text-[14px] text-over-text">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" disabled={busy || !live} className="mt-1 w-full">
              {t('sendResetLink')}
            </Button>
          </form>
        </>
      )}

      <Link to="/login" search={{ lang: locale }} className="-my-3 grid h-11 place-items-center text-[15px] font-medium underline decoration-2 underline-offset-4">
        {t('backToSignIn')}
      </Link>
    </Welcome>
  )
}
