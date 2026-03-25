'use client'

import { useState } from 'react'

interface Props {
  topicKey: string
  initialHidden: boolean
  initialPinned: boolean
}

export default function TopicCurationControls({
  topicKey,
  initialHidden,
  initialPinned,
}: Props) {
  const [hidden, setHidden] = useState(initialHidden)
  const [pinned, setPinned] = useState(initialPinned)
  const [busyAction, setBusyAction] = useState('')

  async function updateTopic(action: 'hide' | 'unhide' | 'pin' | 'unpin') {
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
        }),
      })

      if (!response.ok) {
        throw new Error('Unable to update topic.')
      }

      if (action === 'hide') setHidden(true)
      if (action === 'unhide') setHidden(false)
      if (action === 'pin') setPinned(true)
      if (action === 'unpin') setPinned(false)
    } finally {
      setBusyAction('')
    }
  }

  return (
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
  )
}
