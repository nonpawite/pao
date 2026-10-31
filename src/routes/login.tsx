import { Link, createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { Welcome, emailShape, useFieldErrors, useWelcome, welcomeSearch } from '#/components/app/welcome'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { authClient, errorCode, passkeysWork } from '#/lib/auth-client'
import { getSessionUser, getWelcome } from '#/server/shell'

export const Route = createFileRoute('/login')({
  validateSearch: welcomeSearch,
  beforeLoad: async () => {
    if (await getSessionUser()) throw redirect({ to: '/' })
  },
  loader: () => getWelcome(),
  component: Login,
})

function Login() {
  const router = useRouter()
  const data = Route.useLoaderData()
  const welcome = useWelcome(Route.useSearch().lang, data)
  const { t, locale } = welcome
  const [error, setError] = useState('')
  const { check, field, message } = useFieldErrors()
  const [busy, setBusy] = useState(false)
  // Until the page is live, Sign in would post the form natively and reload; wait for hydration instead.
  const [live, setLive] = useState(false)
  useEffect(() => setLive(true), [])
  // Which way in the second step asks for, once the password was right and two-step sign-in is on.
  const [step, setStep] = useState<'password' | 'code' | 'backup'>('password')

  async function submit(form: FormData) {
    setBusy(true)
    setError('')
    const res = await authClient.signIn.email({ email: String(form.get('email')).trim().toLowerCase(), password: String(form.get('password')) })
    setBusy(false)
    if (res.error) return setError(t('signInFailed'))
    if ('twoFactorRedirect' in res.data && res.data.twoFactorRedirect) return setStep('code')
    await router.navigate({ to: '/' })
  }

  async function verify(code: string) {
    setBusy(true)
    setError('')
    const res = step === 'code' ? await authClient.twoFactor.verifyTotp({ code: code.replace(/\s/g, '') }) : await authClient.twoFactor.verifyBackupCode({ code: code.trim() })
    setBusy(false)
    if (!res.error) return router.navigate({ to: '/' })
    // The pending sign-in is gone: expired, or used up its tries. Only the password step can start a new one.
    if (res.error.code === 'INVALID_TWO_FACTOR_COOKIE' || res.error.code === 'TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE') {
      setStep('password')
      return setError(t(res.error.code === 'INVALID_TWO_FACTOR_COOKIE' ? 'twoStepExpired' : 'tooManyTries'))
    }
    if (res.error.status === 429 || res.error.code === 'ACCOUNT_TEMPORARILY_LOCKED') return setError(t('tooManyTries'))
    setError(t(step === 'code' ? 'codeWrong' : 'backupCodeWrong'))
  }

  async function signInWithPasskey() {
    setBusy(true)
    setError('')
    const res = await authClient.signIn.passkey()
    setBusy(false)
    if (res?.error) return setError(t(errorCode(res.error) === 'PASSKEY_NOT_VERIFIED' ? 'passkeyNotVerified' : 'passkeyFailed'))
    await router.navigate({ to: '/' })
  }

  if (step !== 'password') {
    const label = t(step === 'code' ? 'twoStepCode' : 'backupCode')
    return (
      <Welcome welcome={welcome} title={t('signIn')}>
        <form
          key={step}
          noValidate
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            const ok = check(e.currentTarget, { code: (v) => (!v ? t('fieldRequired') : null) })
            if (ok) void verify(String(new FormData(e.currentTarget).get('code')))
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="code">{label}</Label>
            <Input
              id="code"
              name="code"
              required
              autoFocus
              autoComplete={step === 'code' ? 'one-time-code' : 'off'}
              inputMode={step === 'code' ? 'numeric' : 'text'}
              {...field('code')}
            />
            {message('code')}
            <p className="text-[13px] text-ink-2">{t(step === 'code' ? 'twoStepCodeHint' : 'backupCodeHint')}</p>
          </div>
          {error && (
            <p role="alert" className="text-[14px] text-over-text">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" disabled={busy} className="mt-1 w-full">
            {t('signIn')}
          </Button>
        </form>
        <button
          type="button"
          onClick={() => {
            setError('')
            setStep(step === 'code' ? 'backup' : 'code')
          }}
          className="-my-3 grid h-11 place-items-center text-[15px] font-medium underline decoration-2 underline-offset-4"
        >
          {t(step === 'code' ? 'useBackupCode' : 'useAppCode')}
        </button>
      </Welcome>
    )
  }

  return (
    <Welcome welcome={welcome} title={t('signIn')}>
      {/* method=post: if scripts fail to load, credentials must never land in the URL. */}
      <form
        method="post"
        noValidate
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          const ok = check(e.currentTarget, {
            email: (v) => (!v ? t('fieldRequired') : !emailShape.test(v) ? t('emailInvalid') : null),
            password: (v) => (!v ? t('fieldRequired') : null),
          })
          if (ok) void submit(new FormData(e.currentTarget))
        }}
      >
        <div className="grid gap-1.5">
          <Label htmlFor="email">{t('email')}</Label>
          <Input id="email" name="email" type="email" required autoComplete="email" {...field('email')} />
          {message('email')}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="password">{t('password')}</Label>
          <Input id="password" name="password" type="password" required autoComplete="current-password" {...field('password')} />
          {message('password')}
        </div>
        {error && (
          <p role="alert" className="text-[14px] text-over-text">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" disabled={busy || !live} className="mt-1 w-full">
          {t('signIn')}
        </Button>
        {live && passkeysWork() && (
          <Button type="button" variant="outline" size="lg" disabled={busy} className="w-full" onClick={() => void signInWithPasskey()}>
            {t('passkeySignIn')}
          </Button>
        )}
      </form>

      <Link to="/signup" search={{ lang: locale }} className="-my-3 grid h-11 place-items-center text-[15px] font-medium underline decoration-2 underline-offset-4">
        {data.signup === 'invite' ? t('haveInvite') : t('noAccount')}
      </Link>
    </Welcome>
  )
}
