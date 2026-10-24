import { useRouter } from '@tanstack/react-router'
import { Wallet } from '@phosphor-icons/react'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { toast } from 'sonner'

import { Button } from '#/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '#/components/ui/dialog'
import { formatBaht } from '#/lib/budget'
import { cn } from '#/lib/utils'
import { addEntry, deleteEntry } from '#/server/entries'
import { useAddEntry } from './add-entry'
import { useShell, useT } from './context'
import { PocketChip } from './frame'
import { Avatar, glyphFor } from './kit'

type ListEntry = {
  id: string
  kind: 'expense' | 'income'
  amount: number
  note: string
  occurredOn: string
  categoryName: string | null
  userId: string
  userName: string
  pocketId?: string
  accountName?: string | null
}

/**
 * Entries as ruled rows on a board, newest first. Your own open a dialog to edit or remove them.
 * `who` shows who logged each one, `pockets` which pocket, `grouped` puts them under day headers with the day's spend
 * (or `dayAside`, when the page has more to say about a day).
 */
export function EntryRows({
  entries,
  today,
  who,
  pockets,
  grouped,
  dayAside,
}: {
  entries: ListEntry[]
  today: string
  who?: boolean
  pockets?: Map<string, { name: string; color: string }>
  grouped?: boolean
  dayAside?: (date: string, spent: number) => ReactNode
}) {
  const shell = useShell()
  const router = useRouter()
  const { t, day } = useT()
  const { edit } = useAddEntry()
  const [removing, setRemoving] = useState<ListEntry | null>(null)

  const row = (e: ListEntry) => {
    const mine = e.userId === shell.user.id
    const p = e.pocketId ? pockets?.get(e.pocketId) : undefined
    const meta = [
      e.kind === 'income' ? t('income') : e.categoryName,
      who ? (mine ? t('you') : e.userName) : null,
      e.accountName,
      grouped ? null : e.occurredOn === today ? t('today') : day(e.occurredOn),
    ]
      .filter(Boolean)
      .join(' · ')
    return (
      <button
        key={e.id}
        type="button"
        disabled={!mine}
        onClick={() => setRemoving(e)}
        className="group -mx-2 flex w-[calc(100%+16px)] items-center gap-3 border-t border-board-line px-2 py-2.5 text-left transition-colors enabled:hover:bg-flap disabled:cursor-default"
      >
        {who ? <Avatar name={e.userName} className="size-8 bg-flap text-on-board group-enabled:group-hover:bg-board-line" /> : <EntryMark entry={e} />}
        <span className="grid min-w-0 flex-1">
          <span className="truncate text-[15px] font-medium">{e.note || e.categoryName || t('income')}</span>
          <span className="flex min-w-0 items-center gap-1.5 text-[12px] text-on-board-2">
            {p && (
              <>
                <PocketChip color={p.color} />
                <span className="shrink-0">{p.name}</span>
                {meta && <span aria-hidden>·</span>}
              </>
            )}
            <span className="truncate">{meta}</span>
          </span>
        </span>
        {/* Spending is the default, so only income carries a sign. */}
        <span className={cn('shrink-0 font-board text-[16px] font-semibold', e.kind === 'income' && 'text-ok-text')}>
          {formatBaht(e.amount, { sign: e.kind === 'income' })}
        </span>
      </button>
    )
  }

  let body = entries.map(row)
  if (grouped) {
    const days: Array<[string, ListEntry[]]> = []
    for (const e of entries) {
      if (days.at(-1)?.[0] === e.occurredOn) days.at(-1)![1].push(e)
      else days.push([e.occurredOn, [e]])
    }
    body = days.map(([d, es]) => {
      const spent = es.reduce((s, e) => s + (e.kind === 'expense' ? e.amount : 0), 0)
      return (
        <div key={d} className="grid pt-5 first:pt-0">
          <div className="caps flex items-baseline justify-between gap-3 pb-2 text-[12px] text-on-board-2">
            <h3>{d === today ? `${t('today')} · ${day(d, true)}` : day(d, true)}</h3>
            {dayAside ? dayAside(d, spent) : spent > 0 && <span>{formatBaht(spent)}</span>}
          </div>
          {es.map(row)}
        </div>
      )
    })
  }

  return (
    <div className="grid">
      {body}
      <Dialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
        <DialogContent className="max-w-sm">
          <DialogTitle>{removing?.note || removing?.categoryName || t('income')}</DialogTitle>
          <DialogDescription>{removing && `${formatBaht(removing.amount)} · ${day(removing.occurredOn, true)}`}</DialogDescription>
          {/* Edit is the usual job, so it takes the primary place; Remove stays quiet and can be undone. */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="ghost"
              className="text-over-text"
              onClick={async () => {
                if (!removing) return
                setRemoving(null)
                try {
                  const was = await deleteEntry({ data: { id: removing.id } })
                  void router.invalidate()
                  toast(t('undone'), {
                    duration: 10000,
                    action: {
                      label: t('undo'),
                      onClick: async () => {
                        await addEntry({ data: was })
                        await router.invalidate()
                      },
                    },
                  })
                } catch {
                  toast.error(t('somethingWrong'))
                }
              }}
            >
              {t('remove')}
            </Button>
            <Button
              onClick={() => {
                if (!removing) return
                setRemoving(null)
                // Lists without pockets show the active pocket's entries.
                edit({ id: removing.id, pocketId: removing.pocketId ?? shell.activePocketId, date: removing.occurredOn })
              }}
            >
              {t('edit')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** Entry rows repeat categories, so their pictogram stays a quiet glyph without a tile. */
function EntryMark({ entry }: { entry: ListEntry }) {
  const G = entry.kind === 'income' ? Wallet : glyphFor(entry.categoryName ?? '')
  return (
    <span aria-hidden className="grid size-8 shrink-0 place-items-center text-on-board-2">
      {G ? <G className="size-5" /> : <span className="font-board text-[15px] font-semibold">{(entry.categoryName ?? '').charAt(0)}</span>}
    </span>
  )
}
