import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { Bank, CaretDown, Plus, X } from '@phosphor-icons/react'
import { useEffect, useLayoutEffect, useState } from 'react'
import type { FormEvent } from 'react'

import { oneTapClass } from '#/components/app/add-entry'
import { dayChoices, pickerClass } from '#/components/app/bill-form'
import { makeT } from '#/components/app/context'
import { Board, BoardLine, CategoryGlyph, DayStrip, Flap, Group, Row, Segmented, glyphFor, useDocumentTitle } from '#/components/app/kit'
import { Picker, currencyOptions } from '#/components/app/picker'
import { ThemeSwitch } from '#/components/app/theme'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { authClient } from '#/lib/auth-client'
import { cycleFor, dayStrip } from '#/lib/budget'
import type { StripDay } from '#/lib/budget'
import { locales } from '#/lib/i18n'
import { currencySymbol, formatMoney, parseAmount, typedAmount } from '#/lib/money'
import { cn } from '#/lib/utils'
import { finishSetup, getSetup } from '#/server/setup'
import { getSessionUser } from '#/server/shell'

export const Route = createFileRoute('/setup')({
  beforeLoad: async () => {
    const u = await getSessionUser()
    if (!u) throw redirect({ to: '/login' })
    // Setup runs once: a member with a pocket goes to Today.
    if (u.ready) throw redirect({ to: '/' })
  },
  loader: () => getSetup(),
  component: Setup,
})

type LimitType = 'day' | 'cycle' | 'none'
type Chosen = { name: string; limitType: LimitType; amount: string }

const sameName = (a: string, b: string) => a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase()

/**
 * A new member builds their personal pocket here, with a preview of their Today board filling in beside it.
 * Everything stays in the page until Finish saves it in one go.
 */
function Setup() {
  const data = Route.useLoaderData()
  const router = useRouter()
  const { t, range, locale } = makeT(data.locale, data.names)
  const tag = locales[locale].tag
  const { dayOptions, dayName } = dayChoices(t, locale)
  useDocumentTitle(t('setupTitle'))
  useLayoutEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const [currency, setCurrency] = useState(data.currency)
  const [payday, setPayday] = useState(31)
  const [categories, setCategories] = useState<Chosen[]>([])
  const [accounts, setAccounts] = useState<string[]>([])
  // The one category whose limit is open, by name.
  const [open, setOpen] = useState<string | null>(null)
  const [rowError, setRowError] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  // Finish needs the page live: before hydration a tap would do nothing.
  const [live, setLive] = useState(false)
  useEffect(() => setLive(true), [])

  const money = (hundredths: number) => formatMoney(hundredths, currency, tag)
  const symbol = currencySymbol(currency, tag)
  const limitOf = (c: Chosen) => (c.limitType === 'none' ? 0 : Math.max(0, parseAmount(c.amount, currency) ?? 0))
  const badLimit = (c: Chosen) => c.limitType !== 'none' && limitOf(c) <= 0
  const limitLabel = (type: LimitType, limit: number) => (limit ? t(type === 'day' ? 'aDay' : 'aCycle', { amount: money(limit) }) : t('noLimit'))

  function addCategory(name: string) {
    setCategories((cs) => [...cs, { name: name.trim(), limitType: 'none', amount: '' }])
    setError('')
  }

  function updateOpen(patch: Partial<Chosen>) {
    setCategories((cs) => cs.map((c) => (c.name === open ? { ...c, ...patch } : c)))
    setRowError('')
  }

  /** Closes the open limit; one whose amount does not read stays open with the reason, and this returns false. */
  function closeLimit() {
    const c = categories.find((x) => x.name === open)
    if (c && badLimit(c)) {
      setRowError(t('badAmount'))
      return false
    }
    setOpen(null)
    setRowError('')
    return true
  }

  async function finish() {
    if (!categories.length) return setError(t('setupNeedCategory'))
    const bad = categories.find(badLimit)
    if (bad) {
      setOpen(bad.name)
      return setRowError(t('badAmount'))
    }
    setBusy(true)
    setError('')
    try {
      await finishSetup({
        data: {
          currency,
          cycleStartDay: payday,
          categories: categories.map((c) => ({ name: c.name, limitType: c.limitType, limitAmount: limitOf(c) })),
          accounts,
        },
      })
      await router.navigate({ to: '/' })
    } catch {
      setError(t('somethingWrong'))
      setBusy(false)
    }
  }

  const cycle = cycleFor(data.today, payday)
  const openRow = categories.find((c) => c.name === open)

  return (
    <main className="mx-auto grid w-full max-w-[600px] grid-cols-[minmax(0,1fr)] content-start gap-6 px-4 pt-[max(12px,env(safe-area-inset-top))] pb-10 lg:max-w-[1080px] lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:gap-x-14 lg:gap-y-8 lg:px-8 lg:pt-8">
      <header className="flex items-center justify-between gap-3 lg:col-span-2">
        {/* The name is the same Latin word in every language. */}
        <p className="text-[17px] font-semibold">Pao</p>
        <div className="flex items-center gap-2">
          <ThemeSwitch t={t} className="w-[7.5rem]" />
          <button
            type="button"
            onClick={async () => {
              await authClient.signOut()
              await router.navigate({ to: '/login' })
            }}
            className="-my-3 -mr-2 h-11 px-2 text-[14px] font-medium underline decoration-2 underline-offset-4"
          >
            {t('signOut')}
          </button>
        </div>
      </header>

      <aside className="lg:sticky lg:top-8 lg:col-start-2 lg:row-start-2 lg:self-start">
        <Preview
          title={`${data.pocketName} · ${currency}`}
          range={range(cycle.start, cycle.end)}
          strip={(limit) => dayStrip(cycle, data.today, new Map(), limit).map((d) => d.state)}
          categories={categories.map((c) => ({ name: c.name, limitType: c.limitType, limit: limitOf(c) }))}
          accounts={accounts}
          money={money}
          limitLabel={limitLabel}
          t={t}
        />
      </aside>

      <div className="grid grid-cols-[minmax(0,1fr)] content-start gap-7 lg:col-start-1 lg:row-start-2">
        <div className="grid gap-2">
          <h1 className="title-large">{t('setupTitle')}</h1>
          <p className="max-w-[56ch] text-[15px] text-ink-2">{t('setupIntro')}</p>
        </div>

        <Group title={t('pocket')}>
          <Row className="flex items-center justify-between gap-3">
            <label htmlFor="setup-currency">{t('currency')}</label>
            <Picker
              id="setup-currency"
              label={t('currency')}
              value={currency}
              options={currencyOptions(tag)}
              search={{ placeholder: t('searchCurrency'), empty: t('noCurrency') }}
              display={currency}
              onChange={setCurrency}
              className={cn(pickerClass, 'shrink-0')}
            />
          </Row>
          <Row className="grid gap-1">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="setup-payday">{t('payday')}</label>
              <Picker
                id="setup-payday"
                label={t('payday')}
                value={payday}
                options={dayOptions}
                columns={7}
                display={dayName(payday)}
                onChange={setPayday}
                className={cn(pickerClass, 'shrink-0')}
              />
            </div>
            <p className="text-[13px] text-ink-2">{t('setupPaydayHint')}</p>
          </Row>
        </Group>

        <Group title={t('categories')} aside={categories.length ? t('chosenCount', { n: categories.length }) : undefined}>
          {categories.map((c) => {
            const isOpen = c.name === open
            const limit = limitOf(c)
            return (
              <div key={c.name} className="border-t border-rule">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={isOpen ? 'setup-limit' : undefined}
                  onClick={() => {
                    // One open at a time, and the open one keeps focus until its amount reads.
                    if (closeLimit() && !isOpen) setOpen(c.name)
                  }}
                  className="flex min-h-12 w-full items-center gap-3 py-2 text-left"
                >
                  <CategoryGlyph name={c.name} className="-ml-1.5" />
                  <span className="min-w-0 flex-1 truncate text-[16px] font-medium">{c.name}</span>
                  <span className={cn('shrink-0 text-[15px]', limit ? 'font-board font-semibold' : 'text-ink-2')}>
                    {limitLabel(c.limitType, limit)}
                  </span>
                  <CaretDown aria-hidden weight="bold" className={cn('size-3.5 shrink-0 text-ink-3 transition-transform', isOpen && 'rotate-180')} />
                </button>
                {isOpen && openRow && (
                  <form
                    id="setup-limit"
                    className="grid gap-3 pb-4"
                    onSubmit={(e) => {
                      e.preventDefault()
                      closeLimit()
                    }}
                  >
                    <Segmented
                      label={t('limitType')}
                      value={openRow.limitType}
                      onChange={(v) => updateOpen({ limitType: v })}
                      options={[
                        { value: 'day', label: t('perDayChoice') },
                        { value: 'cycle', label: t('perCycleChoice') },
                        { value: 'none', label: t('noLimit') },
                      ]}
                    />
                    {openRow.limitType !== 'none' && (
                      <div className="grid gap-1.5">
                        <Label htmlFor="setup-limit-amount">{t('limitAmount')}</Label>
                        {/* The currency stays in the field, so the typed figure reads as money. */}
                        <div className="relative">
                          <span aria-hidden className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center font-board text-ink-2">
                            {symbol}
                          </span>
                          <Input
                            id="setup-limit-amount"
                            inputMode="decimal"
                            autoFocus
                            value={openRow.amount}
                            aria-invalid={!!rowError || undefined}
                            aria-describedby={rowError ? 'setup-limit-error' : undefined}
                            onChange={(e) => updateOpen({ amount: typedAmount(e.target.value) })}
                            style={{ paddingLeft: `calc(${symbol.length}ch + 1.375rem)` }}
                            className="font-board font-medium"
                          />
                        </div>
                        {rowError && (
                          <p id="setup-limit-error" role="alert" className="text-[13px] text-over-text">
                            {rowError}
                          </p>
                        )}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        className="-ml-3 text-over-text"
                        onClick={() => {
                          setCategories((cs) => cs.filter((x) => x.name !== c.name))
                          setOpen(null)
                          setRowError('')
                        }}
                      >
                        {t('remove')}
                      </Button>
                      <Button type="submit" variant="outline" className="ml-auto">
                        {t('done')}
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            )
          })}
          <Suggestions
            hint={t('setupCategoriesHint')}
            names={data.categories}
            chosen={categories.map((c) => c.name)}
            onAdd={addCategory}
            inputId="setup-own-category"
            t={t}
          />
        </Group>

        <Group title={t('accounts')} aside={accounts.length ? t('chosenCount', { n: accounts.length }) : undefined}>
          {accounts.map((a) => (
            <Row key={a} className="flex items-center gap-3 py-0.5">
              <Bank aria-hidden className="size-5 shrink-0 text-ink-2" />
              <span className="min-w-0 flex-1 truncate text-[16px] font-medium">{a}</span>
              <button
                type="button"
                aria-label={t('removeName', { name: a })}
                onClick={() => setAccounts((as) => as.filter((x) => x !== a))}
                className="-mr-3 grid size-11 shrink-0 place-items-center text-ink-2 transition-colors hover:text-ink"
              >
                <X weight="bold" className="size-4" />
              </button>
            </Row>
          ))}
          <Suggestions
            hint={t('setupAccountsHint')}
            names={data.accounts}
            chosen={accounts}
            onAdd={(name) => setAccounts((as) => [...as, name.trim()])}
            inputId="setup-own-account"
            t={t}
          />
        </Group>

        <div className="grid gap-3">
          {error && (
            <p role="alert" className="text-[14px] text-over-text">
              {error}
            </p>
          )}
          <Button type="button" size="lg" disabled={busy || !live} onClick={() => void finish()} className="w-full lg:w-auto lg:justify-self-start lg:px-12">
            {t('finish')}
          </Button>
        </div>
      </div>
    </main>
  )
}

type Translate = ReturnType<typeof makeT>['t']

/** Suggested names as one-tap chips, then a field for a name of your own. A chosen name leaves the chips. */
function Suggestions({
  hint,
  names,
  chosen,
  onAdd,
  inputId,
  t,
}: {
  hint: string
  names: string[]
  chosen: string[]
  onAdd: (name: string) => void
  inputId: string
  t: Translate
}) {
  const [own, setOwn] = useState('')
  const [error, setError] = useState('')
  const left = names.filter((n) => !chosen.some((c) => sameName(c, n)))

  function submit(e: FormEvent) {
    e.preventDefault()
    const name = own.trim()
    if (!name) return
    if (chosen.some((c) => sameName(c, name))) return setError(t('setupDuplicate', { name }))
    onAdd(name)
    setOwn('')
    setError('')
  }

  return (
    <Row className="grid gap-3">
      <p className="text-[13px] text-ink-2">{hint}</p>
      {left.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {left.map((n) => (
            <button key={n} type="button" onClick={() => onAdd(n)} className={cn(oneTapClass, 'gap-1.5')}>
              <Plus aria-hidden weight="bold" className="size-3.5" />
              {n}
            </button>
          ))}
        </div>
      )}
      <form className="grid gap-1.5" onSubmit={submit}>
        <Label htmlFor={inputId} className="sr-only">
          {t('addYourOwn')}
        </Label>
        <div className="flex gap-2">
          <Input
            id={inputId}
            placeholder={t('addYourOwn')}
            maxLength={40}
            value={own}
            aria-invalid={!!error || undefined}
            aria-describedby={error ? `${inputId}-error` : undefined}
            onChange={(e) => {
              setOwn(e.target.value)
              setError('')
            }}
          />
          <Button type="submit" variant="outline" disabled={!own.trim()}>
            {t('add')}
          </Button>
        </div>
        {error && (
          <p id={`${inputId}-error`} role="alert" className="text-[13px] text-over-text">
            {error}
          </p>
        )}
      </form>
    </Row>
  )
}

/**
 * The member's Today board as it will look after Finish: the first per-day limit leads, as on Today, else what the
 * cycle allows; the chosen categories list below with their limits.
 */
function Preview({
  title,
  range,
  strip,
  categories,
  accounts,
  money,
  limitLabel,
  t,
}: {
  title: string
  range: string
  strip: (limit: number) => StripDay['state'][]
  categories: Array<{ name: string; limitType: LimitType; limit: number }>
  accounts: string[]
  money: (hundredths: number) => string
  limitLabel: (type: LimitType, limit: number) => string
  t: Translate
}) {
  const first = categories.find((c) => c.limitType === 'day' && c.limit > 0)
  const cycleTotal = categories.reduce((s, c) => s + (c.limitType === 'cycle' ? c.limit : 0), 0)
  const G = first && glyphFor(first.name)
  return (
    // A container, so the flap tiles shrink to fit a narrow board.
    <Board className="@container content-start lg:p-6">
      <BoardLine left={title} right={range} />
      {first && (
        <BoardLine
          className="mt-4"
          left={
            <span className="flex items-center gap-2">
              {G && <G className="size-4 shrink-0 text-ink-2" />}
              {first.name} · {t('aDay', { amount: money(first.limit) })}
            </span>
          }
        />
      )}
      <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-2">
        <Flap text={money(first?.limit ?? cycleTotal)} dim={!first && !cycleTotal} className={first ? 'text-[46px] lg:text-[64px]' : 'text-[40px] lg:text-[56px]'} />
        <span className="pb-1 text-[15px] leading-tight text-ink-2">
          {first ? t('leftToday') : cycleTotal ? t('leftThisCycle') : t('setupNoLimit')}
        </span>
      </div>
      {/* Without a per-day limit the strip still draws the cycle, in neutral cells, so a new payday shows. */}
      <DayStrip days={first ? strip(first.limit) : strip(0).map((s) => (s === 'today' ? s : 'future'))} onBoard className="mt-5" />

      <div className="mt-5 grid">
        {categories.length ? (
          categories.map((c) => (
            <div key={c.name} className="flex items-center gap-3 border-t border-board-line py-2.5">
              <CategoryGlyph name={c.name} className="-ml-1.5 size-7" />
              <span className="min-w-0 flex-1 truncate">{c.name}</span>
              <span className={cn('shrink-0 text-[14px]', c.limit ? 'font-board font-semibold' : 'text-on-board-2')}>
                {limitLabel(c.limitType, c.limit)}
              </span>
            </div>
          ))
        ) : (
          <p className="border-t border-board-line pt-3 text-[15px] text-on-board-2">{t('setupBoardEmpty')}</p>
        )}
      </div>
      {accounts.length > 0 && <BoardLine className="mt-3 border-t border-board-line pt-3" left={t('accounts')} right={accounts.join(' · ')} />}
    </Board>
  )
}
