'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface AliasOption {
  topicKey: string
  label: string
  headline: string
}

interface Props {
  topicKey: string
  initialHidden: boolean
  initialPinned: boolean
  initialAliasTargetKey?: string | null
  aliasOptions?: AliasOption[]
}

export default function TopicCurationControls({
  topicKey,
  initialHidden,
  initialPinned,
  initialAliasTargetKey = null,
  aliasOptions = [],
}: Props) {
  const router = useRouter()
  const [hidden, setHidden] = useState(initialHidden)
  const [pinned, setPinned] = useState(initialPinned)
  const [busyAction, setBusyAction] = useState('')
  const [aliasTargetKey, setAliasTargetKey] = useState(initialAliasTargetKey ?? '')

  useEffect(() => {
    setAliasTargetKey(initialAliasTargetKey ?? '')
  }, [initialAliasTargetKey])

  async function updateTopic(
    action: 'hide' | 'unhide' | 'pin' | 'unpin' | 'set_alias' | 'clear_alias'
  ) {
    if (busyAction) {
      return
    }

    setBusyAction(action)

    try {
      const response = await fetch('/api/topic-curation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topicKey,
          action,
          targetTopicKey: action === 'set_alias' ? aliasTargetKey : undefined,
        }),
      })

      if (!response.ok) {
        throw new Error('Unable to update topic.')
      }

      if (action === 'hide') setHidden(true)
      if (action === 'unhide') setHidden(false)
      if (action === 'pin') setPinned(true)
      if (action === 'unpin') setPinned(false)
      if (action === 'clear_alias') {
        setAliasTargetKey('')
        router.refresh()
      }
      if (action === 'set_alias' && aliasTargetKey) {
        router.push(`/topics/${encodeURIComponent(aliasTargetKey)}`)
        router.refresh()
      }
    } finally {
      setBusyAction('')
    }
  }

  return (
    <div className="space-y-3 rounded-2xl bg-[var(--dae-surface)] px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--dae-muted)]">
        Founder controls
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void updateTopic(hidden ? 'unhide' : 'hide')}
          disabled={Boolean(busyAction)}
          className="rounded-full border border-[var(--dae-accent-rose)] bg-[var(--dae-accent-rose-soft)] px-3 py-1.5 text-xs font-medium text-[var(--dae-accent-rose)] disabled:opacity-60"
        >
          {hidden ? 'Unhide topic' : 'Hide topic'}
        </button>
        <button
          type="button"
          onClick={() => void updateTopic(pinned ? 'unpin' : 'pin')}
          disabled={Boolean(busyAction)}
          className="rounded-full border border-[var(--dae-accent-cool)] bg-[var(--dae-accent-cool-soft)] px-3 py-1.5 text-xs font-medium text-[var(--dae-accent-cool)] disabled:opacity-60"
        >
          {pinned ? 'Unpin topic' : 'Pin topic'}
        </button>
      </div>

      {aliasOptions.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[11px] font-medium text-[var(--dae-muted)]">
            Merge this topic into another hub
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              value={aliasTargetKey}
              onChange={(event) => setAliasTargetKey(event.target.value)}
              className="min-w-[220px] rounded-2xl border border-[var(--dae-line)] bg-white px-3 py-2 text-sm text-[var(--dae-ink)] focus:border-[var(--dae-accent)] focus:outline-none"
            >
              <option value="">Choose a target topic</option>
              {aliasOptions.map((option) => (
              <option key={option.topicKey} value={option.topicKey}>
                  {option.label} - {option.headline}
              </option>
              ))}
            </select>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void updateTopic('set_alias')}
                disabled={!aliasTargetKey || Boolean(busyAction)}
                className="rounded-full border border-[var(--dae-accent-warm)] bg-[var(--dae-accent-warm-soft)] px-3 py-1.5 text-xs font-medium text-[var(--dae-accent-warm)] disabled:opacity-60"
              >
                Merge into target
              </button>
              {initialAliasTargetKey ? (
                <button
                  type="button"
                  onClick={() => void updateTopic('clear_alias')}
                  disabled={Boolean(busyAction)}
                  className="rounded-full border border-[var(--dae-line)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--dae-muted)] disabled:opacity-60"
                >
                  Clear alias
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
