import {
  AirplaneTilt,
  Baby,
  Barbell,
  Basket,
  Bus,
  Car,
  Coffee,
  DeviceMobile,
  Drop,
  FilmSlate,
  ForkKnife,
  GasPump,
  Gift,
  GraduationCap,
  Heartbeat,
  House,
  Lightning,
  PawPrint,
  Receipt,
  ShoppingBag,
  TShirt,
  Taxi,
  Train,
  Wallet,
} from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent, ReactNode } from 'react'

import type { LimitState, StripDay } from '#/lib/budget'
import { wordPattern } from '#/lib/i18n'
import { cn } from '#/lib/utils'
import { useT } from './context'

/** A titled list on the page: a hairline, a quiet label, then ruled rows. No fill behind it. */
export function Group({
  title,
  aside,
  children,
  className,
}: {
  title?: ReactNode
  aside?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('grid grid-cols-[minmax(0,1fr)] border-t border-rule-strong', className)}>
      {(title || aside) && (
        <div className="caps flex items-baseline justify-between gap-3 pt-2 pb-2 text-[12px] text-ink-2">
          {title && <h2>{title}</h2>}
          {aside && <span className="tabular-nums">{aside}</span>}
        </div>
      )}
      <div>{children}</div>
    </section>
  )
}

/** A row of a Group, ruled above. */
export function Row({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('border-t border-rule py-3', className)}>{children}</div>
}

/** A person as a round initial. */
export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span aria-hidden className={cn('grid size-7 shrink-0 place-items-center rounded-full bg-plate text-[13px] font-semibold text-ink', className)}>
      {name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  )
}

/** A panel: white, one hairline, small corners. */
export function Board({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn('board grid grid-cols-[minmax(0,1fr)] rounded-lg p-4', className)}>{children}</section>
}

/** A label line in a panel: quiet labels, left and right. */
export function BoardLine({ left, right, className }: { left: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <div className={cn('caps flex items-center justify-between gap-3 text-[12px] leading-4 text-on-board-2', className)}>
      <span className="min-w-0 truncate">{left}</span>
      {right && <span className="shrink-0">{right}</span>}
    </div>
  )
}

/**
 * The signature: a figure in split-flap tiles. Each character sits in its own tile and flips in when it changes.
 * Size comes from the font size of `className`.
 */
export function Flap({ text, dim, className }: { text: string; dim?: boolean; className?: string }) {
  // A currency sign takes one tile however many characters it has: $, US$, CHF.
  const tiles = (text.match(/\p{L}+\p{Sc}?|./gsu) ?? []).map((ch) => ({
    ch,
    k: /^\d$/.test(ch) ? 'char' : /^[,.]$/.test(ch) ? 'sep' : /^\s$/.test(ch) ? 'gap' : 'sym',
  }))
  // The stagger counts from the first tile that changed, so a typed digit flips at once instead of waiting its place.
  const prev = useRef<typeof tiles>([])
  const first = Math.max(0, tiles.findIndex((t, i) => t.ch !== prev.current[i]?.ch))
  // Tiles cut from the end (a deleted digit) flip away instead of vanishing.
  const [leaving, setLeaving] = useState<Array<(typeof tiles)[number] & { id: number; at: number }>>([])
  const nextId = useRef(0)
  useLayoutEffect(() => {
    const before = prev.current
    prev.current = tiles
    if (tiles.length >= before.length) return setLeaving((ls) => (ls.length ? [] : ls))
    const gone = before.slice(tiles.length).map((t, j) => ({ ...t, id: nextId.current++, at: tiles.length + j }))
    // In their old places: a quick second delete's tile goes before the first one's, as it stood in the figure.
    setLeaving((ls) => [...ls, ...gone].sort((a, b) => a.at - b.at))
    // Each deletion's tiles leave on their own timer, so quick deletes don't strand one another.
    setTimeout(() => setLeaving((ls) => ls.filter((l) => !gone.includes(l))), 140)
  }, [text])
  // The figure's width in em (tile widths from styles.css, plus the gap), so .flaps can shrink it to fit its container.
  // shortcut: copies styles.css's tile widths and guesses a sign's width from its letter count, so a figure can clip
  // if either drifts; measure the rendered tiles once a sign or a styles.css change clips one.
  const width = tiles.reduce((w, { ch, k }) => w + 0.06 + (k === 'char' ? 0.84 : k === 'sep' ? 0.36 : k === 'gap' ? 0.3 : Math.max(0.62, 0.42 * ch.length + 0.16)), 0)
  return (
    <span className={cn('inline-flex', className)}>
      <span className="sr-only">{text}</span>
      <span aria-hidden className="flaps" data-dim={dim || undefined} style={{ '--w': width.toFixed(2) } as CSSProperties}>
        {tiles.map(({ ch, k }, i) => (
          // Keyed by character so a changed character remounts and flips.
          <span key={`${i}-${ch}`} className="flap" data-k={k} style={{ '--i': Math.max(0, i - first) } as CSSProperties}>
            <span>{ch}</span>
          </span>
        ))}
        {leaving.map(({ ch, k, id }) => (
          <span key={`out-${id}`} className="flap" data-k={k} data-out>
            <span>{ch}</span>
          </span>
        ))}
      </span>
    </span>
  )
}

/** A figure in the figure face, without tiles: flaps belong to Today's hero and the amount being typed. */
export function Figure({ text, className }: { text: string; className?: string }) {
  return <span className={cn('font-board leading-none font-medium tracking-[-0.02em]', className)}>{text}</span>
}

/** Arrow keys move through a radio group and choose, as the ARIA radio pattern has it; the group is one Tab stop. */
export function onRadioKeys(e: KeyboardEvent<HTMLElement>) {
  const step = ({ ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 } as Record<string, number>)[e.key]
  const radios = [...e.currentTarget.querySelectorAll<HTMLElement>('[role=radio]')]
  const i = radios.indexOf(document.activeElement as HTMLElement)
  if (!step || i < 0) return
  e.preventDefault()
  const next = radios[(i + step + radios.length) % radios.length]
  next.focus()
  next.click()
}

/** Segmented control: a plate track; the chosen option is a white chip in ink. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
}: {
  value: T
  options: Array<{ value: T; label: ReactNode }>
  onChange: (v: T) => void
  label: string
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const mounted = useRef(false)
  // A strip that scrolls (Spending's periods on a phone) keeps the chosen option in view.
  useEffect(() => {
    if (mounted.current) ref.current?.querySelector('[aria-checked=true]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    mounted.current = true
  }, [value])
  return (
    <div ref={ref} role="radiogroup" aria-label={label} onKeyDown={onRadioKeys} className={cn('flex gap-0.5 rounded-sm bg-plate p-0.5', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          tabIndex={o.value === value ? 0 : -1}
          onClick={() => onChange(o.value)}
          className={cn(
            'h-10 min-w-0 flex-1 truncate rounded-[5px] px-3 text-[13px] leading-10 text-ink-2 transition-colors hover:text-ink lg:h-8 lg:leading-8',
            // In dark a white panel is darker than the plate track, so the thumb steps up a tone to stay raised.
            o.value === value && 'bg-board font-medium text-ink shadow-[0_1px_2px_rgb(0_0_0/0.08)] dark:bg-rule-strong',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

const statusText: Record<LimitState, string> = { over: 'text-over-text', ahead: 'text-ahead-text', ok: 'text-ok-text', none: 'text-ink-2' }
const statusMark: Record<LimitState, string> = { over: 'bg-over', ahead: 'bg-ahead', ok: 'bg-ok', none: 'bg-ink-3' }
// Status words in panels use the text shades, which pass 4.5:1 on white.
const statusOnBoard: Record<LimitState, string> = { over: 'text-over-text', ahead: 'text-ahead-text', ok: 'text-ok-text', none: 'text-on-board-2' }
export const stateTextClass = (s: LimitState) => (s === 'ok' || s === 'none' ? 'text-ink' : statusText[s])

/** A status: a round mark and On pace / Ahead / Over. */
export function Status({ state, onBoard, compact, className }: { state: LimitState; onBoard?: boolean; compact?: boolean; className?: string }) {
  const { t } = useT()
  const label = state === 'over' ? t('statusOver') : state === 'ahead' ? t('statusAhead') : state === 'ok' ? t('statusOk') : t('noLimit')
  return (
    <span className={cn('caps inline-flex items-center gap-1.5 text-[12.5px] whitespace-nowrap', onBoard ? statusOnBoard[state] : statusText[state], className)}>
      <i aria-hidden className={cn('size-1.5 shrink-0 rounded-full', statusMark[state])} />
      <span className={cn(compact && 'max-[379px]:sr-only')}>{label}</span>
    </span>
  )
}

/**
 * L2: progress bar with a pace tick. Over the limit, the overage shows as its own red segment.
 * `aside` is money set aside for bills still to pay, hatched after what was spent.
 * `onBoard` draws it inside a panel.
 */
export function LimitBar({
  spent,
  aside = 0,
  limit,
  pace,
  state,
  onBoard,
  className,
}: {
  spent: number
  aside?: number
  limit: number
  pace?: number
  state: LimitState
  onBoard?: boolean
  className?: string
}) {
  const total = spent + aside
  const over = total > limit
  const scale = over ? total : limit
  const fill = (Math.min(spent, limit) / scale) * 100
  const held = ((Math.min(total, limit) - Math.min(spent, limit)) / scale) * 100
  return (
    <div aria-hidden className={cn('relative h-1', onBoard ? 'bg-board-line' : 'bg-rule', className)}>
      <div
        // A limit bar reports state, so it wears the state colour its status label names; over dims the spent part so the red overage leads.
        className={cn(
          'absolute inset-y-0 left-0',
          over ? 'bg-over/40' : state === 'ahead' ? 'bg-ahead' : 'bg-mark',
        )}
        style={{ width: `${fill}%` }}
      />
      {held > 0 && <div className={cn('set-aside absolute inset-y-0', onBoard ? 'text-on-board-2' : 'text-ink-3')} style={{ left: `${fill}%`, width: `${held}%` }} />}
      {over && <div className="absolute inset-y-0 right-0 bg-over" style={{ width: `${((total - limit) / scale) * 100}%` }} />}
      {pace !== undefined && (
        <span
          className={cn('absolute -inset-y-[3px] w-px', onBoard ? 'bg-ink-3' : 'bg-ink-2')}
          style={{ left: `calc(${(pace / scale) * 100}% - 1px)` }}
        />
      )}
    </div>
  )
}

/** L4: one square per day of the cycle for a per-day limit. `onBoard` draws it on the board. */
export function DayStrip({ days, onBoard, className }: { days: StripDay['state'][]; onBoard?: boolean; className?: string }) {
  return (
    <div aria-hidden className={cn('grid gap-[3px]', className)} style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
      {days.map((s, i) => (
        <span
          key={i}
          className={cn(
            'h-2 rounded-xs',
            s === 'under' && 'bg-ok/55',
            s === 'over' && 'bg-over/80',
            // Today wears the pocket's colour, the one accent.
            s === 'today' && 'ring-[1.5px] ring-sign ring-inset',
            s === 'future' && (onBoard ? 'bg-board-line' : 'bg-plate'),
          )}
        />
      ))}
    </div>
  )
}

/** Pages share one frame: one column on phone, a 6-column grid of panels from lg. */
// One explicit minmax(0, 1fr) column: an implicit auto track grows to its widest unbreakable content (a long email,
// a chart's own width) and scrolls the phone page sideways.
export const pageMain =
  'mx-auto grid w-full max-w-[600px] grid-cols-[minmax(0,1fr)] content-start gap-4 px-4 pt-[max(12px,env(safe-area-inset-top))] pb-8 lg:max-w-[1200px] lg:gap-5 lg:px-8 lg:pt-8'
export const boardGrid = 'grid grid-cols-[minmax(0,1fr)] gap-3 lg:grid-flow-dense lg:grid-cols-6 lg:gap-4'

/** The tab's title follows the page, so a screen reader hears where a navigation landed. */
export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = `${title} · Pao`
  }, [title])
}

export function PageTitle({ title, sub, aside }: { title: string; sub?: ReactNode; aside?: ReactNode }) {
  useDocumentTitle(title)
  return (
    <header className="flex items-end justify-between gap-4 pt-3">
      <div className="grid gap-1.5">
        <h1 className="title-large">{title}</h1>
        {sub && <p className="text-[13px] text-ink-2">{sub}</p>}
      </div>
      {aside}
    </header>
  )
}

/** A widget: one panel, one question, its title on top. `aside` sits right of the title. */
export function Tile({ title, aside, className, children }: { title: ReactNode; aside?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <Board className={cn('content-start gap-4 lg:p-5', className)}>
      <div className="caps flex items-center justify-between gap-3 text-[13px] leading-5 text-on-board-2">
        <h2 className="min-w-0 truncate font-medium text-on-board">{title}</h2>
        {aside && <span className="shrink-0">{aside}</span>}
      </div>
      {children}
    </Board>
  )
}

// Wayfinding pictograms by category name, in any shipped language (the glyph* words). Order matters: the first match wins.
const glyphRules: Array<[RegExp, Icon]> = [
  [wordPattern('glyphCoffee'), Coffee],
  [wordPattern('glyphFood'), ForkKnife],
  [wordPattern('glyphGroceries'), Basket],
  [wordPattern('glyphGas'), GasPump],
  [wordPattern('glyphTravel'), AirplaneTilt],
  [wordPattern('glyphTaxi'), Taxi],
  [wordPattern('glyphTransport'), Train],
  [wordPattern('glyphBus'), Bus],
  [wordPattern('glyphCar'), Car],
  [wordPattern('glyphShopping'), ShoppingBag],
  [wordPattern('glyphClothes'), TShirt],
  [wordPattern('glyphBill'), Receipt],
  [wordPattern('glyphWater'), Drop],
  [wordPattern('glyphElectric'), Lightning],
  [wordPattern('glyphHome'), House],
  [wordPattern('glyphPhone'), DeviceMobile],
  [wordPattern('glyphHealth'), Heartbeat],
  [wordPattern('glyphGym'), Barbell],
  [wordPattern('glyphFun'), FilmSlate],
  [wordPattern('glyphGift'), Gift],
  [wordPattern('glyphSchool'), GraduationCap],
  [wordPattern('glyphKids'), Baby],
  [wordPattern('glyphPets'), PawPrint],
]

/** The pictogram for a category, or null when none fits (callers show its initial instead). */
export const glyphFor = (name: string) => glyphRules.find(([re]) => re.test(name))?.[1] ?? null

/** A category's pictogram, an outline icon in ink-2; its initial when no pictogram fits. `income` shows a wallet. */
export function CategoryGlyph({ name, income, className }: { name: string; income?: boolean; className?: string }) {
  const G = income ? Wallet : glyphFor(name)
  return (
    <span aria-hidden className={cn('grid size-8 shrink-0 place-items-center text-ink-2', className)}>
      {G ? <G className="size-[68%]" /> : <span className="font-board text-[0.95em] font-semibold">{name.charAt(0)}</span>}
    </span>
  )
}
