'use client'

import { startTransition, useOptimistic, useState } from 'react'
import { useRouter } from 'next/navigation'

interface WaitingDae {
  id: string
  text: string
  created_at: string
}

interface Props {
  waitingDaes: WaitingDae[]
}

function formatCreatedAt(createdAt: string) {
  return new Date(createdAt).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function WaitingDaesList({ waitingDaes }: Props) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [pendingId, setPendingId] = useState('')
  const [optimisticDaes, removeOptimisticDae] = useOptimistic(
    waitingDaes,
    (currentDaes, daeId: string) => currentDaes.filter((dae) => dae.id !== daeId)
  )

  async function cancelWaitingDae(daeId: string) {
    setPendingId(daeId)
    setError('')
    removeOptimisticDae(daeId)

    try {
      const response = await fetch(`/api/daes?daeId=${encodeURIComponent(daeId)}`, {
        method: 'DELETE',
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : 'Unable to remove DAE.')
      }

      startTransition(() => {
        router.refresh()
      })
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to remove DAE.')
      startTransition(() => {
        router.refresh()
      })
    } finally {
      setPendingId('')
    }
  }

  if (optimisticDaes.length === 0) {
    return null
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-[var(--dae-ink)]">
          {optimisticDaes.length} waiting {optimisticDaes.length === 1 ? 'prompt' : 'prompts'}
        </p>
        <p className="text-xs text-[var(--dae-muted)]">Attach or remove.</p>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {optimisticDaes.map((dae) => {
          const isPending = pendingId === dae.id

          return (
            <div
              key={dae.id}
              className="rounded-[24px] border border-[var(--dae-line)] bg-[var(--dae-surface-strong)] p-4 shadow-[0_10px_26px_rgba(32,26,22,0.04)]"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--dae-accent-warm)]">
                  Waiting
                </p>
                <p className="text-[11px] text-[var(--dae-muted)]">{formatCreatedAt(dae.created_at)}</p>
              </div>

              <p className="mt-3 text-sm leading-6 text-[var(--dae-ink)]">{dae.text}</p>

              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => void cancelWaitingDae(dae.id)}
                  disabled={isPending}
                  className="rounded-full border border-[var(--dae-line)] px-3 py-1.5 text-xs font-medium text-[var(--dae-muted)] hover:border-[var(--dae-muted)] hover:text-[var(--dae-ink)] disabled:opacity-50"
                >
                  {isPending ? 'Removing...' : 'Remove'}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {error ? <p className="px-1 text-sm text-red-500">{error}</p> : null}
    </section>
  )
}
