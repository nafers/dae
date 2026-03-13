'use client'

import { useState } from 'react'

export default function SubmitForm() {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<'idle' | 'waiting' | 'matched' | 'error'>('idle')
  const [error, setError] = useState('')

  const charCount = text.length
  const maxChars = 280
  const minChars = 10

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (text.length < minChars) return

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/embed-and-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Something went wrong. Try again.')
        setStatus('error')
      } else if (data.status === 'matched') {
        setStatus('matched')
      } else {
        setStatus('waiting')
      }
    } catch {
      setError('Network error. Please try again.')
      setStatus('error')
    } finally {
      setLoading(false)
    }
  }

  if (status === 'matched') {
    return (
      <div className="text-center py-8 space-y-4">
        <div className="text-5xl">🎉</div>
        <h2 className="text-xl font-semibold text-stone-800">Someone else does this too!</h2>
        <p className="text-stone-500">Check your email — we've connected you with your match.</p>
        <a
          href="/threads"
          className="inline-block mt-2 py-3 px-6 bg-stone-900 text-white rounded-xl font-medium hover:bg-stone-700 transition-colors"
        >
          Go to my matches →
        </a>
      </div>
    )
  }

  if (status === 'waiting') {
    return (
      <div className="text-center py-8 space-y-4">
        <div className="text-5xl animate-pulse">🔍</div>
        <h2 className="text-xl font-semibold text-stone-800">Looking for your match…</h2>
        <p className="text-stone-500">
          Your DAE is in the pool. We'll email you the moment someone submits something similar.
          Could be minutes — could be a few days.
        </p>
        <p className="text-xs text-stone-400">
          "Does anyone else {text}"
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-white rounded-2xl border border-stone-200 p-5">
        <p className="text-stone-400 text-sm font-medium mb-2">Does anyone else…</p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, maxChars))}
          placeholder="…always count the stairs when walking up them?"
          rows={4}
          className="w-full text-stone-900 placeholder-stone-300 text-base resize-none focus:outline-none leading-relaxed"
        />
        <div className="flex justify-between items-center mt-2">
          <span className={`text-xs ${charCount > maxChars * 0.9 ? 'text-amber-500' : 'text-stone-300'}`}>
            {charCount}/{maxChars}
          </span>
          {charCount < minChars && charCount > 0 && (
            <span className="text-xs text-stone-400">{minChars - charCount} more characters needed</span>
          )}
        </div>
      </div>

      {error && (
        <p className="text-red-500 text-sm px-1">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading || charCount < minChars}
        className="w-full py-3 px-6 bg-stone-900 text-white rounded-xl font-medium text-base hover:bg-stone-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Finding your match…' : 'Submit DAE →'}
      </button>

      <p className="text-center text-xs text-stone-400">
        Anonymous. One active DAE at a time.
      </p>
    </form>
  )
}
