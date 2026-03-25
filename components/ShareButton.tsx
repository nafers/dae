'use client'

import { useState } from 'react'

interface Props {
  path: string
  label?: string
  title: string
  text?: string
  className?: string
}

export default function ShareButton({
  path,
  label = 'Share',
  title,
  text,
  className,
}: Props) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'error'>('idle')

  async function handleShare() {
    const url = `${window.location.origin}${path}`
    const payload = {
      title,
      text: text ?? title,
      url,
    }

    try {
      if (navigator.share) {
        await navigator.share(payload)
        setStatus('copied')
      } else {
        await navigator.clipboard.writeText(url)
        setStatus('copied')
      }
    } catch {
      setStatus('error')
    } finally {
      window.setTimeout(() => setStatus('idle'), 1800)
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleShare()}
      className={
        className ??
        'rounded-full border border-[var(--dae-line)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--dae-muted)] hover:border-[var(--dae-muted)] hover:text-[var(--dae-ink)]'
      }
    >
      {status === 'copied' ? 'Copied' : status === 'error' ? 'Try again' : label}
    </button>
  )
}
