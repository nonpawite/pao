import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router'
import { Bank, CalendarBlank, Check, CircleHalf, Plus, SignOut, Ticket, Translate, X } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'

import { pickerClass } from '#/components/app/bill-form'
import { useMoney, useShell, useT } from '#/components/app/context'
import { PocketPlan } from '#/components/app/pocket-plan'
import { Avatar, Group, PageTitle, Row, Segmented, onRadioKeys, pageMain } from '#/components/app/kit'
import { Picker, currencyOptions } from '#/components/app/picker'
import { setTheme, themeNames, useTheme } from '#/components/app/theme'
import { Button } from '#/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { authClient } from '#/lib/auth-client'
import { pocketBg, pocketColors } from '#/lib/colors'
import type { PocketColor } from '#/lib/colors'
import { initials, localeCodes, locales, translate } from '#/lib/i18n'
import type { MessageKey } from '#/lib/i18n'
import { themes } from '#/lib/theme'
import { cn } from '#/lib/utils'
import {
  addBankAccount,
  addMember,
  archiveBankAccount,
  changeEmail,
  createPocket,
  deletePocket,
  leavePocket,
  removeMember,
  renameUser,
  restoreBankAccount,
  setPocketCurrency,
  updatePocket,
} from '#/server/settings'
import { createInvite, getMembers, revokeInvite } from '#/server/invites'
import { setLocale, setWeekStart } from '#/server/shell'
import type { Shell } from '#/server/shell'

export const Route = createFileRoute('/_app/settings')({
  // ?pocket= opens that pocket's settings, so other pages can link straight to its categories.
  validateSearch: z.object({ pocket: z.string().optional() }),
  // Members and invites, for the admin only (null for everyone else).
  loader: () => getMembers(),
  component: Settings,
})

function useRun() {
  const router = useRouter()
  const { t } = useT()
  // `done` confirms the action in a toast once it has gone through.
  return async (fn: () => Promise<unknown>, done?: string) => {
    try {
      await fn()
      await router.invalidate()
      if (done) toast.success(done)
      return true
    } catch {
      // Server messages are English and technical; the user gets one plain sentence in their language.
      toast.error(t('somethingWrong'))
      return false
    }
  }
}

function Settings() {
  const shell = useShell()
  const router = useRouter()
  const run = useRun()
  const { t } = useT()
  const theme = useTheme()
  const members = Route.useLoaderData()
  const [account, setAccount] = useState('')

  return (
    // One column of reading width, starting where every other page starts.
    <main className={cn(pageMain, 'gap-7 lg:gap-7 lg:[&>*]:max-w-[600px]')}>
      <PageTitle title={t('settings')} />

      <Group>
        <Profile />
        <Row className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-3">
            <Translate aria-hidden className="size-5 text-ink-2" />
            {t('language')}
          </span>
          <Segmented
            label={t('language')}
            value={shell.user.locale}
            onChange={(v) => run(() => setLocale({ data: { locale: v } }), translate(v, 'languageChanged'))}
            options={localeCodes.map((code) => ({ value: code, label: <span lang={code}>{locales[code].name}</span> }))}
            className="w-44"
          />
        </Row>
        <Row className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-3">
            <CalendarBlank aria-hidden className="size-5 text-ink-2" />
            {t('weekStarts')}
          </span>
          <Segmented
            label={t('weekStarts')}
            value={String(shell.user.weekStart) as '0' | '1'}
            onChange={(v) => run(() => setWeekStart({ data: { weekStart: v === '1' ? 1 : 0 } }), t('weekStartChanged', { day: t(v === '1' ? 'monday' : 'sunday') }))}
            options={[
              { value: '0', label: t('sunday') },
              { value: '1', label: t('monday') },
            ]}
            className="w-44"
          />
        </Row>
        {/* Wraps only when a long label leaves no room for the three choices. */}
        <Row className="flex flex-wrap items-center justify-between gap-3">
          <span className="flex items-center gap-3">
            <CircleHalf aria-hidden className="size-5 text-ink-2" />
            {t('appearance')}
          </span>
          <Segmented
            label={t('appearance')}
            value={theme}
            onChange={setTheme}
            options={themes.map((value) => ({ value, label: t(themeNames[value]) }))}
            className="w-60"
          />
        </Row>
      </Group>

      <Group title={t('accounts')}>
        {shell.accounts.map((a) => (
          <Row key={a.id} className="flex items-center justify-between">
            <span className="flex items-center gap-3">
              <Bank aria-hidden className="size-5 text-ink-2" />
              {a.name}
            </span>
            <button
              type="button"
              aria-label={`${t('remove')} ${a.name}`}
              onClick={async () => {
                if (!(await run(() => archiveBankAccount({ data: { id: a.id } })))) return
                toast.success(t('removedName', { name: a.name }), {
                  duration: 10000,
                  action: { label: t('undo'), onClick: () => void run(() => restoreBankAccount({ data: { id: a.id } }), t('restoredName', { name: a.name })) },
                })
              }}
              className="-mr-2 grid size-11 place-items-center rounded-sm text-ink-2 hover:bg-plate hover:text-ink"
            >
              <X className="size-4" weight="bold" />
            </button>
          </Row>
        ))}
        <Row>
          <form
            className="flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault()
              if (account.trim() && (await run(() => addBankAccount({ data: { name: account } }), t('nameAdded', { name: account.trim() })))) setAccount('')
            }}
          >
            <Input value={account} onChange={(e) => setAccount(e.target.value)} placeholder={t('addAccount')} maxLength={40} aria-label={t('addAccount')} />
            <Button type="submit" variant="secondary" size="icon-lg" className="size-11" aria-label={t('addAccount')}>
              <Plus weight="bold" />
            </Button>
          </form>
        </Row>
      </Group>

      <Pockets />

      {members && <Members data={members} />}

      <Button
        variant="outline"
        size="lg"
        className="text-over-text"
        onClick={async () => {
          await authClient.signOut()
          await router.navigate({ to: '/login' })
        }}
      >
        <SignOut aria-hidden className="size-5" weight="bold" />
        {t('signOut')}
      </Button>
    </main>
  )
}

type Field = 'name' | 'email' | 'password'

/** Copies text, also over plain http on a home network, where the browser keeps the clipboard API off. */
async function copyText(text: string) {
  if (window.isSecureContext && navigator.clipboard) return navigator.clipboard.writeText(text)
  const field = document.createElement('textarea')
  field.value = text
  field.style.cssText = 'position:fixed;opacity:0'
  document.body.append(field)
  field.select()
  document.execCommand('copy')
  field.remove()
}

/** The admin's list: everyone on the instance, invites still waiting, and a way to make one (ADR 0002). */
function Members({ data }: { data: NonNullable<Awaited<ReturnType<typeof getMembers>>> }) {
  const run = useRun()
  const { t, day } = useT()
  const [name, setName] = useState('')
  const copy = async (code: string) => {
    await copyText(`${location.origin}/signup?invite=${code}`)
    toast.success(t('linkCopied'))
  }

  return (
    <Group title={t('everyone')}>
      {data.members.map((m) => (
        <Row key={m.id} className="flex items-center gap-3">
          <Avatar name={m.name} />
          <span className="grid min-w-0 flex-1">
            <span className="truncate">{m.name}</span>
            <span className="truncate text-[13px] text-ink-2">{m.email}</span>
          </span>
          {m.id === data.admin && <span className="caps shrink-0 text-[12px] text-ink-2">{t('admin')}</span>}
        </Row>
      ))}
      {data.pending.map((i) => (
        <Row key={i.id} className="flex items-center gap-3">
          <Ticket aria-hidden className="size-7 shrink-0 p-1 text-ink-2" />
          <span className="grid min-w-0 flex-1">
            <span className="truncate">{i.name || t('inviteUnnamed')}</span>
            <span className="truncate text-[13px] text-ink-2">
              <span className="font-board font-medium text-ink">{i.code}</span> · {t('inviteUntil', { date: day(i.until) })}
            </span>
          </span>
          <Button variant="ghost" size="sm" onClick={() => void copy(i.code)}>
            {t('copyLink')}
          </Button>
          <button
            type="button"
            aria-label={t('revokeInvite', { name: i.name || i.code })}
            onClick={() => run(() => revokeInvite({ data: { id: i.id } }), t('inviteRevoked'))}
            className="-mr-3 grid size-11 shrink-0 place-items-center text-ink-2 transition-colors hover:text-ink"
          >
            <X weight="bold" className="size-4" />
          </button>
        </Row>
      ))}
      <Row className="grid gap-2">
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault()
            let code = ''
            const made = await run(async () => {
              code = (await createInvite({ data: { name } })).code
            })
            if (!made) return
            setName('')
            toast.success(t('inviteReady', { code }), { action: { label: t('copyLink'), onClick: () => void copy(code) } })
          }}
        >
          <Label htmlFor="invite-name" className="sr-only">
            {t('inviteFor')}
          </Label>
          <Input id="invite-name" placeholder={t('inviteFor')} maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
          <Button type="submit" variant="outline" className="shrink-0">
            <Plus aria-hidden weight="bold" />
            {t('makeInvite')}
          </Button>
        </form>
        <p className="text-[13px] text-ink-2">{t('invitesHint')}</p>
      </Row>
    </Group>
  )
}

/** Name, email and password as ruled rows; EDIT opens one row at a time into its form. */
function Profile() {
  const shell = useShell()
  const router = useRouter()
  const { t } = useT()
  const [open, setOpen] = useState<Field | null>(null)
  const row = (field: Field) => ({ open: open === field, onOpen: () => setOpen(field), onClose: () => setOpen(null) })
  const done = async () => {
    await router.invalidate()
    setOpen(null)
  }

  return (
    <>
      <EditRow
        label={t('name')}
        value={shell.user.name}
        {...row('name')}
        onSave={async (form) => {
          await renameUser({ data: { name: String(form.get('name')) } })
          await done()
          toast.success(t('nameChanged'))
        }}
      >
        <Input name="name" defaultValue={shell.user.name} required maxLength={40} autoComplete="name" aria-label={t('name')} autoFocus />
      </EditRow>
      <EditRow
        label={t('email')}
        value={shell.user.email}
        hint={t('emailHint')}
        {...row('email')}
        onSave={async (form) => {
          const { taken } = await changeEmail({ data: { email: String(form.get('email')) } })
          if (taken) return t('emailTaken')
          await done()
          toast.success(t('emailChanged'))
        }}
      >
        <Input name="email" type="email" defaultValue={shell.user.email} required autoComplete="email" aria-label={t('email')} autoFocus />
      </EditRow>
      <EditRow
        label={t('password')}
        value={<span aria-hidden className="tracking-[0.2em] text-ink-2">••••••••</span>}
        {...row('password')}
        onSave={async (form) => {
          const res = await authClient.changePassword({
            currentPassword: String(form.get('current')),
            newPassword: String(form.get('new')),
            revokeOtherSessions: true,
          })
          // Plain sentences in the member's language, never the server's own message.
          if (res.error) return res.error.code === 'INVALID_PASSWORD' ? t('wrongPassword') : res.error.code === 'PASSWORD_TOO_SHORT' ? t('passwordShort') : t('somethingWrong')
          setOpen(null)
          toast.success(t('passwordChanged'))
        }}
      >
        {/* Lets password managers file the new password under this account. */}
        <input hidden readOnly name="username" autoComplete="username" value={shell.user.email} />
        <Input name="current" type="password" required autoComplete="current-password" placeholder={t('currentPassword')} aria-label={t('currentPassword')} autoFocus />
        <Input name="new" type="password" required minLength={8} maxLength={128} autoComplete="new-password" placeholder={t('newPassword')} aria-label={t('newPassword')} />
      </EditRow>
    </>
  )
}

function EditRow({
  label,
  value,
  hint,
  open,
  onOpen,
  onClose,
  onSave,
  children,
}: {
  label: string
  value: ReactNode
  hint?: string
  open: boolean
  onOpen: () => void
  onClose: () => void
  /** Returns an error to show under the fields, or nothing when saved. */
  onSave: (form: FormData) => Promise<string | void>
  children: ReactNode
}) {
  const { t } = useT()
  const edit = useRef<HTMLButtonElement>(null)
  const wasOpen = useRef(false)
  useEffect(() => {
    // Closing removes the focused field: hand focus back to EDIT, unless another row's field took it.
    if (wasOpen.current && !open && document.activeElement === document.body) edit.current?.focus()
    wasOpen.current = open
  }, [open])

  if (open)
    return (
      <Row>
        <EditForm label={label} hint={hint} onClose={onClose} onSave={onSave}>
          {children}
        </EditForm>
      </Row>
    )
  return (
    <Row className="flex items-center gap-3">
      <span className="caps w-24 shrink-0 text-[12px] text-ink-2">{label}</span>
      <span className="min-w-0 flex-1 truncate">{value}</span>
      <button
        ref={edit}
        type="button"
        aria-label={`${t('edit')} ${label}`}
        onClick={onOpen}
        className="caps -mr-2 h-11 min-w-11 shrink-0 rounded-sm px-2.5 text-[12px] text-ink hover:bg-plate"
      >
        {t('edit')}
      </button>
    </Row>
  )
}

function EditForm({
  label,
  hint,
  onClose,
  onSave,
  children,
}: {
  label: string
  hint?: string
  onClose: () => void
  onSave: (form: FormData) => Promise<string | void>
  children: ReactNode
}) {
  const { t } = useT()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <form
      aria-label={label}
      className={cn('grid gap-3', error && '[&_input]:border-destructive')}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      onSubmit={async (e) => {
        e.preventDefault()
        const el = e.currentTarget
        setBusy(true)
        setError('')
        try {
          const failed = await onSave(new FormData(el))
          if (!failed) return
          setError(failed)
        } catch (err) {
          setError(err instanceof Error && err.message ? err.message : t('somethingWrong'))
        }
        setBusy(false)
        // The disabled SAVE dropped focus; put it back on the first field so the fix and Escape both work.
        el.querySelector<HTMLInputElement>('input:not([hidden])')?.focus()
      }}
    >
      <span className="caps text-[12px] text-ink-2">{label}</span>
      {children}
      {error ? (
        <p role="alert" className="text-[13px] text-destructive">
          {error}
        </p>
      ) : (
        hint && <p className="text-[13px] text-ink-2">{hint}</p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>
          {t('cancel')}
        </Button>
        <Button type="submit" disabled={busy}>
          {t('save')}
        </Button>
      </div>
    </form>
  )
}

const colorName: Record<PocketColor, MessageKey> = {
  graphite: 'colorGraphite',
  blue: 'colorBlue',
  orange: 'colorOrange',
  green: 'colorGreen',
  purple: 'colorPurple',
  pink: 'colorPink',
  teal: 'colorTeal',
}

function ColorPicker({ value, onChange }: { value: string; onChange: (c: PocketColor) => void }) {
  const { t } = useT()
  return (
    <div role="radiogroup" aria-label={t('color')} onKeyDown={onRadioKeys} className="flex flex-wrap gap-2.5">
      {pocketColors.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={c === value}
          tabIndex={c === value ? 0 : -1}
          aria-label={t(colorName[c])}
          onClick={() => onChange(c)}
          style={{ background: pocketBg(c) }}
          // Ink check on every colour: white falls under 3:1 on teal, orange and green.
          className={cn('grid size-11 place-items-center rounded-sm text-sign-ink', c === value && 'ring-2 ring-ink ring-offset-2 ring-offset-ground')}
        >
          {c === value && <Check className="size-4" weight="bold" />}
        </button>
      ))}
    </div>
  )
}

/** Pockets as pockets: each holds a card in its colour. Clicking one opens everything you can change about it. */
function Pockets() {
  const shell = useShell()
  const { t } = useT()
  const kindLabel = useKindLabel()
  const navigate = useNavigate({ from: Route.fullPath })
  const [openId, setOpenId] = useState<string | null>(Route.useSearch().pocket ?? null)
  const [creating, setCreating] = useState(false)
  const open = shell.pockets.find((p) => p.id === openId)

  return (
    <Group title={t('pockets')}>
      {/* Room above the first row for a pulled, tilted card. */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-5 pt-5">
        {shell.pockets.map((p) => (
          <PocketTile key={p.id} color={pocketBg(p.color)} mark={initials(p.name)} onClick={() => setOpenId(p.id)}>
            <span className="caps truncate text-[17px]">{p.name}</span>
            <span className="caps truncate text-[11px] text-on-board-2">
              {kindLabel(p)}
            </span>
          </PocketTile>
        ))}
        <PocketTile empty onClick={() => setCreating(true)}>
          <span className="caps flex items-center gap-2 text-[13px]">
            <Plus aria-hidden weight="bold" className="size-4 shrink-0" />
            {t('newPocket')}
          </span>
        </PocketTile>
      </div>

      {/* A pocket that is deleted or left drops out of the shell, which closes its popup. */}
      <Dialog
        open={!!open}
        onOpenChange={(o) => {
          if (o) return
          setOpenId(null)
          void navigate({ search: {}, replace: true })
        }}
      >
        <DialogContent
          className="max-h-[calc(100dvh-4rem)] overflow-y-auto sm:max-w-md"
          // The popup is mostly for looking; landing in the name field would invite an accidental rename.
          onOpenAutoFocus={(e) => {
            e.preventDefault()
            ;(e.currentTarget as HTMLElement).focus()
          }}
        >{open && <PocketEditor key={open.id} pocket={open} />}</DialogContent>
      </Dialog>
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="sm:max-w-md">
          <NewPocket onDone={() => setCreating(false)} />
        </DialogContent>
      </Dialog>
    </Group>
  )
}

/** "Personal", or "Shared · 2 members". */
function useKindLabel() {
  const { t } = useT()
  return (p: Shell['pockets'][number]) =>
    p.kind === 'shared' ? `${t('shared')} · ${p.members.length === 1 ? t('memberOne') : t('members', { n: p.members.length })}` : t('personal')
}

/**
 * A black pocket with a card in the pocket's colour tucked into it; the card slides up on hover.
 * `empty` draws the dashed outline that stands for a pocket not made yet.
 */
// Each pull tilts the card a little, a new way each time, like tugging a real card out of a pocket.
function tilt(e: { currentTarget: HTMLElement }) {
  const deg = (1.5 + Math.random() * 1.5) * (Math.random() < 0.5 ? -1 : 1)
  e.currentTarget.style.setProperty('--tilt', `${deg.toFixed(2)}deg`)
}

function PocketTile({
  color,
  mark,
  empty,
  onClick,
  children,
}: {
  color?: string
  mark?: string
  empty?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button type="button" onClick={onClick} onPointerEnter={tilt} onFocus={tilt} className="group relative grid pt-6 text-left">
      <span
        aria-hidden
        style={color ? { backgroundColor: color } : undefined}
        className={cn(
          // Taller than it shows, so a tilted card never lifts its bottom corner out of the pocket.
          'absolute inset-x-3 top-0 h-12 origin-bottom overflow-hidden rounded-t-sm transition-[translate,rotate] duration-200 ease-out group-hover:-translate-y-2.5 group-hover:rotate-(--tilt) group-focus-visible:-translate-y-2.5 group-focus-visible:rotate-(--tilt) motion-reduce:rotate-none! motion-reduce:transition-none',
          // The empty pocket's card waits inside it, and rises only to show where a new one goes.
          empty ? 'translate-y-6 border-2 border-b-0 border-dashed border-ink' : 'pocket-card',
        )}
      >
        {/* The pocket's initials, printed into the card a shade darker than its colour. */}
        {mark && <span className="absolute top-2 left-3.5 font-board text-[28px] leading-none font-semibold tracking-[-0.02em] text-black/20">{mark}</span>}
      </span>
      <span
        className={cn(
          'relative grid min-h-24 gap-0.5 rounded-sm px-4 pb-3.5',
          empty
            ? 'content-center justify-items-center pt-3.5 border-2 border-dashed border-ink-3 bg-ground text-ink-2 transition-colors group-hover:border-ink group-hover:text-ink group-focus-visible:border-ink group-focus-visible:text-ink'
            : 'board content-end pt-6',
        )}
      >
        {/* The pocket's mouth, stitched. */}
        {!empty && <span aria-hidden className="absolute inset-x-3 top-2.5 border-t border-dashed border-board-line" />}
        {children}
      </span>
    </button>
  )
}

function PocketEditor({ pocket }: { pocket: Shell['pockets'][number] }) {
  const shell = useShell()
  const run = useRun()
  const { t } = useT()
  const [name, setName] = useState(pocket.name)
  const [email, setEmail] = useState('')
  const [confirming, setConfirming] = useState(false)
  // Removing a member and leaving both cut someone off from the pocket, so each asks first.
  const [removing, setRemoving] = useState<string | null>(null)
  const [leaving, setLeaving] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const kindLabel = useKindLabel()
  const owner = pocket.role === 'owner'
  const shared = pocket.kind === 'shared'

  return (
    <div className="grid gap-5">
      <div className="grid gap-1.5">
        <DialogTitle>{pocket.name}</DialogTitle>
        <DialogDescription>
          {kindLabel(pocket)}
        </DialogDescription>
      </div>

      {owner && (
        <>
          <form
            className="grid gap-1.5"
            onSubmit={(e) => {
              e.preventDefault()
              if (name.trim() && name.trim() !== pocket.name) void run(() => updatePocket({ data: { pocketId: pocket.id, name, color: pocket.color as PocketColor } }), t('savedChanges'))
            }}
          >
            <Label htmlFor="pocket-name">{t('name')}</Label>
            <div className="flex gap-2">
              <Input id="pocket-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
              <Button type="submit" variant="secondary" disabled={!name.trim() || name.trim() === pocket.name}>
                {t('save')}
              </Button>
            </div>
          </form>
          <div className="grid gap-1.5">
            <span aria-hidden className="caps text-[12px] text-ink-2">{t('color')}</span>
            <ColorPicker value={pocket.color} onChange={(c) => run(() => updatePocket({ data: { pocketId: pocket.id, name: pocket.name, color: c } }), t('savedChanges'))} />
          </div>
        </>
      )}

      <PocketCurrency pocket={pocket} />

      <PocketPlan pocket={pocket} />

      {shared && (
        <div className="grid">
          {pocket.members.map((m) =>
            removing === m.id ? (
              <Row key={m.id} className="py-2.5">
                <div role="alert" className="grid gap-3 rounded-sm bg-over/10 p-3">
                  <p className="text-[15px]">
                    <b className="font-semibold">{t('confirmRemove', { name: m.name })}</b> {t('removeMemberHint')}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="secondary" onClick={() => setRemoving(null)}>
                      {t('cancel')}
                    </Button>
                    <Button variant="destructive" onClick={() => run(() => removeMember({ data: { pocketId: pocket.id, userId: m.id } }), t('memberRemoved', { name: m.name, pocket: pocket.name }))}>
                      {t('remove')}
                    </Button>
                  </div>
                </div>
              </Row>
            ) : (
              <Row key={m.id} className="flex items-center gap-3 py-1.5">
                <Avatar name={m.name} />
                <span className="flex-1 truncate">{m.id === shell.user.id ? t('you') : m.name}</span>
                {m.role === 'owner' ? (
                  <span className="caps py-3 text-[11px] text-ink-2">{t('owner')}</span>
                ) : (
                  owner && (
                    <button
                      type="button"
                      onClick={() => setRemoving(m.id)}
                      className="caps -mr-2 h-11 rounded-sm px-2 text-[12px] text-over-text hover:bg-over/10"
                    >
                      {t('remove')}
                    </button>
                  )
                )}
              </Row>
            ),
          )}
          {owner && (
            <Row className="grid gap-1.5">
              <form
                className="flex gap-2"
                onSubmit={async (e) => {
                  e.preventDefault()
                  setInviteError('')
                  let res = { found: true }
                  const ok = await run(async () => {
                    res = await addMember({ data: { pocketId: pocket.id, email } })
                  })
                  if (!ok) return
                  if (!res.found) return setInviteError(t('noAccountWithEmail'))
                  toast.success(t('memberAdded', { email, pocket: pocket.name }))
                  setEmail('')
                }}
              >
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('invite')}
                  aria-label={t('invite')}
                  aria-invalid={!!inviteError || undefined}
                  aria-describedby={`invite-hint-${pocket.id}`}
                />
                <Button type="submit" variant="secondary">
                  {t('addMember')}
                </Button>
              </form>
              <span id={`invite-hint-${pocket.id}`} role={inviteError ? 'alert' : undefined} className={cn('text-[13px]', inviteError ? 'text-over-text' : 'text-ink-2')}>
                {inviteError || t('inviteHint')}
              </span>
            </Row>
          )}
        </div>
      )}

      {shared &&
        (!owner ? (
          leaving ? (
            <div role="alert" className="grid gap-3 rounded-sm bg-over/10 p-3">
              <p className="text-[15px]">
                <b className="font-semibold">{t('leaveTitle', { name: pocket.name })}</b> {t('leaveHint')}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" onClick={() => setLeaving(false)}>
                  {t('cancel')}
                </Button>
                <Button variant="destructive" onClick={() => run(() => leavePocket({ data: { pocketId: pocket.id } }), t('pocketLeft', { name: pocket.name }))}>
                  {t('leave')}
                </Button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setLeaving(true)} className="caps -ml-2 h-11 justify-self-start rounded-sm px-2 text-[13px] text-over-text hover:bg-over/10">
              {t('leave')}
            </button>
          )
        ) : confirming ? (
          // Deleting takes every member's entries with it, so it asks first.
          <div role="alert" className="grid gap-3 rounded-sm bg-over/10 p-3">
            <p className="text-[15px]">
              <b className="font-semibold">{t('deletePocketTitle', { name: pocket.name })}</b> {t('deletePocketHint')}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => setConfirming(false)}>
                {t('cancel')}
              </Button>
              <Button variant="destructive" onClick={() => run(() => deletePocket({ data: { pocketId: pocket.id } }), t('nameDeleted', { name: pocket.name }))}>
                {t('deletePocket')}
              </Button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirming(true)} className="caps -ml-2 h-11 justify-self-start rounded-sm px-2 text-[13px] text-over-text hover:bg-over/10">
            {t('deletePocket')}
          </button>
        ))}
    </div>
  )
}

/** The pocket's currency. Switching relabels every amount and converts none, so it asks first. The owner edits; members read. */
function PocketCurrency({ pocket }: { pocket: Shell['pockets'][number] }) {
  const run = useRun()
  const { t, locale } = useT()
  const [next, setNext] = useState<string | null>(null)
  const from = useMoney(pocket.currency)
  const to = useMoney(next ?? pocket.currency)
  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={`currency-${pocket.id}`} className="caps text-[12px] text-ink-2">
          {t('currency')}
        </label>
        <Picker
          id={`currency-${pocket.id}`}
          label={t('currency')}
          disabled={pocket.role !== 'owner'}
          value={pocket.currency}
          options={currencyOptions(locales[locale].tag)}
          search={{ placeholder: t('searchCurrency'), empty: t('noCurrency') }}
          display={pocket.currency}
          onChange={(c) => setNext(c === pocket.currency ? null : c)}
          className={cn(pickerClass, 'shrink-0')}
        />
      </div>
      {next && (
        <div role="alert" className="grid gap-3 rounded-sm bg-over/10 p-3">
          <p className="text-[15px]">
            <b className="font-semibold">{t('changeCurrencyTitle', { currency: next })}</b>{' '}
            {t('changeCurrencyHint', { from: from.money(50_000), to: to.money(50_000) })}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => setNext(null)}>
              {t('cancel')}
            </Button>
            <Button onClick={async () => (await run(() => setPocketCurrency({ data: { pocketId: pocket.id, currency: next } }), t('currencyChanged', { currency: next }))) && setNext(null)}>
              {t('changeCurrency')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function NewPocket({ onDone }: { onDone: () => void }) {
  const run = useRun()
  const shell = useShell()
  const { t } = useT()
  // A shared pocket starts its cycle on its creator's payday, which their own pocket already knows.
  const startDay = shell.pockets.find((p) => p.kind === 'personal')?.cycleStartDay ?? 1
  const [name, setName] = useState('')
  const [color, setColor] = useState<PocketColor>('blue')
  return (
    <form
      className="grid gap-5"
      onSubmit={async (e) => {
        e.preventDefault()
        if (name.trim() && (await run(() => createPocket({ data: { name, color, cycleStartDay: startDay } }), t('pocketCreated', { name: name.trim() })))) onDone()
      }}
    >
      <DialogTitle>{t('newPocket')}</DialogTitle>
      <div className="grid gap-1.5">
        <Label htmlFor="new-pocket-name">{t('name')}</Label>
        <Input id="new-pocket-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
      </div>
      <div className="grid gap-1.5">
        <span aria-hidden className="caps text-[12px] text-ink-2">{t('color')}</span>
        <ColorPicker value={color} onChange={setColor} />
      </div>
      <Button type="submit" disabled={!name.trim()}>
        {t('create')}
      </Button>
    </form>
  )
}
