import { useRouter } from '@tanstack/react-router'
import { CaretRight, Plus } from '@phosphor-icons/react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '#/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { addDays, cycleFor } from '#/lib/budget'
import { parseAmount } from '#/lib/money'
import { cn } from '#/lib/utils'
import { archiveCategory, restoreCategory, saveCategory, setCycleStartDay } from '#/server/limits'
import type { Shell } from '#/server/shell'
import { pickerClass, useDays } from './bill-form'
import { useMoney, useT } from './context'
import { CategoryGlyph, Row, Segmented } from './kit'
import { Picker } from './picker'

type Editing = { id: string | null; name: string; limitType: 'day' | 'cycle' | 'none'; amount: string }

const sectionLabel = 'caps text-[12px] text-ink-2'

/**
 * A pocket's plan, inside its settings: when its cycle starts, its categories and their limits, and what that adds up to.
 * The owner edits; members read.
 */
export function PocketPlan({ pocket }: { pocket: Shell['pockets'][number] }) {
  const router = useRouter()
  const { t, range } = useT()
  const { dayOptions, dayName } = useDays()
  // The plan's pocket, which can differ from the active one.
  const { money, symbol } = useMoney(pocket.currency)
  const [editing, setEditing] = useState<Editing | null>(null)
  const [error, setError] = useState('')
  const canEdit = pocket.role === 'owner'
  const next = cycleFor(addDays(pocket.cycle.end, 1), pocket.cycleStartDay)
  const cycleTotal = pocket.categories.filter((c) => c.limitType === 'cycle').reduce((s, c) => s + c.limitAmount, 0)
  const dayTotal = pocket.categories.filter((c) => c.limitType === 'day').reduce((s, c) => s + c.limitAmount * next.length, 0)

  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn()
      await router.invalidate()
      return true
    } catch {
      toast.error(t('somethingWrong'))
      return false
    }
  }

  return (
    <>
      <div className="grid gap-1.5">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor={`start-${pocket.id}`} className={sectionLabel}>
            {t('cycleStarts')}
          </label>
          <Picker
            id={`start-${pocket.id}`}
            label={t('cycleStarts')}
            disabled={!canEdit}
            value={pocket.cycleStartDay}
            options={dayOptions}
            columns={7}
            display={dayName(pocket.cycleStartDay)}
            onChange={(day) => run(() => setCycleStartDay({ data: { pocketId: pocket.id, day } }))}
            className={cn(pickerClass, 'shrink-0')}
          />
        </div>
        <span className="caps text-[11px] text-ink-2">{t('nextCycleRange', { range: range(next.start, next.end) })}</span>
      </div>

      <div className="grid">
        <span className={cn(sectionLabel, 'pb-1')}>{t('category')}</span>
        {pocket.categories.map((c) => (
          <Row key={c.id} className="py-2.5">
            <button
              type="button"
              disabled={!canEdit}
              onClick={() => setEditing({ id: c.id, name: c.name, limitType: c.limitType, amount: c.limitAmount ? String(c.limitAmount / 100) : '' })}
              className="-my-2.5 flex min-h-11 w-full items-center gap-3 py-2.5 text-left disabled:cursor-default"
            >
              <CategoryGlyph name={c.name} className="size-7" />
              <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{c.name}</span>
              <span className="caps shrink-0 rounded-sm bg-plate px-2 py-1 text-[11px] text-ink-2">
                {t(c.limitType === 'day' ? 'perDay' : c.limitType === 'cycle' ? 'perCycle' : 'noLimit')}
              </span>
              {c.limitType !== 'none' && <span className="w-20 shrink-0 text-right font-board text-[16px] font-semibold">{money(c.limitAmount)}</span>}
              {canEdit && <CaretRight className="size-4 shrink-0 text-ink-2" weight="bold" />}
            </button>
          </Row>
        ))}
        {canEdit && (
          <Row className="py-2.5">
            <button
              type="button"
              onClick={() => setEditing({ id: null, name: '', limitType: 'cycle', amount: '' })}
              className="caps -my-2.5 flex min-h-11 items-center gap-2 text-[13px]"
            >
              <Plus className="size-4" weight="bold" />
              {t('addCategory')}
            </button>
          </Row>
        )}
        {cycleTotal + dayTotal > 0 && (
          <Row className="grid gap-0.5 py-2.5">
            <span className="font-board text-[15px] font-semibold">{t('plannedUpTo', { amount: money(cycleTotal + dayTotal) })}</span>
            <span className="text-[13px] text-ink-2">{t('plannedDetail', { cycle: money(cycleTotal), day: money(dayTotal) })}</span>
          </Row>
        )}
      </div>

      {/* Opens over the pocket's popup. */}
      <Dialog
        open={!!editing}
        onOpenChange={(o) => {
          if (o) return
          setEditing(null)
          setError('')
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogTitle>{editing?.id ? t('editCategory') : t('addCategory')}</DialogTitle>
          <DialogDescription className="sr-only">{t('limitAmount')}</DialogDescription>
          {editing && (
            <form
              className="grid gap-4"
              onSubmit={async (e) => {
                e.preventDefault()
                const amount = editing.limitType === 'none' ? 0 : parseAmount(editing.amount, pocket.currency)
                // Next to the field, not in a toast that leaves.
                if (amount === null || (amount <= 0 && editing.limitType !== 'none')) return setError(t('badAmount'))
                setError('')
                const ok = await run(() =>
                  saveCategory({ data: { pocketId: pocket.id, id: editing.id, name: editing.name, limitType: editing.limitType, limitAmount: amount } }),
                )
                if (ok) {
                  setEditing(null)
                  toast(t('savedChanges'))
                }
              }}
            >
              <div className="grid gap-1.5">
                <Label htmlFor="cat-name">{t('name')}</Label>
                <Input id="cat-name" required maxLength={40} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <span className={sectionLabel}>{t('limitType')}</span>
                <Segmented
                  label={t('limitType')}
                  value={editing.limitType}
                  onChange={(v) => setEditing({ ...editing, limitType: v })}
                  options={[
                    { value: 'day', label: t('perDay') },
                    { value: 'cycle', label: t('perCycle') },
                    { value: 'none', label: t('noLimit') },
                  ]}
                />
              </div>
              {editing.limitType !== 'none' && (
                <div className="grid gap-1.5">
                  <Label htmlFor="cat-amount">{t('limitAmount')}</Label>
                  <Input
                    id="cat-amount"
                    inputMode="decimal"
                    required
                    placeholder={symbol}
                    value={editing.amount}
                    aria-invalid={!!error || undefined}
                    aria-describedby={error ? 'cat-amount-error' : undefined}
                    onChange={(e) => setEditing({ ...editing, amount: e.target.value.replace(/[^\d.]/g, '') })}
                  />
                  {error && (
                    <p id="cat-amount-error" role="alert" className="text-[13px] text-over-text">
                      {error}
                    </p>
                  )}
                </div>
              )}
              <div className="flex gap-2">
                {editing.id && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-over-text"
                    onClick={async () => {
                      const id = editing.id!
                      if (!(await run(() => archiveCategory({ data: { pocketId: pocket.id, id } })))) return
                      setEditing(null)
                      toast(t('removedName', { name: editing.name }), {
                        duration: 10000,
                        action: { label: t('undo'), onClick: () => void run(() => restoreCategory({ data: { pocketId: pocket.id, id } })) },
                      })
                    }}
                  >
                    {t('archive')}
                  </Button>
                )}
                <Button type="submit" className="ml-auto">
                  {t('saveChanges')}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
