import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'

import { makeT } from './context'
import { Figure, useDocumentTitle } from './kit'
import { ThemeSwitch } from './theme'
import { localeCodes, locales, pickLocale } from '#/lib/i18n'
import type { CalendarNames, Locale } from '#/lib/i18n'

/** Enough of an email's shape to catch a slip (a missing @ or domain); the server has the last word. */
export const emailShape = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** ?lang= carries a language picked on sign-in over to sign-up and back; ?invite= is an invite link's code. */
export const welcomeSearch = (search: Record<string, unknown>): { lang?: Locale; invite?: string } => ({
  lang: localeCodes.find((l) => l === search.lang),
  invite: typeof search.invite === 'string' ? search.invite.slice(0, 20) : undefined,
})

/** The page's language (the one passed along, else the browser's), with the welcome board's day. */
export function useWelcome(lang: Locale | undefined, { names, today }: { names: Record<Locale, CalendarNames>; today: string }) {
  const [locale, setLocale] = useState<Locale>(lang ?? 'en')
  // Without ?lang= the server render stays English, so the browser's language waits for the client.
  useEffect(() => {
    if (!lang) setLocale(pickLocale(navigator.languages))
  }, [lang])
  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])
  return { ...makeT(locale, names[locale]), setLocale, today }
}

/** Sign-in and sign-up share a frame: the name, the language and colour switches, and the board as the welcome. */
export function Welcome({
  welcome,
  title,
  children,
}: {
  welcome: ReturnType<typeof useWelcome>
  title: string
  children: ReactNode
}) {
  const { t, day, locale, setLocale, today } = welcome
  useDocumentTitle(title)
  // shortcut: the switch steps through the registry; past three or so languages, make it a menu.
  const other = localeCodes[(localeCodes.indexOf(locale) + 1) % localeCodes.length]
  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-sm content-center gap-8 px-5 py-10">
      <div className="flex items-center justify-between gap-3">
        {/* The name is the same Latin word in every language. */}
        <p className="text-[17px] font-semibold">Pao</p>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setLocale(other)} className="caps -my-3 h-11 px-2 text-[13px] underline decoration-2 underline-offset-4">
            <span lang={other}>{locales[other].name}</span>
          </button>
          <ThemeSwitch t={t} className="w-[7.5rem]" />
        </div>
      </div>

      {/* The board, the app's own object, as the welcome: today's date, no figures before there is an account. */}
      <div aria-hidden className="board grid gap-3 rounded-lg p-4">
        <span className="caps text-[12px] text-on-board-2">{t('today')}</span>
        <Figure text={day(today)} className="text-[32px]" />
      </div>

      <h1 className="title-large">{title}</h1>
      {children}
    </main>
  )
}

/**
 * Field checks the page does itself, so a problem shows under its field in the member's language rather than as the
 * browser's own English bubble. `check` returns whether every field passed and focuses the first that didn't.
 */
export function useFieldErrors() {
  const [errors, setErrors] = useState<Record<string, string>>({})
  function check(form: HTMLFormElement, rules: Record<string, (value: string) => string | null>) {
    const data = new FormData(form)
    const found: Record<string, string> = {}
    for (const [name, rule] of Object.entries(rules)) {
      const problem = rule(String(data.get(name) ?? '').trim())
      if (problem) found[name] = problem
    }
    setErrors(found)
    const first = Object.keys(rules).find((name) => found[name])
    if (first) (form.elements.namedItem(first) as HTMLElement | null)?.focus()
    return !first
  }
  /** A field's error state: the red edge, the message read with it, and the message gone once they type. */
  const field = (name: string, ...describedBy: Array<string | false | undefined>) => ({
    'aria-invalid': errors[name] ? true : undefined,
    'aria-describedby': [errors[name] && `${name}-error`, ...describedBy].filter(Boolean).join(' ') || undefined,
    onInput: () => setErrors((e) => (e[name] ? { ...e, [name]: '' } : e)),
  })
  const message = (name: string) =>
    errors[name] ? (
      <p id={`${name}-error`} className="text-[13px] text-over-text">
        {errors[name]}
      </p>
    ) : null
  return { check, field, message }
}
