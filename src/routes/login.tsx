import { Link, createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { Welcome, useWelcome, welcomeSearch } from '#/components/app/welcome'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { authClient } from '#/lib/auth-client'
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
  const [busy, setBusy] = useState(false)
  // Until the page is live, Sign in would post the form natively and reload; wait for hydration instead.
  const [live, setLive] = useState(false)
  useEffect(() => setLive(true), [])

  async function submit(form: FormData) {
    setBusy(true)
    setError('')
    const res = await authClient.signIn.email({ email: String(form.get('email')).trim().toLowerCase(), password: String(form.get('password')) })
    setBusy(false)
    if (res.error) return setError(t('signInFailed'))
    await router.navigate({ to: '/' })
  }

  return (
    <Welcome welcome={welcome} title={t('signIn')}>
      {/* method=post: if scripts fail to load, credentials must never land in the URL. */}
      <form
        method="post"
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          void submit(new FormData(e.currentTarget))
        }}
      >
        <div className="grid gap-1.5">
          <Label htmlFor="email">{t('email')}</Label>
          <Input id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="password">{t('password')}</Label>
          <Input id="password" name="password" type="password" required autoComplete="current-password" />
        </div>
        {error && (
          <p role="alert" className="text-[14px] text-over-text">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" disabled={busy || !live} className="mt-1 w-full">
          {t('signIn')}
        </Button>
      </form>

      <Link to="/signup" search={{ lang: locale }} className="-my-3 grid h-11 place-items-center text-[15px] font-medium underline decoration-2 underline-offset-4">
        {data.signup === 'invite' ? t('haveInvite') : t('noAccount')}
      </Link>
    </Welcome>
  )
}
