import { CaretDown } from '@phosphor-icons/react'
import { Popover } from 'radix-ui'
import { useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'

import { cn } from '#/lib/utils'

export type PickerOption<T> = { value: T; label: ReactNode; wide?: boolean }

/**
 * Our dropdown: the trigger reads as a field, and the choices open on a small board below it.
 * `columns` above 1 lays them out as a grid of figures (days, months); a `wide` option spans its row.
 * `display` replaces the chosen option's label in the trigger (the 15th, not 15).
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
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const grid = columns > 1

  // Arrows move through the choices as laid out; Home and End jump to the ends.
  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    const items = [...listRef.current!.querySelectorAll<HTMLElement>('[role=option]')]
    const i = items.indexOf(document.activeElement as HTMLElement)
    const steps: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: columns, ArrowUp: -columns }
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : e.key in steps ? Math.min(items.length - 1, Math.max(0, i + steps[e.key])) : null
    if (next === null) return
    e.preventDefault()
    items[next].focus()
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        id={id}
        type="button"
        disabled={disabled}
        aria-label={label}
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
          // Open on the current choice, so arrows start from it.
          onOpenAutoFocus={(e) => {
            e.preventDefault()
            const list = listRef.current
            ;(list?.querySelector<HTMLElement>('[aria-selected=true]') ?? list?.querySelector<HTMLElement>('[role=option]'))?.focus()
          }}
          className="board z-50 max-h-[min(380px,var(--radix-popover-content-available-height))] max-w-[var(--radix-popover-content-available-width)] min-w-[var(--radix-popover-trigger-width)] overflow-y-auto rounded-sm p-1.5 shadow-[0_16px_32px_-12px_rgb(0_0_0/0.5)] duration-150 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
        >
          <div
            ref={listRef}
            role="listbox"
            aria-label={label}
            onKeyDown={onKey}
            className="grid gap-1"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
          >
            {options.map((o) => {
              const on = o.value === value
              return (
                <button
                  key={String(o.value)}
                  type="button"
                  role="option"
                  aria-selected={on}
                  onClick={() => {
                    onChange(o.value)
                    setOpen(false)
                  }}
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
