import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'

import { readTheme } from '#/components/app/theme'
import { themeColor } from '#/lib/theme'
import appCss from '../styles.css?url'

export const Route = createRootRoute({
  beforeLoad: () => ({ theme: readTheme() }),
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
      { title: 'Pao' },
      // Opens full screen when added to the home screen.
      { name: 'apple-mobile-web-app-capable', content: 'yes' },
      { name: 'mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
      { name: 'apple-mobile-web-app-title', content: 'Pao' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'manifest', href: '/manifest.webmanifest' },
      { rel: 'icon', href: '/icon.svg', type: 'image/svg+xml' },
      { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  const { theme } = Route.useRouteContext()
  return (
    // System leaves data-theme off, so the styles follow the device.
    <html lang="en" data-theme={theme === 'system' ? undefined : theme}>
      <head>
        <HeadContent />
        {/* Here, not in head(): the router keeps one meta per name, and the status bar needs one per appearance.
            Each keeps its own colour under System; a chosen mode gives both its colour. */}
        <meta name="theme-color" content={themeColor[theme === 'system' ? 'light' : theme]} media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content={themeColor[theme === 'system' ? 'dark' : theme]} media="(prefers-color-scheme: dark)" />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
