'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { UserPreferences } from '@/lib/user-preferences'

interface Props {
  userEmail: string
  initialPreferences: UserPreferences
  initialBlockedUsers: Array<{
    userId: string
    handle: string
    matchId: string | null
    createdAt: string
  }>
}

function formatTimestamp(timestamp: string) {
  return new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function SettingsPanel({ userEmail, initialPreferences, initialBlockedUsers }: Props) {
  const router = useRouter()
  const [preferences, setPreferences] = useState<UserPreferences>(initialPreferences)
  const [blockedUsers, setBlockedUsers] = useState(initialBlockedUsers)
  const [saving, setSaving] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [unblockUserId, setUnblockUserId] = useState('')
  const [status, setStatus] = useState('')

  async function savePreferences(nextPreferences: UserPreferences) {
    setSaving(true)
    setStatus('')

    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(nextPreferences),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : 'Unable to save settings.')
      }

      setPreferences(nextPreferences)
      setStatus('Saved')
      return true
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to save settings.')
      return false
    } finally {
      setSaving(false)
    }
  }

  async function handleToggle(key: keyof UserPreferences) {
    const previousPreferences = preferences
    const nextPreferences = {
      ...preferences,
      [key]: !preferences[key],
    }

    setPreferences(nextPreferences)
    const didSave = await savePreferences(nextPreferences)

    if (!didSave) {
      setPreferences(previousPreferences)
    }
  }

  async function handleSignOut() {
    setSigningOut(true)
    setStatus('')

    try {
      const supabase = createClient()
      await supabase.auth.signOut()
      router.replace('/')
      router.refresh()
    } catch {
      setStatus('Unable to sign out right now.')
      setSigningOut(false)
    }
  }

  async function handleUnblock(targetUserId: string) {
    if (unblockUserId) {
      return
    }

    setUnblockUserId(targetUserId)
    setStatus('')

    try {
      const response = await fetch('/api/blocks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'unblock',
          targetUserId,
        }),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : 'Unable to unblock right now.')
      }

      setBlockedUsers((current) => current.filter((user) => user.userId !== targetUserId))
      setStatus('Block removed')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to unblock right now.')
    } finally {
      setUnblockUserId('')
    }
  }

  async function handleDeleteAccount() {
    if (deleting || deleteConfirm !== 'DELETE') {
      return
    }

    setDeleting(true)
    setStatus('')

    try {
      const response = await fetch('/api/account/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          confirm: deleteConfirm,
        }),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : 'Unable to delete account.')
      }

      const supabase = createClient()
      await supabase.auth.signOut()
      router.replace('/')
      router.refresh()
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to delete account.')
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[28px] border border-[var(--dae-line)] bg-[var(--dae-surface-strong)] p-5 shadow-[0_14px_36px_rgba(32,26,22,0.05)]">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--dae-muted)]">
          Account
        </p>
        <p className="mt-3 text-sm text-[var(--dae-muted)]">Signed in as</p>
        <p className="mt-1 text-lg font-semibold text-[var(--dae-ink)]">{userEmail}</p>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleSignOut()}
            disabled={signingOut}
            className="rounded-full border border-[var(--dae-line)] bg-white px-4 py-2 text-sm font-medium text-[var(--dae-ink)] hover:border-[var(--dae-muted)] disabled:opacity-50"
          >
            {signingOut ? 'Signing out...' : 'Sign out'}
          </button>
        </div>
      </section>

      <section className="rounded-[28px] border border-[var(--dae-line)] bg-[var(--dae-surface-strong)] p-5 shadow-[0_14px_36px_rgba(32,26,22,0.05)]">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--dae-accent-cool)]">
          Emails
        </p>
        <div className="mt-4 space-y-3">
          <label className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--dae-surface)] px-4 py-3">
            <div>
              <p className="text-sm font-medium text-[var(--dae-ink)]">Match emails</p>
              <p className="text-xs text-[var(--dae-muted)]">Tell me when someone else matches my DAE.</p>
            </div>
            <input
              type="checkbox"
              checked={preferences.matchEmails}
              onChange={() => void handleToggle('matchEmails')}
              disabled={saving}
              className="h-4 w-4 accent-[var(--dae-accent-cool)]"
            />
          </label>

          <label className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--dae-surface)] px-4 py-3">
            <div>
              <p className="text-sm font-medium text-[var(--dae-ink)]">Reply emails</p>
              <p className="text-xs text-[var(--dae-muted)]">Tell me when someone replies in a room.</p>
            </div>
            <input
              type="checkbox"
              checked={preferences.replyEmails}
              onChange={() => void handleToggle('replyEmails')}
              disabled={saving}
              className="h-4 w-4 accent-[var(--dae-accent-cool)]"
            />
          </label>
        </div>
      </section>

      <section className="rounded-[28px] border border-[var(--dae-line)] bg-[var(--dae-surface-strong)] p-5 shadow-[0_14px_36px_rgba(32,26,22,0.05)]">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--dae-accent-warm)]">
          Privacy
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl bg-[var(--dae-surface)] px-4 py-3">
            <p className="text-sm font-medium text-[var(--dae-ink)]">Fresh handle every room</p>
            <p className="mt-1 text-xs leading-5 text-[var(--dae-muted)]">
              Your anonymous name changes from chat to chat.
            </p>
          </div>
          <div className="rounded-2xl bg-[var(--dae-surface)] px-4 py-3">
            <p className="text-sm font-medium text-[var(--dae-ink)]">Your DAE stays visible inside the room</p>
            <p className="mt-1 text-xs leading-5 text-[var(--dae-muted)]">
              People in the room can see the prompt that brought each person there.
            </p>
          </div>
          <div className="rounded-2xl bg-[var(--dae-surface)] px-4 py-3">
            <p className="text-sm font-medium text-[var(--dae-ink)]">Blocking removes future contact</p>
            <p className="mt-1 text-xs leading-5 text-[var(--dae-muted)]">
              Blocked people disappear from rooms, joins, and future match suggestions for you.
            </p>
          </div>
          <div className="rounded-2xl bg-[var(--dae-surface)] px-4 py-3">
            <p className="text-sm font-medium text-[var(--dae-ink)]">Delete account cascades your data</p>
            <p className="mt-1 text-xs leading-5 text-[var(--dae-muted)]">
              Deleting your account removes your DAEs, room memberships, messages, and preferences.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-[var(--dae-line)] bg-[var(--dae-surface-strong)] p-5 shadow-[0_14px_36px_rgba(32,26,22,0.05)]">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--dae-accent-rose)]">
          Blocked
        </p>
        {blockedUsers.length === 0 ? (
          <div className="mt-4 rounded-2xl bg-[var(--dae-surface)] px-4 py-4 text-sm text-[var(--dae-muted)]">
            Nobody blocked.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {blockedUsers.map((blockedUser) => (
              <div
                key={blockedUser.userId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[var(--dae-surface)] px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-[var(--dae-ink)]">{blockedUser.handle}</p>
                  <p className="mt-1 text-xs text-[var(--dae-muted)]">
                    {blockedUser.matchId ? `Room ${blockedUser.matchId.slice(0, 8)} · ` : ''}
                    Blocked {formatTimestamp(blockedUser.createdAt)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleUnblock(blockedUser.userId)}
                  disabled={unblockUserId === blockedUser.userId}
                  className="rounded-full border border-[var(--dae-line)] bg-white px-4 py-2 text-sm font-medium text-[var(--dae-ink)] hover:border-[var(--dae-muted)] disabled:opacity-50"
                >
                  {unblockUserId === blockedUser.userId ? 'Unblocking...' : 'Unblock'}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-[28px] border border-red-200 bg-red-50 p-5 shadow-[0_14px_36px_rgba(32,26,22,0.05)]">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-600">Danger zone</p>
        <p className="mt-3 text-sm leading-6 text-red-700">
          Type <strong>DELETE</strong> to permanently remove your account and everything attached to it.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={deleteConfirm}
            onChange={(event) => setDeleteConfirm(event.target.value)}
            placeholder="Type DELETE"
            className="w-full rounded-2xl border border-red-200 bg-white px-4 py-3 text-base text-[var(--dae-ink)] placeholder:text-stone-400 focus:border-red-400 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => void handleDeleteAccount()}
            disabled={deleting || deleteConfirm !== 'DELETE'}
            className="rounded-2xl bg-red-600 px-5 py-3 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {deleting ? 'Deleting...' : 'Delete account'}
          </button>
        </div>
      </section>

      {status ? <p className="px-1 text-sm text-[var(--dae-muted)]">{status}</p> : null}
    </div>
  )
}
