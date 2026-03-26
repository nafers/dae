'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { NearRoomMatch, NearTopicMatch } from '@/lib/near-matches'

interface Props {
  initialText?: string
  initialInviteMatchId?: string
}

interface WaitingResult {
  daeId: string
  nearRooms: NearRoomMatch[]
  nearTopics: NearTopicMatch[]
}

const starterPrompts = [
  'replay a conversation for hours after it ends',
  'love the way Scrubs still holds up',
  'hear your heartbeat in your ear sometimes',
  'mentally rehearse ordering before it is your turn',
]

function normalizePrompt(value: string) {
  return value
    .replace(/^\s*does\s+anyone\s+else[\s,.!?-]*/i, '')
    .replace(/^\.\.\.\s*/, '')
    .trim()
}

function getPromptTips(rawText: string) {
  const normalizedText = normalizePrompt(rawText)
  const tips: string[] = []

  if (!rawText.trim()) {
    return [
      'Lead with the specific habit, thought, or feeling. The app already supplies the opening words.',
      'Specific beats broad. "replay a conversation for hours" will match better than "overthink things."',
    ]
  }

  if (rawText.trim() !== normalizedText) {
    tips.push('No need to type "Does anyone else?" again. The app adds it for you.')
  }

  if (normalizedText.length > 0 && normalizedText.length < 28) {
    tips.push('Add the odd detail. The more specific version usually matches better.')
  }

  if (
    !/\b(always|sometimes|mentally|randomly|replay|rehearse|check|count|hear|love|hate|wish|feel|keep|avoid|watch)\b/i.test(
      normalizedText
    )
  ) {
    tips.push('Try phrasing it as the actual thing you do or notice, not a category.')
  }

  return tips.slice(0, 2)
}

export default function SubmitForm({ initialText = '', initialInviteMatchId = '' }: Props) {
  const [text, setText] = useState(initialText)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<'idle' | 'waiting' | 'error'>('idle')
  const [waitingResult, setWaitingResult] = useState<WaitingResult | null>(null)
  const [error, setError] = useState('')
  const [pendingRoomIds, setPendingRoomIds] = useState<string[]>([])
  const router = useRouter()

  const normalizedText = normalizePrompt(text)
  const charCount = normalizedText.length
  const maxChars = 280
  const minChars = 10
  const promptTips = getPromptTips(text)

  useEffect(() => {
    setText(initialText)
    setError('')
    setStatus('idle')
    setWaitingResult(null)
    setPendingRoomIds([])
  }, [initialText])

  async function continueIntoRoom(room: NearRoomMatch) {
    if (!waitingResult?.daeId || pendingRoomIds.includes(room.matchId)) {
      return
    }

    setPendingRoomIds((current) => [...current, room.matchId])
    setError('')

    try {
      const joinNow = room.joinMode === 'join_now'
      const response = await fetch(joinNow ? '/api/threads/join' : '/api/thread-join-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          joinNow
            ? {
                matchId: room.matchId,
                daeId: waitingResult.daeId,
                sourceContext: {
                  source: 'submit_near_match',
                  fitScore: room.fitScore,
                  fitReason: room.reason,
                },
              }
            : {
                action: 'request',
                matchId: room.matchId,
                daeId: waitingResult.daeId,
                sourceContext: {
                  source: 'submit_near_match',
                  fitScore: room.fitScore,
                  fitReason: room.reason,
                },
              }
        ),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : 'Unable to continue into this room.')
      }

      if (joinNow) {
        router.push(`/threads/${room.matchId}`)
        return
      }

      router.push(
        `/review?daeId=${encodeURIComponent(waitingResult.daeId)}&matchId=${encodeURIComponent(room.matchId)}`
      )
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : 'Unable to continue into this room.')
      setPendingRoomIds((current) => current.filter((matchId) => matchId !== room.matchId))
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (normalizedText.length < minChars) return

    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/embed-and-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: normalizedText }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Something went wrong.')
        setStatus('error')
      } else if (data.status === 'matched') {
        router.push(`/threads/${data.matchId}`)
        return
      } else {
        setStatus('waiting')
        setPendingRoomIds([])
        setWaitingResult({
          daeId: typeof data?.daeId === 'string' ? data.daeId : '',
          nearRooms: Array.isArray(data?.nearRooms) ? (data.nearRooms as NearRoomMatch[]) : [],
          nearTopics: Array.isArray(data?.nearTopics) ? (data.nearTopics as NearTopicMatch[]) : [],
        })
      }
    } catch {
      setError('Network error. Please try again.')
      setStatus('error')
    } finally {
      setLoading(false)
    }
  }

  if (status === 'waiting') {
    return (
      <div className="space-y-4 rounded-[28px] border border-[var(--dae-accent-warm)]/30 bg-[var(--dae-accent-warm-soft)] p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--dae-accent-warm)]">
              Waiting
            </p>
            <h2 className="mt-1 text-xl font-semibold text-[var(--dae-ink)]">Still looking</h2>
          </div>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-[var(--dae-muted)]">
            {charCount}/{maxChars}
          </span>
        </div>

        <div className="rounded-2xl bg-white/80 px-4 py-3">
          <p className="text-sm leading-6 text-[var(--dae-ink)]">{normalizedText}</p>
        </div>

        {waitingResult && (waitingResult.nearRooms.length > 0 || waitingResult.nearTopics.length > 0 || initialInviteMatchId) ? (
          <div className="space-y-3 rounded-2xl bg-white/80 px-4 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--dae-accent-cool)]">
                  Almost there
                </p>
                <p className="mt-1 text-sm text-[var(--dae-muted)]">
                  These look close enough to place now instead of only waiting.
                </p>
              </div>
              <Link
                href={
                  waitingResult.daeId && initialInviteMatchId
                    ? `/review?daeId=${encodeURIComponent(waitingResult.daeId)}&matchId=${encodeURIComponent(initialInviteMatchId)}`
                    : '/review'
                }
                className="rounded-full border border-[var(--dae-accent-warm)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--dae-accent-warm)] hover:bg-[var(--dae-accent-warm-soft)]"
              >
                Open place
              </Link>
            </div>

            {waitingResult.nearRooms.length > 0 ? (
              <div className="space-y-2">
                {waitingResult.nearRooms.map((room) => (
                  <div
                    key={room.matchId}
                    className="rounded-2xl border border-[var(--dae-line)] bg-white px-4 py-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--dae-accent-cool)]">
                          {room.topicLabel}
                        </p>
                        <p className="mt-1 text-sm font-medium text-[var(--dae-ink)]">{room.headline}</p>
                      </div>
                      <span className="rounded-full bg-[var(--dae-accent-cool-soft)] px-3 py-1 text-xs font-medium text-[var(--dae-accent-cool)]">
                        {room.matchPercent}%
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-[var(--dae-muted)]">
                      {room.reason} | {room.participantCount} people
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-[11px] font-medium ${
                          room.roomHealthLabel === 'Working'
                            ? 'bg-[var(--dae-accent-soft)] text-[var(--dae-accent)]'
                            : room.roomHealthLabel === 'Risky'
                              ? 'bg-[var(--dae-accent-rose-soft)] text-[var(--dae-accent-rose)]'
                              : 'bg-[var(--dae-surface)] text-[var(--dae-muted)]'
                        }`}
                      >
                        {room.roomHealthLabel}
                      </span>
                      <span className="text-[11px] text-[var(--dae-muted)]">{room.roomHealthDetail}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void continueIntoRoom(room)}
                        disabled={pendingRoomIds.includes(room.matchId)}
                        className="rounded-full border border-[var(--dae-accent-cool)] bg-[var(--dae-accent-cool-soft)] px-3 py-1.5 text-xs font-medium text-[var(--dae-accent-cool)] hover:opacity-95 disabled:opacity-60"
                      >
                        {pendingRoomIds.includes(room.matchId)
                          ? room.joinMode === 'join_now'
                            ? 'Joining...'
                            : 'Requesting...'
                          : room.joinMode === 'join_now'
                            ? 'Join now'
                            : 'Request to join'}
                      </button>
                      <Link
                        href={`/review?daeId=${encodeURIComponent(waitingResult.daeId)}&matchId=${encodeURIComponent(room.matchId)}`}
                        className="rounded-full border border-[var(--dae-line)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--dae-muted)] hover:border-[var(--dae-muted)] hover:text-[var(--dae-ink)]"
                      >
                        Place options
                      </Link>
                      <span className="rounded-full bg-[var(--dae-surface)] px-3 py-1 text-[11px] font-medium text-[var(--dae-muted)]">
                        {room.joinMode === 'join_now' ? 'Auto-admit' : 'Needs admission'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {waitingResult.nearTopics.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {waitingResult.nearTopics.map((topic) => (
                  <Link
                    key={topic.topicKey}
                    href={`/topics/${encodeURIComponent(topic.topicKey)}`}
                    className="rounded-full border border-[var(--dae-line)] bg-[var(--dae-surface)] px-3 py-1.5 text-xs font-medium text-[var(--dae-muted)] hover:border-[var(--dae-accent-rose)] hover:text-[var(--dae-accent-rose)]"
                  >
                    {topic.label} {topic.matchPercent}%
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Link
            href="/now"
            className="rounded-full border border-[var(--dae-line)] bg-white px-4 py-2 text-sm font-medium text-[var(--dae-ink)] hover:border-[var(--dae-muted)]"
          >
            Now
          </Link>
          <button
            type="button"
            onClick={() => {
              setText('')
              setError('')
              setStatus('idle')
              setWaitingResult(null)
            }}
            className="rounded-full border border-[var(--dae-accent)] bg-[var(--dae-accent-soft)] px-4 py-2 text-sm font-medium text-[var(--dae-accent)] hover:opacity-95"
          >
            New
          </button>
          <Link
            href="/review"
            className="rounded-full border border-[var(--dae-accent-warm)] bg-white px-4 py-2 text-sm font-medium text-[var(--dae-accent-warm)] hover:bg-[var(--dae-accent-warm-soft)]"
          >
            Place
          </Link>
          <Link
            href="/browse"
            className="rounded-full border border-[var(--dae-accent-rose)] bg-white px-4 py-2 text-sm font-medium text-[var(--dae-accent-rose)] hover:bg-[var(--dae-accent-rose-soft)]"
          >
            Browse
          </Link>
          <Link
            href="/topics"
            className="rounded-full border border-[var(--dae-line)] bg-white px-4 py-2 text-sm font-medium text-[var(--dae-ink)] hover:border-[var(--dae-muted)]"
          >
            Topics
          </Link>
          <Link
            href="/threads"
            className="rounded-full border border-[var(--dae-accent-cool)] bg-white px-4 py-2 text-sm font-medium text-[var(--dae-accent-cool)] hover:bg-[var(--dae-accent-cool-soft)]"
          >
            Chats
          </Link>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-[28px] border border-[var(--dae-line)] bg-[var(--dae-surface-strong)] p-5 shadow-[0_14px_36px_rgba(32,26,22,0.05)]">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="dae-text" className="text-sm font-semibold text-[var(--dae-ink)]">
            Does anyone else?
          </label>
          <span
            className={`text-xs ${
              charCount > maxChars * 0.9 ? 'text-[var(--dae-accent-warm)]' : 'text-[var(--dae-muted)]'
            }`}
          >
            {charCount}/{maxChars}
          </span>
        </div>

        <textarea
          id="dae-text"
          value={text}
          onChange={(event) => setText(event.target.value.slice(0, maxChars + 24))}
          placeholder="love the way Scrubs still holds up"
          rows={5}
          className="mt-4 w-full resize-none bg-transparent text-lg leading-8 text-[var(--dae-ink)] placeholder:text-stone-400 focus:outline-none"
        />

        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-xs text-[var(--dae-muted)]">10-280 chars.</p>
          {charCount < minChars && charCount > 0 ? (
            <span className="text-xs text-[var(--dae-muted)]">{minChars - charCount} more</span>
          ) : null}
        </div>

        <div className="mt-4 space-y-3">
          <div className="rounded-2xl bg-[var(--dae-surface)] px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--dae-accent)]">
              Better matches
            </p>
            <div className="mt-2 space-y-1">
              {promptTips.map((tip) => (
                <p key={tip} className="text-xs leading-5 text-[var(--dae-muted)]">
                  {tip}
                </p>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--dae-muted)]">
              Starter prompts
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {starterPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => setText(prompt)}
                  className="rounded-full border border-[var(--dae-line)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--dae-muted)] hover:border-[var(--dae-accent)] hover:text-[var(--dae-accent)]"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          {initialInviteMatchId ? (
            <div className="rounded-2xl bg-[var(--dae-accent-cool-soft)]/70 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--dae-accent-cool)]">
                Invite handoff
              </p>
              <p className="mt-2 text-xs leading-5 text-[var(--dae-muted)]">
                If this feels close to the room you were invited to, post it and we will tee up the rescue path.
              </p>
            </div>
          ) : null}
        </div>
      </div>

      {error ? <p className="px-1 text-sm text-red-500">{error}</p> : null}

      <button
        type="submit"
        disabled={loading || charCount < minChars}
        className="w-full rounded-2xl bg-[var(--dae-accent)] px-6 py-3 text-base font-medium text-white transition-all hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loading ? 'Matching...' : 'Post'}
      </button>
    </form>
  )
}
