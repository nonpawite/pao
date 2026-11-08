import { CaretDown, CaretLeft, CaretRight, MagnifyingGlass } from '@phosphor-icons/react'
import { Popover } from 'radix-ui'
import { useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { flushSync } from 'react-dom'

import { addDays, daysInMonth, iso, monthCells, shiftMonth } from '#/lib/budget'
import type { ISODate } from '#/lib/budget'
import { currencies } from '#/lib/money'
import { cn } from '#/lib/utils'
import { useShell, useT } from './context'

// `text` is what a search matches, for options whose label is not plain text.
export type PickerOption<T> = { value: T; label: ReactNode; wide?: boolean; text?: string }

/**
 * Our dropdown: the trigger reads as a field, and the choices open on a small board below it.
 * `columns` above 1 lays them out as a grid of figures (days, months); a `wide` option spans its row.
 * `display` replaces the chosen option's label in the trigger (the 15th, not 15).
 * `search` puts a field above a long list (currencies) that narrows it by each option's `text`.
 */
export function Picker<T extends string | number>({
  value,
  options,
  onChange,
  label,
  display,
  columns = 1,
  id,
  disabled,
  search,
  className,
}: {
  value: T
  options: PickerOption<T>[]
  onChange: (value: T) => void
  label: string
  display?: ReactNode
  columns?: number
  id?: string
  disabled?: boolean
  search?: { placeholder: string; empty: string }
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const grid = columns > 1
  const q = query.trim().toLocaleLowerCase()
  const shown = q ? options.filter((o) => (o.text ?? String(o.value)).toLocaleLowerCase().includes(q)) : options
  const current = options.find((o) => o.value === value)
  // The trigger's name says the choice too ("Currency, USD"), so a screen reader hears it without opening the list.
  const spoken = typeof display === 'string' ? display : (current?.text ?? (typeof current?.label === 'string' ? current.label : String(value)))
  // The list is one Tab stop, on the current choice (or the first match); arrows move within it.
  const stop = shown.find((o) => o.value === value) ?? shown[0]

  function pick(v: T) {
    onChange(v)
    setOpen(false)
  }

  // Arrows move through the choices as laid out; Home and End jump to the ends.
  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    const items = [...listRef.current!.querySelectorAll<HTMLElement>('[role=option]')]
    const i = items.indexOf(document.activeElement as HTMLElement)
    const steps: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: columns, ArrowUp: -columns }
    // Up from the first row goes back to the search field, where typing narrows the list.
    if (search && e.key === 'ArrowUp' && i - columns < 0) {
      e.preventDefault()
      return listRef.current?.parentElement?.querySelector('input')?.focus()
    }
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : e.key in steps ? Math.min(items.length - 1, Math.max(0, i + steps[e.key])) : null
    if (next === null) return
    e.preventDefault()
    items[next].focus()
  }

  return (
    <Popover.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) setQuery('')
      }}
    >
      <Popover.Trigger
        id={id}
        type="button"
        disabled={disabled}
        aria-label={`${label}, ${spoken}`}
        className={cn('flex min-w-0 items-center justify-between gap-2 text-left disabled:opacity-60', className)}
      >
        <span className="truncate">{display ?? options.find((o) => o.value === value)?.label}</span>
        <CaretDown aria-hidden weight="bold" className={cn('size-4 shrink-0 opacity-70 transition-transform motion-reduce:transition-none', open && 'rotate-180')} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          collisionPadding={12}
          // Open on the current choice, so arrows start from it; with a search field, typing starts there instead.
          onOpenAutoFocus={(e) => {
            e.preventDefault()
            const list = listRef.current
            const current = list?.querySelector<HTMLElement>('[aria-selected=true]') ?? list?.querySelector<HTMLElement>('[role=option]')
            if (!search) return current?.focus()
            list?.parentElement?.querySelector('input')?.focus()
            // The list only gets its height once the board is placed, a frame later.
            requestAnimationFrame(() => current?.scrollIntoView({ block: 'center' }))
          }}
          className="board z-50 flex max-h-[min(380px,var(--radix-popover-content-available-height))] max-w-[var(--radix-popover-content-available-width)] min-w-[var(--radix-popover-trigger-width)] flex-col rounded-sm shadow-[0_16px_32px_-12px_rgb(0_0_0/0.5)] duration-150 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
        >
          {search && (
            <label className="flex shrink-0 items-center gap-2 border-b border-board-line px-3 focus-within:border-ink">
              <MagnifyingGlass aria-hidden weight="bold" className="size-4 shrink-0 text-on-board-2" />
              <input
                type="search"
                value={query}
                placeholder={search.placeholder}
                aria-label={search.placeholder}
                autoComplete="off"
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  // Down steps into the list; Enter takes the first match.
                  if (e.key === 'ArrowDown') {
                    e.preventDefault()
                    listRef.current?.querySelector<HTMLElement>('[role=option]')?.focus()
                  } else if (e.key === 'Enter' && q && shown[0]) {
                    e.preventDefault()
                    pick(shown[0].value)
                  }
                }}
                className="h-11 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-on-board-2 [&::-webkit-search-cancel-button]:hidden"
              />
            </label>
          )}
          {!shown.length && (
            <p role="status" className="px-4.5 py-4 text-[15px] text-on-board-2">
              {search?.empty}
            </p>
          )}
          <div
            ref={listRef}
            role="listbox"
            aria-label={label}
            onKeyDown={onKey}
            className="scroll-quiet grid min-h-0 gap-1 overflow-y-auto p-1.5"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
          >
            {shown.map((o) => {
              const on = o.value === value
              return (
                <button
                  key={String(o.value)}
                  type="button"
                  role="option"
                  aria-selected={on}
                  tabIndex={o === stop ? 0 : -1}
                  onClick={() => pick(o.value)}
                  style={o.wide ? { gridColumn: '1 / -1' } : undefined}
                  className={cn(
                    'rounded-sm transition-colors hover:bg-flap',
                    // A grid holds figures in board type; a list holds names.
                    grid ? 'grid h-9 min-w-10 place-items-center font-board text-[15px] font-semibold' : 'flex h-10 items-center px-3 text-left text-[15px] whitespace-nowrap',
                    o.wide && 'caps text-[12px]',
                    on && 'bg-ink text-ground hover:bg-ink',
                  )}
                >
                  {o.label}
                </button>
              )
            })}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

/**
 * Our date picker: a month on the same small board as the dropdown, weeks starting on the member's day,
 * today underlined in the pocket's colour. Days after `max` are off. Arrows move by day and week, Page Up/Down by month.
 */
export function DatePicker({
  value,
  max,
  onChange,
  label,
  className,
  children,
}: {
  value: ISODate
  max?: ISODate
  onChange: (date: ISODate) => void
  label: string
  className?: string
  children: ReactNode
}) {
  const shell = useShell()
  const { t, day, month: monthLabel, names } = useT()
  const [open, setOpen] = useState(false)
  // The day arrows move from; its month is the one on show.
  const [cursor, setCursor] = useState(value)
  const gridRef = useRef<HTMLDivElement>(null)
  const picked = useRef(false)
  const month = cursor.slice(0, 7)
  const cells = monthCells(month, shell.user.weekStart)
  // Names come Monday first; turn them to start on the member's day.
  const initials = Array.from({ length: 7 }, (_, i) => names.weekdayInitials[(shell.user.weekStart + i + 6) % 7])
  const clamp = (d: ISODate) => (max && d > max ? max : d)
  const nextOff = !!max && shiftMonth(month, 1) > max.slice(0, 7)

  // The same day number in another month, or its last day when that month is shorter.
  function toMonth(m: string) {
    const [y, mo] = m.split('-').map(Number)
    return clamp(iso(y, mo, Math.min(Number(cursor.slice(8)), daysInMonth(y, mo))))
  }

  function pick(d: ISODate) {
    picked.current = true
    onChange(d)
    setOpen(false)
  }

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    const days: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }
    const months: Record<string, number> = { PageUp: -1, PageDown: 1 }
    const next = e.key in days ? clamp(addDays(cursor, days[e.key])) : e.key in months ? toMonth(shiftMonth(month, months[e.key])) : null
    if (!next) return
    e.preventDefault()
    // The day may be in a month not drawn yet: draw it now, so focus never drops to the page between keys.
    flushSync(() => setCursor(next))
    gridRef.current?.querySelector<HTMLElement>(`[data-day="${next}"]`)?.focus()
  }

  const arrow =
    'grid size-11 place-items-center rounded-sm text-on-board-2 transition-colors enabled:hover:bg-flap enabled:hover:text-ink disabled:opacity-35 lg:size-9'

  return (
    <Popover.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) setCursor(value)
      }}
    >
      <Popover.Trigger type="button" aria-label={`${label}, ${day(value)}`} className={className}>
        {children}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          collisionPadding={12}
          // Open on the picked day, so arrows start from it.
          onOpenAutoFocus={(e) => {
            e.preventDefault()
            gridRef.current?.querySelector<HTMLElement>('[tabindex="0"]')?.focus()
          }}
          // A pick hands focus on to whatever onChange chose (the amount); Escape returns it to the trigger.
          onCloseAutoFocus={(e) => {
            if (picked.current) e.preventDefault()
            picked.current = false
          }}
          className="board z-50 grid gap-1 rounded-sm p-1.5 shadow-[0_16px_32px_-12px_rgb(0_0_0/0.5)] duration-150 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
        >
          <div className="flex items-center justify-between gap-1">
            <button type="button" aria-label={t('prevMonth')} onClick={() => setCursor(toMonth(shiftMonth(month, -1)))} className={arrow}>
              <CaretLeft aria-hidden weight="bold" className="size-4" />
            </button>
            <span aria-live="polite" className="text-[15px] font-medium">
              {monthLabel(month)}
            </span>
            <button type="button" aria-label={t('nextMonth')} disabled={nextOff} onClick={() => setCursor(toMonth(shiftMonth(month, 1)))} className={arrow}>
              <CaretRight aria-hidden weight="bold" className="size-4" />
            </button>
          </div>
          <div aria-hidden className="grid grid-cols-7 text-center text-[12px] leading-6 text-on-board-2">
            {initials.map((d, i) => (
              <span key={i}>{d}</span>
            ))}
          </div>
          <div ref={gridRef} role="group" aria-label={monthLabel(month)} onKeyDown={onKey} className="grid grid-cols-7">
            {cells.map((d) => {
              const on = d === value
              return (
                <button
                  key={d}
                  type="button"
                  data-day={d}
                  // The month is one Tab stop, on the cursor day; arrows move within it.
                  tabIndex={d === cursor ? 0 : -1}
                  disabled={!!max && d > max}
                  aria-pressed={on}
                  aria-current={d === shell.today ? 'date' : undefined}
                  aria-label={day(d, true)}
                  onClick={() => pick(d)}
                  className={cn(
                    'relative grid size-11 place-items-center rounded-sm font-board text-[15px] transition-colors enabled:hover:bg-flap disabled:opacity-35 lg:size-9',
                    // Days from the months either side fill the weeks, quieter than this month's.
                    d.slice(0, 7) === month ? 'font-semibold' : 'text-on-board-2',
                    on && 'bg-ink text-ground enabled:hover:bg-ink',
                  )}
                >
                  {Number(d.slice(8))}
                  {d === shell.today && <span aria-hidden className="absolute bottom-1 h-0.5 w-3.5 rounded-full bg-sign" />}
                </button>
              )
            })}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

/** Every currency as "USD · US Dollar" in the member's language, so a search finds it by code or by name. */
export function currencyOptions(tag: string): PickerOption<string>[] {
  const names = new Intl.DisplayNames([tag], { type: 'currency' })
  return currencies.map((c) => {
    const text = `${c} · ${names.of(c)}`
    return { value: c, text, label: <span className="truncate">{text}</span> }
  })
}
