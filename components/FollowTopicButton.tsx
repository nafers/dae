'use client'

import { useState } from 'react'

interface Props {
  topicKey: string
  headline: string
  label: string
  searchQuery: string
  initialFollowing: boolean
}

export default function FollowTopicButton({
  topicKey,
  headline,
  label,
  searchQuery,
  initialFollowing,
}: Props) {
  const [following, setFollowing] = useState(initialFollowing)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function toggleFollow() {
    if (saving) return

    const nextFollowing = !following
    setSaving(true)
    setError('')

    try {
      const response = await fetch('/api/topic-follows', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topicKey,
          headline,
          label,
          searchQuery,
          follow: nextFollowing,
        }),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : 'Unable to update follow.')
      }

      setFollowing(nextFollowing)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update follow.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => void toggleFollow()}
        disabled={saving}
        className={`rounded-full border px-4 py-2 text-sm font-medium transition-all ${
          following
            ? 'border-[var(--dae-accent-cool)] bg-[var(--dae-accent-cool-soft)] text-[var(--dae-accent-cool)]'
            : 'border-[var(--dae-line)] bg-white text-[var(--dae-muted)] hover:border-[var(--dae-muted)] hover:text-[var(--dae-ink)]'
        } disabled:cursor-not-allowed disabled:opacity-60`}
      >
        {saving ? 'Saving...' : following ? 'Following' : 'Follow'}
      </button>
      {error ? <p className="px-1 text-[11px] text-red-500">{error}</p> : null}
    </div>
  )
}
