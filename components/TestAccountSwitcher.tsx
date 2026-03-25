'use client'

import { useMemo, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

interface Props {
  userEmail: string
  testAccountEmails: string[]
}

export default function TestAccountSwitcher({ userEmail, testAccountEmails }: Props) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, setPending] = useState(false)

  const normalizedUserEmail = userEmail.trim().toLowerCase()
  const accountOptions = useMemo(
    () => testAccountEmails.filter((email) => email !== normalizedUserEmail),
    [normalizedUserEmail, testAccountEmails]
  )
  const [selectedEmail, setSelectedEmail] = useState(accountOptions[0] ?? '')

  if (accountOptions.length === 0) {
    return null
  }

  const currentSearch = searchParams.toString()
  const nextPath = `${pathname}${currentSearch ? `?${currentSearch}` : ''}`

  function handleSwitch() {
    if (!selectedEmail || pending) return

    setPending(true)
    const params = new URLSearchParams({
      email: selectedEmail,
      next: nextPath.startsWith('/') ? nextPath : '/now',
    })

    window.location.assign(`/api/auth/test-switch?${params.toString()}`)
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-full border border-[var(--dae-line)] bg-[var(--dae-surface-strong)] px-2 py-1.5 shadow-sm">
      <span className="pl-1 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--dae-muted)]">
        Test
      </span>
      <select
        value={selectedEmail}
        onChange={(event) => setSelectedEmail(event.target.value)}
        className="min-w-[180px] bg-transparent pr-1 text-xs font-medium text-[var(--dae-ink)] focus:outline-none"
      >
        {accountOptions.map((email) => (
          <option key={email} value={email}>
            {email}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={handleSwitch}
        disabled={!selectedEmail || pending}
        className="rounded-full border border-[var(--dae-accent-cool)] bg-[var(--dae-accent-cool-soft)] px-3 py-1 text-xs font-medium text-[var(--dae-accent-cool)] hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? 'Switching...' : 'Switch'}
      </button>
    </div>
  )
}
