import { Link, createFileRoute } from '@tanstack/react-router'
import { CaretLeft, CaretRight } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import { useCategoryColor } from '#/components/app/charts'
import { useActivePocket, useMoney, useT } from '#/components/app/context'
import { DayStrip, useDocumentTitle } from '#/components/app/kit'
import { Button } from '#/components/ui/button'
import { cn } from '#/lib/utils'
import { getRecap } from '#/server/review'

export const Route = createFileRoute('/_app/recap')({
  loader: () => getRecap(),
  component: Recap,
})

/** R3: a short set of cards about the cycle that just ended. Next and Back at the foot, arrow keys, or tap right and left. */
function Recap() {
  const data = Route.useLoaderData()
  const pocket = useActivePocket()
  const { t, range } = useT()
  const { money } = useMoney()
  const color = useCategoryColor()
  const [i, setI] = useState(0)
  useDocumentTitle(t('recap'))
  // Set once the cards are built below; the arrow keys stop at either end.
  const total = useRef(1)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setI((n) => Math.min(n + 1, total.current - 1))
      if (e.key === 'ArrowLeft') setI((n) => Math.max(0, n - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (data.empty)
    return (
      <main className="mx-auto grid max-w-[600px] justify-items-center gap-4 px-4 pt-10 text-center">
        <h1 className="text-[17px]">{t('nothingToRecap')}</h1>
        <Button asChild variant="outline">
          <Link to="/">{t('today')}</Link>
        </Button>
      </main>
    )

  const kept = data.kept
  const cards: Array<{ key: string; body: ReactNode }> = [
    {
      key: 'kept',
      body:
        data.kind === 'personal' ? (
          <>
            <Figure amount={money(Math.abs(kept))} suffix={kept >= 0 ? t('keptSuffix') : t('overEarned')} />
            {data.keptDelta !== null && (
              <p className={cn('caps text-[14px]', data.keptDelta >= 0 ? 'text-ok-text' : 'text-ahead-text')}>
                {t(data.keptDelta >= 0 ? 'keptMore' : 'keptLess', { amount: money(Math.abs(data.keptDelta)) })}
              </p>
            )}
            {/* Earned as one bar, as on Review: the spent part in ink, the rest is what was kept. */}
            <div className="grid gap-2 pt-4">
              <div className="flex h-1.5 bg-board-line">
                <span className={cn('h-full', kept < 0 ? 'bg-over' : 'bg-ink')} style={{ width: `${Math.min(100, (data.spent / Math.max(1, data.earned)) * 100)}%` }} />
              </div>
              <p className="caps text-[12px] text-on-board-2">
                {t('spentOfEarned', { spent: money(data.spent), earned: money(data.earned) })}
              </p>
            </div>
          </>
        ) : (
          <Figure amount={money(data.spent)} suffix={t('spent').toLowerCase()} />
        ),
    },
    ...(data.top.length
      ? [
          {
            key: 'where',
            body: (
              <>
                <Statement>{t('mostWentTo', { category: data.top[0].name })}</Statement>
                <ol className="grid gap-4">
                  {data.top.map((c) => (
                    <li key={c.id} className="grid gap-1.5">
                      <span className="flex items-baseline justify-between text-[17px] font-semibold">
                        <span>{c.name}</span>
                        <span className="font-board">{money(c.spent)}</span>
                      </span>
                      <span className="h-1 bg-board-line">
                        <span className="block h-full" style={{ width: `${(c.spent / data.top[0].spent) * 100}%`, background: color(c.name) }} />
                      </span>
                    </li>
                  ))}
                </ol>
              </>
            ),
          },
        ]
      : []),
    ...data.daily.map((d) => ({
      key: `daily-${d.id}`,
      body: (
        <>
          <Statement>
            {d.overDays > 0 ? t('overOnDays', { category: d.name, n: d.overDays }) : t('neverOver', { category: d.name })}
          </Statement>
          <DayStrip days={d.strip} onBoard />
        </>
      ),
    })),
    ...(data.best
      ? [{ key: 'best', body: <Statement>{t('stayedUnder', { category: data.best.name, pct: data.best.pct })}</Statement> }]
      : []),
    {
      key: 'next',
      body: (
        <>
          <Statement>{t('nextCycleLimits')}</Statement>
          <ul className="grid gap-2 text-[17px]">
            {data.limits.map((l) => (
              <li key={l.id} className="flex justify-between border-b border-board-line pb-2">
                <span>{l.name}</span>
                <span className="font-board font-semibold">{t(l.limitType === 'day' ? 'aDay' : 'aCycle', { amount: money(l.limit) })}</span>
              </li>
            ))}
          </ul>
          <div className="relative z-10 grid gap-2 pt-4">
            <Button asChild size="lg">
              <Link to="/">{t('keepLimits')}</Link>
            </Button>
            <Button asChild size="lg" variant="ghost" className="text-on-board hover:bg-flap">
              <Link to="/settings" search={{ pocket: pocket.id }}>{t('adjustLimits')}</Link>
            </Button>
          </div>
        </>
      ),
    },
  ]
  total.current = cards.length
  const at = Math.min(i, cards.length - 1)
  const card = cards[at]
  const last = at >= cards.length - 1
  const next = () => setI(Math.min(at + 1, cards.length - 1))
  const back = () => setI(Math.max(0, at - 1))

  return (
    <main className="mx-auto grid w-full max-w-[520px] px-4 pt-[max(12px,env(safe-area-inset-top))] pb-4 lg:pt-8">
      <section
        className="board relative flex min-h-[min(520px,calc(100dvh-180px))] flex-col gap-5 overflow-hidden rounded-lg p-5 lg:min-h-[480px]"
        aria-roledescription="carousel"
        aria-label={range(data.cycle.start, data.cycle.end)}
      >
        <div className="grid gap-3">
          <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${cards.length}, 1fr)` }}>
            {cards.map((c, n) => (
              <span key={c.key} className={cn('h-[3px]', n <= at ? 'bg-sign' : 'bg-board-line')} />
            ))}
          </div>
          <div className="caps flex items-center justify-between text-[12px] text-on-board-2">
            <h1>{range(data.cycle.start, data.cycle.end)}</h1>
            <Link to="/" className="relative z-10 -my-3 -mr-3 grid h-11 place-items-center rounded-sm px-3 text-on-board hover:bg-flap">
              {t('close')}
            </Link>
          </div>
        </div>

        {/* Content sits at the foot of the card, like the front of a pass. */}
        <div key={card.key} className="flex flex-1 flex-col justify-end gap-4 animate-in fade-in slide-in-from-right-4 duration-300">
          {card.body}
        </div>

        {/* The way on, said out loud: Back, where you are, Next. */}
        <div className="relative z-10 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <span>
            {at > 0 && (
              <Button variant="ghost" onClick={back} className="-ml-3 text-on-board">
                <CaretLeft aria-hidden weight="bold" />
                {t('back')}
              </Button>
            )}
          </span>
          <span className="font-board text-[13px] text-on-board-2" aria-live="polite">
            {t('overDaysValue', { n: at + 1, total: cards.length })}
          </span>
          <span className="justify-self-end">
            {!last && (
              <Button onClick={next}>
                {t('next')}
                <CaretRight aria-hidden weight="bold" />
              </Button>
            )}
          </span>
        </div>

        {/* Tap zones for thumbs: left goes back, right goes forward. The buttons above serve keyboards and screen readers. */}
        {!last && <button type="button" tabIndex={-1} aria-hidden onClick={next} className="absolute inset-y-0 right-0 w-2/3" />}
        {at > 0 && <button type="button" tabIndex={-1} aria-hidden onClick={back} className="absolute inset-y-0 left-0 w-1/3" />}
      </section>
    </main>
  )
}

function Figure({ amount, suffix }: { amount: string; suffix: string }) {
  return (
    <p className="flex flex-wrap items-end gap-x-4 gap-y-2">
      <span className="font-board text-[40px] leading-none font-medium tracking-[-0.02em]">{amount}</span>
      <span className="caps text-[17px] text-on-board">{suffix}</span>
    </p>
  )
}

const Statement = ({ children }: { children: ReactNode }) => (
  <h2 className="text-[26px] leading-tight font-semibold text-balance">{children}</h2>
)
