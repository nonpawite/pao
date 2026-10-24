import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { makeT } from '#/components/app/context'
import { Figure, useDocumentTitle } from '#/components/app/kit'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { authClient } from '#/lib/auth-client'
import { formatDay, localeCodes, locales, pickLocale } from '#/lib/i18n'
import type { Locale } from '#/lib/i18n'
import { getSessionUser } from '#/server/shell'

export const Route = createFileRoute('/login')({
  beforeLoad: async () => {
    if (await getSessionUser()) throw redirect({ to: '/' })
  },
  component: Login,
})

function Login() {
  const router = useRouter()
  const [locale, setLocale] = useState<Locale>('en')
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  // Until the page is live, Sign in would post the form natively and reload; wait for hydration instead.
  const [live, setLive] = useState(false)
  useEffect(() => setLive(true), [])
  const { t } = makeT(locale)
  useDocumentTitle(mode === 'in' ? t('signIn') : t('signUp'))
  // Start in the browser's language; the server render stays English, so this waits for the client.
  useEffect(() => setLocale(pickLocale(navigator.languages)), [])
  // shortcut: the switch steps through the registry; past three or so languages, make it a menu.
  const other = localeCodes[(localeCodes.indexOf(locale) + 1) % localeCodes.length]
  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  async function submit(form: FormData) {
    setBusy(true)
    setError('')
    const email = String(form.get('email')).trim().toLowerCase()
    const password = String(form.get('password'))
    const res =
      mode === 'in'
        ? await authClient.signIn.email({ email, password })
        : await authClient.signUp.email({ email, password, name: String(form.get('name')).trim(), locale })
    setBusy(false)
    if (res.error) return setError(mode === 'in' ? t('signInFailed') : res.error.message || t('signUpFailed'))
    await router.navigate({ to: '/' })
  }

  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-sm content-center gap-8 px-5 py-10">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setLocale(other)}
          className="caps -my-3 -mr-2 h-11 px-2 text-[13px] underline decoration-2 underline-offset-4"
        >
          <span lang={other}>{locales[other].name}</span>
        </button>
      </div>

      {/* The board, the app's own object, as the welcome: today's date, no figures before there is an account. */}
      <div aria-hidden className="board grid gap-3 rounded-lg p-4">
        <span className="caps text-[12px] text-on-board-2">{t('today')}</span>
        <Figure text={formatDay(locale, new Date().toLocaleDateString('en-CA'))} className="text-[32px]" />
      </div>

      <h1 className="title-large">{mode === 'in' ? t('signIn') : t('signUp')}</h1>

      {/* method=post: if scripts fail to load, credentials must never land in the URL. */}
      <form
        method="post"
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          void submit(new FormData(e.currentTarget))
        }}
      >
        {mode === 'up' && (
          <div className="grid gap-1.5">
            <Label htmlFor="name">{t('yourName')}</Label>
            <Input id="name" name="name" required autoComplete="name" maxLength={40} />
          </div>
        )}
        <div className="grid gap-1.5">
          <Label htmlFor="email">{t('email')}</Label>
          <Input id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="password">{t('password')}</Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
          />
        </div>
        {error && (
          <p role="alert" className="text-[14px] text-over-text">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" disabled={busy || !live} className="mt-1 w-full">
          {mode === 'in' ? t('signIn') : t('signUp')}
        </Button>
      </form>

      <button type="button" onClick={() => setMode(mode === 'in' ? 'up' : 'in')} className="-my-3 h-11 text-[15px] font-medium underline decoration-2 underline-offset-4">
        {mode === 'in' ? t('noAccount') : t('haveAccount')}
      </button>
    </main>
  )
}
