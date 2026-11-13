import { useRouter } from '@tanstack/react-router'
import { CaretDown, Check, Receipt } from '@phosphor-icons/react'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { toast } from 'sonner'

import { Button } from '#/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { nextDue, timesAYear } from '#/lib/bills'
import { prefill, searchServices } from '#/lib/services'
import type { Prefill } from '#/lib/services'
import { ordinal } from '#/lib/i18n'
import type { Locale, MessageKey } from '#/lib/i18n'
import { parseAmount, typedAmount } from '#/lib/money'
import { cn } from '#/lib/utils'
import { deleteBill, pauseBill, saveBill } from '#/server/bills'
import { useActivePocket, useMoney, useShell, useT } from './context'
import { CategoryGlyph, Segmented, glyphFor } from './kit'
import { DatePicker, Picker } from './picker'
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
// The bill dialog's picker fields: full width and as tall as its text fields, so the rows line up.
const fieldClass = 'h-11 w-full rounded-sm border border-mark bg-board px-3.5 text-[16px]'
const dateClass = 'flex items-center justify-between gap-2 text-left font-board font-medium'

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
  const { symbol, money } = useMoney()
  // A due date in another year names its year (a yearly bill, or a trial ending in January).
  const dateLabel = (d: string, withWeekday = false) =>
    d.slice(0, 4) === shell.today.slice(0, 4) ? day(d, withWeekday) : `${day(d, withWeekday)} ${Number(d.slice(0, 4)) + names.yearOffset}`
  // "Custom" opens the every-N line; a bill that already repeats every 2 or more opens with it.
  const [custom, setCustom] = useState(false)
  // The folded trial-and-end row.
  const [more, setMore] = useState(false)
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
    setCustom(false)
    setMore(false)
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
  const showCustom = custom || (!!draft && draft.every !== '1')
  const repeatLabel = draft && (every === 1 && !custom
    ? t(({ week: 'everyWeek', month: 'everyMonth', year: 'everyYear' } as const)[draft.unit])
    : t(({ week: 'everyWeeks', month: 'everyMonths', year: 'everyYears' } as const)[draft.unit], { n: draft.every || '…' }))
  const moreSummary = draft && [
    draft.trial ? t('freeTrial') : t('noTrial'),
    draft.ends === 'after' && endsAfter ? t('endsAfterN', { n: endsAfter }) : draft.ends === 'on' && draft.endsOn ? t('endsOnDate', { date: dateLabel(draft.endsOn) }) : t('neverEnds'),
  ].join(' · ')
  // What a weekly or yearly bill comes to a month, in whole units; a plain monthly bill already says it.
  const typed = draft && !draft.varies ? parseAmount(draft.amount, pocket.currency) : null
  const perMonth = draft && typed && validEvery && !(draft.unit === 'month' && every === 1) ? Math.round((typed * timesAYear({ unit: draft.unit, every, firstDue: draft.firstDue })) / 1200) * 100 : null

  return (
    <Dialog open={!!draft} onOpenChange={(o) => !o && close()}>
      <DialogContent
        className="max-h-[calc(100dvh-4rem)] overflow-y-auto sm:max-w-md"
        onOpenAutoFocus={(e) => {
          if (!draft?.id) return
          e.preventDefault()
          ;(e.currentTarget as HTMLElement).focus()
        }}
      >
        <DialogTitle>{draft?.id ? draft.name || t('editBill') : t('addBill')}</DialogTitle>
        <DialogDescription className="sr-only">{t('repeats')}</DialogDescription>
        {draft && (
          <form
            noValidate
            className="grid min-w-0 grid-cols-1 gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              // A bad end date lives in the folded row, so the row opens to show it.
              if (!validEnd) setMore(true)
              // Problems show inside the form, rather than in a toast that leaves.
              const fine = check(e.currentTarget, {
                name: (v) => (v ? null : t('fieldRequired')),
                every: () => (validEvery ? null : t('badEvery')),
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
            {/* The amount is the bill's one figure, so it is set large on a ruled line; Varies rides at its end. */}
            <div className="grid grid-cols-1 gap-1.5">
              <Label htmlFor="bill-amount">{t('amount')}</Label>
              <div className="flex items-center gap-2 border-b border-mark has-[input:focus]:border-ink has-[input:focus]:shadow-[0_1px_0_var(--color-ink)] has-[input[aria-invalid=true]]:border-over-text">
                <span aria-hidden className={cn('font-board text-[24px] font-medium text-ink-2', draft.varies && 'opacity-50')}>
                  {symbol}
                </span>
                <input
                  id="bill-amount"
                  name="amount"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder={draft.varies ? '—' : '0'}
                  required={!draft.varies}
                  disabled={draft.varies}
                  value={draft.varies ? '' : draft.amount}
                  onChange={(e) => setDraft({ ...draft, amount: typedAmount(e.target.value, true) })}
                  className="h-14 min-w-0 flex-1 bg-transparent font-board text-[40px] leading-none font-medium tracking-[-0.02em] tabular-nums outline-none placeholder:text-ink-3 disabled:cursor-not-allowed"
                  {...field('amount')}
                />
                <button
                  type="button"
                  aria-pressed={draft.varies}
                  onClick={() => setDraft({ ...draft, varies: !draft.varies })}
                  className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-sm px-2 text-[14px] text-ink-2 transition-colors hover:bg-plate aria-pressed:text-ink lg:h-9"
                >
                  {draft.varies && <Check aria-hidden weight="bold" className="size-3.5" />}
                  {t('varies')}
                </button>
              </div>
              {message('amount')}
            </div>
            <div className={cn('grid grid-cols-1 gap-3', shell.accounts.length > 0 && 'grid-cols-2')}>
              <div className="grid min-w-0 gap-1.5">
                <Label htmlFor="bill-category">{t('category')}</Label>
                <Picker
                  id="bill-category"
                  label={t('category')}
                  value={draft.categoryId ?? ''}
                  options={pocket.categories.map((c) => ({
                    value: c.id,
                    text: c.name,
                    label: (
                      <span className="flex min-w-0 items-center gap-2">
                        <CategoryGlyph name={c.name} className="size-5" />
                        <span className="truncate">{c.name}</span>
                      </span>
                    ),
                  }))}
                  display={draft.categoryId ? undefined : <span className="text-ink-2">{t('pickCategory')}</span>}
                  onChange={(id) => {
                    setDraft({ ...draft, categoryId: id })
                    setError('')
                  }}
                  className={fieldClass}
                />
              </div>
              {shell.accounts.length > 0 && (
                <div className="grid min-w-0 gap-1.5">
                  <Label htmlFor="bill-account">{t('paidFrom')}</Label>
                  <Picker
                    id="bill-account"
                    label={t('paidFrom')}
                    value={draft.bankAccountId ?? ''}
                    options={shell.accounts.map((a) => ({ value: a.id, label: a.name }))}
                    display={shell.accounts.some((a) => a.id === draft.bankAccountId) ? undefined : <span className="text-ink-2">{t('noBankAccount')}</span>}
                    onChange={(id) => setDraft({ ...draft, bankAccountId: id })}
                    className={fieldClass}
                  />
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="grid min-w-0 gap-1.5">
                  <Label htmlFor="bill-repeats">{t('repeats')}</Label>
                  <Picker
                    id="bill-repeats"
                    label={t('repeats')}
                    value={showCustom ? 'custom' : draft.unit}
                    options={[
                      { value: 'week', label: t('everyWeek') },
                      { value: 'month', label: t('everyMonth') },
                      { value: 'year', label: t('everyYear') },
                      { value: 'custom', label: t('periodCustom') },
                    ]}
                    display={repeatLabel}
                    onChange={(v) => {
                      setCustom(v === 'custom')
                      if (v !== 'custom') setDraft({ ...draft, unit: v, every: '1' })
                    }}
                    className={fieldClass}
                  />
                </div>
                <div className="grid min-w-0 gap-1.5">
                  <Label>{draft.trial ? t('trialEnds') : t('firstDue')}</Label>
                  <DatePicker
                    value={draft.firstDue}
                    onChange={(d) => setDraft({ ...draft, firstDue: d })}
                    label={draft.trial ? t('trialEnds') : t('firstDue')}
                    className={cn(fieldClass, dateClass)}
                  >
                    <span className="truncate">{dateLabel(draft.firstDue, true)}</span>
                    <CaretDown aria-hidden weight="bold" className="size-4 shrink-0 opacity-70" />
                  </DatePicker>
                </div>
              </div>
              {/* Every 2 weeks, every 3 months: the rare schedules open their own line rather than crowding the common ones. */}
              {showCustom && (
                <div className="flex items-center gap-2">
                  <label htmlFor="bill-every" className="caps shrink-0 text-[12px] text-ink-2">
                    {t('every')}
                  </label>
                  <Input
                    id="bill-every"
                    name="every"
                    inputMode="numeric"
                    className="w-14 text-center font-board font-medium"
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
                    className="min-w-0 flex-1"
                  />
                </div>
              )}
              {message('every')}
            </div>
            {/* A trial and an end date are rare, so they fold into one ruled row that still says what is set. */}
            <div className="grid grid-cols-1 border-y border-board-line">
              <button
                type="button"
                aria-expanded={more}
                aria-controls="bill-more"
                onClick={() => setMore(!more)}
                className="-mx-2 flex min-h-12 flex-wrap items-center justify-between gap-x-3 gap-y-0.5 rounded-sm px-2 py-2 text-left transition-colors hover:bg-plate"
              >
                <span className="shrink-0 text-[15px]">{t('trialAndEnd')}</span>
                <span className="flex min-w-0 items-center gap-2 text-[13px] text-ink-2">
                  <span>{moreSummary}</span>
                  <CaretDown aria-hidden weight="bold" className={cn('size-4 shrink-0 transition-transform motion-reduce:transition-none', more && 'rotate-180')} />
                </span>
              </button>
              {more && (
                <div id="bill-more" className="grid gap-4 pt-3 pb-4">
                  <BillChip toggle on={draft.trial} onClick={() => setDraft({ ...draft, trial: !draft.trial })} className="h-11 justify-self-start lg:h-9">
                    {t('freeTrial')}
                  </BillChip>
                  <div className="grid gap-1.5">
                    <span className="caps text-[12px] text-ink-2">{t('ends')}</span>
                    <div className="flex flex-wrap items-center gap-2">
                      <Segmented
                        label={t('ends')}
                        value={draft.ends}
                        onChange={(v) => setDraft({ ...draft, ends: v })}
                        options={[
                          { value: 'never', label: t('endsNever') },
                          { value: 'after', label: t('endsAfterLabel') },
                          { value: 'on', label: t('endsOnLabel') },
                        ]}
                        className="min-w-48 flex-1 sm:w-56 sm:flex-none"
                      />
                      {draft.ends === 'after' && (
                        <span className="flex items-center gap-2">
                          <Input
                            id="bill-ends-after"
                            name="endsAfter"
                            aria-label={t('charges')}
                            inputMode="numeric"
                            className="w-16 text-center font-board font-medium"
                            value={draft.endsAfter}
                            onChange={(e) => setDraft({ ...draft, endsAfter: e.target.value.replace(/\D/g, '').slice(0, 3) })}
                            {...field('endsAfter')}
                          />
                          <span className="text-[13px] text-ink-2">{t('charges')}</span>
                        </span>
                      )}
                      {draft.ends === 'on' && (
                        <DatePicker
                          value={draft.endsOn || undefined}
                          onChange={(d) => setDraft({ ...draft, endsOn: d })}
                          label={t('endsOnLabel')}
                          className={cn(fieldClass, dateClass, 'w-auto min-w-36', !draft.endsOn && 'font-sans font-normal text-ink-2')}
                        >
                          <span className="truncate">{draft.endsOn ? dateLabel(draft.endsOn, true) : t('pickDate')}</span>
                          <CaretDown aria-hidden weight="bold" className="size-4 shrink-0 opacity-70" />
                        </DatePicker>
                      )}
                    </div>
                    {message('endsAfter')}
                    {message('endsOn')}
                  </div>
                </div>
              )}
            </div>
            {next && (
              <p className="text-[13px] text-ink-2">
                {t('nextDueOn', { date: dateLabel(next) })}
                {perMonth !== null && <> · {t('aboutAMonth', { amount: money(perMonth) })}</>}
              </p>
            )}
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
                  <Button type="button" variant="ghost" className="-ml-5 text-over-text" disabled={busy} onClick={() => setConfirming(true)}>
                    {t('deleteBill')}
                  </Button>
                )}
                {/* Pause can be undone, so it stays quiet beside Save, away from Delete. */}
                <div className="ml-auto flex gap-2">
                  {draft.id && (
                    <Button
                      type="button"
                      variant="ghost"
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
                  <Button type="submit" disabled={busy}>
                    {t('saveBill')}
                  </Button>
                </div>
              </div>
            )}
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

/** A choice fills ink when picked; a `toggle` beside a field (Free trial) gets an ink edge and a check instead, so it never reads as Save. */
function BillChip({ on, onClick, className, children, toggle }: { on: boolean; onClick: () => void; className?: string; children: ReactNode; toggle?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-sm border border-ink/25 px-3 text-[14px] whitespace-nowrap transition-colors hover:bg-plate',
        on && (toggle ? 'border-ink' : 'border-ink bg-ink text-ground hover:bg-ink'),
        className,
      )}
    >
      {toggle && on && <Check aria-hidden weight="bold" className="size-3.5" />}
      {children}
    </button>
  )
}
