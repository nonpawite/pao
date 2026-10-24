import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { CaretLeft, CaretRight, Plus, Receipt } from '@phosphor-icons/react'
import { useState } from 'react'
import { z } from 'zod'

import { BillForm, draftFrom, useNewDraft } from '#/components/app/bill-form'
import type { BillDraft } from '#/components/app/bill-form'
import { BillRows } from '#/components/app/bills'
import { Button } from '#/components/ui/button'
import { useCategoryColor } from '#/components/app/charts'
import { useActivePocket, useMoney, useShell, useT } from '#/components/app/context'
import { PocketTabs } from '#/components/app/frame'
import { Board, CategoryGlyph, Figure, PageTitle, Segmented, Tile, boardGrid, pageMain } from '#/components/app/kit'
import { isOwed } from '#/lib/bills'
import { addDays, daysInMonth, diffDays, iso, weekday } from '#/lib/budget'
import { ordinal } from '#/lib/i18n'
import { cn } from '#/lib/utils'
import { getBillsPage } from '#/server/bills'
import type { BillsPage } from '#/server/bills'

export const Route = createFileRoute('/_app/bills')({
  validateSearch: z.object({
    view: z.enum(['list', 'calendar']).optional(),
    m: z
      .string()
      .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
      .optional(),
  }),
  loaderDeps: ({ search }) => ({ m: search.m }),
  loader: ({ deps }) => getBillsPage({ data: { month: deps.m } }),
  component: Bills,
})

type Bill = BillsPage['monthBills'][number]

const shiftMonth = (month: string, n: number) => {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + n, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/** What a bill counts for in the month: what was paid, else what it costs or last cost; nothing once skipped. */
const worth = (b: Bill) => (b.state === 'skipped' ? 0 : (b.paidAmount ?? b.amount ?? b.lastPaid ?? 0))

/** Every bill of the pocket: a list to manage them, or the calendar of a month. Both open the same bill form. */
function Bills() {
  const data = Route.useLoaderData()
  const { view = 'list' } = Route.useSearch()
  const pocket = useActivePocket()
  const navigate = useNavigate({ from: Route.fullPath })
  const { t } = useT()
  const newDraft = useNewDraft()
  const [draft, setDraft] = useState<BillDraft | null>(null)
  const edit = pocket.role === 'owner' ? (b: Parameters<typeof draftFrom>[0]) => setDraft(draftFrom(b)) : undefined
  const add = (date?: string) => setDraft(newDraft(date))
  const switcher = (className: string) => (
    <Segmented
      label={t('bills')}
      value={view}
      onChange={(v) => void navigate({ search: (s) => ({ ...s, view: v === 'list' ? undefined : v }) })}
      options={[
        { value: 'list', label: t('list') },
        { value: 'calendar', label: t('calendar') },
      ]}
      className={className}
    />
  )

  return (
    <main className={pageMain}>
      {/* Desktop keeps the controls in the title row; the phone gives them their own rows so the title keeps its room. */}
      <PageTitle
        title={t('bills')}
        sub={pocket.name}
        aside={
          <div className="hidden items-center gap-4 lg:flex">
            {view === 'calendar' && <MonthNav month={data.month} today={data.today} />}
            {switcher('w-60')}
          </div>
        }
      />
      <PocketTabs className="lg:hidden" />
      <div className="grid gap-2 lg:hidden">
        {switcher('w-full')}
        {view === 'calendar' && <MonthNav month={data.month} today={data.today} />}
      </div>
      {view === 'calendar' ? <CalendarView key={data.month} data={data} onEdit={edit} onAdd={add} /> : <ListView data={data} onEdit={edit} onAdd={add} />}
      <BillForm draft={draft} setDraft={setDraft} />
    </main>
  )
}

const listCols = 'grid grid-cols-[minmax(0,1fr)_68px_60px] items-center gap-x-3 lg:grid-cols-[minmax(0,1fr)_132px_96px_110px]'

/** The pocket's bills as a timetable, soonest first, with what they cost a month and a year. */
function ListView({ data, onEdit, onAdd }: { data: BillsPage; onEdit?: (b: Parameters<typeof draftFrom>[0]) => void; onAdd: (date?: string) => void }) {
  const { t, day, locale, names } = useT()
  const pocket = useActivePocket()
  const { money } = useMoney()
  const cost = (b: BillsPage['bills'][number]) => b.amount ?? b.lastPaid ?? 0
  const perMonth = data.bills.filter((b) => b.repeat === 'monthly').reduce((s, b) => s + cost(b), 0)
  const perYear = perMonth * 12 + data.bills.filter((b) => b.repeat === 'yearly').reduce((s, b) => s + cost(b), 0)
  const toPay = data.bills.reduce((s, b) => s + b.setAside, 0)
  const yearlyOn = (b: BillsPage['bills'][number]) => t('dateDay', { day: b.day, month: names.months[b.month! - 1] })
  const when = (b: BillsPage['bills'][number]) =>
    b.repeat === 'yearly'
      ? `${t('yearly')} · ${yearlyOn(b)}`
      : b.day === 31
        ? t('lastDay')
        : `${t('monthly')} · ${ordinal(locale, b.day)}`
  const next = (b: BillsPage['bills'][number]) => {
    if (b.state === 'late') {
      const n = diffDays(b.due!, data.today)
      return <span className="text-over-text">{n === 1 ? t('billLateOne') : t('billLate', { n })}</span>
    }
    if (b.state === 'today') return <span className="text-ahead-text">{t('billToday')}</span>
    return day(b.next)
  }

  // No bills yet: one panel that says so and offers the first one, not a table header over zeros.
  if (!data.bills.length)
    return (
      <Board className="justify-items-start gap-4 lg:p-6">
        <Receipt aria-hidden className="size-9 text-on-board-2" />
        <span className="grid gap-1">
          <span className="font-medium">{t('noBills')}</span>
          <span className="text-[15px] text-on-board-2">{onEdit && !pocket.categories.length ? t('noCategories') : t('noBillsHint')}</span>
        </span>
        {onEdit && pocket.categories.length > 0 && (
          <Button onClick={() => onAdd()}>
            <Plus aria-hidden weight="bold" />
            {t('addBill')}
          </Button>
        )}
      </Board>
    )

  return (
    <div className={boardGrid}>
      <Tile
        title={t('aMonth')}
        aside={data.bills.length === 1 ? t('billOne') : t('billCount', { n: data.bills.length })}
        className="lg:col-span-2 lg:col-start-5 lg:row-start-1"
      >
        <span className="font-board text-[32px] leading-none font-semibold">{money(perMonth)}</span>
        <dl className="grid gap-2 font-board text-[12px] font-semibold">
          <Fact label={t('aYear')} value={money(perYear)} />
          <Fact label={t('toPayCycle')} value={money(toPay)} />
        </dl>
        {onEdit && pocket.categories.length > 0 && (
          <button
            type="button"
            onClick={() => onAdd()}
            className="caps -mb-2 flex min-h-11 items-center gap-2 border-t border-board-line text-[13px]"
          >
            <Plus aria-hidden className="size-4" weight="bold" />
            {t('addBill')}
          </button>
        )}
      </Tile>

      <Board className="content-start lg:col-span-4 lg:col-start-1 lg:row-start-1 lg:p-5">
        <div className={cn(listCols, 'caps pb-2.5 text-[12px] leading-4 text-on-board-2')}>
          <h2>{t('bills')}</h2>
          <span className="hidden lg:block">{t('repeats')}</span>
          <span className="text-right">{t('amount')}</span>
          <span className="text-right">{t('colNext')}</span>
        </div>
        {data.bills.map((b) => (
          <button
            key={b.id}
            type="button"
            disabled={!onEdit}
            onClick={() => onEdit?.(b)}
            className={cn(
              listCols,
              'group -mx-2 border-t border-board-line px-2 py-3 text-left transition-colors enabled:hover:bg-flap disabled:cursor-default',
            )}
          >
            <span className="flex min-w-0 items-center gap-3">
              <CategoryGlyph name={pocket.categories.find((c) => c.id === b.categoryId)?.name ?? ''} className="size-7" />
              <span className="grid min-w-0">
                <span className="truncate text-[16px] font-medium">{b.name}</span>
                <span className="truncate text-[12px] text-on-board-2">
                  {/* The phone has no Repeats column, so the day rides along here. */}
                  <span className="lg:hidden">
                    {b.repeat === 'yearly' ? yearlyOn(b) : b.day === 31 ? t('lastDay') : ordinal(locale, b.day)} ·{' '}
                  </span>
                  {pocket.categories.find((c) => c.id === b.categoryId)?.name}
                </span>
              </span>
            </span>
            <span className="caps hidden text-[12px] text-on-board-2 lg:block">{when(b)}</span>
            <span className="text-right font-board text-[17px] font-semibold">
              {b.amount !== null ? money(b.amount) : <span className="text-[13px] text-on-board-2">{t('varies')}</span>}
            </span>
            <span className="caps text-right text-[12px] text-on-board-2">{next(b)}</span>
          </button>
        ))}
      </Board>
    </div>
  )
}

/** ‹ month › in the title row, as Subly's calendar has it; the month's name returns to this month. */
function MonthNav({ month, today }: { month: string; today: string }) {
  const navigate = useNavigate({ from: Route.fullPath })
  const { t, month: monthLabel } = useT()
  const thisMonth = today.slice(0, 7)
  const go = (m: string) => void navigate({ search: { view: 'calendar', m: m === thisMonth ? undefined : m } })
  const arrow = 'grid size-11 place-items-center rounded-sm text-ink-2 transition-colors hover:bg-plate hover:text-ink lg:size-9'
  return (
    <div className="flex items-center justify-between gap-1">
      <button type="button" aria-label={t('prevMonth')} onClick={() => go(shiftMonth(month, -1))} className={arrow}>
        <CaretLeft className="size-4" />
      </button>
      <button
        type="button"
        disabled={month === thisMonth}
        onClick={() => go(thisMonth)}
        title={month === thisMonth ? undefined : t('thisMonthLink')}
        className="h-11 min-w-36 rounded-sm px-2 text-center text-[15px] font-medium enabled:hover:bg-plate lg:h-9"
      >
        {monthLabel(month)}
      </button>
      <button type="button" aria-label={t('nextMonth')} onClick={() => go(shiftMonth(month, 1))} className={arrow}>
        <CaretRight className="size-4" />
      </button>
    </div>
  )
}

/**
 * Subly's calendar with our bills in it: the month grid is the panel, full weekday names across the top,
 * days outside the month shaded, today in a badge of the pocket's colour. Beside it, the month's total and
 * its biggest day, then the month's bills (or the picked day's) in a list panel.
 */
function CalendarView({ data, onEdit, onAdd }: { data: BillsPage; onEdit?: (b: Parameters<typeof draftFrom>[0]) => void; onAdd: (date?: string) => void }) {
  const shell = useShell()
  const pocket = useActivePocket()
  const { t, day, month: monthLabel, names } = useT()
  const { money } = useMoney()
  const [picked, setPicked] = useState<string | null>(null)
  const owner = pocket.role === 'owner'

  const [y, m] = data.month.split('-').map(Number)
  const first = iso(y, m, 1)
  const length = daysInMonth(y, m)
  // Days before the 1st fill the first week; days after the last fill the final one.
  const lead = (weekday(first) - shell.user.weekStart + 7) % 7
  const cells = Array.from({ length: Math.ceil((lead + length) / 7) * 7 }, (_, i) => addDays(first, i - lead))
  const payday = iso(y, m, Math.min(data.payday, length))
  // Names come Monday first; turn them to start on the user's day.
  const weekdays = (list: string[]) => Array.from({ length: 7 }, (_, i) => list[(shell.user.weekStart + i + 6) % 7])
  const [long, short] = [weekdays(names.weekdaysLong), weekdays(names.weekdays)]

  const onDay = new Map<string, Bill[]>()
  for (const b of data.monthBills) onDay.set(b.due!, [...(onDay.get(b.due!) ?? []), b])
  const total = data.monthBills.reduce((s, b) => s + worth(b), 0)
  const paid = data.monthBills.reduce((s, b) => s + (b.state === 'paid' ? (b.paidAmount ?? 0) : 0), 0)
  const toPay = data.monthBills.reduce((s, b) => s + b.setAside, 0)
  const biggest = [...onDay].map(([d, bs]) => ({ d, sum: bs.reduce((s, b) => s + worth(b), 0) })).sort((a, b) => b.sum - a.sum)[0]
  const shown = picked ? (onDay.get(picked) ?? []) : data.monthBills
  const statLabel = 'text-[13px] text-ink-2'

  return (
    <div className={boardGrid}>
      <div
        role="group"
        aria-label={monthLabel(data.month)}
        className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-board-line bg-board-line lg:col-span-4"
      >
        {long.map((name, i) => (
          <span key={name} aria-hidden className="bg-board py-1.5 text-center text-[12px] leading-5 text-ink-2 lg:text-[13px]">
            <span className="lg:hidden">{short[i]}</span>
            <span className="hidden lg:inline">{name}</span>
          </span>
        ))}
        {cells.map((d, i) => (
          <DayCell
            key={d}
            // The bottom corners round with the grid (its 8px less the 1px border), so a selection outline follows them.
            className={i === cells.length - 7 ? 'rounded-bl-[7px]' : i === cells.length - 1 ? 'rounded-br-[7px]' : undefined}
            date={d}
            inMonth={d.slice(0, 7) === data.month}
            today={d === data.today}
            payday={d === payday ? (pocket.kind === 'personal' ? t('payday') : t('cycleStartShort')) : undefined}
            picked={d === picked}
            bills={d.slice(0, 7) === data.month ? (onDay.get(d) ?? []) : []}
            onPick={() => setPicked(picked === d ? null : d)}
          />
        ))}
      </div>

      {/* The month's figures and its bills stack beside the grid, each as tall as its content. */}
      <div className="grid content-start gap-3 lg:col-span-2 lg:gap-4">
        <Tile title={t('billsInMonth', { month: monthLabel(data.month) })} aside={data.monthBills.length === 1 ? t('billOne') : t('billCount', { n: data.monthBills.length })}>
          <Figure text={money(total)} className="text-[30px]" />
          {total > 0 && (
            <span aria-hidden className="flex h-1 bg-board-line">
              <span className="bg-ink" style={{ width: `${(paid / total) * 100}%` }} />
              <span className="set-aside text-on-board-2" style={{ width: `${(toPay / total) * 100}%` }} />
            </span>
          )}
          <dl className="grid gap-2 text-[13px]">
            <Fact label={t('paidLabel')} value={money(paid)} />
            <Fact label={t('toPay')} value={money(toPay)} />
            <Fact label={t('biggestDay')} value={biggest && biggest.sum > 0 ? `${day(biggest.d)} · ${money(biggest.sum)}` : '—'} />
          </dl>
        </Tile>

        <div className="board grid rounded-lg">
          <div className="flex items-center justify-between gap-3 border-b border-board-line px-4 py-3">
            <h2 className={statLabel}>{picked ? day(picked, true) : t('thisMonthLink')}</h2>
            {picked && (
              <button type="button" onClick={() => setPicked(null)} className="-my-3 -mr-2 h-11 px-2 text-[13px] text-ink-2 hover:text-ink">
                {t('thisMonthLink')}
              </button>
            )}
          </div>
          {shown.length ? (
            <div className="px-4 pb-1 [&>div>div:first-child]:border-t-0">
              <BillRows bills={shown} today={data.today} onEdit={onEdit} />
            </div>
          ) : (
            <p className="px-4 py-10 text-center text-[15px] text-ink-2">{t('noBillsMonth')}</p>
          )}
          {owner && pocket.categories.length > 0 && (
            <button
              type="button"
              onClick={() => onAdd(picked ?? (data.month === data.today.slice(0, 7) ? data.today : first))}
              className="flex items-center gap-2 border-t border-board-line px-4 py-3 text-[14px] font-medium hover:bg-plate"
            >
              <Plus aria-hidden className="size-4" weight="bold" />
              {picked ? `${t('addBill')} · ${day(picked)}` : t('addBill')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="caps flex justify-between gap-3">
      <dt className="text-on-board-2">{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

/**
 * A day of the month. Desktop lists its bills by name; the phone keeps a mark per bill and the day's amount.
 * Paid bills dim with a tick, a late one turns red, a skipped one is struck through.
 */
function DayCell({
  date,
  inMonth,
  today,
  payday,
  picked,
  bills,
  onPick,
  className,
}: {
  date: string
  inMonth: boolean
  today: boolean
  /** The pocket's cycle start: "Payday" for a person, "Cycle starts" for a shared pocket. */
  payday?: string
  picked: boolean
  bills: Bill[]
  onPick: () => void
  className?: string
}) {
  const { t, day } = useT()
  const color = useCategoryColor()
  const pocket = useActivePocket()
  const { money } = useMoney()
  // Cells are tight, so their amounts drop the currency sign.
  const bare = (n: number) => money(n, { symbol: false })
  const owed = bills.filter((b) => isOwed(b.state)).reduce((s, b) => s + worth(b), 0)
  const late = bills.some((b) => b.state === 'late')
  const tone = (b: Bill) => (b.state === 'late' ? 'text-over-text' : b.state === 'paid' || b.state === 'skipped' ? 'text-on-board-2' : '')
  const cat = (b: Bill) => pocket.categories.find((c) => c.id === b.categoryId)?.name ?? ''

  return (
    <button
      type="button"
      aria-pressed={picked}
      disabled={!inMonth}
      onClick={onPick}
      // The phone shows a bill's state only as a coloured mark, so the label says it in words.
      aria-label={[
        day(date, true),
        payday && inMonth ? payday : null,
        ...bills.map((b) => {
          const state = b.state === 'late' ? t('billLateShort') : b.state === 'paid' ? t('billPaid') : b.state === 'skipped' ? t('billSkipped') : null
          return [b.name, money(worth(b)), state].filter(Boolean).join(' ')
        }),
      ]
        .filter(Boolean)
        .join(', ')}
      className={cn(
        'relative grid min-h-[56px] content-start justify-items-center gap-1 p-1.5 text-left transition-colors lg:min-h-28 lg:justify-items-start lg:p-2.5',
        // Days outside the month are shaded, as Subly does; today's date sits in a badge of the pocket's colour.
        inMonth ? 'bg-board enabled:hover:bg-plate/60' : 'bg-plate',
        picked && 'ring-1 ring-ink ring-inset',
        className,
      )}
    >
      <span className="flex w-full items-center justify-center gap-1 lg:justify-between">
        <span
          className={cn(
            'font-board text-[12px] lg:text-[13px]',
            !inMonth ? 'text-ink-3' : today ? 'rounded-[5px] bg-sign px-1.5 py-0.5 font-semibold text-sign-ink' : 'text-ink-2',
          )}
        >
          {Number(date.slice(8))}
        </span>
        {payday && inMonth && <span className="caps hidden text-[11px] text-ink-2 lg:inline">{payday}</span>}
      </span>
      {/* The phone has no room for the word: payday is a short accent line under the date, like the active tab's. */}
      {payday && inMonth && <span aria-hidden className="-mt-0.5 h-0.5 w-3.5 rounded-full bg-sign lg:hidden" />}

      {/* Phone: a mark per bill and what is still owed that day. */}
      {bills.length > 0 && (
        <span className="grid justify-items-center gap-0.5 lg:hidden">
          <span className="flex gap-0.5">
            {bills.slice(0, 4).map((b) => (
              <i
                key={b.id}
                aria-hidden
                className={cn('size-1.5', b.state === 'late' && 'bg-over', b.state === 'paid' || b.state === 'skipped' ? 'bg-on-board-2/50' : '')}
                style={b.state === 'late' || b.state === 'paid' || b.state === 'skipped' ? undefined : { background: color(cat(b)) }}
              />
            ))}
          </span>
          {owed > 0 && (
            <span className={cn('font-board text-[11px] font-semibold', late ? 'text-over-text' : 'text-on-board-2')}>{bare(owed)}</span>
          )}
        </span>
      )}

      {/* Desktop: each bill by name. */}
      <span className="hidden gap-1 lg:grid">
        {bills.slice(0, 3).map((b) => (
          <span
            key={b.id}
            className={cn(
              'grid grid-cols-[6px_minmax(0,1fr)] items-center gap-x-1.5 text-[12px] leading-tight',
              tone(b),
              b.state === 'skipped' && 'line-through',
            )}
          >
            <i
              aria-hidden
              className="size-1.5"
              style={{
                background: b.state === 'paid' || b.state === 'skipped' ? 'currentColor' : color(cat(b)),
              }}
            />
            <span className="truncate">{b.name}</span>
            <span className="col-start-2 font-board text-[11px] font-semibold">
              {b.amount === null && b.state !== 'paid' ? '~' : ''}
              {bare(worth(b))}
              {b.state === 'paid' ? ' ✓' : ''}
            </span>
          </span>
        ))}
        {bills.length > 3 && <span className="text-[11px] text-on-board-2">+{bills.length - 3}</span>}
      </span>
    </button>
  )
}
