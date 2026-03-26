import { after } from 'next/server'
import { redirect, notFound } from 'next/navigation'
import AppShell from '@/components/AppShell'
import ChatThread from '@/components/ChatThread'
import { trackAnalyticsEvent } from '@/lib/analytics'
import { fetchBlockedUserIdsForUser } from '@/lib/blocks'
import { fetchRoomSignalSummary } from '@/lib/quality-signals'
import { getRequestUser } from '@/lib/request-user'
import { createAdminClient } from '@/lib/supabase/server'
import { fetchPendingJoinRequestsForMatch } from '@/lib/thread-join-requests'
import { userHasBlockedParticipantInMatch } from '@/lib/thread-access'
import { buildThreadMemorySummary } from '@/lib/thread-memory'
import { fetchThreadUserStates, getThreadUserState } from '@/lib/thread-state'
import { scoreThreadAttachmentFit } from '@/lib/thread-fit'
import { getTopicPresentation } from '@/lib/topic-intelligence'

interface Props {
  params: Promise<{ matchId: string }>
  searchParams: Promise<{
    jump?: string | string[]
    focus?: string | string[]
  }>
}

interface DaeRelation {
  text: string
}

interface ThreadParticipant {
  user_id: string
  handle: string
  dae_id: string
  daes: DaeRelation | DaeRelation[] | null
}

interface ChatParticipant {
  userId: string
  handle: string
  dae: string
}

type MatchFeedback = 'good' | 'bad' | null

function getDaeText(daeRelation: DaeRelation | DaeRelation[] | null) {
  if (Array.isArray(daeRelation)) {
    return daeRelation[0]?.text ?? ''
  }

  return daeRelation?.text ?? ''
}

function uniqueTexts(texts: string[]) {
  return [...new Set(texts.map((text) => text.trim()).filter(Boolean))]
}

export default async function ThreadPage({ params, searchParams }: Props) {
  const { matchId } = await params
  const { jump, focus } = await searchParams
  const jumpTarget = Array.isArray(jump) ? jump[0] ?? '' : jump ?? ''
  const focusTarget = Array.isArray(focus) ? focus[0] ?? '' : focus ?? ''
  const user = await getRequestUser()
  const preservedParams = new URLSearchParams()
  if (jumpTarget) preservedParams.set('jump', jumpTarget)
  if (focusTarget) preservedParams.set('focus', focusTarget)
  const nextPath = preservedParams.size > 0 ? `/threads/${matchId}?${preservedParams.toString()}` : `/threads/${matchId}`

  if (!user) redirect(`/?next=${encodeURIComponent(nextPath)}`)

  const admin = createAdminClient()
  const { data: participants, error } = await admin
    .from('thread_participants')
    .select(`
      user_id,
      handle,
      dae_id,
      daes ( text )
    `)
    .eq('match_id', matchId)

  if (error || !participants || participants.length === 0) {
    notFound()
  }

  const typedParticipants = participants as ThreadParticipant[]
  const myParticipant = typedParticipants.find((participant) => participant.user_id === user.id)
  if (!myParticipant) notFound()
  if (await userHasBlockedParticipantInMatch({ currentUserId: user.id, matchId })) {
    redirect('/threads')
  }

  const orderedParticipants: ChatParticipant[] = [
    {
      userId: myParticipant.user_id,
      handle: myParticipant.handle,
      dae: getDaeText(myParticipant.daes),
    },
    ...typedParticipants
      .filter((participant) => participant.user_id !== user.id)
      .sort((a, b) => a.handle.localeCompare(b.handle))
      .map((participant) => ({
        userId: participant.user_id,
        handle: participant.handle,
        dae: getDaeText(participant.daes),
      })),
  ]

  const daeTexts = uniqueTexts(orderedParticipants.map((participant) => participant.dae))
  const [
    { data: initialMessages },
    { data: feedbackEvent },
    threadStateMap,
    topicPresentation,
    joinRequests,
    roomSignalSummary,
    blockedUserIds,
  ] =
    await Promise.all([
      admin
        .from('messages')
        .select('id, sender_id, content, created_at')
        .eq('match_id', matchId)
        .order('created_at', { ascending: true })
        .limit(50),
      admin
        .from('analytics_events')
        .select('metadata')
        .eq('event_name', 'match_feedback_submitted')
        .eq('user_id', user.id)
        .eq('match_id', matchId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      fetchThreadUserStates({
        userIds: [user.id],
        matchIds: [matchId],
      }),
      getTopicPresentation(daeTexts, {
        matchedCount: Math.max(orderedParticipants.length - 1, 0),
        forceAI: true,
      }),
      fetchPendingJoinRequestsForMatch(matchId),
      fetchRoomSignalSummary({
        matchId,
        currentUserId: user.id,
      }),
      fetchBlockedUserIdsForUser(user.id),
    ])

  const initialThreadState = getThreadUserState(threadStateMap, user.id, matchId)
  const threadHeadline = topicPresentation.headline || 'Shared room'
  const threadTopicLabel = topicPresentation.label || 'Chat'
  const threadSummary = topicPresentation.summary
  const supportingDaes = daeTexts.filter((text) => text !== threadHeadline).slice(0, 2)
  const myFit = scoreThreadAttachmentFit({
    daeText: getDaeText(myParticipant.daes),
    threadTexts: orderedParticipants.filter((participant) => participant.userId !== user.id).map((participant) => participant.dae),
  })
  const threadMemory = buildThreadMemorySummary({
    participants: orderedParticipants,
    messages: (initialMessages ?? []).map((message) => ({
      sender_id: message.sender_id,
      content: message.content,
    })),
    matchReason: myFit.reason,
  })
  const initialFeedback = ((feedbackEvent?.metadata as { verdict?: MatchFeedback } | null)?.verdict ??
    null) as MatchFeedback

  after(async () => {
    await trackAnalyticsEvent({
      eventName: 'thread_opened',
      userId: user.id,
      matchId,
      daeId: myParticipant.dae_id,
      metadata: {
        initialMessageCount: initialMessages?.length ?? 0,
        participantCount: orderedParticipants.length,
      },
    })
  })

  return (
    <AppShell
      activeTab="threads"
      userEmail={user.email ?? ''}
      eyebrow={threadTopicLabel}
      title={threadHeadline}
      description={`${threadSummary} | Room ${matchId.slice(0, 8)} | ${orderedParticipants.length} ${orderedParticipants.length === 1 ? 'person' : 'people'}`}
      compact
    >
      <ChatThread
        matchId={matchId}
        initialParticipants={orderedParticipants}
        myUserId={user.id}
        initialFeedback={initialFeedback}
        initialMessages={initialMessages ?? []}
        initialThreadState={initialThreadState}
        threadHeadline={threadHeadline}
        threadTopicLabel={threadTopicLabel}
        threadSummary={threadSummary}
        supportingDaes={supportingDaes}
        initialJoinRequests={joinRequests}
        initialRoomSignalSummary={roomSignalSummary}
        matchReason={myFit.reason}
        matchConfidence={myFit.confidenceLabel}
        matchSharedTerms={myFit.sharedTerms}
        threadMemory={threadMemory}
        topicKey={topicPresentation.topicKey}
        initialLastSeenAt={initialThreadState.lastSeenAt}
        blockedUserIds={[...blockedUserIds]}
        initialFocus={focusTarget === 'requests' ? 'requests' : jumpTarget === 'unread' ? 'unread' : 'latest'}
      />
    </AppShell>
  )
}
