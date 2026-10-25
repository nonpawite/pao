import { CaretDown, MagnifyingGlass } from '@phosphor-icons/react'
import { Popover } from 'radix-ui'
import { useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'

import { currencies } from '#/lib/money'
import { cn } from '#/lib/utils'

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

/** Every currency as "USD · US Dollar" in the member's language, so a search finds it by code or by name. */
export function currencyOptions(tag: string): PickerOption<string>[] {
  const names = new Intl.DisplayNames([tag], { type: 'currency' })
  return currencies.map((c) => {
    const text = `${c} · ${names.of(c)}`
    return { value: c, text, label: <span className="truncate">{text}</span> }
  })
}
