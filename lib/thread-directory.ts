import { createAdminClient } from '@/lib/supabase/server'
import { fetchActiveBlockPairs, hasActiveBlockBetween } from '@/lib/blocks'
import { buildThreadRecap } from '@/lib/thread-recap'
import { fetchThreadUserStates, getThreadUserState } from '@/lib/thread-state'

interface DaeRelation {
  text: string
  embedding?: unknown
}

interface MatchRow {
  id: string
  created_at: string
}

interface ThreadParticipantRow {
  match_id: string
  user_id: string
  handle: string
  dae_id: string
  daes: DaeRelation | DaeRelation[] | null
}

interface MessageRow {
  match_id: string
  sender_id: string
  content: string
  created_at: string
}

export interface ThreadDirectoryParticipant {
  userId: string
  handle: string
  daeId: string
  daeText: string
  daeEmbedding?: unknown
  isMe: boolean
}

export interface ThreadDirectoryItem {
  matchId: string
  createdAt: string
  latestActivityAt: string
  participantCount: number
  participants: ThreadDirectoryParticipant[]
  lastMessagePreview: string
  lastMessageSenderLabel: string
  unreadCount: number
  hasUnread: boolean
  recapHeadline: string | null
  recapDetail: string | null
  isHidden: boolean
  isMuted: boolean
  isJoined: boolean
}

type ThreadScope = 'joined' | 'discover' | 'all'

function getDaeText(daeRelation: DaeRelation | DaeRelation[] | null) {
  if (Array.isArray(daeRelation)) {
    return daeRelation[0]?.text ?? ''
  }

  return daeRelation?.text ?? ''
}

export async function fetchThreadDirectory({
  currentUserId,
  scope,
  limit = 24,
  includeEmbeddings = false,
  includeState = scope === 'joined',
  includeMessages = true,
  matchIds: requestedMatchIds,
}: {
  currentUserId: string
  scope: ThreadScope
  limit?: number
  includeEmbeddings?: boolean
  includeState?: boolean
  includeMessages?: boolean
  matchIds?: string[]
}): Promise<ThreadDirectoryItem[]> {
  const admin = createAdminClient()
  let matchRows: MatchRow[] = []
  const uniqueRequestedMatchIds = [...new Set((requestedMatchIds ?? []).filter(Boolean))]

  if (uniqueRequestedMatchIds.length > 0) {
    const { data: selectedMatches } = await admin
      .from('matches')
      .select('id, created_at')
      .in('id', uniqueRequestedMatchIds)

    matchRows = (selectedMatches ?? []) as MatchRow[]
  } else if (scope === 'joined') {
    const { data: myParticipantRows } = await admin
      .from('thread_participants')
      .select('match_id')
      .eq('user_id', currentUserId)

    const joinedMatchIds = [...new Set((myParticipantRows ?? []).map((row) => row.match_id))].slice(0, limit)

    if (joinedMatchIds.length === 0) {
      return []
    }

    const { data: joinedMatches } = await admin
      .from('matches')
      .select('id, created_at')
      .in('id', joinedMatchIds)

    matchRows = (joinedMatches ?? []) as MatchRow[]
  } else {
    const { data: recentMatches } = await admin
      .from('matches')
      .select('id, created_at')
      .order('created_at', { ascending: false })
      .limit(limit)

    matchRows = (recentMatches ?? []) as MatchRow[]
  }

  if (matchRows.length === 0) {
    return []
  }

  const matchIds = matchRows.map((row) => row.id)
  const createdAtByMatch = new Map(matchRows.map((row) => [row.id, row.created_at] as const))
  const messageSampleLimit = Math.max(48, Math.min(matchIds.length * 8, 192))
  const participantSelect = includeEmbeddings
    ? `
        match_id,
        user_id,
        handle,
        dae_id,
        daes ( text, embedding )
      `
    : `
        match_id,
        user_id,
        handle,
        dae_id,
        daes ( text )
      `

  const [{ data: participantRows }, { data: messageRows }] = await Promise.all([
    admin
      .from('thread_participants')
      .select(participantSelect)
      .in('match_id', matchIds),
    includeMessages
      ? admin
          .from('messages')
          .select('match_id, sender_id, content, created_at')
          .in('match_id', matchIds)
          .order('created_at', { ascending: false })
          .limit(messageSampleLimit)
      : Promise.resolve({ data: [] as MessageRow[] | null }),
  ])

  const groupedParticipants = new Map<string, ThreadParticipantRow[]>()
  const latestMessageByMatch = new Map<string, MessageRow>()
  const messagesByMatch = new Map<string, MessageRow[]>()

  for (const participant of (participantRows ?? []) as ThreadParticipantRow[]) {
    const current = groupedParticipants.get(participant.match_id) ?? []
    current.push(participant)
    groupedParticipants.set(participant.match_id, current)
  }

  const participantUserIds = currentUserId.startsWith('__')
    ? []
    : [...new Set(((participantRows ?? []) as ThreadParticipantRow[]).map((participant) => participant.user_id))]
  const activeBlockPairs = currentUserId.startsWith('__')
    ? new Set<string>()
    : await fetchActiveBlockPairs([currentUserId, ...participantUserIds])

  for (const message of (messageRows ?? []) as MessageRow[]) {
    if (!latestMessageByMatch.has(message.match_id)) {
      latestMessageByMatch.set(message.match_id, message)
    }

    const currentMessages = messagesByMatch.get(message.match_id) ?? []
    currentMessages.push(message)
    messagesByMatch.set(message.match_id, currentMessages)
  }

  const currentUserStateMap = includeState
    ? await fetchThreadUserStates({
        userIds: [currentUserId],
        matchIds,
      })
    : new Map()

  const mappedThreads = matchIds.map((matchId) => {
      const participants = groupedParticipants.get(matchId) ?? []
      if (participants.length === 0) {
        return null
      }

      if (
        activeBlockPairs.size > 0 &&
        participants.some(
          (participant) =>
            participant.user_id !== currentUserId &&
            hasActiveBlockBetween(activeBlockPairs, currentUserId, participant.user_id)
        )
      ) {
        return null
      }

      const isJoined = participants.some((participant) => participant.user_id === currentUserId)
      if (scope === 'discover' && isJoined) {
        return null
      }

      const myParticipant = participants.find((participant) => participant.user_id === currentUserId)
      const orderedParticipants = [
        ...(myParticipant ? [myParticipant] : []),
        ...participants
          .filter((participant) => participant.user_id !== currentUserId)
          .sort((a, b) => a.handle.localeCompare(b.handle)),
      ]
      const latestMessage = latestMessageByMatch.get(matchId)
      const threadMessages = messagesByMatch.get(matchId) ?? []
      const orderedThreadMessages = [...threadMessages].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )
      const state = getThreadUserState(currentUserStateMap, currentUserId, matchId)
      const unreadCount = includeState
        ? threadMessages.filter(
            (message) =>
              message.sender_id !== currentUserId &&
              (!state.lastSeenAt || new Date(message.created_at).getTime() > new Date(state.lastSeenAt).getTime())
          ).length
        : 0
      const hasUnread = unreadCount > 0
      const messageSender = latestMessage
        ? orderedParticipants.find((participant) => participant.user_id === latestMessage.sender_id)
        : null
      const createdAt = createdAtByMatch.get(matchId) ?? latestMessage?.created_at ?? new Date().toISOString()
      const recap =
        includeState && includeMessages
          ? buildThreadRecap({
              participants: orderedParticipants.map((participant) => ({
                userId: participant.user_id,
                handle: participant.handle,
              })),
              messages: orderedThreadMessages,
              lastSeenAt: state.lastSeenAt,
              currentUserId,
            })
          : null

      return {
        matchId,
        createdAt,
        latestActivityAt: latestMessage?.created_at ?? createdAt,
        participantCount: orderedParticipants.length,
        participants: orderedParticipants.map((participant) => ({
          userId: participant.user_id,
          handle: participant.handle,
          daeId: participant.dae_id,
          daeText: getDaeText(participant.daes),
          daeEmbedding: includeEmbeddings
            ? Array.isArray(participant.daes)
              ? participant.daes[0]?.embedding
              : participant.daes?.embedding
            : undefined,
          isMe: participant.user_id === currentUserId,
        })),
        lastMessagePreview: latestMessage?.content ?? 'No messages yet',
        lastMessageSenderLabel: latestMessage
          ? latestMessage.sender_id === currentUserId
            ? myParticipant
              ? `You (${myParticipant.handle})`
            : 'You'
          : messageSender?.handle ?? 'Someone'
        : 'Thread',
        unreadCount,
        hasUnread,
        recapHeadline: recap?.headline ?? null,
        recapDetail: recap?.detail ?? null,
        isHidden: state.hidden,
        isMuted: state.muted,
        isJoined,
      } satisfies ThreadDirectoryItem
    })

  const filteredThreads: ThreadDirectoryItem[] = mappedThreads.flatMap((thread) =>
    thread ? [thread] : []
  )

  return filteredThreads.sort(
    (a, b) => new Date(b.latestActivityAt).getTime() - new Date(a.latestActivityAt).getTime()
  )
}
