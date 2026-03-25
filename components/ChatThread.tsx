'use client'

import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getHandleInitial, getParticipantTheme } from '@/lib/chat-theme'
import type { RoomSignalType } from '@/lib/quality-signals'
import type { ThreadJoinRequest } from '@/lib/thread-join-requests'
import ChatInput from './ChatInput'
import JoinRequestsPanel from './JoinRequestsPanel'
import MatchFeedbackPrompt from './MatchFeedbackPrompt'
import RoomSignalBar from './RoomSignalBar'
import ShareButton from './ShareButton'
import ThreadExitControls from './ThreadExitControls'

interface Message {
  id: string
  sender_id: string
  content: string
  created_at: string
}

interface Participant {
  userId: string
  handle: string
  dae: string
}

interface Props {
  matchId: string
  initialParticipants: Participant[]
  myUserId: string
  initialFeedback: 'good' | 'bad' | null
  initialMessages: Message[]
  initialThreadState: {
    muted: boolean
    hidden: boolean
  }
  threadHeadline: string
  threadTopicLabel: string
  threadSummary: string
  supportingDaes: string[]
  initialJoinRequests: ThreadJoinRequest[]
  initialRoomSignalSummary: {
    usefulCount: number
    notQuiteCount: number
    mySignal: RoomSignalType | null
  }
  matchReason: string
  matchConfidence: string
  matchSharedTerms: string[]
  topicKey: string
  initialLastSeenAt: string | null
  blockedUserIds: string[]
}

function orderParticipants(participants: Participant[], myUserId: string) {
  const myParticipant = participants.find((participant) => participant.userId === myUserId)
  const otherParticipants = participants
    .filter((participant) => participant.userId !== myUserId)
    .sort((a, b) => a.handle.localeCompare(b.handle))

  return [...(myParticipant ? [myParticipant] : []), ...otherParticipants]
}

export default function ChatThread({
  matchId,
  initialParticipants,
  myUserId,
  initialFeedback,
  initialMessages,
  initialThreadState,
  threadHeadline,
  threadTopicLabel,
  threadSummary,
  supportingDaes,
  initialJoinRequests,
  initialRoomSignalSummary,
  matchReason,
  matchConfidence,
  matchSharedTerms,
  topicKey,
  initialLastSeenAt,
  blockedUserIds,
}: Props) {
  const [participants, setParticipants] = useState<Participant[]>(
    orderParticipants(initialParticipants, myUserId)
  )
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [sendError, setSendError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const supabase = useRef(createClient()).current
  const refreshInFlightRef = useRef(false)
  const participantRefreshInFlightRef = useRef(false)
  const seenInFlightRef = useRef(false)
  const lastSeenAtRef = useRef(0)
  const lastSeenMarkerRef = useRef('')
  const messagesRef = useRef(initialMessages)

  const participantMeta = participants.map((participant, index) => ({
    ...participant,
    isMe: participant.userId === myUserId,
    theme: getParticipantTheme(index),
  }))
  const participantByUserId = new Map(
    participantMeta.map((participant) => [participant.userId, participant] as const)
  )

  function mergeMessages(nextMessages: Message[]) {
    setMessages((prev) => {
      if (
        prev.length === nextMessages.length &&
        prev.every((message, index) => message.id === nextMessages[index]?.id)
      ) {
        return prev
      }

      return nextMessages
    })
  }

  function removeMessage(messageId: string) {
    setMessages((prev) => prev.filter((message) => message.id !== messageId))
  }

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  const refreshMessages = useEffectEvent(async () => {
    if (refreshInFlightRef.current) return

    refreshInFlightRef.current = true

    try {
      const response = await fetch(`/api/messages?matchId=${encodeURIComponent(matchId)}`, {
        cache: 'no-store',
      })
      const data = await response.json()

      if (response.ok && Array.isArray(data?.messages)) {
        mergeMessages(data.messages as Message[])
      }
    } catch {
      // Realtime stays primary; this is a quiet safety net.
    } finally {
      refreshInFlightRef.current = false
    }
  })

  const refreshParticipants = useEffectEvent(async () => {
    if (participantRefreshInFlightRef.current) return

    participantRefreshInFlightRef.current = true

    try {
      const response = await fetch(`/api/thread-participants?matchId=${encodeURIComponent(matchId)}`, {
        cache: 'no-store',
      })
      const data = await response.json()

      if (response.ok && Array.isArray(data?.participants)) {
        setParticipants(orderParticipants(data.participants as Participant[], myUserId))
      }
    } catch {
      // Focus and polling will reconcile if this misses.
    } finally {
      participantRefreshInFlightRef.current = false
    }
  })

  const markThreadSeen = useCallback(async () => {
    if (document.visibilityState !== 'visible' || seenInFlightRef.current) {
      return
    }

    const currentMessages = messagesRef.current
    const marker = `${currentMessages.length}:${currentMessages[currentMessages.length - 1]?.id ?? 'none'}`
    const now = Date.now()

    if (marker === lastSeenMarkerRef.current && now - lastSeenAtRef.current < 20000) {
      return
    }

    seenInFlightRef.current = true

    try {
      await fetch('/api/threads/state', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          matchId,
          action: 'seen',
        }),
      })

      lastSeenMarkerRef.current = marker
      lastSeenAtRef.current = now
    } catch {
      // Quiet fallback. Missing a seen ping is okay.
    } finally {
      seenInFlightRef.current = false
    }
  }, [matchId])

  useEffect(() => {
    const channel = supabase
      .channel(`match:${matchId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `match_id=eq.${matchId}`,
        },
        (payload) => {
          setMessages((prev) => {
            if (prev.find((message) => message.id === payload.new.id)) {
              return prev
            }

            return [...prev, payload.new as Message]
          })

          if (payload.new.sender_id !== myUserId && document.visibilityState === 'visible') {
            void markThreadSeen()
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'messages',
          filter: `match_id=eq.${matchId}`,
        },
        (payload) => {
          const deletedId = typeof payload.old.id === 'string' ? payload.old.id : null

          if (deletedId) {
            removeMessage(deletedId)
          } else {
            void refreshMessages()
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'thread_participants',
          filter: `match_id=eq.${matchId}`,
        },
        () => {
          void refreshParticipants()
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'thread_participants',
          filter: `match_id=eq.${matchId}`,
        },
        () => {
          void refreshParticipants()
          void refreshMessages()
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          void refreshMessages()
          void refreshParticipants()
          void markThreadSeen()
        }
      })

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void refreshMessages()
        void refreshParticipants()
        void markThreadSeen()
      }
    }, 2500)

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        void refreshMessages()
        void refreshParticipants()
        void markThreadSeen()
      }
    }

    function handleFocus() {
      void refreshMessages()
      void refreshParticipants()
      void markThreadSeen()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)

    return () => {
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
      supabase.removeChannel(channel)
    }
  }, [markThreadSeen, matchId, myUserId, supabase])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(content: string) {
    setSendError('')

    const response = await fetch('/api/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        matchId,
        content,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      const errorMessage = typeof data?.error === 'string' ? data.error : 'Failed to send message.'
      setSendError(errorMessage)
      throw new Error(errorMessage)
    }

    if (data?.message) {
      setMessages((prev) => {
        if (prev.find((message) => message.id === data.message.id)) {
          return prev
        }

        return [...prev, data.message as Message]
      })
    }

    void markThreadSeen()
  }

  function formatTime(timestamp: string) {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  function handleBack() {
    if (window.history.length > 1) {
      router.back()
      return
    }

    router.push('/threads')
  }

  return (
    <div className="flex min-h-[72vh] flex-col overflow-hidden rounded-[28px] border border-[var(--dae-line)] bg-[var(--dae-surface-strong)] shadow-[0_18px_40px_rgba(32,26,22,0.06)]">
      <div className="flex-shrink-0 border-b border-[var(--dae-line)] bg-[var(--dae-surface)] px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--dae-accent-cool)]">
                {threadTopicLabel}
              </p>
              <span className="rounded-full bg-[var(--dae-surface-strong)] px-2.5 py-1 text-[11px] font-medium text-[var(--dae-muted)]">
                Room {matchId.slice(0, 8)}
              </span>
            </div>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-[var(--dae-ink)]">
              {threadHeadline}
            </h2>
            <p className="mt-1 text-sm leading-6 text-[var(--dae-muted)]">{threadSummary}</p>
            {supportingDaes.length > 0 ? (
              <p className="mt-1 line-clamp-2 text-sm leading-6 text-[var(--dae-muted)]">
                Also here: {supportingDaes.join(' | ')}
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[var(--dae-accent-soft)] px-2.5 py-1 text-[11px] font-medium text-[var(--dae-accent)]">
                {matchConfidence}
              </span>
              <span className="text-xs text-[var(--dae-muted)]">{matchReason}</span>
              {matchSharedTerms.length > 0 ? (
                <span className="rounded-full bg-[var(--dae-surface-strong)] px-2.5 py-1 text-[11px] font-medium text-[var(--dae-muted)]">
                  {matchSharedTerms.join(', ')}
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleBack}
              className="rounded-full border border-[var(--dae-line)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--dae-muted)] hover:border-[var(--dae-muted)] hover:text-[var(--dae-ink)]"
            >
              Back
            </button>
            <span className="rounded-full bg-[var(--dae-surface-strong)] px-2.5 py-1 text-[11px] font-medium text-[var(--dae-muted)]">
              {participantMeta.length} {participantMeta.length === 1 ? 'person' : 'people'}
            </span>
            <Link
              href="/threads"
              className="rounded-full border border-[var(--dae-line)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--dae-muted)] hover:border-[var(--dae-muted)] hover:text-[var(--dae-ink)]"
            >
              All chats
            </Link>
            <Link
              href={`/topics/${encodeURIComponent(topicKey)}`}
              className="rounded-full border border-[var(--dae-line)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--dae-muted)] hover:border-[var(--dae-muted)] hover:text-[var(--dae-ink)]"
            >
              Topic
            </Link>
            <ShareButton
              path={`/invite/${encodeURIComponent(matchId)}`}
              title={`DAE room: ${threadTopicLabel}`}
              text={`See if your DAE fits: ${threadHeadline}`}
              label="Invite"
            />
          </div>
        </div>

        <div className="mt-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--dae-muted)]">
            Connected by
          </p>
        </div>

        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {participantMeta.map((participant) => (
            <div
              key={participant.userId}
              className={`min-w-[180px] rounded-2xl border px-3 py-3 ${participant.theme.cardClass}`}
            >
              <p className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${participant.theme.labelClass}`}>
                {participant.isMe ? `You / ${participant.handle}` : participant.handle}
              </p>
              <p className="mt-2 line-clamp-3 text-sm leading-6 text-[var(--dae-ink)]">
                {participant.dae}
              </p>
            </div>
          ))}
        </div>

        <JoinRequestsPanel matchId={matchId} initialRequests={initialJoinRequests} />

        <div className="mt-3">
          <div className="mb-3 rounded-2xl bg-[var(--dae-surface)] px-3 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--dae-accent-cool)]">
                Room signal
              </p>
              <p className="text-xs text-[var(--dae-muted)]">Does this room actually work?</p>
            </div>
            <div className="mt-3">
              <RoomSignalBar
                matchId={matchId}
                initialCounts={{
                  usefulCount: initialRoomSignalSummary.usefulCount,
                  notQuiteCount: initialRoomSignalSummary.notQuiteCount,
                }}
                initialSignal={initialRoomSignalSummary.mySignal}
              />
            </div>
          </div>
          <ThreadExitControls
            matchId={matchId}
            initialMuted={initialThreadState.muted}
            initialHidden={initialThreadState.hidden}
            otherParticipants={participantMeta
              .filter((participant) => !participant.isMe)
              .map((participant) => ({
                userId: participant.userId,
                handle: participant.handle,
              }))}
            initialBlockedUserIds={blockedUserIds}
          />
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="py-8 text-center text-sm text-[var(--dae-muted)]">No messages yet.</div>
        ) : null}

        {messages.map((message, index) => {
          const isMe = message.sender_id === myUserId
          const participant = participantByUserId.get(message.sender_id)
          const bubbleTheme = participant?.theme ?? getParticipantTheme(0)
          const previousMessage = messages[index - 1]
          const previousSameSender = previousMessage?.sender_id === message.sender_id
          const previousWithinWindow =
            previousMessage &&
            new Date(message.created_at).getTime() - new Date(previousMessage.created_at).getTime() < 1000 * 60 * 8
          const showIdentity = !(previousSameSender && previousWithinWindow)
          const senderLabel = participant
            ? participant.isMe
              ? `You (${participant.handle})`
              : participant.handle
            : isMe
              ? 'You'
              : 'Someone'
          const showDateDivider =
            !previousMessage ||
            new Date(previousMessage.created_at).toDateString() !== new Date(message.created_at).toDateString()
          const showUnreadDivider =
            initialLastSeenAt &&
            !previousMessage &&
            !isMe &&
            new Date(message.created_at).getTime() > new Date(initialLastSeenAt).getTime()
              ? true
              : Boolean(
                  initialLastSeenAt &&
                    previousMessage &&
                    new Date(previousMessage.created_at).getTime() <= new Date(initialLastSeenAt).getTime() &&
                    new Date(message.created_at).getTime() > new Date(initialLastSeenAt).getTime() &&
                    !isMe
                )

          return (
            <div key={message.id}>
              {showDateDivider ? (
                <div className="my-4 flex items-center gap-3">
                  <div className="h-px flex-1 bg-[var(--dae-line)]" />
                  <p className="text-[11px] font-medium text-[var(--dae-muted)]">
                    {new Date(message.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                  <div className="h-px flex-1 bg-[var(--dae-line)]" />
                </div>
              ) : null}
              {showUnreadDivider ? (
                <div className="my-4 flex items-center gap-3">
                  <div className="h-px flex-1 bg-[var(--dae-accent-cool)]/30" />
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--dae-accent-cool)]">
                    New since you left
                  </p>
                  <div className="h-px flex-1 bg-[var(--dae-accent-cool)]/30" />
                </div>
              ) : null}
              <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`flex max-w-[88%] items-end gap-2 ${
                  isMe ? 'flex-row-reverse' : 'flex-row'
                }`}
              >
                {showIdentity ? (
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${bubbleTheme.avatarClass}`}
                  >
                    {getHandleInitial(participant?.handle ?? senderLabel)}
                  </div>
                ) : (
                  <div className="w-8 shrink-0" />
                )}
                <div className={`flex flex-col gap-1 ${isMe ? 'items-end' : 'items-start'}`}>
                  {showIdentity ? (
                    <span className={`px-1 text-[10px] ${bubbleTheme.labelClass}`}>{senderLabel}</span>
                  ) : null}
                  <div
                    className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm ${bubbleTheme.bubbleClass} ${
                      isMe ? 'rounded-br-sm' : 'rounded-bl-sm'
                    }`}
                  >
                    {message.content}
                  </div>
                  <span className="px-1 text-[10px] text-[var(--dae-muted)]">
                    {formatTime(message.created_at)}
                  </span>
                </div>
              </div>
            </div>
            </div>
          )
        })}

        <div ref={bottomRef} />
      </div>

      <MatchFeedbackPrompt matchId={matchId} initialFeedback={initialFeedback} />
      <ChatInput onSend={sendMessage} error={sendError} />
    </div>
  )
}
