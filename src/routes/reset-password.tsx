import { Link, createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { Welcome, useFieldErrors, useWelcome, welcomeSearch } from '#/components/app/welcome'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { authClient } from '#/lib/auth-client'
import { getWelcome } from '#/server/shell'

// Better Auth's emailed link checks the token, then lands here with ?token=, or ?error=INVALID_TOKEN when it doesn't work.
export const Route = createFileRoute('/reset-password')({
  validateSearch: (search: Record<string, unknown>) => ({
    ...welcomeSearch(search),
    token: typeof search.token === 'string' ? search.token : undefined,
  }),
  loader: () => getWelcome(),
  component: ResetPassword,
})

function ResetPassword() {
  const data = Route.useLoaderData()
  const search = Route.useSearch()
  const welcome = useWelcome(search.lang, data)
  const { t, locale } = welcome
  const { check, field, message } = useFieldErrors()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [dead, setDead] = useState(!search.token)
  const [done, setDone] = useState(false)
  const [live, setLive] = useState(false)
  useEffect(() => setLive(true), [])

  async function submit(newPassword: string) {
    setBusy(true)
    setError('')
    const res = await authClient.resetPassword({ newPassword, token: search.token! })
    setBusy(false)
    if (!res.error) return setDone(true)
    if (res.error.code === 'INVALID_TOKEN') return setDead(true)
    setError(t(res.error.code === 'PASSWORD_TOO_SHORT' ? 'passwordShort' : res.error.status === 429 ? 'resetTooMany' : 'somethingWrong'))
  }

  return (
    <Welcome welcome={welcome} title={t('chooseNewPassword')}>
      {done ? (
        <p role="status" className="-mt-4 text-[15px]">
          {t('resetDone')}
        </p>
      ) : dead ? (
        <>
          <p role="alert" className="-mt-4 text-[15px] text-over-text">
            {t('resetLinkDead')}
          </p>
          <Link to="/forgot-password" search={{ lang: locale }} className="text-[15px] font-medium underline decoration-2 underline-offset-4">
            {t('askNewLink')}
          </Link>
        </>
      ) : (
        <form
          method="post"
          noValidate
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            const ok = check(e.currentTarget, { password: (v) => (!v ? t('fieldRequired') : v.length < 8 ? t('passwordShort') : null) })
            if (ok) void submit(String(new FormData(e.currentTarget).get('password')))
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="new-password">{t('newPassword')}</Label>
            <Input id="new-password" name="password" type="password" required minLength={8} autoFocus autoComplete="new-password" {...field('password')} />
            {message('password')}
          </div>
          {error && (
            <p role="alert" className="text-[14px] text-over-text">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" disabled={busy || !live} className="mt-1 w-full">
            {t('savePassword')}
          </Button>
        </form>
      )}

      <Link to="/login" search={{ lang: locale }} className="-my-3 grid h-11 place-items-center text-[15px] font-medium underline decoration-2 underline-offset-4">
        {t('backToSignIn')}
      </Link>
    </Welcome>
  )
}
