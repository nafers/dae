'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function AuthGate() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSent(true)
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="text-center py-8">
        <div className="text-4xl mb-4">📬</div>
        <h2 className="text-xl font-semibold text-stone-800 mb-2">Check your email</h2>
        <p className="text-stone-500">
          We sent a magic link to <strong>{email}</strong>.<br />
          Click it to get started — no password needed.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-stone-700 mb-1">
          Enter your email to get started
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-white text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:border-transparent text-base"
        />
      </div>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={loading || !email}
        className="w-full py-3 px-6 bg-stone-900 text-white rounded-xl font-medium text-base hover:bg-stone-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Sending…' : 'Send magic link →'}
      </button>
      <p className="text-center text-xs text-stone-400 pt-1">
        No password. No spam. Just a link.
      </p>
    </form>
  )
}
