import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowRight, CalendarCheck, CaretRight, Receipt, X } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'

import { BillRows } from '#/components/app/bills'
import { useActivePocket, useMoney, useShell, useT } from '#/components/app/context'
import { EntryRows } from '#/components/app/entry-list'
import { PocketChip, PocketTabs } from '#/components/app/frame'
import { Avatar, Board, BoardLine, CategoryGlyph, DayStrip, Figure, Flap, LimitBar, PageTitle, Status, Tile, boardGrid, glyphFor, pageMain } from '#/components/app/kit'
import { isOwed } from '#/lib/bills'
import type { LimitState } from '#/lib/budget'
import { cn } from '#/lib/utils'
import { getToday } from '#/server/today'
import type { TodayData } from '#/server/today'

export const Route = createFileRoute('/_app/')({
  loader: () => getToday(),
  component: Today,
})

function Today() {
  const data = Route.useLoaderData()
  const shell = useShell()
  const { t, day } = useT()
  const { money } = useMoney()
  // With no limits and no income the cycle panel would only repeat the hero's spent figure.
  const showCycle = data.daily.length > 0 || data.cycleLimit > 0 || data.earned > 0 || data.setAside > 0
  const shared = data.kind === 'shared' && data.members.length > 0
  // The limits table runs down the left beside every tile in the right column, so neither side leaves a hole.
  const beside = Number(data.bills.length > 0) + 1 + Number(shared) - Number(!showCycle)
  const span = beside === 3 ? 'lg:row-span-3' : beside === 2 ? 'lg:row-span-2' : undefined

  return (
    <main className={pageMain}>
      <PageTitle
        title={t('today')}
        sub={`${day(data.today, true)} · ${t('dayOf', { n: data.cycle.dayIndex, total: data.cycle.length })}`}
        aside={
          <Link to="/settings" aria-label={t('settings')} className="-my-0.5 grid size-11 place-items-center lg:hidden">
            <Avatar name={shell.user.name} className="size-10 bg-plate text-[16px] text-ink" />
          </Link>
        }
      />
      {/* Desktop switches pockets from the sidebar. */}
      <PocketTabs className="lg:hidden" />

      {data.recapFor && <RecapBanner start={data.recapFor.start} end={data.recapFor.end} />}

      <div className={boardGrid}>
        {/* A container, so the hero's flap tiles shrink to fit a narrow board. */}
        <Board className="@container content-start lg:col-span-4 lg:p-6">
          <BoardBody data={data} />
        </Board>

        {showCycle && <CycleBoard data={data} className="lg:col-span-2" />}

        {/* Bills sit above Recent in the right column; on the phone they come before the limits. */}
        {data.bills.length > 0 && <BillsTile data={data} className="lg:col-span-2 lg:col-start-5" />}

        <LimitsBoard data={data} className={cn('lg:col-span-4 lg:self-start', span)} />

        <Tile
          title={t('recent')}
          aside={
            <Link to="/spending" className="-mx-2 -my-3 flex items-center gap-1 px-2 py-3 hover:text-on-board">
              {t('seeAll')}
              <ArrowRight aria-hidden className="size-3.5" weight="bold" />
            </Link>
          }
          className="lg:col-span-2 lg:col-start-5"
        >
          {data.recent.length ? (
            <EntryRows entries={data.recent} today={data.today} who={data.kind === 'shared'} />
          ) : (
            <div className="flex items-center gap-4 py-2">
              <Receipt aria-hidden className="size-9 shrink-0 text-on-board-2" />
              <span className="grid gap-1">
                <span className="font-medium">{t('noEntries')}</span>
                <span className="text-[15px] text-on-board-2">{t('noEntriesHint')}</span>
              </span>
            </div>
          )}
        </Tile>

        {shared && (
          <Tile title={t('loggedBy')} className="lg:col-span-2 lg:col-start-5">
            <div className="grid">
              {data.members.map((m) => (
                <div key={m.id} className="flex items-center gap-3 border-t border-board-line py-3">
                  <Avatar name={m.name} className="bg-flap text-on-board" />
                  <span className="min-w-0 flex-1 truncate">{m.id === shell.user.id ? t('you') : m.name}</span>
                  <span className="font-board text-[16px] font-semibold">{money(m.spent)}</span>
                </div>
              ))}
            </div>
          </Tile>
        )}
      </div>
    </main>
  )
}

/** What the hero board says: today's first per-day limit, else what is left this cycle. */
function BoardBody({ data }: { data: TodayData }) {
  const { t, range } = useT()
  const { money } = useMoney()
  const pocket = useActivePocket()
  const first = data.daily[0]

  if (first) {
    const over = first.left < 0
    const G = glyphFor(first.name)
    return (
      <>
        <BoardLine
          left={
            <span className="flex items-center gap-2">
              {G && <G className="size-4 shrink-0 text-ink-2" />}
              {first.name} · {t('aDay', { amount: money(first.limit) })}
            </span>
          }
          right={range(data.cycle.start, data.cycle.end)}
        />
        <Link
          to="/category/$categoryId"
          params={{ categoryId: first.id }}
          className="mt-4 flex flex-wrap items-end gap-x-4 gap-y-2 transition-opacity hover:opacity-80"
        >
          <Flap text={money(Math.abs(first.left))} className="text-[46px] lg:text-[64px]" />
          <span className={cn('pb-1 text-[15px] leading-tight', over ? 'text-over-text' : 'text-ink-2')}>
            {over ? t('over') : t('leftToday')}
          </span>
        </Link>
        <DayStrip days={first.strip} onBoard className="mt-5" />
        <BoardLine
          className="mt-2.5"
          left={t('spentToday', { amount: money(first.spentToday) })}
          right={
            <span className={cn(first.overDays > 0 && 'text-over-text')}>
              {first.overDays === 0 ? t('noDaysOver') : first.overDays === 1 ? t('oneDayOver') : t('daysOver', { n: first.overDays })}
            </span>
          }
        />
      </>
    )
  }

  const hasLimits = data.cycleLimit > 0
  const left = data.cycleLeft
  const spentIn = data.cycleLimit - left - data.cycleAside
  return (
    <>
      <BoardLine
        left={
          <span className="flex items-center gap-2">
            <PocketChip color={pocket.color} />
            {pocket.name} · {t('thisCycle')}
          </span>
        }
        right={range(data.cycle.start, data.cycle.end)}
      />
      <div className="mt-4 flex flex-wrap items-end gap-x-4 gap-y-2">
        <Flap text={money(hasLimits ? Math.abs(left) : data.spent)} className="text-[40px] lg:text-[56px]" />
        <span className={cn('pb-1 text-[15px] leading-tight', hasLimits && left < 0 ? 'text-over-text' : 'text-ink-2')}>
          {hasLimits ? (left < 0 ? t('over') : t('leftThisCycle')) : t('spent')}
        </span>
      </div>
      {hasLimits && (
        <LimitBar spent={spentIn} aside={data.cycleAside} limit={data.cycleLimit} state={left < 0 ? 'over' : 'ok'} onBoard className="mt-5" />
      )}
      <BoardLine
        className="mt-2.5"
        left={hasLimits ? `${money(spentIn)} ${t('of')} ${money(data.cycleLimit)}` : ''}
        right={t('dayOf', { n: data.cycle.dayIndex, total: data.cycle.length })}
      />
    </>
  )
}

/** The cycle so far against what came in; the whole board opens Review. */
function CycleBoard({ data, className }: { data: TodayData; className?: string }) {
  const { t } = useT()
  const { money } = useMoney()
  const left = data.earned - data.spent - data.setAside
  return (
    <Link to="/review" className={cn('board grid content-start gap-4 rounded-lg p-4 transition-colors hover:bg-flap lg:p-5', className)}>
      <BoardLine left={t('thisCycle')} />
      <span className="flex flex-wrap items-end gap-x-3 gap-y-2">
        <Figure text={money(data.spent)} className="text-[30px] lg:text-[32px]" />
        <span className="pb-1 text-[15px] leading-tight text-ink-2">{t('spent')}</span>
      </span>
      {data.earned > 0 && (
        <span className="grid gap-2.5">
          <span aria-hidden className="relative flex h-1 bg-board-line">
            <span className={left < 0 ? 'bg-over' : 'bg-ink'} style={{ width: `${Math.min(100, (data.spent / data.earned) * 100)}%` }} />
            {data.setAside > 0 && <span className="set-aside text-on-board-2" style={{ width: `${Math.min(100, (data.setAside / data.earned) * 100)}%` }} />}
          </span>
          <BoardLine
            left={t('ofEarnedAmount', { amount: money(data.earned) })}
            right={
              <span className={cn(left < 0 ? 'text-over-text' : 'text-on-board')}>
                {left < 0 ? t('amountOver', { amount: money(-left) }) : t('notSpentYetAmount', { amount: money(left) })}
              </span>
            }
          />
        </span>
      )}
      {data.setAside > 0 && <SetAside amount={data.setAside} count={data.setAsideCount} />}
      <span className="caps mt-auto flex items-center gap-1.5 text-[12px] text-on-board-2">
        {t('review')}
        <ArrowRight aria-hidden className="size-3.5" weight="bold" />
      </span>
    </Link>
  )
}

// Under 380px the status keeps only its dot (the word goes to screen readers), so the name keeps room to read.
// The amount column grows past its width for a wide sign (CHF 12,345.50) and takes the room from the name.
const limitCols = 'grid grid-cols-[minmax(0,1fr)_minmax(84px,auto)_12px] items-center gap-x-3 min-[380px]:grid-cols-[minmax(0,1fr)_minmax(88px,auto)_84px]'

/** The cycle table in a panel: each category, what is left, and its status; problems first. */
function LimitsBoard({ data, className }: { data: TodayData; className?: string }) {
  const { t } = useT()
  const { money } = useMoney()
  return (
    <Board className={cn('content-start lg:p-5', className)}>
      <div className={cn(limitCols, 'caps pb-2.5 text-[12px] leading-4 text-on-board-2')}>
        <h2>{t('limits')}</h2>
        <span className="text-right">{t('colLeft')}</span>
        <span className="text-right max-[379px]:sr-only">{t('colStatus')}</span>
      </div>

      {!data.hasCategories && (
        <Link to="/settings" search={{ pocket: data.pocketId }} className="caps flex items-center justify-between border-t border-board-line py-3 text-[13px]">
          {t('noCategories')}
          <CaretRight className="size-4" weight="bold" />
        </Link>
      )}

      {/* The hero shows the first per-day limit; the rest read as rows with their day strip. */}
      {data.daily.slice(1).map((d) => (
        <LimitRow
          key={d.id}
          id={d.id}
          name={d.name}
          left={d.left}
          state={d.left < 0 ? 'over' : 'ok'}
          below={<DayStrip days={d.strip} onBoard />}
        />
      ))}
      {data.limited.map((r) => (
        <LimitRow
          key={r.id}
          id={r.id}
          name={r.name}
          left={r.left}
          state={r.state}
          sub={r.aside.amount > 0 ? <SetAside amount={r.aside.amount} count={r.aside.count} /> : undefined}
          below={<LimitBar spent={r.spent} aside={r.aside.amount} limit={r.limit} pace={r.pace} state={r.state} onBoard />}
        />
      ))}
      {/* No limit, so nothing is left: the row says what went out instead. */}
      {data.open.map((r) => (
        <LimitRow
          key={r.id}
          id={r.id}
          name={r.name}
          left={null}
          state="none"
          sub={<span className="truncate text-[12px] text-on-board-2">{t('amountSpent', { amount: money(r.spent) })}</span>}
        />
      ))}

      {data.hasCategories && (
        <div className="caps flex items-baseline justify-between border-t-2 border-board-line pt-3 text-[13px]">
          <span className="text-on-board-2">{t('spent')}</span>
          <span className="text-[17px]">{money(data.spent)}</span>
        </div>
      )}
    </Board>
  )
}

function LimitRow({ id, name, left, state, sub, below }: { id: string; name: string; left: number | null; state: LimitState; sub?: ReactNode; below?: ReactNode }) {
  const { money } = useMoney()
  return (
    <Link
      to="/category/$categoryId"
      params={{ categoryId: id }}
      className="group -mx-2 grid gap-2.5 border-t border-board-line px-2 py-3 transition-colors hover:bg-flap"
    >
      <span className={limitCols}>
        <span className="flex min-w-0 items-center gap-3">
          <CategoryGlyph name={name} className="size-7" />
          <span className="grid min-w-0">
            <span className="truncate text-[16px] font-medium">{name}</span>
            {sub}
          </span>
        </span>
        <span className={cn('text-right font-board text-[17px] font-semibold', state === 'over' && 'text-over-text', left === null && 'text-on-board-2')}>
          {left === null ? '—' : left < 0 ? `−${money(-left)}` : money(left)}
        </span>
        <Status state={state} onBoard compact className="justify-self-end" />
      </span>
      {below}
    </Link>
  )
}

function RecapBanner({ start, end }: { start: string; end: string }) {
  const { t, range } = useT()
  const key = `recap-dismissed-${start}`
  const [hidden, setHidden] = useState(true)
  useEffect(() => {
    try {
      setHidden(localStorage.getItem(key) === '1')
    } catch {
      setHidden(false)
    }
  }, [key])
  if (hidden) return null
  return (
    <div className="board flex items-center gap-2 overflow-hidden rounded-lg pl-4">
      <Link to="/recap" className="flex flex-1 items-center gap-3 py-3 text-[14px] font-medium">
        <CalendarCheck aria-hidden className="size-5 shrink-0 text-ink-2" />
        <span className="flex-1">{t('recapReady', { range: range(start, end) })}</span>
        <ArrowRight aria-hidden className="size-4 shrink-0" weight="bold" />
      </Link>
      <button
        type="button"
        aria-label={t('dismiss')}
        onClick={() => {
          try {
            localStorage.setItem(key, '1')
          } catch {}
          setHidden(true)
        }}
        className="grid size-11 place-items-center text-ink-2 hover:bg-plate hover:text-ink"
      >
        <X className="size-4" weight="bold" />
      </button>
    </div>
  )
}

/** Money held back for bills still to pay, with the hatch the bars use. */
function SetAside({ amount, count }: { amount: number; count: number }) {
  const { t } = useT()
  const { money } = useMoney()
  return (
    <span className="caps flex items-center gap-2 text-[11px] text-on-board-2">
      <i aria-hidden className="set-aside h-[7px] w-3.5 shrink-0" />
      {count === 1 ? t('setAsideOne', { amount: money(amount) }) : t('setAsideBills', { amount: money(amount), n: count })}
    </span>
  )
}

/** D1: this cycle's bills as ruled rows, late first; the Bills page holds them all. */
function BillsTile({ data, className }: { data: TodayData; className?: string }) {
  const { t } = useT()
  const toPay = data.bills.filter((b) => isOwed(b.state)).length
  return (
    <Tile
      title={t('billsThisCycle')}
      aside={
        <Link to="/bills" className="-mx-2 -my-3 flex items-center gap-1 px-2 py-3 hover:text-on-board">
          {toPay > 0 ? `${t('billsToPay', { n: toPay })} · ` : ''}
          {t('seeAll')}
          <ArrowRight aria-hidden className="size-3.5" weight="bold" />
        </Link>
      }
      className={className}
    >
      <BillRows bills={data.bills} today={data.today} />
    </Tile>
  )
}
