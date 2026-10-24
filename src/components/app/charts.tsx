import { useLayoutEffect, useRef, useState } from 'react'
import type { PointerEvent, ReactNode } from 'react'

import { addDays } from '#/lib/budget'
import { monthNames } from '#/lib/i18n'
import { cn } from '#/lib/utils'
import { useActivePocket, useMoney, useShell, useT } from './context'
import { DotsThree } from '@phosphor-icons/react'

import { Figure, glyphFor } from './kit'

/** Width of an element in CSS pixels, so charts draw at real size (text never scales with the viewBox). */
function useWidth(fallback: number) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(fallback)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}

const wholeUnits = (hundredths: number) => Math.round(hundredths / 100) * 100

/** A tick step of 1, 2 or 5 × 10^n that gives about `count` gridlines. */
function niceStep(max: number, count: number) {
  const raw = max / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  return ([1, 2, 5, 10].find((m) => m * mag >= raw) ?? 10) * mag
}

/** A visually hidden table: every chart's values stay readable without hover or sight. */
function ChartTable({ head, rows }: { head: string[]; rows: Array<Array<string>> }) {
  const { t } = useT()
  // The wrapper does the hiding: a table ignores sr-only's 1px box and would stretch the page.
  return (
    <div className="sr-only">
      <table>
        <caption>{t('chartTable')}</caption>
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const SLOTS = 7

/**
 * A category's chart slot: its place in the active pocket's category order, then other pockets' categories.
 * By name, so Food is one colour across pockets and on every chart. Past slot 7 it folds to the Other grey.
 */
export function useCategorySlot() {
  const shell = useShell()
  const active = useActivePocket()
  const names = [...new Set([active, ...shell.pockets.filter((p) => p.id !== active.id)].flatMap((p) => p.categories.map((c) => c.name)))]
  return (name: string) => {
    const i = names.indexOf(name)
    return i >= 0 && i < SLOTS ? i : SLOTS
  }
}

export const slotColor = (slot: number) => (slot < SLOTS ? `var(--cat-${slot + 1})` : 'var(--cat-other)')

export function useCategoryColor() {
  const slot = useCategorySlot()
  return (name: string) => slotColor(slot(name))
}

type Part = { id: string; name: string; value: number; color: string; slot: number; other?: boolean }

/** Part-to-whole: the biggest categories by size in the legend, each in its own colour; the rest folded into Other. */
export function WhereItWent({ categories, otherLabel }: { categories: Array<{ id: string; name: string; value: number }>; otherLabel: string }) {
  const slotOf = useCategorySlot()
  const { money } = useMoney()
  const shown = categories.filter((c) => c.value > 0)
  const total = shown.reduce((s, c) => s + c.value, 0)
  const [active, setActive] = useState<string | null>(null)
  if (!total) return null

  const head = shown.slice(0, shown.length > 5 ? 4 : 5)
  const tail = shown.slice(head.length)
  const parts: Part[] = head.map((c) => ({ ...c, slot: slotOf(c.name), color: slotColor(slotOf(c.name)) }))
  if (tail.length)
    parts.push({ id: 'other', name: otherLabel, value: tail.reduce((s, c) => s + c.value, 0), slot: SLOTS + 1, color: 'var(--cat-other)', other: true })
  const pct = (v: number) => Math.round((v / total) * 100)
  const focus = parts.find((p) => p.id === active) ?? parts[0]
  // The ring runs in slot order, so touching segments are the palette's validated neighbours.
  const ring = [...parts].sort((a, b) => a.slot - b.slot)

  // The legend sits beside the donut only when its own board is wide enough, not the screen.
  return (
    <div className="@container">
      <div className="grid items-center gap-6 @md:grid-cols-[auto_minmax(0,1fr)]">
        <Donut parts={ring} total={total} active={active} onActive={setActive}>
          <span className="caps max-w-[7rem] truncate text-[11px] text-on-board-2">{focus.name}</span>
          <Figure text={`${pct(focus.value)}%`} className="text-[26px]" />
          <span className="font-board text-[13px] text-on-board-2">{money(focus.value)}</span>
        </Donut>
        <ul className="grid">
          {parts.map((p) => {
            const G = p.other ? DotsThree : glyphFor(p.name)
            return (
              <li
                key={p.id}
                onPointerEnter={() => setActive(p.id)}
                onPointerLeave={() => setActive(null)}
                className={cn(
                  'grid grid-cols-[10px_18px_minmax(0,1fr)_auto_3.2rem] items-center gap-2.5 border-b border-board-line py-2.5 transition-opacity',
                  active && active !== p.id && 'opacity-45',
                )}
              >
                <i aria-hidden className="size-2.5 rounded-xs" style={{ background: p.color }} />
                <span aria-hidden className="grid place-items-center text-on-board-2">{G && <G className="size-4" />}</span>
                <span className="truncate text-[15px]">{p.name}</span>
                <span className="text-right font-board text-[15px] font-semibold">{money(p.value)}</span>
                <span className="text-right font-board text-[13px] text-on-board-2">{pct(p.value)}%</span>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

/** Donut segments with a 2px board-coloured gap between them; the centre names the hovered part. */
function Donut({
  parts,
  total,
  active,
  onActive,
  children,
}: {
  parts: Part[]
  total: number
  active: string | null
  onActive: (id: string | null) => void
  children: ReactNode
}) {
  const size = 176
  const r = size / 2
  const thick = 20
  const inner = r - thick
  // A 2px gap measured along the ring's middle.
  const gap = 2 / (r - thick / 2)
  let a = -Math.PI / 2
  const arcs = parts.map((p) => {
    const span = (p.value / total) * Math.PI * 2
    const start = a + (parts.length > 1 ? gap / 2 : 0)
    const end = a + span - (parts.length > 1 ? gap / 2 : 0)
    a += span
    return { p, start, end: Math.max(start + 0.0001, end) }
  })
  // Rounded: server and browser trig differ in the last digit, which breaks hydration.
  const pt = (rad: number, ang: number) => `${(r + rad * Math.cos(ang)).toFixed(2)} ${(r + rad * Math.sin(ang)).toFixed(2)}`
  const path = (s: number, e: number): string => {
    const large = e - s > Math.PI ? 1 : 0
    // A full ring cannot be one arc; split it in two.
    if (e - s >= Math.PI * 2 - 0.001) return `${path(s, s + Math.PI)} ${path(s + Math.PI, e)}`
    return `M ${pt(r, s)} A ${r} ${r} 0 ${large} 1 ${pt(r, e)} L ${pt(inner, e)} A ${inner} ${inner} 0 ${large} 0 ${pt(inner, s)} Z`
  }
  return (
    <div className="relative mx-auto size-44 shrink-0">
      <svg viewBox={`0 0 ${size} ${size}`} className="size-full" aria-hidden>
        {arcs.map(({ p, start, end }) => (
          <path
            key={p.id}
            d={path(start, end)}
            fill={p.color}
            className="cursor-pointer transition-opacity"
            opacity={active && active !== p.id ? 0.35 : 1}
            onPointerEnter={() => onActive(p.id)}
            onPointerLeave={() => onActive(null)}
          />
        ))}
      </svg>
      <div className="pointer-events-none absolute inset-0 grid place-content-center justify-items-center gap-1 text-center">{children}</div>
    </div>
  )
}

/**
 * Running total this cycle against the whole of last cycle and this cycle's plan.
 * One axis; a crosshair snaps to the nearest day and reads all three series.
 */
export function RunningTotal({
  current,
  previous,
  plan,
  length,
  start,
  end,
}: {
  current: number[]
  previous: number[] | null
  plan: number | null
  length: number
  start: string
  end: string
}) {
  const { t, day } = useT()
  const { money, compact } = useMoney()
  const [ref, width] = useWidth(340)
  const [hover, setHover] = useState<number | null>(null)
  const H = 200
  const pad = { l: 46, r: 14, t: 18, b: 26 }
  const w = Math.max(120, width - pad.l - pad.r)
  const h = H - pad.t - pad.b
  const days = Math.max(length, previous?.length ?? 0)
  const top = Math.max(plan ?? 0, ...current, ...(previous ?? []), 1)
  const step = niceStep(top, 3)
  const yMax = Math.ceil(top / step) * step
  const x = (d: number) => pad.l + (days > 1 ? (d / (days - 1)) * w : 0)
  const y = (v: number) => pad.t + h - (v / yMax) * h
  const line = (vals: number[]) => vals.map((v, d) => `${d ? 'L' : 'M'} ${x(d)} ${y(v)}`).join(' ')
  const last = current.length - 1
  const ticks = Array.from({ length: Math.floor(yMax / step) + 1 }, (_, i) => i * step)
  const planAt = (d: number) => (plan ? (plan * (d + 1)) / length : null)

  const onMove = (e: PointerEvent<SVGRectElement>) => {
    const box = e.currentTarget.getBoundingClientRect()
    const d = Math.round(((e.clientX - box.left) / box.width) * (days - 1))
    setHover(Math.max(0, Math.min(days - 1, d)))
  }
  const tipLeft = hover === null ? 0 : Math.min(Math.max(x(hover) - 80, 0), width - 160)

  return (
    <div ref={ref} className="relative">
      {/* max-w-full keeps the drawn width out of the layout: the panel sets the width, the chart follows it. */}
      <svg width={width} height={H} className="block max-w-full overflow-visible" aria-hidden>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={pad.l + w} y1={y(v)} y2={y(v)} stroke="var(--board-line)" strokeWidth={1} />
            <text x={pad.l - 8} y={y(v) + 4} textAnchor="end" className="fill-on-board-2 font-board text-[11px]">
              {compact(v)}
            </text>
          </g>
        ))}
        {plan && (
          <g>
            <line x1={x(0)} y1={y(planAt(0)!)} x2={x(length - 1)} y2={y(plan)} stroke="var(--on-board-2)" strokeWidth={1.5} strokeDasharray="5 4" />
            <text x={x(length - 1)} y={y(plan) - 8} textAnchor="end" className="caps fill-on-board-2 text-[11px]">
              {t('plan')} {compact(plan)}
            </text>
          </g>
        )}
        {/* Last cycle sits a step darker than the plan so the two never read as one line. */}
        {previous && <path d={line(previous)} fill="none" stroke="var(--chart-muted)" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />}
        {last >= 0 && (
          <>
            <path d={`${line(current)} L ${x(last)} ${y(0)} L ${x(0)} ${y(0)} Z`} fill="var(--series)" opacity={0.06} />
            <path d={line(current)} fill="none" stroke="var(--series)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {/* Today: the accent mark, ringed in the panel colour. */}
            <circle cx={x(last)} cy={y(current[last])} r={5} fill="var(--sign)" stroke="var(--board)" strokeWidth={2} />
            <text
              x={x(last)}
              y={y(current[last]) - 12}
              textAnchor={x(last) > pad.l + w - 60 ? 'end' : 'middle'}
              className="fill-on-board font-board text-[13px] font-semibold"
            >
              {money(current[last])}
            </text>
          </>
        )}
        <text x={pad.l} y={H - 6} className="caps fill-on-board-2 text-[11px]">
          {day(start)}
        </text>
        <text x={pad.l + w} y={H - 6} textAnchor="end" className="caps fill-on-board-2 text-[11px]">
          {day(end)}
        </text>
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + h} stroke="var(--on-board-2)" strokeWidth={1} />}
        <rect
          x={pad.l}
          y={pad.t}
          width={w}
          height={h}
          fill="transparent"
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={() => setHover(null)}
        />
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute top-0 grid w-40 gap-1 rounded-sm bg-flap px-3 py-2 text-[12px] shadow-[0_8px_20px_-8px_rgb(0_0_0/0.6)]"
          style={{ left: tipLeft }}
        >
          <span className="caps text-[11px] text-on-board-2">{day(addDays(start, hover))}</span>
          {hover <= last && <TipRow color="var(--series)" label={t('thisCycle')} value={money(current[hover])} />}
          {previous && previous[hover] !== undefined && <TipRow color="var(--chart-muted)" label={t('lastCycle')} value={money(previous[hover])} />}
          {plan && hover < length && <TipRow color="var(--on-board-2)" dashed label={t('plan')} value={money(wholeUnits(planAt(hover)!))} />}
        </div>
      )}
      <div className="caps mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-on-board-2">
        <LineKey color="var(--series)" label={t('thisCycle')} />
        {previous && <LineKey color="var(--chart-muted)" label={t('lastCycle')} />}
        {plan && <LineKey color="var(--on-board-2)" dashed label={t('plan')} />}
      </div>
      <ChartTable
        head={[t('date'), t('thisCycle'), t('lastCycle'), t('plan')]}
        rows={Array.from({ length: days }, (_, d) => [
          day(addDays(start, d)),
          d <= last ? money(current[d]) : '',
          previous?.[d] !== undefined ? money(previous[d]) : '',
          plan && d < length ? money(wholeUnits(planAt(d)!)) : '',
        ])}
      />
    </div>
  )
}

function LineKey({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <svg width="16" height="4" aria-hidden>
        <line x1="0" x2="16" y1="2" y2="2" stroke={color} strokeWidth={2} strokeDasharray={dashed ? '4 3' : undefined} />
      </svg>
      {label}
    </span>
  )
}

function TipRow({ color, label, value, dashed }: { color: string; label: string; value: string; dashed?: boolean }) {
  return (
    <span className="flex items-center justify-between gap-2">
      <LineKey color={color} label={label} dashed={dashed} />
      <span className="font-board text-[13px] font-semibold text-on-board">{value}</span>
    </span>
  )
}

/** Average spend per weekday; the costliest day (or the hovered one) is the ink bar and the one label, the rest step back. */
export function WeekdayBars({ values, names }: { values: number[]; names: string[] }) {
  const { money } = useMoney()
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(...values, 1)
  const top = values.indexOf(Math.max(...values))
  const shownLabel = hover ?? top
  return (
    // Hover clears only when the pointer leaves the chart, so crossing the gap between two bars keeps the last day.
    <div className="grid grid-cols-7 items-end gap-2 pt-6" onPointerLeave={() => setHover(null)}>
      {values.map((v, i) => (
        <button
          key={i}
          type="button"
          aria-label={`${names[i]} ${money(v)}`}
          onPointerEnter={() => setHover(i)}
          onFocus={() => setHover(i)}
          onBlur={() => setHover(null)}
          className="group grid h-40 grid-rows-[1fr_auto] justify-items-center gap-1.5 outline-none"
        >
          <span className="relative flex w-full items-end justify-center">
            {shownLabel === i && (
              <span className="absolute font-board text-[12px] font-semibold whitespace-nowrap" style={{ bottom: `calc(${(v / max) * 100}% + 4px)` }}>
                {money(v)}
              </span>
            )}
            <span
              className={cn(
                'w-full max-w-6 rounded-t-sm transition-colors group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-[var(--focus)]',
                (hover ?? top) === i ? 'bg-series' : 'bg-series-hi',
              )}
              style={{ height: `${Math.max(2, (v / max) * 100)}%` }}
            />
          </span>
          <span className={cn('caps w-full border-t-2 border-board-line pt-1.5 text-center text-[11px]', i === top ? 'text-on-board' : 'text-on-board-2')}>
            {names[i]}
          </span>
        </button>
      ))}
    </div>
  )
}

type Bar = { start: string; spent: number; current: boolean; hasData: boolean }

/**
 * Spent per cycle on the board, values printed. Cycles before the first entry are dropped (no data is not ฿0).
 * The current cycle is partial: a dashed outline shows where it lands at this pace.
 */
export function CycleBars({ bars, cycle, className }: { bars: Bar[]; cycle: { dayIndex: number; length: number }; className?: string }) {
  const { t, locale } = useT()
  const { money } = useMoney()
  // A cycle like 25 Sep – 24 Oct is mostly October: label it by its middle.
  const monthOf = (start: string) => monthNames(locale)[Number(addDays(start, 15).slice(5, 7)) - 1]
  const first = bars.findIndex((b) => b.hasData || b.current)
  const shown = bars.slice(first)
  const projected = (b: Bar) => (b.current ? Math.round((b.spent / cycle.dayIndex) * cycle.length) : b.spent)
  const max = Math.max(1, ...shown.map(projected))
  const current = shown.find((b) => b.current)
  const pace = current && projected(current) > current.spent ? Math.round(projected(current) / 100) * 100 : null
  return (
    <div className="grid gap-3">
      <div
        className={cn('flex items-end gap-2', className)}
        role="img"
        aria-label={`${t('spentPerCycle')}: ${shown.map((b) => `${b.current ? t('thisCycle') : monthOf(b.start)} ${money(b.spent)}`).join(', ')}`}
      >
        {shown.map((b) => (
          <div key={b.start} className="grid h-full flex-1 grid-rows-[auto_1fr_auto] gap-1.5 text-center">
            <span className={cn('truncate font-board text-[12px] font-semibold', b.current ? 'text-on-board' : 'text-on-board-2')}>{money(b.spent)}</span>
            {/* Columns stay 24px wide at most; the column's leftover width is air. */}
            <div className="relative mx-auto flex w-full max-w-6 items-end">
              {b.current && (
                <div
                  className="absolute inset-x-0 bottom-0 rounded-t-sm border-2 border-dashed border-series-hi"
                  style={{ height: `${(projected(b) / max) * 100}%` }}
                />
              )}
              <div
                // The cycle under way is the subject, so it is the ink bar; past cycles step back.
                className={cn('relative w-full rounded-t-sm', b.current ? 'bg-series' : 'bg-series-hi')}
                style={{ height: `${Math.max(1.5, (b.spent / max) * 100)}%` }}
              />
            </div>
            <span className={cn('caps border-t-2 border-board-line pt-1.5 text-[11px] text-on-board-2', b.current && 'text-on-board')}>
              {b.current ? t('dayShort', { n: cycle.dayIndex }) : monthOf(b.start)}
            </span>
          </div>
        ))}
      </div>
      {pace && (
        <span className="caps flex items-center gap-2 text-[11px] text-on-board-2">
          <i aria-hidden className="size-3 rounded-xs border-2 border-dashed border-series-hi" />
          {t('atThisPace', { amount: money(pace) })}
        </span>
      )}
    </div>
  )
}
