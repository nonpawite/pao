import { Link, useRouter } from '@tanstack/react-router'
import { Backspace, CaretDown, CaretRight, Check } from '@phosphor-icons/react'
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { toast } from 'sonner'

import { Button } from '#/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '#/components/ui/dialog'
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from '#/components/ui/drawer'
import { addDays, formatBaht, parseAmount } from '#/lib/budget'
import { cn } from '#/lib/utils'
import { addEntry, deleteEntry, getDayEntries, updateEntry } from '#/server/entries'
import type { DayEntry } from '#/server/entries'
import { useCategoryColor } from './charts'
import { useShell, useT } from './context'
import { Flap, Segmented, glyphFor } from './kit'

/** An existing entry to load into the sheet as the line being edited. */
export type EditTarget = { id: string; pocketId: string; date: string }
/** A bill that varies, waiting for its amount; the line it becomes pays that due date. */
export type BillTarget = { pocketId: string; billId: string; dueOn: string; name: string; categoryId: string | null }
type Opening = { edit?: EditTarget; bill?: BillTarget }
/** A line typed but not added when the sheet closed; it comes back on the next open instead of being lost. */
type Draft = { kind: 'expense' | 'income'; amountText: string; categoryId: string | null; note: string; pocketId: string; date: string }

const AddContext = createContext<{ open: () => void; edit: (target: EditTarget) => void; pay: (target: BillTarget) => void }>({
  open: () => {},
  edit: () => {},
  pay: () => {},
})
export const useAddEntry = () => useContext(AddContext)

const isDesktop = () => window.matchMedia('(min-width: 1024px)').matches

/** Owns the add sheet (phone) and dialog (desktop); N opens it. */
export function AddEntryProvider({ children }: { children: ReactNode }) {
  const [sheet, setSheet] = useState(false)
  const [dialog, setDialog] = useState(false)
  const [target, setTarget] = useState<Opening>({})
  const draft = useRef<Draft | null>(null)
  const { t } = useT()
  const keepDraft = (d: Draft | null) => (draft.current = d)

  const show = (next: Opening = {}) => {
    setTarget(next)
    if (!isDesktop()) return setSheet(true)
    setDialog(true)
  }
  const open = () => show()

  // N opens the sheet, except while typing or while another dialog is up (it would stack on top).
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (e.key !== 'n' || e.metaKey || e.ctrlKey || e.altKey || target.closest('input, textarea, [contenteditable]')) return
      if (document.querySelector('[role=dialog], [role=alertdialog]')) return
      e.preventDefault()
      show()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <AddContext.Provider value={{ open, edit: (edit) => show({ edit }), pay: (bill) => show({ bill }) }}>
      {children}
      {/* autoFocus: focus moves into the sheet as it opens, not left on the + behind the overlay. */}
      <Drawer open={sheet} onOpenChange={setSheet} repositionInputs={false} autoFocus>
        <DrawerContent className="pb-[max(12px,env(safe-area-inset-bottom))]">
          <DrawerTitle className="sr-only">{t('newExpense')}</DrawerTitle>
          <DrawerDescription className="sr-only">{t('amountHint')}</DrawerDescription>
          <div className="overflow-y-auto px-4 pt-2">
            <AddEntryForm keypad {...target} draft={draft.current} onDraft={keepDraft} onClose={() => setSheet(false)} />
          </div>
        </DrawerContent>
      </Drawer>
      <Dialog open={dialog} onOpenChange={setDialog}>
        {/* Pinned near the top, not centred, so the dialog does not jump as the effect line comes and goes. */}
        <DialogContent
          showCloseButton={false}
          // Focus lands on the amount, set here rather than with autoFocus so the dialog first records what opened it.
          onOpenAutoFocus={(e) => {
            e.preventDefault()
            ;(e.currentTarget as HTMLElement).querySelector<HTMLElement>('input[inputmode=decimal]')?.focus()
          }}
          className="top-[max(2rem,6vh)] max-h-[calc(100dvh-4rem)] translate-y-0 overflow-y-auto sm:max-w-[880px]"
        >
          <DialogTitle className="sr-only">{t('newExpense')}</DialogTitle>
          <DialogDescription className="sr-only">{t('amountHint')}</DialogDescription>
          <AddEntryForm {...target} draft={draft.current} onDraft={keepDraft} onClose={() => setDialog(false)} />
        </DialogContent>
      </Dialog>
    </AddContext.Provider>
  )
}

const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'] as const

type Keep = { category: boolean; note: boolean }
const KEEP_KEY = 'keep-next'
// Per device: what survives an Add. Storage can be blocked, so it falls back to keeping nothing.
function readKeep(): Keep {
  try {
    return { category: false, note: false, ...JSON.parse(localStorage.getItem(KEEP_KEY) ?? '{}') }
  } catch {
    return { category: false, note: false }
  }
}

type Line = { kind: 'expense' | 'income'; amount: number; categoryId: string | null; note: string; bankAccountId: string | null; billId?: string; billFor?: string }

/**
 * B2 tape: the sheet stays open, the day's entries collect on a tape above the line being typed, and each Add saves at once.
 * C1 the batch's date, account and pocket open from the tape header; C2 keep-for-next; C3 day total and limit effect;
 * C5 Enter adds, Cmd/Ctrl+Enter adds and closes; C6 copy a line. Log-again chips add a line without closing.
 * `keypad` draws an on-screen keypad (phone); otherwise the amount is a text field and the tape is a second column (desktop).
 */
export function AddEntryForm({
  keypad,
  edit,
  bill,
  draft: saved,
  onDraft,
  onClose,
}: {
  keypad?: boolean
  edit?: EditTarget
  bill?: BillTarget
  draft?: Draft | null
  onDraft?: (d: Draft | null) => void
  onClose: () => void
}) {
  const shell = useShell()
  const router = useRouter()
  const { t, day } = useT()
  const color = useCategoryColor()
  // A plain open picks up a line left typed last time; opening an entry or a bill starts from that instead.
  const draft = edit || bill ? null : saved
  const [kind, setKind] = useState<'expense' | 'income'>(draft?.kind ?? 'expense')
  const [pocketId, setPocketId] = useState(edit?.pocketId ?? bill?.pocketId ?? draft?.pocketId ?? shell.activePocketId)
  const [amountText, setAmountText] = useState(draft?.amountText ?? '')
  const [categoryId, setCategoryId] = useState<string | null>(bill?.categoryId ?? draft?.categoryId ?? null)
  const [date, setDate] = useState(edit?.date ?? draft?.date ?? shell.today)
  const [accountId, setAccountId] = useState<string | null>(shell.accounts[0]?.id ?? null)
  const [note, setNote] = useState(bill?.name ?? draft?.note ?? '')
  // The bill the line being typed will pay, from a Due chip or a Paid that needs an amount.
  const [link, setLink] = useState(bill ? { billId: bill.billId, billFor: bill.dueOn } : null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [said, setSaid] = useState('')
  const [batch, setBatch] = useState(false)
  const [keep, setKeep] = useState(readKeep)
  const [opened, setOpened] = useState<string | null>(null)
  const [editing, setEditing] = useState<DayEntry | null>(null)
  const [tape, setTape] = useState<{ key: string; rows: DayEntry[] } | null>(null)
  const [version, setVersion] = useState(0)
  const [scrolled, setScrolled] = useState(false)
  const amountRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  // Closing with a line typed (Esc, Done, a tap outside, a swipe) keeps it for next time.
  const latest = useRef<Draft | null>(null)
  latest.current = amountText && !editing && !link ? { kind, amountText, categoryId, note, pocketId, date } : null
  useEffect(() => () => onDraft?.(latest.current), [])

  // "Saved …" stands in the effect line's place for a moment, so a one-tap chip visibly did something.
  useEffect(() => {
    if (!said) return
    const id = setTimeout(() => setSaid(''), 5000)
    return () => clearTimeout(id)
  }, [said])

  // Follow the pocket switcher while the form is untouched.
  useEffect(() => {
    if (!amountText && !edit && !bill) setPocketId(shell.activePocketId)
  }, [shell.activePocketId])

  const pocket = shell.pockets.find((p) => p.id === pocketId) ?? shell.pockets[0]
  const category = pocket.categories.find((c) => c.id === categoryId) ?? null
  const amount = parseAmount(amountText)
  const yesterday = addDays(shell.today, -1)

  // The whole day of this pocket, so lines logged earlier show and nothing gets logged twice.
  const tapeKey = `${pocket.id}:${date}`
  useEffect(() => {
    let live = true
    getDayEntries({ data: { pocketId: pocket.id, date } }).then(
      (rows) => live && setTape({ key: tapeKey, rows }),
      () => {},
    )
    return () => {
      live = false
    }
  }, [tapeKey, version])
  const rows = tape?.key === tapeKey ? tape.rows : null

  useEffect(() => {
    setEditing(null)
    setOpened(null)
  }, [tapeKey])

  // Opened from an entry list: load that entry as soon as its day's lines arrive.
  const pending = useRef(edit?.id)
  useEffect(() => {
    const r = rows?.find((x) => x.id === pending.current)
    if (!r) return
    pending.current = undefined
    fill(r, true)
  }, [rows])

  // Newest line last, so keep the tape scrolled to it.
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [rows?.length])

  const catName = (id: string | null) => pocket.categories.find((c) => c.id === id)?.name ?? ''
  const spent = rows?.reduce((s, r) => s + (r.kind === 'expense' ? r.amount : 0), 0) ?? 0

  // What this line does to its limit, before saving. A line being edited stops counting at its old amount.
  let effect: { left: number; name: string; day?: string } | null = null
  if (kind === 'expense' && category && amount && category.limitType !== 'none') {
    const was = editing?.kind === 'expense' && editing.categoryId === category.id ? editing.amount : 0
    if (category.limitType === 'day' && rows) {
      const onDay = rows.reduce((s, r) => s + (r.kind === 'expense' && r.categoryId === category.id ? r.amount : 0), 0)
      effect = { left: category.limitAmount - onDay + was - amount, name: category.name, day: date === shell.today ? undefined : date }
    }
    if (category.limitType === 'cycle' && date >= pocket.cycle.start && date <= pocket.cycle.end)
      effect = { left: category.limitAmount - category.spentCycle + was - amount, name: category.name }
  }

  const defaultAccount = pocket.kind === 'personal' || kind === 'expense' ? accountId : null

  async function save(line: Line, id?: string) {
    if (busy) return false
    setBusy(true)
    setError('')
    try {
      const data = {
        pocketId: pocket.id,
        kind: line.kind,
        categoryId: line.kind === 'expense' ? line.categoryId : null,
        bankAccountId: line.bankAccountId,
        amount: line.amount,
        note: line.note,
        occurredOn: date,
      }
      if (id) await updateEntry({ data: { id, ...data } })
      else await addEntry({ data: line.billId ? { ...data, billId: line.billId, billFor: line.billFor } : data })
      setSaid(
        line.kind === 'income'
          ? t('savedIncome', { amount: formatBaht(line.amount) })
          : t('saved', { amount: formatBaht(line.amount), category: catName(line.categoryId) }),
      )
      setVersion((v) => v + 1)
      void router.invalidate()
      return true
    } catch {
      setError(t('somethingWrong'))
      return false
    } finally {
      setBusy(false)
    }
  }

  const canSave = !!amount && (kind === 'income' || !!category) && !busy

  async function submit(close: boolean, pickedId = categoryId) {
    if (!amount || busy || (kind === 'expense' && !pocket.categories.some((c) => c.id === pickedId))) return
    const line = {
      kind,
      amount,
      categoryId: pickedId,
      note: note.trim(),
      bankAccountId: editing ? editing.bankAccountId : defaultAccount,
      ...(link && !editing && link),
    }
    if (!(await save(line, editing?.id))) return
    // An edit started from an entry list, or a bill paid from Today, is the whole job, so the sheet closes after it.
    if ((editing && editing.id === edit?.id) || (line.billId && line.billId === bill?.billId)) close = true
    setLink(null)
    setAmountText('')
    // After an edit the composer goes back to a blank next line.
    if (!keep.note || editing) setNote('')
    if (!keep.category || editing) setCategoryId(null)
    setEditing(null)
    // Saved, so nothing is left to keep, even if the sheet unmounts before it renders again.
    latest.current = null
    if (close) onClose()
    else amountRef.current?.focus()
  }

  // C6 copy, or load a line to edit: the composer takes its kind, category, note and amount.
  function fill(r: DayEntry, edit: boolean) {
    setKind(r.kind)
    setCategoryId(r.categoryId)
    setNote(r.note)
    setAmountText(String(r.amount / 100))
    setEditing(edit ? r : null)
    setOpened(null)
    amountRef.current?.focus()
  }

  function cancelEdit() {
    setEditing(null)
    setAmountText('')
    setNote('')
    setCategoryId(null)
  }

  async function remove(r: DayEntry) {
    setOpened(null)
    if (editing?.id === r.id) cancelEdit()
    let was: Awaited<ReturnType<typeof deleteEntry>>
    try {
      was = await deleteEntry({ data: { id: r.id } })
    } catch {
      setError(t('somethingWrong'))
      return
    }
    setVersion((v) => v + 1)
    void router.invalidate()
    toast(t('undone'), {
      duration: 10000,
      action: {
        label: t('undo'),
        onClick: async () => {
          await addEntry({ data: was })
          setVersion((v) => v + 1)
          await router.invalidate()
        },
      },
    })
  }

  function pickDate(d: string) {
    setDate(d)
    amountRef.current?.focus()
  }

  function toggleKeep(k: keyof Keep) {
    const next = { ...keep, [k]: !keep[k] }
    setKeep(next)
    try {
      localStorage.setItem(KEEP_KEY, JSON.stringify(next))
    } catch {}
  }

  const press = (k: (typeof keys)[number]) =>
    setAmountText((s) => (k === 'del' ? s.slice(0, -1) : k === '.' && s.includes('.') ? s : (s + k).slice(0, 12)))

  // Arrows move through categories like a radio group; Enter adds the focused one.
  function onCategoryKey(e: KeyboardEvent<HTMLDivElement>) {
    const cats = pocket.categories
    const focused = (e.target as HTMLElement).closest<HTMLElement>('[data-id]')?.dataset.id ?? categoryId
    if (e.key === 'Enter') {
      e.preventDefault()
      if (focused) setCategoryId(focused)
      void submit(e.metaKey || e.ctrlKey, focused)
      return
    }
    const step = ({ ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 } as Record<string, number>)[e.key]
    if (!step || !cats.length) return
    e.preventDefault()
    const i = cats.findIndex((c) => c.id === focused)
    const next = cats[i < 0 ? (step > 0 ? 0 : cats.length - 1) : (i + step + cats.length) % cats.length]
    setCategoryId(next.id)
    e.currentTarget.querySelector<HTMLElement>(`[data-id="${next.id}"]`)?.focus()
  }

  const mod = typeof navigator !== 'undefined' && /Mac|iP/.test(navigator.platform) ? '⌘' : 'Ctrl'

  const tapeBlock = (
    <div className="grid">
      {/* Logging last night's spending is the usual job, so the day stays in view rather than in the batch details. */}
      <div role="group" aria-label={t('when')} className="flex flex-wrap gap-1.5 pb-3">
        {/* Picking the day is a step on the way to typing, so the amount takes focus back (desktop). */}
        <Chip on={date === shell.today} onClick={() => pickDate(shell.today)}>{t('today')}</Chip>
        <Chip on={date === yesterday} onClick={() => pickDate(yesterday)}>{t('yesterday')}</Chip>
        {/* The date field is invisible over the chip, so the chip wears its focus ring. */}
        <label
          className={cn(
            chipClass,
            'relative has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--focus)]',
            date !== shell.today && date !== yesterday && chipOn,
          )}
        >
          {date !== shell.today && date !== yesterday ? day(date) : t('pickDate')}
          <input
            type="date"
            value={date}
            max={addDays(shell.today, 1)}
            onChange={(e) => e.target.value && pickDate(e.target.value)}
            className="absolute inset-0 opacity-0"
            aria-label={t('pickDate')}
          />
        </label>
      </div>
      <button
        type="button"
        aria-expanded={batch}
        onClick={() => setBatch(!batch)}
        className="flex items-baseline justify-between gap-3 border-b-2 border-rule-strong pt-2.5 pb-2 text-left"
      >
        <span className="caps flex min-w-0 items-center gap-1.5 text-[12px] text-ink-2">
          <span className="truncate text-ink underline decoration-ink-3 decoration-dashed underline-offset-4">
            {[shell.accounts.find((a) => a.id === accountId)?.name, shell.pockets.length > 1 ? pocket.name : null].filter(Boolean).join(' · ') ||
              t('thisBatch')}
          </span>
          {rows && <span className="shrink-0">· {rows.length === 1 ? t('lineOne') : t('lineCount', { n: rows.length })}</span>}
          <CaretDown weight="bold" className={cn('size-3 shrink-0 transition-transform motion-reduce:transition-none', batch && 'rotate-180')} />
        </span>
        <span className={cn('shrink-0 font-board text-[17px] font-semibold', !spent && 'text-ink-2')}>{formatBaht(spent)}</span>
      </button>

      {batch && (
        <div className="grid gap-2.5 border-b border-rule py-3">
          {shell.accounts.length > 0 && (
            <ChipRow label={kind === 'income' ? t('paidInto') : t('paidFrom')}>
              {shell.accounts.map((a) => (
                <Chip key={a.id} on={a.id === accountId} onClick={() => setAccountId(a.id)}>
                  {a.name}
                </Chip>
              ))}
            </ChipRow>
          )}
          {shell.pockets.length > 1 && (
            <ChipRow label={t('pocket')}>
              {shell.pockets.map((p) => (
                <Chip
                  key={p.id}
                  on={p.id === pocket.id}
                  onClick={() => {
                    setPocketId(p.id)
                    setCategoryId(null)
                    setLink(null)
                  }}
                >
                  {p.name}
                </Chip>
              ))}
            </ChipRow>
          )}
          <p className="text-[13px] text-ink-2">{t('batchHint')}</p>
          <ChipRow label={t('keepNext')}>
            <Chip on={keep.category} onClick={() => toggleKeep('category')}>{t('category')}</Chip>
            <Chip on={keep.note} onClick={() => toggleKeep('note')}>{t('keepNote')}</Chip>
          </ChipRow>
        </div>
      )}

      {!!rows?.length && (
        <ul
          ref={listRef}
          onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 4)}
          className={cn(
            // Rows fill edge to edge with their own inset; the fade, not a scrollbar, says it scrolls.
            '-mx-1.5 grid overflow-x-hidden overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
            keypad ? 'max-h-[154px]' : 'max-h-[440px]',
            // The fade says earlier lines sit above.
            scrolled && '[mask-image:linear-gradient(to_bottom,transparent,black_32px)]',
          )}
        >
          {rows.map((r) => {
            const mine = r.userId === shell.user.id
            const name = r.kind === 'income' ? t('income') : catName(r.categoryId)
            const meta = [r.note ? name : null, mine ? null : r.userName].filter(Boolean).join(' · ')
            const on = opened === r.id || editing?.id === r.id
            return (
              // The fill bleeds past the column; the rule stays at the header rule's width.
              <li key={r.id} className="relative grid after:absolute after:inset-x-1.5 after:bottom-0 after:h-px after:bg-rule">
                <button
                  type="button"
                  aria-expanded={opened === r.id}
                  onClick={() => setOpened(opened === r.id ? null : r.id)}
                  className={cn(
                    'grid grid-cols-[8px_minmax(0,1fr)_auto] items-center gap-2.5 px-1.5 py-2 text-left transition-colors hover:bg-plate',
                    on && 'bg-plate',
                  )}
                >
                  <i aria-hidden className="size-2" style={{ background: r.kind === 'income' ? 'var(--ink-3)' : color(name) }} />
                  <span className="grid min-w-0 leading-tight">
                    <span className="truncate text-[15px] font-medium">{r.note || name}</span>
                    {meta && <span className="truncate text-[12px] text-ink-2">{meta}</span>}
                  </span>
                  <span className={cn('font-board text-[16px] font-semibold', r.kind === 'income' && 'text-ok-text')}>
                    {formatBaht(r.amount, { sign: r.kind === 'income' })}
                  </span>
                </button>
                {opened === r.id && (
                  <div className="flex gap-1.5 bg-plate px-1.5 pb-2">
                    <LineAction onClick={() => fill(r, false)}>{t('copy')}</LineAction>
                    {mine && <LineAction onClick={() => fill(r, true)}>{t('edit')}</LineAction>}
                    {mine && (
                      <LineAction danger onClick={() => void remove(r)}>
                        {t('remove')}
                      </LineAction>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )

  return (
    <form
      className={cn('grid gap-4', !keypad && 'grid-cols-[minmax(0,1fr)_minmax(0,340px)] gap-0')}
      onSubmit={(e) => {
        e.preventDefault()
        void submit(false)
      }}
      onKeyDown={(e) => {
        if (e.key !== 'Enter' || !(e.metaKey || e.ctrlKey) || e.defaultPrevented) return
        e.preventDefault()
        void submit(true)
      }}
    >
      <div className={cn('grid content-start gap-4', !keypad && 'pr-6')}>
        <div className="flex items-center justify-between gap-3">
          <Segmented
            label={t('newExpense')}
            value={kind}
            onChange={(v) => setKind(v)}
            options={[
              { value: 'expense', label: t('expense') },
              { value: 'income', label: t('income') },
            ]}
            className="w-48"
          />
          {keypad && <DoneLink onClick={onClose}>{t('done')}</DoneLink>}
        </div>

        {keypad && tapeBlock}

        {/* The line being typed sits on the board: its note on the left, its amount in flaps on the right. */}
        <div
          className={cn(
            'board grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-sm',
            keypad ? 'px-3.5 py-3' : 'min-h-20 px-4 py-3',
          )}
        >
          <div className="grid min-w-0 gap-1">
            <span className="caps flex items-baseline gap-2 text-[11px] text-on-board-2">
              {editing ? t('editingLine') : t('nextLine')}
              {editing && (
                <button type="button" onClick={cancelEdit} className="text-on-board underline underline-offset-2">
                  {t('cancelEdit')}
                </button>
              )}
            </span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('note')}
              maxLength={200}
              aria-label={t('note')}
              className="-my-2 w-full min-w-0 rounded-xs bg-transparent py-2 text-[16px] text-on-board placeholder:text-on-board-2"
            />
          </div>
          {keypad ? (
            <output aria-live="polite" aria-label={t('amount')}>
              <Flap text={`฿${amountText || '0'}`} dim={!amountText} className="text-[34px]" />
            </output>
          ) : (
            // The real field is invisible over the tiles, so the tiles wear its focus ring.
            <label className="relative flex min-w-24 justify-end rounded-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-4 has-[:focus-visible]:outline-[var(--focus)]">
              <span className="sr-only">{t('amount')}</span>
              <span aria-hidden>
                <Flap text={`฿${amountText || '0'}`} dim={!amountText} className="text-[32px]" />
              </span>
              {/* The real field lies over the tiles: typing goes to it, the tiles show it. */}
              <input
                ref={amountRef}
                inputMode="decimal"
                autoComplete="off"
                maxLength={12}
                value={amountText}
                // Digits, a decimal point and + for sums (120+45); anything else never reaches the tiles.
                onChange={(e) => setAmountText(e.target.value.replace(/[^\d.+]/g, ''))}
                className="absolute inset-0 cursor-text opacity-0"
              />
            </label>
          )}
        </div>
        {!keypad && amountText && !amount && <span className="-mt-2 text-[13px] text-over-text">{t('badAmount')}</span>}

        {effect ? (
          <p
            className={cn(
              'caps flex items-center gap-2 rounded-sm px-3 py-2.5 text-[13px]',
              effect.left < 0 ? 'bg-over/12 text-over-text' : 'bg-plate text-ink-2',
            )}
          >
            <i aria-hidden className={cn('size-2 shrink-0', effect.left < 0 ? 'bg-over' : 'bg-ok')} />
            {/* A daily limit is that day's, so another day's line names it: Today's figure is not the one changing. */}
            {effect.day
              ? t(effect.left < 0 ? 'overAfterOn' : 'leftAfterOn', { amount: formatBaht(Math.abs(effect.left)), category: effect.name, day: day(effect.day, true) })
              : t(effect.left < 0 ? 'overAfter' : 'leftAfter', { amount: formatBaht(Math.abs(effect.left)), category: effect.name })}
          </p>
        ) : (
          said && (
            <p aria-hidden className="caps flex items-center gap-2 rounded-sm bg-plate px-3 py-2.5 text-[13px] text-ink-2">
              <Check weight="bold" className="size-3.5 shrink-0 text-ok-text" />
              {said}
            </p>
          )
        )}

        {kind === 'expense' &&
          (pocket.categories.length ? (
            <div
              role="radiogroup"
              aria-label={t('category')}
              onKeyDown={onCategoryKey}
              // One ruled grid rather than a box per category: the gaps are the rules.
              className="grid grid-cols-4 gap-px overflow-hidden rounded-sm border border-rule bg-rule"
            >
              {pocket.categories.map((c, i) => (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  data-id={c.id}
                  aria-checked={c.id === categoryId}
                  tabIndex={c.id === categoryId || (!category && i === 0) ? 0 : -1}
                  onClick={() => setCategoryId(c.id)}
                  className={cn(
                    'grid min-w-0 justify-items-center gap-1 bg-board px-1.5 pt-2.5 pb-2 text-center text-[13px] text-ink-2 transition-colors hover:bg-plate hover:text-ink',
                    c.id === categoryId && 'font-medium text-ink ring-1 ring-ink ring-inset',
                  )}
                >
                  <CategoryMark name={c.name} />
                  <span className="w-full truncate">{c.name}</span>
                </button>
              ))}
              {Array.from({ length: (4 - (pocket.categories.length % 4)) % 4 }, (_, i) => (
                <span key={`fill-${i}`} aria-hidden className="bg-board" />
              ))}
            </div>
          ) : (
            <Link
              to="/settings"
              search={{ pocket: pocket.id }}
              onClick={onClose}
              className="flex min-h-11 items-center justify-between gap-3 rounded-sm border border-rule px-3 text-[14px] hover:bg-plate"
            >
              {t('noCategories')}
              <CaretRight aria-hidden className="size-4 shrink-0" weight="bold" />
            </Link>
          ))}

        {/* D3: bills still to pay; a fixed one logs at once, one that varies waits for its amount. */}
        {kind === 'expense' && pocket.dueBills.length > 0 && (
          <div className="grid gap-1.5">
            <span className="caps text-[12px] text-ink-2">{t('due')}</span>
            <div className="flex flex-wrap gap-2">
              {pocket.dueBills.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (!b.varies && b.amount !== null)
                      return void save({ kind: 'expense', amount: b.amount, categoryId: b.categoryId, note: b.name, bankAccountId: accountId, billId: b.id, billFor: b.due })
                    setCategoryId(b.categoryId)
                    setNote(b.name)
                    setAmountText('')
                    setLink({ billId: b.id, billFor: b.due })
                    amountRef.current?.focus()
                  }}
                  className={cn(oneTapClass, link?.billId === b.id && chipOn)}
                >
                  + {b.name} <span className="font-board font-semibold">{b.varies ? t('varies') : formatBaht(b.amount ?? 0)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {kind === 'expense' && pocket.logAgain.length > 0 && (
          <div className="grid gap-1.5">
            <span className="caps text-[12px] text-ink-2">{t('logAgain')}</span>
            <div
              className={cn(
                'flex gap-2',
                // The fade at the edge says the row scrolls.
                keypad ? '-mx-1 overflow-x-auto px-1 pr-10 pb-1 [mask-image:linear-gradient(to_right,black_82%,transparent)]' : 'flex-wrap',
              )}
            >
              {pocket.logAgain.map((r) => {
                const c = pocket.categories.find((x) => x.id === r.categoryId)
                return (
                  <button
                    key={`${r.categoryId}-${r.amount}-${r.note}`}
                    type="button"
                    disabled={busy}
                    onClick={() => void save({ kind: 'expense', amount: r.amount, categoryId: r.categoryId, note: r.note, bankAccountId: accountId })}
                    className={oneTapClass}
                  >
                    + {r.note || c?.name} <span className="font-board font-semibold">{formatBaht(r.amount)}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* On the phone sheet the keypad and Add stay pinned while the options scroll. */}
        <div
          className={cn(
            'grid gap-2',
            // The fade tells you the options continue under the pinned keypad.
            keypad &&
              'sticky bottom-0 -mx-4 bg-ground px-4 pt-2 before:pointer-events-none before:absolute before:inset-x-0 before:-top-6 before:h-6 before:bg-[linear-gradient(to_top,var(--ground),transparent)]',
          )}
        >
          {keypad && (
            <div className="grid grid-cols-3 gap-1.5">
              {keys.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => press(k)}
                  aria-label={k === 'del' ? t('deleteDigit') : k}
                  className="grid h-12 place-items-center rounded-sm bg-plate font-board text-[24px] font-semibold active:bg-rule"
                >
                  {k === 'del' ? <Backspace className="size-6" /> : k}
                </button>
              ))}
            </div>
          )}
          {error && (
            <p role="alert" className="text-[13px] text-over-text">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" disabled={!canSave} className="w-full">
            {editing
              ? t('updateLine')
              : !amount
                ? t('add')
                : kind === 'income'
                  ? t('addIncome', { amount: formatBaht(amount) })
                  : category
                    ? t('addTo', { amount: formatBaht(amount), category: category.name })
                    : t('pickCategory')}
            {!keypad && (
              <kbd aria-hidden className="rounded-xs border border-current/40 px-1.5 font-board text-[11px] font-semibold">
                Enter
              </kbd>
            )}
          </Button>
          {!keypad && (
            <p className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-2">
              <KeyHint k="Tab">{t('category')}</KeyHint>
              <KeyHint k={`${mod} Enter`}>{t('addClose')}</KeyHint>
              <KeyHint k="Esc">{t('done')}</KeyHint>
            </p>
          )}
        </div>
        <p className="sr-only" aria-live="polite">
          {said}
        </p>
      </div>

      {!keypad && (
        <div className="grid content-start gap-4 border-l-2 border-rule-strong pl-6">
          <div className="-my-1.5 flex h-11 items-center justify-end">
            <DoneLink onClick={onClose}>{t('done')}</DoneLink>
          </div>
          {tapeBlock}
        </div>
      )}
    </form>
  )
}

const chipClass =
  'inline-flex h-11 shrink-0 items-center rounded-sm border border-ink/25 px-3 text-[14px] whitespace-nowrap transition-colors hover:bg-plate lg:h-8'
// Log-again and Due chips save in one tap, so on a phone they get a full thumb-sized target.
const oneTapClass =
  'inline-flex h-11 shrink-0 items-center gap-1 rounded-sm border border-ink/25 px-3 text-[14px] whitespace-nowrap transition-colors hover:bg-plate lg:h-9'
const chipOn = 'border-ink bg-ink text-ground hover:bg-ink'

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className={cn(chipClass, on && chipOn)}>
      {children}
    </button>
  )
}

function ChipRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[72px_1fr] items-start gap-2">
      <span className="caps pt-3 text-[11px] text-ink-2 lg:pt-2.5">{label}</span>
      <div className="flex flex-wrap gap-1.5 py-0.5">{children}</div>
    </div>
  )
}

function DoneLink({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="caps -mr-3 h-11 px-3 text-[13px] text-ink underline decoration-2 underline-offset-4">
      {children}
    </button>
  )
}

function LineAction({ danger, onClick, children }: { danger?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'caps h-9 flex-1 rounded-sm border border-ink/25 bg-ground text-[12px] transition-colors hover:border-ink',
        danger && 'border-over/50 text-over-text hover:border-over',
      )}
    >
      {children}
    </button>
  )
}

function KeyHint({ k, children }: { k: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <kbd className="rounded-xs border border-current/40 px-1.5 font-board text-[11px] font-semibold">{k}</kbd>
      {children}
    </span>
  )
}

/** A category tile's pictogram, or its initial when no pictogram fits. */
function CategoryMark({ name }: { name: string }) {
  const G = glyphFor(name)
  return G ? (
    <G aria-hidden className="size-5" />
  ) : (
    <span aria-hidden className="grid size-5 place-items-center font-board text-[15px] font-semibold">
      {name.charAt(0)}
    </span>
  )
}
