import { Link, createRouter as createTanStackRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

// Shown for missing pages and for pockets or categories the viewer does not belong to.
function Problem({ title, retry }: { title: string; retry?: () => void }) {
  return (
    <main className="mx-auto grid min-h-[60dvh] max-w-sm content-center gap-4 px-6 text-center">
      <p className="text-[20px] font-semibold">{title}</p>
      <div className="caps flex justify-center gap-6 text-[13px] underline decoration-2 underline-offset-4">
        {retry && (
          <button type="button" onClick={retry}>
            Try again
          </button>
        )}
        <Link to="/">Today</Link>
      </div>
    </main>
  )
}

export function getRouter() {
  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    defaultNotFoundComponent: () => <Problem title="This page does not exist." />,
    defaultErrorComponent: ({ reset }) => <Problem title="Something went wrong loading this page." retry={reset} />,
  })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
