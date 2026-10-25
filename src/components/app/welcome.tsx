import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'

import { makeT } from './context'
import { Figure, useDocumentTitle } from './kit'
import { ThemeSwitch } from './theme'
import { localeCodes, locales, pickLocale } from '#/lib/i18n'
import type { CalendarNames, Locale } from '#/lib/i18n'

/** ?lang= carries a language picked on sign-in over to sign-up and back. */
export const welcomeSearch = (search: Record<string, unknown>): { lang?: Locale } => ({ lang: localeCodes.find((l) => l === search.lang) })

/** The page's language: the one passed along, else the browser's. */
export function useWelcomeLocale(lang: Locale | undefined, names: Record<Locale, CalendarNames>) {
  const [locale, setLocale] = useState<Locale>(lang ?? 'en')
  // Without ?lang= the server render stays English, so the browser's language waits for the client.
  useEffect(() => {
    if (!lang) setLocale(pickLocale(navigator.languages))
  }, [lang])
  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])
  return { ...makeT(locale, names[locale]), setLocale }
}

/** Sign-in and sign-up share a frame: the name, the language and colour switches, and the board as the welcome. */
export function Welcome({
  welcome,
  title,
  children,
}: {
  welcome: ReturnType<typeof useWelcomeLocale> & { today: string }
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
