import { useRouter } from '@tanstack/react-router'
import { Receipt } from '@phosphor-icons/react'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { toast } from 'sonner'

import { Button } from '#/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { nextDue } from '#/lib/bills'
import { prefill, searchServices } from '#/lib/services'
import type { Prefill } from '#/lib/services'
import { ordinal } from '#/lib/i18n'
import type { Locale, MessageKey } from '#/lib/i18n'
import { parseAmount, typedAmount } from '#/lib/money'
import { cn } from '#/lib/utils'
import { deleteBill, pauseBill, saveBill } from '#/server/bills'
import { useActivePocket, useMoney, useShell, useT } from './context'
import { Segmented, glyphFor } from './kit'
import { useFieldErrors } from './welcome'

export type BillDraft = {
  id: string | null
  name: string
  amount: string
  varies: boolean
  categoryId: string | null
  bankAccountId: string | null
  unit: 'week' | 'month' | 'year'
  every: string
  firstDue: string
  trial: boolean
  ends: 'never' | 'after' | 'on'
  endsAfter: string
  endsOn: string
  paused: boolean
}

type SavedBill = {
  id: string
  name: string
  amount: number | null
  categoryId: string | null
  bankAccountId: string | null
  unit: 'week' | 'month' | 'year'
  every: number
  firstDue: string
  trial: boolean
  endsAfter: number | null
  endsOn: string | null
  pausedOn: string | null
}

export const draftFrom = (b: SavedBill): BillDraft => ({
  id: b.id,
  name: b.name,
  amount: b.amount !== null ? String(b.amount / 100) : '',
  varies: b.amount === null,
  categoryId: b.categoryId,
  bankAccountId: b.bankAccountId,
  unit: b.unit,
  every: String(b.every),
  firstDue: b.firstDue,
  trial: b.trial,
  ends: b.endsAfter ? 'after' : b.endsOn ? 'on' : 'never',
  endsAfter: b.endsAfter ? String(b.endsAfter) : '',
  endsOn: b.endsOn ?? '',
  paused: !!b.pausedOn,
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
    unit: 'month',
    every: '1',
    firstDue: date,
    trial: false,
    ends: 'never',
    endsAfter: '',
    endsOn: '',
    paused: false,
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
  const { t, day } = useT()
  const { symbol, money } = useMoney()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState(false)
  // The service picked from the list, for its plan prices.
  const [service, setService] = useState<Prefill | null>(null)
  const { check, field, message, clear } = useFieldErrors()
  // Each opened bill starts clean.
  const close = () => {
    setDraft(null)
    setError('')
    clear()
    setConfirming(false)
    setService(null)
  }

  // `done` confirms the action in a toast once the dialog closes on it.
  const run = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true)
    setError('')
    try {
      await fn()
      await router.invalidate()
      close()
      toast.success(done)
    } catch {
      setError(t('somethingWrong'))
    } finally {
      setBusy(false)
    }
  }

  const every = draft ? Number(draft.every) : 0
  const validEvery = Number.isInteger(every) && every >= 1 && every <= 99
  const endsAfter = draft?.ends === 'after' ? Number(draft.endsAfter) : null
  const validEnd = !draft || (draft.ends === 'after' ? Number.isInteger(endsAfter) && endsAfter! >= 1 && endsAfter! <= 999 : draft.ends === 'on' ? !!draft.endsOn && draft.endsOn >= draft.firstDue : true)
  const endsOn = draft?.ends === 'on' ? draft.endsOn : null
  const next = draft && validEvery && validEnd && draft.firstDue && nextDue({ unit: draft.unit, every, firstDue: draft.firstDue, endsAfter, endsOn }, shell.today)

  return (
    <Dialog open={!!draft} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-h-[calc(100dvh-4rem)] overflow-y-auto sm:max-w-md">
        <DialogTitle>{draft?.id ? draft.name || t('editBill') : t('addBill')}</DialogTitle>
        <DialogDescription className="sr-only">{t('repeats')}</DialogDescription>
        {draft && (
          <form
            noValidate
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              // Problems show inside the form, rather than in a toast that leaves.
              const fine = check(e.currentTarget, {
                name: (v) => (v ? null : t('fieldRequired')),
                every: () => (validEvery ? null : t('badEvery')),
                firstDue: (v) => (v ? null : t('fieldRequired')),
                endsAfter: () => (validEnd ? null : t('badCharges')),
                endsOn: () => (validEnd ? null : t('badEndsOn')),
                amount: (v) => (!draft.varies && parseAmount(v, pocket.currency) === null ? t('badAmount') : null),
              })
              if (!fine) return
              const amount = draft.varies ? null : parseAmount(draft.amount, pocket.currency)
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
                    unit: draft.unit,
                    every,
                    firstDue: draft.firstDue,
                    trial: draft.trial,
                    endsAfter,
                    endsOn,
                  },
                }),
                t('billSaved', { name: draft.name.trim() }),
              )
            }}
          >
            <div className="grid gap-1.5">
              <Label htmlFor="bill-name">{t('name')}</Label>
              <Input id="bill-name" name="name" required maxLength={40} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} {...field('name')} />
              {message('name')}
              {/* New bills only: known services as you type. */}
              {!draft.id && !service && (
                <div className="flex flex-wrap gap-1.5">
                  {searchServices(draft.name).map((s) => (
                    <BillChip
                      key={s.name}
                      on={false}
                      onClick={() => {
                        const p = prefill(s, pocket.currency)
                        setService(p)
                        const plan = p.plans[0]
                        setDraft({ ...draft, name: p.name, unit: plan?.unit ?? p.unit, every: '1', ...(plan && { amount: String(plan.amount / 100), varies: false }) })
                      }}
                    >
                      {s.name}
                    </BillChip>
                  ))}
                </div>
              )}
              {service && service.plans.length > 1 && (
                <div className="flex flex-wrap gap-1.5">
                  {service.plans.map((p) => (
                    <BillChip
                      key={p.name}
                      on={draft.amount === String(p.amount / 100) && draft.unit === p.unit}
                      onClick={() => setDraft({ ...draft, amount: String(p.amount / 100), unit: p.unit, varies: false })}
                    >
                      {p.name} · {money(p.amount)}
                    </BillChip>
                  ))}
                </div>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="bill-amount">{t('amount')}</Label>
              <div className="flex gap-2">
                <Input
                  id="bill-amount"
                  name="amount"
                  inputMode="decimal"
                  placeholder={symbol}
                  required={!draft.varies}
                  disabled={draft.varies}
                  value={draft.varies ? '' : draft.amount}
                  onChange={(e) => setDraft({ ...draft, amount: typedAmount(e.target.value, true) })}
                  {...field('amount')}
                />
                <BillChip on={draft.varies} onClick={() => setDraft({ ...draft, varies: !draft.varies })} className="h-11">
                  {t('varies')}
                </BillChip>
              </div>
              {message('amount')}
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
                <label htmlFor="bill-every" className="caps text-[11px] text-ink-2">
                  {t('every')}
                </label>
                <Input
                  id="bill-every"
                  name="every"
                  inputMode="numeric"
                  className="w-16"
                  value={draft.every}
                  onChange={(e) => setDraft({ ...draft, every: e.target.value.replace(/\D/g, '').slice(0, 2) })}
                  {...field('every')}
                />
                <Segmented
                  label={t('repeats')}
                  value={draft.unit}
                  onChange={(v) => setDraft({ ...draft, unit: v })}
                  options={[
                    { value: 'week', label: t('weeks') },
                    { value: 'month', label: t('months') },
                    { value: 'year', label: t('years') },
                  ]}
                  className="w-56"
                />
              </div>
              {message('every')}
              <div className="grid gap-1.5">
                <Label htmlFor="bill-first-due">{draft.trial ? t('trialEnds') : t('firstDue')}</Label>
                {/* ponytail: native date input; its day of the month carries over, and the 31st means a month's last day. */}
                <Input
                  id="bill-first-due"
                  name="firstDue"
                  type="date"
                  required
                  className={cn(pickerClass, 'w-44')}
                  value={draft.firstDue}
                  onChange={(e) => setDraft({ ...draft, firstDue: e.target.value })}
                  {...field('firstDue')}
                />
                {message('firstDue')}
              </div>
              <BillChip on={draft.trial} onClick={() => setDraft({ ...draft, trial: !draft.trial })} className="justify-self-start">
                {t('freeTrial')}
              </BillChip>
              <div className="flex flex-wrap items-center gap-2">
                <span className="caps text-[11px] text-ink-2">{t('ends')}</span>
                <Segmented
                  label={t('ends')}
                  value={draft.ends}
                  onChange={(v) => setDraft({ ...draft, ends: v })}
                  options={[
                    { value: 'never', label: t('endsNever') },
                    { value: 'after', label: t('endsAfterLabel') },
                    { value: 'on', label: t('endsOnLabel') },
                  ]}
                  className="w-56"
                />
                {draft.ends === 'after' && (
                  <span className="flex items-center gap-2">
                    <Input
                      id="bill-ends-after"
                      name="endsAfter"
                      aria-label={t('charges')}
                      inputMode="numeric"
                      className="w-16"
                      value={draft.endsAfter}
                      onChange={(e) => setDraft({ ...draft, endsAfter: e.target.value.replace(/\D/g, '').slice(0, 3) })}
                      {...field('endsAfter')}
                    />
                    <span className="text-[13px] text-ink-2">{t('charges')}</span>
                  </span>
                )}
                {draft.ends === 'on' && (
                  <Input
                    id="bill-ends-on"
                    name="endsOn"
                    type="date"
                    aria-label={t('endsOnLabel')}
                    className={cn(pickerClass, 'w-44')}
                    value={draft.endsOn}
                    onChange={(e) => setDraft({ ...draft, endsOn: e.target.value })}
                    {...field('endsOn')}
                  />
                )}
              </div>
              {message('endsAfter')}
              {message('endsOn')}
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
                  <Button type="button" variant="destructive" disabled={busy} onClick={() => void run(() => deleteBill({ data: { pocketId: pocket.id, id: draft.id! } }), t('nameDeleted', { name: draft.name }))}>
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
                {draft.id && (
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={busy}
                    onClick={() =>
                      void run(
                        () => pauseBill({ data: { pocketId: pocket.id, id: draft.id!, paused: !draft.paused } }),
                        t(draft.paused ? 'billResumed' : 'billPaused', { name: draft.name.trim() }),
                      )
                    }
                  >
                    {draft.paused ? t('resumeBill') : t('pauseBill')}
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
