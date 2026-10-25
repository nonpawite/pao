import { Monitor, Moon, Sun } from '@phosphor-icons/react'
import { useRouteContext } from '@tanstack/react-router'
import { createIsomorphicFn } from '@tanstack/react-start'
import { getCookie } from '@tanstack/react-start/server'
import { useSyncExternalStore } from 'react'

import type { MessageKey } from '#/lib/i18n'
import { parseTheme, themeColor, themes } from '#/lib/theme'
import type { Theme } from '#/lib/theme'
import { Segmented } from './kit'

/** The colour mode for this device: the server reads it to render the right theme, so nothing flashes. */
export const readTheme = createIsomorphicFn()
  .server(() => parseTheme(getCookie('theme')))
  .client(() => parseTheme(document.cookie.match(/(?:^|; )theme=([^;]*)/)?.[1]))

/** Light or Dark sets data-theme on the root; System leaves it off so the styles follow the device. */
export function setTheme(theme: Theme) {
  document.cookie = `theme=${theme}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`
  if (theme === 'system') delete document.documentElement.dataset.theme
  else document.documentElement.dataset.theme = theme
  // The status bar follows too: each tag keeps its own colour under System, both take the chosen one otherwise.
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name=theme-color]')) {
    meta.content = theme === 'system' ? themeColor[meta.media.includes('dark') ? 'dark' : 'light'] : themeColor[theme]
  }
}

const subscribe = (onChange: () => void) => {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributeFilter: ['data-theme'] })
  return () => observer.disconnect()
}

/** The current colour mode; the root attribute is the truth in the browser, the cookie on the server. */
export function useTheme() {
  const { theme } = useRouteContext({ from: '__root__' })
  return useSyncExternalStore(subscribe, () => parseTheme(document.documentElement.dataset.theme), () => theme)
}

export const themeNames: Record<Theme, MessageKey> = { system: 'themeSystem', light: 'themeLight', dark: 'themeDark' }
const icons = { system: Monitor, light: Sun, dark: Moon }

/** The compact switch for pages without Settings (sign-in, sign-up, Setup): three icons, the current one raised. */
export function ThemeSwitch({ t, className }: { t: (key: MessageKey) => string; className?: string }) {
  const theme = useTheme()
  return (
    <Segmented
      label={t('appearance')}
      value={theme}
      onChange={setTheme}
      className={className}
      options={themes.map((value) => {
        const Icon = icons[value]
        return {
          value,
          label: (
            <span title={t(themeNames[value])} className="flex h-full items-center justify-center">
              <Icon aria-hidden className="size-4" />
              <span className="sr-only">{t(themeNames[value])}</span>
            </span>
          ),
        }
      })}
    />
  )
}
