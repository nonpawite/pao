import { Link, useRouter } from '@tanstack/react-router'
import { CalendarCheck, CaretUpDown, ChartBar, Check, Gear, ListMagnifyingGlass, Plus, Receipt } from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
import { useLayoutEffect, useRef } from 'react'
import type { ReactNode } from 'react'

import { pocketBg } from '#/lib/colors'
import { cn } from '#/lib/utils'
import { setActivePocket } from '#/server/shell'
import type { Shell } from '#/server/shell'
import { useActivePocket, useMoney, useShell, useT } from './context'
import { Avatar } from './kit'

type Pocket = Shell['pockets'][number]

/** The one figure a pocket leads with: today's first daily limit, else what is left of its cycle limits. */
function useHeadline() {
  const { t } = useT()
  return (p: Pocket) => {
    const daily = p.categories.find((c) => c.limitType === 'day')
    if (daily) {
      const left = daily.limitAmount - daily.spentToday
      return { amount: Math.abs(left), label: left < 0 ? t('overToday') : t('leftToday'), over: left < 0, spent: daily.spentToday, limit: daily.limitAmount }
    }
    const limited = p.categories.filter((c) => c.limitType === 'cycle')
    if (!limited.length) return { amount: p.categories.reduce((s, c) => s + c.spentCycle, 0), label: t('spentCycleLabel'), over: false, spent: 0, limit: 0 }
    // Always name the period: the same figure sits near a board that says "left today".
    const limit = limited.reduce((s, c) => s + c.limitAmount, 0)
    const spent = limited.reduce((s, c) => s + c.spentCycle, 0)
    return { amount: Math.abs(limit - spent), label: spent > limit ? t('overThisCycle') : t('leftThisCycle'), over: spent > limit, spent, limit }
  }
}

// Pending pocket switches, told each time React commits an active pocket.
const onPocketCommit = new Set<(id: string) => void>()

/** Switch the whole app to another pocket; the page crossfades and the board's figures flip. */
export function useSwitchPocket() {
  const router = useRouter()
  const active = useActivePocket()
  useLayoutEffect(() => onPocketCommit.forEach((tell) => tell(active.id)), [active.id])
  return (pocketId: string) => {
    const go = async () => {
      let committed!: () => void
      const shown = new Promise<void>((r) => (committed = r))
      const tell = (id: string) => id === pocketId && committed()
      onPocketCommit.add(tell)
      try {
        await setActivePocket({ data: { pocketId } })
        await router.invalidate()
        // The new snapshot must show the new pocket, and React commits it a little after invalidate resolves.
        // Not requestAnimationFrame: frames pause during a view transition's update, so it hung until Chrome's 4s timeout.
        await Promise.race([shown, new Promise((r) => setTimeout(r, 500))])
      } finally {
        onPocketCommit.delete(tell)
      }
    }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce || !('startViewTransition' in document)) return void go()
    // A slow round trip aborts the animation, never the switch itself.
    const vt = document.startViewTransition(go)
    vt.ready.catch(() => {})
    vt.finished.catch(() => {})
  }
}

/** A pocket's colour as a square chip. */
export function PocketChip({ color, className }: { color: string; className?: string }) {
  return <i aria-hidden className={cn('inline-block size-2 shrink-0', className)} style={{ background: pocketBg(color) }} />
}

/** Phone: the pockets as outlined pills; the active one in ink. Hidden when there is only one. */
export function PocketTabs({ className }: { className?: string }) {
  const shell = useShell()
  const active = useActivePocket()
  const switchTo = useSwitchPocket()
  const { t } = useT()
  if (shell.pockets.length < 2) return null
  return (
    <nav aria-label={t('pockets')} className={cn('-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5', className)}>
      {shell.pockets.map((p) => {
        const on = p.id === active.id
        return (
          <button
            key={p.id}
            type="button"
            aria-current={on ? 'true' : undefined}
            onClick={() => !on && switchTo(p.id)}
            className={cn(
              'flex h-11 shrink-0 items-center gap-2 rounded-sm border px-3.5 text-[14px] whitespace-nowrap transition-colors',
              on ? 'border-ink font-medium text-ink' : 'border-rule text-ink-2 hover:border-rule-strong hover:text-ink',
            )}
          >
            <PocketChip color={p.color} />
            {p.name}
          </button>
        )
      })}
    </nav>
  )
}

/** Desktop: the pocket as one quiet button; the menu under it lists every pocket with its headline. */
function PocketSwitch() {
  const shell = useShell()
  const active = useActivePocket()
  const switchTo = useSwitchPocket()
  const headline = useHeadline()
  const { t } = useT()
  const { money } = useMoney()
  const menu = useRef<HTMLDivElement>(null)
  const single = shell.pockets.length < 2
  return (
    <>
      <button
        type="button"
        popoverTarget="pocket-menu"
        disabled={single}
        aria-label={`${t('pocket')}: ${active.name}`}
        className="flex items-center gap-2.5 rounded-sm border border-rule px-3 py-2.5 text-left transition-colors [anchor-name:--pocket-menu] enabled:hover:bg-plate"
      >
        <PocketChip color={active.color} />
        <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{active.name}</span>
        {!single && <CaretUpDown aria-hidden className="size-4 shrink-0 text-ink-3" />}
      </button>
      <div
        ref={menu}
        id="pocket-menu"
        popover="auto"
        className="board anchored rounded-sm p-1 shadow-[0_12px_32px_-16px_rgb(0_0_0/0.25)] [position-anchor:--pocket-menu]"
      >
        {shell.pockets.map((p) => {
          const on = p.id === active.id
          const h = headline(p)
          return (
            <button
              key={p.id}
              type="button"
              aria-current={on ? 'true' : undefined}
              onClick={() => {
                menu.current?.hidePopover()
                if (!on) switchTo(p.id)
              }}
              className="grid w-full gap-0.5 rounded-sm px-2.5 py-2 text-left transition-colors hover:bg-plate"
            >
              <span className={cn('flex items-center gap-2 text-[14px]', on ? 'font-medium text-ink' : 'text-ink-2')}>
                <PocketChip color={p.color} />
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                {on && <Check aria-hidden className="size-4 shrink-0" />}
              </span>
              <span className={cn('truncate pl-4 text-[12px]', h.over ? 'text-over-text' : 'text-ink-2')}>
                <span className="font-board">{money(h.amount, { currency: p.currency })}</span> {h.label}
              </span>
            </button>
          )
        })}
      </div>
    </>
  )
}

/** A page link as a quiet row: its name, a short note under it, and one live figure on the right. */
function NavTile({ to, label, Icon, figure, sub, subClass }: { to: string; label: string; Icon: Icon; figure?: ReactNode; sub: ReactNode; subClass?: string }) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: to === '/', includeSearch: false }}
      className="group grid grid-cols-[18px_minmax(0,1fr)_auto] items-center gap-x-2.5 rounded-sm px-2.5 py-2 text-ink-2 transition-colors hover:bg-plate hover:text-ink data-[status=active]:bg-plate data-[status=active]:text-ink"
    >
      <Icon aria-hidden className="size-[18px]" />
      <span className="grid min-w-0 leading-snug">
        <span className="truncate text-[14px] group-data-[status=active]:font-medium">{label}</span>
        <span className={cn('truncate text-[12px] text-ink-2', subClass)}>{sub}</span>
      </span>
      {figure !== undefined && <span className="font-board text-[13px] font-medium">{figure}</span>}
    </Link>
  )
}

/** Desktop navigation: a white rail with the pocket, the pages as rows with live figures, and the ink add button. */
export function Sidebar({ onAdd }: { onAdd: () => void }) {
  const shell = useShell()
  const pocket = useActivePocket()
  const headline = useHeadline()
  const { t } = useT()
  const { money } = useMoney()
  const h = headline(pocket)
  const spentCycle = pocket.categories.reduce((s, c) => s + c.spentCycle, 0)
  const spentToday = pocket.categories.reduce((s, c) => s + c.spentToday, 0)
  const lateBills = pocket.dueBills.filter((b) => b.state === 'late').length

  return (
    // A plain rail, not <aside>: the nav inside is the landmark, not a complementary region.
    <div className="sticky top-0 hidden h-dvh flex-col gap-4 overflow-y-auto border-r border-rule bg-board px-3 py-5 lg:flex">
      <PocketSwitch />

      <nav aria-label={t('mainNav')} className="grid gap-0.5">
        <NavTile to="/" label={t('today')} Icon={CalendarCheck} figure={money(h.amount)} sub={h.label} subClass={h.over ? 'text-over-text' : undefined} />
        <NavTile
          to="/review"
          label={t('review')}
          Icon={ChartBar}
          figure={money(spentCycle)}
          sub={t('spentCycleLabel')}
        />
        <NavTile to="/spending" label={t('spending')} Icon={ListMagnifyingGlass} figure={money(spentToday)} sub={t('spentTodayLabel')} />
        <NavTile
          to="/bills"
          label={t('bills')}
          Icon={Receipt}
          figure={pocket.dueBills.length ? money(pocket.dueBills.reduce((s, b) => s + (b.amount ?? 0), 0)) : undefined}
          sub={lateBills > 0 ? t('nLate', { n: lateBills }) : pocket.dueBills.length ? t('toPayCycle') : t('nothingToPay')}
          subClass={lateBills > 0 ? 'text-over-text' : undefined}
        />
      </nav>

      <div className="mt-auto grid gap-2">
        <button
          type="button"
          onClick={onAdd}
          aria-keyshortcuts="N"
          className="flex h-10 items-center justify-between rounded-sm bg-primary px-3 text-[14px] font-medium text-primary-foreground hover:opacity-90"
        >
          <span className="flex items-center gap-2">
            <Plus aria-hidden className="size-4" weight="bold" />
            {t('newExpense')}
          </span>
          <kbd aria-hidden className="rounded-xs border border-current/40 px-1.5 font-board text-[11px]">
            N
          </kbd>
        </button>
        <Link
          to="/settings"
          className="group flex items-center gap-3 rounded-sm py-1.5 pr-2.5 pl-1.5 transition-colors hover:bg-plate data-[status=active]:bg-plate"
        >
          <Avatar name={shell.user.name} className="size-8 bg-plate text-[14px] text-ink" />
          <span className="grid min-w-0 flex-1 leading-snug">
            <span className="truncate text-[14px] font-medium">{shell.user.name}</span>
            <span className="truncate text-[12px] text-ink-2">{shell.user.email}</span>
          </span>
          <Gear aria-hidden className="size-[18px] shrink-0 text-ink-2 group-data-[status=active]:text-ink" />
          <span className="sr-only">{t('settings')}</span>
        </Link>
      </div>
    </div>
  )
}

const tabs = [
  { to: '/', key: 'today', Icon: CalendarCheck },
  { to: '/review', key: 'review', Icon: ChartBar },
  { to: '/spending', key: 'spending', Icon: ListMagnifyingGlass },
  { to: '/bills', key: 'bills', Icon: Receipt },
] as const

/** Phone navigation: a white bar, four outline tabs around the ink +. The open tab is ink with a short line in the pocket's colour. */
export function TabBar({ onAdd }: { onAdd: () => void }) {
  const { t } = useT()
  const item = (n: (typeof tabs)[number]) => (
    <Link
      key={n.to}
      to={n.to}
      activeOptions={{ exact: n.to === '/', includeSearch: false }}
      className="group flex min-w-0 flex-col items-center gap-1 pt-2 text-[11px] text-ink-2 data-[status=active]:text-ink"
    >
      <n.Icon aria-hidden className="size-6" />
      <span className="max-w-full truncate">{t(n.key)}</span>
      <span aria-hidden className="h-0.5 w-3.5 rounded-full group-data-[status=active]:bg-sign" />
    </Link>
  )
  return (
    <nav
      aria-label={t('mainNav')}
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-rule bg-board pb-[max(8px,env(safe-area-inset-bottom))] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] lg:hidden"
    >
      {item(tabs[0])}
      {item(tabs[1])}
      <button
        type="button"
        onClick={onAdd}
        aria-label={t('newExpense')}
        className="mx-auto mt-1.5 grid size-11 place-items-center rounded-lg bg-primary text-primary-foreground active:opacity-90"
      >
        <Plus className="size-6" weight="bold" />
      </button>
      {item(tabs[2])}
      {item(tabs[3])}
    </nav>
  )
}
