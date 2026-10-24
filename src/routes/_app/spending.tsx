import { createFileRoute, stripSearchParams, useNavigate } from '@tanstack/react-router'
import { CaretDown, MagnifyingGlass, X } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { z } from 'zod'

import { WhereItWent } from '#/components/app/charts'
import { useActivePocket, useMoney, useShell, useT } from '#/components/app/context'
import { EntryRows } from '#/components/app/entry-list'
import { PocketTabs } from '#/components/app/frame'
import { BoardLine, Figure, PageTitle, Segmented, Tile, boardGrid, pageMain } from '#/components/app/kit'
import { Picker } from '#/components/app/picker'
import type { PickerOption } from '#/components/app/picker'
import { cn } from '#/lib/utils'
import { getSpending } from '#/server/spending'
import type { SpendingData } from '#/server/spending'

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const PAGE = 200

// Filters live in the URL, so a filtered list survives reload and the back button.
const search = z.object({
  period: z.enum(['cycle', 'last', 'three', 'all', 'custom']).default('cycle').catch('cycle'),
  from: isoDate.optional().catch(undefined),
  to: isoDate.optional().catch(undefined),
  pocket: z.enum(['active', 'all']).default('active').catch('active'),
  kind: z.enum(['all', 'expense', 'income']).default('all').catch('all'),
  category: z.uuid().optional().catch(undefined),
  member: z.string().max(100).optional().catch(undefined),
  account: z.uuid().optional().catch(undefined),
  q: z.string().max(100).optional().catch(undefined),
  n: z.number().int().min(1).max(2000).default(PAGE).catch(PAGE),
})
type Search = z.infer<typeof search>

export const Route = createFileRoute('/_app/spending')({
  validateSearch: search,
  search: { middlewares: [stripSearchParams({ period: 'cycle', pocket: 'active', kind: 'all', n: PAGE })] },
  loaderDeps: ({ search }) => search,
  loader: ({ deps: { n, ...filters } }) => getSpending({ data: { ...filters, limit: n } }),
  component: Spending,
})

/** Every entry, filtered: the list on the left, what the filtered set adds up to on the right. */
function Spending() {
  const data = Route.useLoaderData()
  const s = Route.useSearch()
  const navigate = useNavigate({ from: '/spending' })
  const { t, day, range } = useT()
  const { money } = useMoney()
  // Any filter change starts the list from the top again.
  const set = (patch: Partial<Search>) => navigate({ search: (prev) => ({ ...prev, ...patch, n: PAGE }), replace: true, resetScroll: false })
  const clear = () => navigate({ search: {}, replace: true, resetScroll: false })
  const filtered = s.period !== 'cycle' || s.pocket !== 'active' || s.kind !== 'all' || !!(s.category || s.member || s.account || s.q)

  const sub =
    data.from && data.to ? range(data.from, data.to) : data.from ? `${t('from')} ${day(data.from)}` : data.to ? `${t('to')} ${day(data.to)}` : t('periodAll')
  const count = data.totals.count === 1 ? t('entryOne') : t('entriesN', { n: data.totals.count })
  const pockets = s.pocket === 'all' ? new Map(data.pockets.map((p) => [p.id, p])) : undefined

  return (
    <main className={pageMain}>
      <PageTitle title={t('spending')} sub={sub} />
      <PocketTabs className="lg:hidden" />

      <div className={boardGrid}>
        <Filters data={data} s={s} set={set} onClear={filtered ? clear : undefined} className="lg:col-span-6" />

        {/* Phone reads the sum, the list, then the donut; desktop keeps sum and donut beside the list while it scrolls. */}
        <div className="contents lg:sticky lg:top-8 lg:col-span-2 lg:col-start-5 lg:row-start-2 lg:grid lg:content-start lg:gap-4 lg:self-start">
          <Tile title={t('spent')}>
            {/* One figure per currency, stacked, so a narrow board never splits a pair mid-line. */}
            {data.totals.spent.map((c) => (
              <Figure key={c.currency} text={money(c.total, { currency: c.currency })} className="text-[30px] lg:text-[32px]" />
            ))}
            {data.totals.earned.length > 0 && (
              <BoardLine
                left={t('earned')}
                // Each currency keeps its own figure, never a sum (ADR 0001).
                right={<span className="text-ok-text">{data.totals.earned.map((c) => money(c.total, { currency: c.currency, sign: true })).join(' · ')}</span>}
              />
            )}
          </Tile>
          {data.byCategory.map((g) => (
            // A second currency gets its own breakdown, named by its code.
            <Tile key={g.currency} title={t('whereItWent')} aside={data.byCategory.length > 1 && g.currency} className="order-last lg:order-none">
              <WhereItWent
                categories={g.categories.map((c) => (c.name ? c : { ...c, id: 'none', name: t('otherCategories') }))}
                otherLabel={t('otherCategories')}
                currency={g.currency}
              />
            </Tile>
          ))}
        </div>

        <Tile title={t('entries')} aside={count} className="lg:col-span-4 lg:row-start-2">
          {data.entries.length ? (
            <EntryRows entries={data.entries} today={data.today} who={data.members.length > 1} pockets={pockets} grouped />
          ) : (
            <div className="grid justify-items-start gap-3 py-2">
              <span className="text-[15px] text-on-board-2">{t('noMatches')}</span>
              {filtered && <ClearButton onClick={clear} />}
            </div>
          )}
          {data.hasMore && (
            <button
              type="button"
              onClick={() => navigate({ search: (prev) => ({ ...prev, n: prev.n + PAGE }), replace: true, resetScroll: false })}
              className="caps h-11 rounded-sm bg-flap text-[13px] transition-colors hover:text-ink"
            >
              {t('showMore')}
            </button>
          )}
        </Tile>
      </div>
    </main>
  )
}

// Wells, not outlined fields; focus is the global ink ring.
const field = 'h-11 rounded-sm bg-flap px-3 text-[14px] text-on-board placeholder:text-on-board-2 lg:h-10'

/** The filter board: the period as a strip on top, then search and one select per dimension that has a choice to make. */
function Filters({
  data,
  s,
  set,
  onClear,
  className,
}: {
  data: SpendingData
  s: Search
  set: (patch: Partial<Search>) => void
  onClear?: () => void
  className?: string
}) {
  const shell = useShell()
  const pocket = useActivePocket()
  const { t } = useT()
  const [q, setQ] = useState(s.q ?? '')
  // On a phone the pickers fold behind one Filters button, so the list starts near the top.
  const [open, setOpen] = useState(false)
  const active = [s.category, s.kind !== 'all', s.pocket !== 'active', s.member, s.account].filter(Boolean).length
  // Typing settles for a moment before the list reloads.
  useEffect(() => {
    if (q.trim() === (s.q ?? '')) return
    const id = setTimeout(() => set({ q: q.trim() || undefined }), 300)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  return (
    <div className={cn('board grid overflow-hidden rounded-lg', className)}>
      <Segmented
        label={t('date')}
        value={s.period}
        // Custom starts from the range on screen, so it is a nudge, not a blank form.
        onChange={(period) => set(period === 'custom' ? { period, from: data.from ?? undefined, to: data.to ?? undefined } : { period, from: undefined, to: undefined })}
        options={[
          { value: 'cycle', label: t('rangeCycle') },
          { value: 'last', label: t('lastCycle') },
          { value: 'three', label: t('period3') },
          { value: 'all', label: t('periodAll') },
          { value: 'custom', label: t('periodCustom') },
        ]}
        // Five periods do not fit a phone's width: the strip scrolls rather than cutting the words.
        className="m-3 mb-0 overflow-x-auto lg:m-4 lg:mb-0 max-lg:[&>button]:flex-none max-lg:[&>button]:px-4"
      />
      <div className="flex flex-wrap items-center gap-2 p-3 lg:p-4">
        {s.period === 'custom' && (
          <>
            <DateField label={t('from')} value={s.from} onChange={(from) => set({ from })} />
            <DateField label={t('to')} value={s.to} onChange={(to) => set({ to })} />
          </>
        )}
        <label className="relative flex min-w-0 flex-[2_1_180px] items-center">
          <span className="sr-only">{t('searchNotes')}</span>
          <MagnifyingGlass aria-hidden className="pointer-events-none absolute left-3 size-4 text-on-board-2" weight="bold" />
          <input type="search" value={q} maxLength={100} onChange={(e) => setQ(e.target.value)} placeholder={t('searchNotes')} className={cn(field, 'w-full pl-9')} />
        </label>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className={cn(field, 'flex shrink-0 items-center gap-2 font-medium lg:hidden')}
        >
          {t('filters')}
          {active > 0 && <span className="grid size-5 place-items-center rounded-full bg-ink font-board text-[11px] font-semibold text-ground">{active}</span>}
          <CaretDown aria-hidden weight="bold" className={cn('size-4 opacity-70 transition-transform motion-reduce:transition-none', open && 'rotate-180')} />
        </button>
        <div className={cn('flex-wrap items-center gap-2 max-lg:w-full lg:contents', open ? 'flex' : 'hidden')}>
          <BoardSelect
            label={t('category')}
            value={s.category ?? ''}
            onChange={(v) => set({ category: v || undefined })}
            options={[
              { value: '', label: t('allCategories') },
              ...data.categories.map((c) => ({ value: c.id, label: s.pocket === 'all' ? `${c.name} · ${c.pocketName}` : c.name })),
            ]}
          />
          <BoardSelect
            label={t('kindLabel')}
            value={s.kind}
            onChange={(v) => set({ kind: v as Search['kind'] })}
            options={[
              { value: 'all', label: `${t('expense')} + ${t('income')}` },
              { value: 'expense', label: t('expense') },
              { value: 'income', label: t('income') },
            ]}
          />
          {shell.pockets.length > 1 && (
            // A category or person from one pocket means nothing in the other view, so they reset.
            <BoardSelect
              label={t('pocket')}
              value={s.pocket}
              onChange={(v) => set({ pocket: v as Search['pocket'], category: undefined, member: undefined })}
              options={[
                { value: 'active', label: pocket.name },
                { value: 'all', label: t('allPockets') },
              ]}
            />
          )}
          {data.members.length > 1 && (
            <BoardSelect
              label={t('who')}
              value={s.member ?? ''}
              onChange={(v) => set({ member: v || undefined })}
              options={[{ value: '', label: t('anyone') }, ...data.members.map((m) => ({ value: m.id, label: m.id === shell.user.id ? t('you') : m.name }))]}
            />
          )}
          {data.accounts.length > 0 && (
            <BoardSelect
              label={t('paidFrom')}
              value={s.account ?? ''}
              onChange={(v) => set({ account: v || undefined })}
              options={[{ value: '', label: t('allAccounts') }, ...data.accounts.map((a) => ({ value: a.id, label: a.name }))]}
            />
          )}
        </div>
        {onClear && (
          <ClearButton
            onClick={() => {
              setQ('')
              onClear()
            }}
          />
        )}
      </div>
    </div>
  )
}

/**
 * A filter picker whose trigger says what it filters ("Pocket  Me"), so a value never reads as something else.
 * The first option is "everything", which the label already names, so the trigger just says All.
 */
function BoardSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: PickerOption<string>[] }) {
  const { t } = useT()
  const everything = value === options[0].value && value !== 'active'
  return (
    <Picker
      label={label}
      value={value}
      onChange={onChange}
      options={options}
      display={
        <>
          <span className="text-on-board-2">{label}</span> {everything ? t('kindAll') : options.find((o) => o.value === value)?.label}
        </>
      }
      className={cn(field, 'flex-[1_1_160px] lg:max-w-60 [&>svg]:text-on-board-2')}
    />
  )
}

function DateField({ label, value, onChange }: { label: string; value?: string; onChange: (v: string | undefined) => void }) {
  return (
    <label className="flex min-w-0 flex-[1_1_200px] items-center gap-2">
      <span className="caps shrink-0 text-[11px] text-on-board-2">{label}</span>
      <input type="date" value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)} className={cn(field, 'min-w-0 flex-1')} />
    </label>
  )
}

function ClearButton({ onClick }: { onClick: () => void }) {
  const { t } = useT()
  return (
    <button
      type="button"
      onClick={onClick}
      className="caps flex h-11 items-center gap-1.5 rounded-sm px-2 text-[12px] text-on-board-2 hover:text-on-board lg:h-10"
    >
      <X aria-hidden className="size-3.5" weight="bold" />
      {t('clearFilters')}
    </button>
  )
}
