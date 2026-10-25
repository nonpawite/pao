import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { useLayoutEffect } from 'react'

import { AddEntryProvider, useAddEntry } from '#/components/app/add-entry'
import { pocketBg } from '#/lib/colors'
import { ShellProvider } from '#/components/app/context'
import { Sidebar, TabBar } from '#/components/app/frame'
import { useT } from '#/components/app/context'
import { useTheme } from '#/components/app/theme'
import { Toaster } from '#/components/ui/sonner'
import { getSessionUser, getShell } from '#/server/shell'

export const Route = createFileRoute('/_app')({
  beforeLoad: async () => {
    const u = await getSessionUser()
    if (!u) throw redirect({ to: '/login' })
    // A new member has no pocket until they finish Setup.
    if (!u.ready) throw redirect({ to: '/setup' })
  },
  loader: () => getShell(),
  component: AppLayout,
})

function AppLayout() {
  const shell = Route.useLoaderData()

  // Thai sets its own line height and spacing, so the document language follows the user.
  useLayoutEffect(() => {
    document.documentElement.lang = shell.user.locale
  }, [shell.user.locale])

  // The one accent is the active pocket's colour; on the root so dialogs and sheets take it too.
  const color = (shell.pockets.find((p) => p.id === shell.activePocketId) ?? shell.pockets[0])?.color
  useLayoutEffect(() => {
    if (color) document.documentElement.style.setProperty('--sign', pocketBg(color))
  }, [color])

  return (
    <ShellProvider value={shell}>
      <AddEntryProvider>
        <div className="min-h-dvh lg:grid lg:grid-cols-[272px_minmax(0,1fr)]">
          <Frame />
        </div>
      </AddEntryProvider>
    </ShellProvider>
  )
}

function Frame() {
  const { open } = useAddEntry()
  const { t } = useT()
  const theme = useTheme()
  return (
    <>
      <a
        href="#content"
        className="sr-only z-50 rounded-sm bg-ink px-4 py-3 text-[14px] font-medium text-ground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        {t('skipToContent')}
      </a>
      <Sidebar onAdd={open} />
      <div id="content" tabIndex={-1} className="min-w-0 pb-[calc(100px+env(safe-area-inset-bottom))] outline-none lg:pb-0">
        <Outlet />
      </div>
      <TabBar onAdd={open} />
      <Toaster theme={theme} position="top-center" containerAriaLabel={t('notifications')} />
    </>
  )
}
