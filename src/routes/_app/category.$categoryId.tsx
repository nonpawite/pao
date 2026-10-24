import { Link, createFileRoute, notFound, useCanGoBack, useRouter } from '@tanstack/react-router'
import { CaretLeft } from '@phosphor-icons/react'
import type { ReactNode } from 'react'

import { useShell, useT } from '#/components/app/context'
import { EntryRows } from '#/components/app/entry-list'
import { PocketChip } from '#/components/app/frame'
import { Board, BoardLine, CategoryGlyph, Figure, Group, LimitBar, Row, Status, pageMain, useDocumentTitle } from '#/components/app/kit'
import { formatBaht, weekday } from '#/lib/budget'
import { weekdayInitials } from '#/lib/i18n'
import { cn } from '#/lib/utils'
import { getCategoryDetail } from '#/server/category'
import type { CategoryDetail } from '#/server/category'

export const Route = createFileRoute('/_app/category/$categoryId')({
  // Not a member of its pocket reads the same as not existing.
  loader: ({ params }) => getCategoryDetail({ data: { categoryId: params.categoryId } }).catch(() => {
    throw notFound()
  }),
  component: Category,
})

const navLink = 'caps flex h-11 items-center text-[13px] text-ink hover:underline hover:decoration-2 hover:underline-offset-4'

function Category() {
  const c = Route.useLoaderData()
  const { t, range } = useT()
  const router = useRouter()
  // Back returns to wherever the category was opened from (Today, Review, Spending); a fresh tab goes to Today.
  const canGoBack = useCanGoBack()
  useDocumentTitle(c.name)
  const sub =
    c.limitType === 'day'
      ? `${t('aDay', { amount: formatBaht(c.limit) })} · ${t('resetsMidnight')}`
      : c.limitType === 'cycle'
        ? `${t('aCycle', { amount: formatBaht(c.limit) })} · ${range(c.cycle.start, c.cycle.end)}`
        : `${t('noLimit')} · ${range(c.cycle.start, c.cycle.end)}`

  return (
    // One column of reading width, starting where every other page starts.
    <main className={cn(pageMain, 'gap-7 lg:gap-7 lg:[&>*]:max-w-[600px]')}>
      <div className="-mb-3 flex items-center justify-between">
        <Link
          to="/"
          onClick={(e) => {
            if (!canGoBack) return
            e.preventDefault()
            router.history.back()
          }}
          className={cn(navLink, '-ml-1.5 pr-2')}
        >
          <CaretLeft aria-hidden className="size-5" weight="bold" />
          {t('back')}
        </Link>
        {c.canEdit && (
          <Link to="/settings" search={{ pocket: c.pocketId }} className={cn(navLink, 'px-1.5 -mr-1.5')}>
            {t('editLimit')}
          </Link>
        )}
      </div>
      <header className="flex items-center gap-4">
        <CategoryGlyph name={c.name} className="size-14 text-[26px]" />
        <div className="grid min-w-0 gap-1.5">
          <h1 className="title-large truncate">{c.name}</h1>
          <p className="caps text-[13px] text-ink-2">{sub}</p>
        </div>
      </header>

      {c.day && <DayView c={c} />}
      {c.cycleLimit && <CycleView c={c} />}
      {!c.day && !c.cycleLimit && (
        <CategoryBoard c={c} figure={formatBaht(c.spent)} qualifier={t('spent')} />
      )}

      <Entries c={c} />
    </main>
  )
}

/** The category's figure on the board, as on Today. */
function CategoryBoard({
  c,
  figure,
  qualifier,
  over,
  status,
  foot,
}: {
  c: CategoryDetail
  figure: string
  qualifier: ReactNode
  over?: boolean
  status?: ReactNode
  foot?: ReactNode
}) {
  return (
    <Board>
      <BoardLine
        left={
          <span className="flex items-center gap-2">
            <PocketChip color={c.pocketColor} />
            {c.pocketName}
          </span>
        }
        right={status}
      />
      <div className="mt-4 flex flex-wrap items-end gap-x-4 gap-y-2">
        <Figure text={figure} className="text-[40px]" />
        <span className={cn('pb-1 text-[15px] leading-tight', over ? 'text-over-text' : 'text-ink-2')}>
          {qualifier}
        </span>
      </div>
      {foot}
    </Board>
  )
}

function DayView({ c }: { c: CategoryDetail }) {
  const d = c.day!
  const shell = useShell()
  const { t, day, locale } = useT()
  // The grid starts on the user's own first weekday, as the Bills calendar does.
  const start = shell.user.weekStart
  const lead = (weekday(c.cycle.start) - start + 7) % 7
  // Initials come Monday first; turn them to start on the user's day.
  const initials = weekdayInitials(locale)
  const heads = Array.from({ length: 7 }, (_, i) => initials[(start + i + 6) % 7])
  return (
    <>
      <CategoryBoard
        c={c}
        figure={formatBaht(Math.abs(d.left))}
        qualifier={d.left < 0 ? t('over') : t('leftToday')}
        over={d.left < 0}
        foot={
          <>
            <LimitBar spent={d.spentToday} limit={c.limit} state={d.state} onBoard className="mt-5" />
            <BoardLine className="mt-2.5" left={t('spentToday', { amount: formatBaht(d.spentToday) })} right={t('aDay', { amount: formatBaht(c.limit) })} />
          </>
        }
      />

      <Group title={t('thisCycle')} aside={<span className={cn(d.overDays > 0 && 'text-over-text')}>{t('daysOver', { n: d.overDays })}</span>}>
        <Row className="grid gap-5 pt-4">
          <div className="grid grid-cols-7 gap-1 text-center">
            {heads.map((w, i) => (
              <span key={i} aria-hidden className="caps pb-1 text-[11px] text-ink-2">
                {w}
              </span>
            ))}
            {Array.from({ length: lead }, (_, i) => (
              <span key={`lead-${i}`} />
            ))}
            {/* State as a tint with its text shade, like a status word; today wears the pocket's accent ring. */}
            {d.strip.map((s) => (
              <span
                key={s.date}
                title={day(s.date, true)}
                className={cn(
                  'grid aspect-square place-items-center rounded-sm font-board text-[13px] font-semibold',
                  s.state === 'under' && 'bg-ok/10 text-ok-text',
                  s.state === 'over' && 'bg-over/10 text-over-text',
                  s.state === 'today' && 'ring-2 ring-sign ring-inset',
                  s.state === 'future' && 'bg-plate text-ink-2',
                )}
              >
                {Number(s.date.slice(8))}
                {(s.state === 'under' || s.state === 'over') && <span className="sr-only"> {s.state === 'over' ? t('over') : t('dayUnder')}</span>}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-3 border-t border-rule pt-3">
            <Stat label={t('spent')} value={formatBaht(c.spent)} />
            <Stat label={t('avgADay')} value={formatBaht(d.avgPerDay)} />
            <Stat
              label={t('overDays')}
              value={t('overDaysValue', { n: d.overDays, total: d.pastDays })}
              className={cn(d.overDays > 0 && 'text-over-text')}
            />
          </div>
        </Row>
      </Group>
    </>
  )
}

function CycleView({ c }: { c: CategoryDetail }) {
  const l = c.cycleLimit!
  const { t } = useT()
  return (
    <>
      <CategoryBoard
        c={c}
        figure={formatBaht(Math.abs(l.left))}
        qualifier={l.state === 'over' ? t('over') : t('leftThisCycle')}
        over={l.state === 'over'}
        status={<Status state={l.state} onBoard />}
        foot={
          <>
            <LimitBar spent={c.spent} limit={c.limit} pace={l.pace} state={l.state} onBoard className="mt-5" />
            <BoardLine
              className="mt-2.5"
              left={`${t('spent')} ${formatBaht(c.spent)}`}
              right={t('todaysPace', { amount: formatBaht(l.pace) })}
            />
          </>
        }
      />
      {l.state !== 'over' && (
        <Group title={t('toStayUnder')}>
          <Row className="text-[15px]">{t('perDayLeft', { amount: formatBaht(l.perDayToStayUnder), n: c.daysLeft })}</Row>
        </Group>
      )}
    </>
  )
}

function Stat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="grid gap-1">
      <span className="caps text-[11px] text-ink-2">{label}</span>
      <span className={cn('font-board text-[17px] font-semibold', className)}>{value}</span>
    </div>
  )
}

/** The cycle's entries by day, editable like every other list; a per-day limit shows each day against it. */
function Entries({ c }: { c: CategoryDetail }) {
  const { t } = useT()
  if (!c.days.length) return null
  const entries = c.days.flatMap((d) =>
    d.entries.map((e) => ({ ...e, kind: 'expense' as const, categoryName: c.name, pocketId: c.pocketId })),
  )
  return (
    <Group title={t('entries')}>
      <div className="pt-2">
        <EntryRows
          entries={entries}
          today={c.today}
          who={c.pocketKind === 'shared'}
          grouped
          dayAside={(_, spent) => (
            <span className={cn(c.limitType === 'day' && spent > c.limit && 'text-over-text')}>
              {formatBaht(spent)}
              {c.limitType === 'day' && ` / ${formatBaht(c.limit)}`}
            </span>
          )}
        />
      </div>
    </Group>
  )
}
