'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Props {
  nextPath?: string | null
  authError?: string | null
}

export default function AuthGate({ nextPath, authError }: Props) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(
    authError === 'auth' ? 'That link expired. Request a new one.' : ''
  )
  const router = useRouter()

  const [supabase] = useState(() => createClient())
  const safeNext = nextPath?.startsWith('/') ? nextPath : '/submit'

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        session &&
        (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION')
      ) {
        router.replace(safeNext)
        router.refresh()
      }
    })

    async function checkSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (session) {
        router.replace(safeNext)
        router.refresh()
      }
    }

    checkSession()

    return () => subscription.unsubscribe()
  }, [router, safeNext, supabase.auth])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError('')

    const response = await fetch('/api/auth/magic-link', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        nextPath: safeNext,
      }),
    })
    const data = await response.json()

    if (!response.ok) {
      setError(typeof data?.error === 'string' ? data.error : 'Unable to send link.')
    } else {
      setSent(true)
    }

    setLoading(false)
  }

  if (sent) {
    return (
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--dae-accent)]">
          Link sent
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-[var(--dae-ink)]">Check your email.</h2>
        <p className="mt-3 text-sm leading-6 text-[var(--dae-muted)]">{email}</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-[var(--dae-ink)]">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          required
          className="mt-2 w-full rounded-2xl border border-[var(--dae-line)] bg-[var(--dae-surface)] px-4 py-3 text-base text-[var(--dae-ink)] placeholder:text-stone-400 focus:border-[var(--dae-accent)] focus:outline-none"
        />
      </div>
      {error ? <p className="text-sm text-red-500">{error}</p> : null}
      <button
        type="submit"
        disabled={loading || !email}
        className="w-full rounded-2xl bg-[var(--dae-accent)] px-6 py-3 text-base font-medium text-white transition-all hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? 'Sending...' : 'Send link'}
      </button>
    </form>
  )
}
