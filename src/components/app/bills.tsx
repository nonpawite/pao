import { Link, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '#/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '#/components/ui/dialog'
import { isOwed } from '#/lib/bills'
import type { BillState } from '#/lib/bills'
import { diffDays, formatBaht } from '#/lib/budget'
import { cn } from '#/lib/utils'
import { payBill, skipBill } from '#/server/bills'
import { deleteEntry } from '#/server/entries'
import { useAddEntry } from './add-entry'
import { useActivePocket, useT } from './context'

export type Bill = {
  id: string
  name: string
  amount: number | null
  categoryId: string | null
  bankAccountId: string | null
  repeat: 'monthly' | 'yearly'
  day: number
  month: number | null
  due: string | null
  state: BillState | null
  paidAmount: number | null
}

/** Paid: a fixed bill logs at once with Undo; one that varies opens the add sheet for its amount. */
function usePayBill() {
  const router = useRouter()
  const { t } = useT()
  const { pay } = useAddEntry()
  const pocket = useActivePocket()
  const [busy, setBusy] = useState(false)
  async function run(b: Bill) {
    if (b.amount === null) return pay({ pocketId: pocket.id, billId: b.id, dueOn: b.due!, name: b.name, categoryId: b.categoryId })
    if (busy) return
    setBusy(true)
    try {
      const { id } = await payBill({ data: { id: b.id, dueOn: b.due! } })
      await router.invalidate()
      toast(t('paidBill', { name: b.name, amount: formatBaht(b.amount) }), {
        duration: 10000,
        action: {
          label: t('undo'),
          onClick: async () => {
            await deleteEntry({ data: { id } })
            await router.invalidate()
          },
        },
      })
    } catch {
      toast.error(t('somethingWrong'))
    } finally {
      setBusy(false)
    }
  }
  return { run, busy }
}

/**
 * Bills as board rows, most urgent first: status, and Paid while owed. Tapping a bill offers Skip and Edit;
 * `onEdit` edits in place, otherwise Edit goes to the Bills page.
 */
export function BillRows({ bills, today, onEdit }: { bills: Bill[]; today: string; onEdit?: (b: Bill) => void }) {
  const { t, day } = useT()
  const pocket = useActivePocket()
  const router = useRouter()
  const paying = usePayBill()
  const [picked, setPicked] = useState<Bill | null>(null)

  return (
    <>
      <div className="grid">
        {bills.map((b) => (
          <div key={b.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-t border-board-line py-2.5">
            <button type="button" onClick={() => setPicked(b)} className="grid min-w-0 text-left">
              <span className="truncate text-[15px] font-medium">{b.name}</span>
              <span className="truncate text-[12px] text-on-board-2">
                {[day(b.due!), pocket.categories.find((c) => c.id === b.categoryId)?.name].filter(Boolean).join(' · ')}
              </span>
            </button>
            <BillStatus state={b.state!} due={b.due!} today={today} />
            {isOwed(b.state) ? (
              <button
                type="button"
                disabled={paying.busy}
                onClick={() => void paying.run(b)}
                className={cn(
                  'caps h-11 rounded-sm px-3 text-[12px] transition-colors lg:h-8',
                  // Paying what is late or due today is the action that matters now.
                  b.state === 'soon' ? 'border border-rule-strong text-on-board-2 hover:text-on-board' : 'bg-ink text-ground',
                )}
              >
                {t('markPaid')}
              </button>
            ) : (
              <span className="w-[52px] text-right font-board text-[15px] font-semibold text-on-board-2">{formatBaht(b.paidAmount ?? b.amount ?? 0)}</span>
            )}
          </div>
        ))}
      </div>

      <Dialog open={!!picked} onOpenChange={(o) => !o && setPicked(null)}>
        <DialogContent className="max-w-sm">
          <DialogTitle>{picked?.name}</DialogTitle>
          <DialogDescription>
            {picked && `${picked.amount !== null ? formatBaht(picked.amount) : t('varies')} · ${t('dueOn', { date: day(picked.due!) })}`}
          </DialogDescription>
          {picked && (
            <div className="grid gap-2">
              {(isOwed(picked.state) || picked.state === 'skipped') && (
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="secondary"
                    onClick={async () => {
                      try {
                        await skipBill({ data: { id: picked.id, dueOn: picked.due! } })
                        setPicked(null)
                        await router.invalidate()
                      } catch {
                        toast.error(t('somethingWrong'))
                      }
                    }}
                  >
                    {picked.state === 'skipped' ? t('unskip') : t('skipCycle')}
                  </Button>
                  {isOwed(picked.state) && (
                    <Button
                      disabled={paying.busy}
                      onClick={() => {
                        setPicked(null)
                        void paying.run(picked)
                      }}
                    >
                      {t('markPaid')}
                    </Button>
                  )}
                </div>
              )}
              {pocket.role === 'owner' &&
                (onEdit ? (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setPicked(null)
                      onEdit(picked)
                    }}
                  >
                    {t('editBill')}
                  </Button>
                ) : (
                  <Button asChild variant="ghost">
                    <Link to="/bills">{t('editBill')}</Link>
                  </Button>
                ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

export function BillStatus({ state, due, today }: { state: BillState; due: string; today: string }) {
  const { t } = useT()
  const n = diffDays(today, due)
  const label =
    state === 'late'
      ? n === -1
        ? t('billLateOne')
        : t('billLate', { n: -n })
      : state === 'today'
        ? t('billToday')
        : state === 'soon'
          ? n === 1
            ? t('billTomorrow')
            : t('billInDays', { n })
          : state === 'paid'
            ? t('billPaid')
            : t('billSkipped')
  return (
    <span
      className={cn(
        'caps inline-flex items-center gap-1.5 text-[11px] whitespace-nowrap',
        state === 'late' ? 'text-over-text' : state === 'today' ? 'text-ahead-text' : 'text-on-board-2',
      )}
    >
      <i aria-hidden className="size-[7px] bg-current" />
      {label}
    </span>
  )
}
