import { useRouter } from '@tanstack/react-router'
import { Receipt } from '@phosphor-icons/react'
import { useState } from 'react'
import type { ReactNode } from 'react'

import { Button } from '#/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { nextDue } from '#/lib/bills'
import { ordinal } from '#/lib/i18n'
import type { Locale, MessageKey } from '#/lib/i18n'
import { parseAmount } from '#/lib/money'
import { cn } from '#/lib/utils'
import { deleteBill, saveBill } from '#/server/bills'
import { useActivePocket, useMoney, useShell, useT } from './context'
import { Segmented, glyphFor } from './kit'
import { Picker } from './picker'

export type BillDraft = {
  id: string | null
  name: string
  amount: string
  varies: boolean
  categoryId: string | null
  bankAccountId: string | null
  repeat: 'monthly' | 'yearly'
  day: number
  month: number
}

type SavedBill = {
  id: string
  name: string
  amount: number | null
  categoryId: string | null
  bankAccountId: string | null
  repeat: 'monthly' | 'yearly'
  day: number
  month: number | null
}

export const draftFrom = (b: SavedBill): BillDraft => ({
  id: b.id,
  name: b.name,
  amount: b.amount !== null ? String(b.amount / 100) : '',
  varies: b.amount === null,
  categoryId: b.categoryId,
  bankAccountId: b.bankAccountId,
  repeat: b.repeat,
  day: b.day,
  month: b.month ?? 1,
})

/**
 * A blank bill on a given date and the first account. Its category is the pocket's bills category when it has one
 * (the receipt pictogram, named like "Bills" or "ค่าบิล"); otherwise none, so the bill is never filed under Gas without a choice.
 */
export function useNewDraft() {
  const shell = useShell()
  const pocket = useActivePocket()
  return (date: string = shell.today): BillDraft => ({
    id: null,
    name: '',
    amount: '',
    varies: false,
    categoryId: pocket.categories.find((c) => glyphFor(c.name) === Receipt)?.id ?? null,
    bankAccountId: shell.accounts[0]?.id ?? null,
    repeat: 'monthly',
    day: Number(date.slice(8)),
    month: Number(date.slice(5, 7)),
  })
}

// Field edges in mark grey: 3:1 against the panel, so a field reads as a field (WCAG 1.4.11).
export const pickerClass = 'h-11 min-w-24 rounded-sm border border-mark bg-board px-3 font-board font-medium lg:h-10'

/** Days of the month as the pickers show them: 1–30, then the last day, which also covers the 31st. */
export function useDays() {
  const { t, locale } = useT()
  return dayChoices(t, locale)
}

/** Days of the month for a picker, outside the app shell too (Setup). */
export function dayChoices(t: (key: MessageKey) => string, locale: Locale) {
  return {
    dayOptions: [...Array.from({ length: 30 }, (_, i) => ({ value: i + 1, label: String(i + 1) })), { value: 31, label: t('lastDay'), wide: true }],
    dayName: (d: number) => (d === 31 ? t('lastDay') : ordinal(locale, d)),
  }
}

/** Adds or edits a bill of the active pocket; Limits and Calendar both open it. */
export function BillForm({ draft, setDraft }: { draft: BillDraft | null; setDraft: (d: BillDraft | null) => void }) {
  const shell = useShell()
  const pocket = useActivePocket()
  const router = useRouter()
  const { t, day, names } = useT()
  const { dayOptions, dayName } = useDays()
  const { symbol } = useMoney()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState(false)
  // Each opened bill starts clean.
  const close = () => {
    setDraft(null)
    setError('')
    setConfirming(false)
  }

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    setError('')
    try {
      await fn()
      await router.invalidate()
      close()
    } catch {
      setError(t('somethingWrong'))
    } finally {
      setBusy(false)
    }
  }

  const next = draft && nextDue({ repeat: draft.repeat, day: draft.day, month: draft.repeat === 'yearly' ? draft.month : null }, shell.today)

  return (
    <Dialog open={!!draft} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-h-[calc(100dvh-4rem)] overflow-y-auto sm:max-w-md">
        <DialogTitle>{draft?.id ? draft.name || t('editBill') : t('addBill')}</DialogTitle>
        <DialogDescription className="sr-only">{t('repeats')}</DialogDescription>
        {draft && (
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              const amount = draft.varies ? null : parseAmount(draft.amount, pocket.currency)
              // Problems show inside the form, next to Save, rather than in a toast that leaves.
              if (!draft.varies && amount === null) return setError(t('badAmount'))
              if (!draft.categoryId) return setError(t('pickCategory'))
              void run(() =>
                saveBill({
                  data: {
                    pocketId: pocket.id,
                    id: draft.id,
                    name: draft.name,
                    amount,
                    categoryId: draft.categoryId!,
                    bankAccountId: draft.bankAccountId,
                    repeat: draft.repeat,
                    day: draft.day,
                    month: draft.repeat === 'yearly' ? draft.month : null,
                  },
                }),
              )
            }}
          >
            <div className="grid gap-1.5">
              <Label htmlFor="bill-name">{t('name')}</Label>
              <Input id="bill-name" required maxLength={40} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="bill-amount">{t('amount')}</Label>
              <div className="flex gap-2">
                <Input
                  id="bill-amount"
                  inputMode="decimal"
                  placeholder={symbol}
                  required={!draft.varies}
                  disabled={draft.varies}
                  value={draft.varies ? '' : draft.amount}
                  onChange={(e) => setDraft({ ...draft, amount: e.target.value.replace(/[^\d.]/g, '') })}
                />
                <BillChip on={draft.varies} onClick={() => setDraft({ ...draft, varies: !draft.varies })} className="h-11">
                  {t('varies')}
                </BillChip>
              </div>
            </div>
            <div className="grid gap-1.5">
              <span className="caps text-[12px] text-ink-2">{t('category')}</span>
              <div className="flex flex-wrap gap-1.5">
                {pocket.categories.map((c) => (
                  <BillChip
                    key={c.id}
                    on={c.id === draft.categoryId}
                    onClick={() => {
                      setDraft({ ...draft, categoryId: c.id })
                      setError('')
                    }}
                  >
                    {c.name}
                  </BillChip>
                ))}
              </div>
            </div>
            {shell.accounts.length > 0 && (
              <div className="grid gap-1.5">
                <span className="caps text-[12px] text-ink-2">{t('paidFrom')}</span>
                <div className="flex flex-wrap gap-1.5">
                  {shell.accounts.map((a) => (
                    <BillChip key={a.id} on={a.id === draft.bankAccountId} onClick={() => setDraft({ ...draft, bankAccountId: a.id })}>
                      {a.name}
                    </BillChip>
                  ))}
                </div>
              </div>
            )}
            <div className="grid gap-2">
              <span className="caps text-[12px] text-ink-2">{t('repeats')}</span>
              <div className="flex flex-wrap items-center gap-2">
                <Segmented
                  label={t('repeats')}
                  value={draft.repeat}
                  onChange={(v) => setDraft({ ...draft, repeat: v })}
                  options={[
                    { value: 'monthly', label: t('monthly') },
                    { value: 'yearly', label: t('yearly') },
                  ]}
                  className="w-44"
                />
                {/* "on the 25th Oct" is one phrase: narrow pickers keep it beside the choice in the dialog, and on a
                    phone it wraps whole, so the month never sits alone on a line. */}
                <div className="flex items-center gap-2">
                  <label htmlFor="bill-day" className="caps text-[11px] text-ink-2">
                    {t('onThe')}
                  </label>
                  <Picker
                    id="bill-day"
                    label={t('onThe')}
                    value={draft.day}
                    options={dayOptions}
                    columns={7}
                    display={dayName(draft.day)}
                    onChange={(d) => setDraft({ ...draft, day: d })}
                    className={cn(pickerClass, 'min-w-20')}
                  />
                  {draft.repeat === 'yearly' && (
                    <Picker
                      label={t('month')}
                      value={draft.month}
                      options={names.months.map((m, i) => ({ value: i + 1, label: m }))}
                      columns={4}
                      onChange={(m) => setDraft({ ...draft, month: m })}
                      className={cn(pickerClass, 'min-w-20')}
                    />
                  )}
                </div>
              </div>
              {next && <span className="caps text-[12px] text-ink-2">{t('nextDueOn', { date: day(next) })}</span>}
            </div>
            {error && (
              <p role="alert" className="text-[13px] text-over-text">
                {error}
              </p>
            )}
            {confirming ? (
              // Deleting a bill cannot be undone (its paid entries stay, unlinked), so it asks first.
              <div role="alert" className="grid gap-3 rounded-sm bg-over/10 p-3">
                <p className="text-[15px]">
                  <b className="font-semibold">{t('deleteBillTitle', { name: draft.name })}</b> {t('deleteBillHint')}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" variant="secondary" onClick={() => setConfirming(false)}>
                    {t('cancel')}
                  </Button>
                  <Button type="button" variant="destructive" disabled={busy} onClick={() => void run(() => deleteBill({ data: { pocketId: pocket.id, id: draft.id! } }))}>
                    {t('deleteBill')}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                {draft.id && (
                  <Button type="button" variant="ghost" className="text-over-text" disabled={busy} onClick={() => setConfirming(true)}>
                    {t('deleteBill')}
                  </Button>
                )}
                <Button type="submit" className="ml-auto" disabled={busy}>
                  {t('saveBill')}
                </Button>
              </div>
            )}
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

function BillChip({ on, onClick, className, children }: { on: boolean; onClick: () => void; className?: string; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        'inline-flex h-9 shrink-0 items-center rounded-sm border border-ink/25 px-3 text-[14px] whitespace-nowrap transition-colors hover:bg-plate',
        on && 'border-ink bg-ink text-ground hover:bg-ink',
        className,
      )}
    >
      {children}
    </button>
  )
}
