import { Link, createFileRoute, stripSearchParams, useNavigate } from '@tanstack/react-router'
import { ArrowDownRight, ArrowUpRight, CaretRight, CaretUp } from '@phosphor-icons/react'
import { z } from 'zod'

import { CycleBars, RunningTotal, WeekdayBars, WhereItWent, useCategoryColor } from '#/components/app/charts'
import { useActivePocket, useT } from '#/components/app/context'
import { PocketChip, PocketTabs } from '#/components/app/frame'
import { Board, BoardLine, CategoryGlyph, Figure, PageTitle, Segmented, Tile, boardGrid, pageMain } from '#/components/app/kit'
import { addDays, formatBaht, weekday } from '#/lib/budget'
import { weekdayNames } from '#/lib/i18n'
import { cn } from '#/lib/utils'
import { getReview } from '#/server/review'
import type { ReviewData } from '#/server/review'

const search = z.object({ range: z.enum(['cycle', 'last3', 'year']).default('cycle').catch('cycle') })

export const Route = createFileRoute('/_app/review')({
  validateSearch: search,
  // This cycle is the default, so a plain /review stays plain.
  search: { middlewares: [stripSearchParams({ range: 'cycle' })] },
  loaderDeps: ({ search }) => ({ range: search.range }),
  loader: ({ deps }) => getReview({ data: { range: deps.range } }),
  component: Review,
})

function Review() {
  const data = Route.useLoaderData()
  const { t, range } = useT()
  const facts = useFacts(data)
  const partial = data.range === 'cycle'

  return (
    <main className={pageMain}>
      <PageTitle
        title={t('review')}
        sub={`${range(data.from, data.to)}${partial ? ` · ${t('dayOf', { n: data.cycle.dayIndex, total: data.cycle.length })}` : ''}`}
      />
      <PocketTabs className="lg:hidden" />

      <div className={boardGrid}>
        <SpentBoard data={data} className="lg:col-span-2" />

        {data.spent > 0 && (
          // The range is in the page title; over several cycles the parts are per-cycle averages, so say so here.
          <Tile title={t('whereItWent')} aside={partial ? undefined : t('perCycleAvg')} className="lg:col-span-4">
            <WhereItWent categories={data.categories} otherLabel={t('otherCategories')} />
          </Tile>
        )}

        {facts && (
          // One panel split three ways, not three cards under the big figure.
          <div className="board grid grid-cols-3 divide-x divide-board-line rounded-lg lg:col-span-6">
            <Fact label={t('avgADay')} value={formatBaht(facts.avgPerDay)} />
            {facts.biggest && <Fact label={t('biggestDay')} value={formatBaht(facts.biggest.amount)} sub={facts.biggest.date} />}
            {facts.most && <Fact label={t('mostLogged')} value={facts.most.name} sub={t('timesLogged', { n: facts.most.count })} text />}
          </div>
        )}

        {data.burn && (
          <Tile title={t('runningTotal')} aside={t('dayOf', { n: data.cycle.dayIndex, total: data.cycle.length })} className="lg:col-span-6">
            <RunningTotal
              current={data.burn.current}
              previous={data.burn.previous}
              plan={data.burn.plan}
              length={data.cycle.length}
              start={data.cycle.start}
              end={data.cycle.end}
            />
          </Tile>
        )}

        {/* The long category list spans two rows; the two short charts stack beside it. */}
        <ByCategory data={data} className="lg:col-span-4 lg:row-span-2" />

        {facts && (
          <Tile title={t('byWeekday')} aside={t('weekdayAvg', { day: facts.names[facts.topDay] })} className="lg:col-span-2">
            <WeekdayBars values={facts.weekday} names={facts.names} />
          </Tile>
        )}

        <Tile title={t('spentPerCycle')} className="lg:col-span-2">
          <CycleBars bars={data.history} cycle={data.cycle} className="h-36" />
        </Tile>
      </div>
    </main>
  )
}

/** What went out over the chosen range, against last time and against what came in. The range switch lives here. */
function SpentBoard({ data, className }: { data: ReviewData; className?: string }) {
  const navigate = useNavigate({ from: '/review' })
  const pocket = useActivePocket()
  const { t } = useT()
  const partial = data.range === 'cycle'
  let delta: string | null = null
  if (data.compare !== null) {
    const diff = data.spent - data.compare
    const amount = formatBaht(Math.abs(diff))
    delta = partial
      ? t(diff <= 0 ? 'lessThanLast' : 'moreThanLast', { amount, n: data.cycle.dayIndex })
      : t(diff <= 0 ? 'lessThanPrev' : 'moreThanPrev', { amount })
  }
  const less = data.compare !== null && data.spent <= data.compare
  const left = data.earned - data.spent

  return (
    <div className={cn('grid content-start gap-2', className)}>
      <Segmented
        label={t('review')}
        value={data.range}
        onChange={(r) => navigate({ search: { range: r }, replace: true, resetScroll: false })}
        options={[
          { value: 'cycle', label: t('rangeCycle') },
          { value: 'last3', label: t('rangeLast3') },
          { value: 'year', label: t('rangeYear') },
        ]}
      />
      <Board className="content-start lg:p-5">
        <BoardLine
          left={
            <span className="flex items-center gap-2">
              <PocketChip color={pocket.color} />
              {pocket.name}
            </span>
          }
        />
        <div className="mt-4 flex flex-wrap items-end gap-x-3 gap-y-2">
          <Figure text={formatBaht(data.spent)} className="text-[32px] lg:text-[40px]" />
          <span className="pb-1 text-[15px] text-ink-2">{t('spent')}</span>
        </div>
        {delta && (
          <p className={cn('caps mt-3 flex items-center gap-1.5 text-[13px]', less ? 'text-ok-text' : 'text-ahead-text')}>
            {less ? (
              <ArrowDownRight aria-hidden className="size-4 shrink-0" weight="bold" />
            ) : (
              <ArrowUpRight aria-hidden className="size-4 shrink-0" weight="bold" />
            )}
            {delta}
          </p>
        )}
        {/* Earned as one bar: the white part is spent, the rest is what is left of it. */}
        {data.kind === 'personal' && data.earned > 0 && (
          <>
            <div className="relative mt-5 h-1 bg-board-line">
              <div
                className={cn('absolute inset-y-0 left-0', left < 0 ? 'bg-over' : 'bg-ink')}
                style={{ width: `${Math.min(100, (data.spent / data.earned) * 100)}%` }}
              />
            </div>
            <BoardLine
              className="mt-2.5"
              left={t('ofEarnedAmount', { amount: formatBaht(data.earned) })}
              right={
                <span className={cn(left < 0 ? 'text-over-text' : 'text-on-board')}>
                  {left < 0
                    ? t('amountOver', { amount: formatBaht(-left) })
                    : t(partial ? 'notSpentYetAmount' : 'keptAmount', { amount: formatBaht(left) })}
                </span>
              }
            />
          </>
        )}
      </Board>
    </div>
  )
}

/** Each category on one scale, with its 3-cycle average as a hollow square; a row opens the category. */
function ByCategory({ data, className }: { data: ReviewData; className?: string }) {
  const { t } = useT()
  const color = useCategoryColor()
  const partial = data.range === 'cycle'
  // One scale for every row, so bar lengths compare across categories.
  const top = Math.max(1, ...data.categories.flatMap((x) => [x.value, partial ? (x.average ?? 0) : 0]))
  return (
    <Tile title={t('byCategory')} aside={partial ? t('avgTick') : t('perCycleAvg')} className={className}>
      <div className="grid">
        {data.categories.map((c) => {
          // The 3-cycle average only means something next to this cycle; on longer ranges it equals the value.
          const avg = partial ? c.average : null
          const above = avg !== null && c.value > avg * 1.1
          return (
            <Link
              key={c.id}
              to="/category/$categoryId"
              params={{ categoryId: c.id }}
              className="group -mx-2 grid gap-2.5 border-t border-board-line px-2 py-3 transition-colors hover:bg-flap"
            >
              <span className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-3">
                  <CategoryGlyph name={c.name} className="size-7" />
                  <span className="truncate text-[16px] font-medium">{c.name}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  {/* Above average is said in words, not amber: amber means ahead of a limit's pace. */}
                  {above && (
                    <span className="caps mr-2 flex items-center gap-1 text-[11px]">
                      <CaretUp aria-hidden weight="fill" className="size-3" />
                      {t('vsAvg', { amount: formatBaht(c.value - avg!) })}
                    </span>
                  )}
                  <span className="font-board text-[17px] font-semibold">{formatBaht(c.value)}</span>
                  <CaretRight aria-hidden className="size-4 text-on-board-2" weight="bold" />
                </span>
              </span>
              <span aria-hidden className="relative h-1 bg-board-line">
                <span className="absolute inset-y-0 left-0" style={{ width: `${(c.value / top) * 100}%`, background: color(c.name) }} />
                {/* The average is a hollow square, so it never reads as Today's pace tick. */}
                {avg !== null && (
                  <span
                    className="absolute top-1/2 size-2.5 -translate-y-1/2 border-2 border-on-board bg-board"
                    style={{ left: `calc(${(avg / top) * 100}% - 5px)` }}
                  />
                )}
              </span>
            </Link>
          )
        })}
      </div>
    </Tile>
  )
}

function Fact({ label, value, sub, text }: { label: string; value: string; sub?: string; text?: boolean }) {
  return (
    <div className="grid min-w-0 content-start gap-1 p-3 lg:p-5">
      <span className="caps truncate text-[12px] text-on-board-2">{label}</span>
      <span className={cn('truncate font-semibold', text ? 'text-[17px] lg:text-[20px]' : 'font-board text-[17px] lg:text-[26px]')}>{value}</span>
      {sub && <span className="truncate text-[12px] text-on-board-2">{sub}</span>}
    </div>
  )
}

/** Figures read off the entries: average per day, the biggest day, what gets logged most, spend by weekday. */
function useFacts(data: ReviewData) {
  const { day, locale } = useT()
  if (!data.entries.length) return null
  const today = addDays(data.cycle.start, data.cycle.dayIndex - 1)
  const last = data.to < today ? data.to : today
  const days = Math.round((Date.parse(last) - Date.parse(data.from)) / 86_400_000) + 1
  const names = new Map(data.categories.map((c) => [c.id, c.name]))

  const byDate = new Map<string, number>()
  const counts = new Map<string, number>()
  const weekdayTotal = Array(7).fill(0) as number[]
  for (const e of data.entries) {
    byDate.set(e.occurredOn, (byDate.get(e.occurredOn) ?? 0) + e.amount)
    const what = e.note || names.get(e.categoryId) || ''
    if (what) counts.set(what, (counts.get(what) ?? 0) + 1)
    weekdayTotal[(weekday(e.occurredOn) + 6) % 7] += e.amount
  }
  // How many of each weekday the range has had so far, so each bar is an average, not a total.
  const weekdayDays = Array(7).fill(0) as number[]
  for (let d = 0; d < days; d++) weekdayDays[(weekday(addDays(data.from, d)) + 6) % 7]++
  // shortcut: entries are capped at 400 server-side, so a long year range averages a sample; fine for a household budget.
  const weekdayAvg = weekdayTotal.map((v, i) => (weekdayDays[i] ? Math.round(v / weekdayDays[i] / 100) * 100 : 0))
  const [bigDate, bigAmount] = [...byDate].sort((a, b) => b[1] - a[1])[0]
  const [mostName, mostCount] = [...counts].sort((a, b) => b[1] - a[1])[0] ?? []

  return {
    avgPerDay: Math.round(data.spent / Math.max(1, days) / 100) * 100,
    biggest: { amount: bigAmount, date: day(bigDate, true) },
    most: mostName ? { name: mostName, count: mostCount } : null,
    weekday: weekdayAvg,
    topDay: weekdayAvg.indexOf(Math.max(...weekdayAvg)),
    names: weekdayNames(locale),
  }
}
