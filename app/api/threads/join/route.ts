import { NextResponse } from 'next/server'
import { trackAnalyticsEvent } from '@/lib/analytics'
import { fetchBlockedUserIdsForUser } from '@/lib/blocks'
import { generateHandle } from '@/lib/handles'
import { fetchRoomModerationStates, getRoomModerationState } from '@/lib/moderation-state'
import { getRequestUser } from '@/lib/request-user'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const { matchId, daeId, sourceContext } = await request.json()

    if (!matchId || typeof matchId !== 'string') {
      return NextResponse.json({ error: 'Missing matchId' }, { status: 400 })
    }

    if (!daeId || typeof daeId !== 'string') {
      return NextResponse.json({ error: 'Missing daeId' }, { status: 400 })
    }

    const user = await getRequestUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    const roomState = getRoomModerationState(await fetchRoomModerationStates([matchId]), matchId)

    if (roomState.hidden) {
      return NextResponse.json({ error: 'That room is no longer open for discovery' }, { status: 400 })
    }

    if (roomState.joinLocked) {
      return NextResponse.json({ error: 'New joins are paused for this room' }, { status: 400 })
    }

    const admin = createAdminClient()
    const blockedUserIds = await fetchBlockedUserIdsForUser(user.id)
    const [{ data: thread }, { data: dae }, { data: existingParticipant }] = await Promise.all([
      admin.from('matches').select('id').eq('id', matchId).maybeSingle(),
      admin
        .from('daes')
        .select('id, status')
        .eq('id', daeId)
        .eq('user_id', user.id)
        .maybeSingle(),
      admin
        .from('thread_participants')
        .select('id')
        .eq('match_id', matchId)
        .eq('user_id', user.id)
        .maybeSingle(),
    ])

    if (!thread) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 })
    }

    if (!dae) {
      return NextResponse.json({ error: 'That DAE is not available' }, { status: 404 })
    }

    if (dae.status !== 'unmatched') {
      return NextResponse.json({ error: 'Only waiting DAEs can be attached to a chat' }, { status: 400 })
    }

    if (existingParticipant) {
      return NextResponse.json({ error: 'You are already in this chat' }, { status: 400 })
    }

    const [{ data: threadParticipants }, { data: priorHandleRows }] = await Promise.all([
      admin
        .from('thread_participants')
        .select('user_id, handle')
        .eq('match_id', matchId),
      admin
        .from('thread_participants')
        .select('handle')
        .eq('user_id', user.id),
    ])

    if ((threadParticipants ?? []).some((participant) => blockedUserIds.has(participant.user_id))) {
      return NextResponse.json({ error: 'You blocked someone in this room' }, { status: 400 })
    }

    const excludedHandles = new Set<string>()

    for (const participant of threadParticipants ?? []) {
      excludedHandles.add(participant.handle)
    }

    for (const handleRow of priorHandleRows ?? []) {
      excludedHandles.add(handleRow.handle)
    }

    const handle = generateHandle(excludedHandles)

    const { error: participantInsertError } = await admin.from('thread_participants').insert({
      match_id: matchId,
      user_id: user.id,
      dae_id: daeId,
      handle,
    })

    if (participantInsertError) {
      console.error('Thread join participant insert error:', participantInsertError)
      return NextResponse.json({ error: 'Unable to join this chat' }, { status: 500 })
    }

    const { error: daeUpdateError } = await admin
      .from('daes')
      .update({ status: 'matched' })
      .eq('id', daeId)
      .eq('user_id', user.id)

    if (daeUpdateError) {
      console.error('Thread join dae update error:', daeUpdateError)
      return NextResponse.json({ error: 'Unable to attach this DAE' }, { status: 500 })
    }

    await trackAnalyticsEvent({
      eventName: 'dae_attached_to_thread',
      userId: user.id,
      matchId,
      daeId,
      metadata: {
        participantCountBeforeJoin: threadParticipants?.length ?? 0,
        source:
          sourceContext && typeof sourceContext === 'object' && typeof sourceContext.source === 'string'
            ? sourceContext.source
            : 'direct_join',
      },
    })

    await trackAnalyticsEvent({
      eventName: 'thread_auto_joined',
      userId: user.id,
      matchId,
      daeId,
      metadata: {
        source:
          sourceContext && typeof sourceContext === 'object' && typeof sourceContext.source === 'string'
            ? sourceContext.source
            : 'direct_join',
        fitScore:
          sourceContext && typeof sourceContext === 'object' && typeof sourceContext.fitScore === 'number'
            ? Number(sourceContext.fitScore.toFixed(3))
            : null,
        fitReason:
          sourceContext && typeof sourceContext === 'object' && typeof sourceContext.fitReason === 'string'
            ? sourceContext.fitReason
            : null,
      },
    })

    return NextResponse.json({ ok: true, matchId })
  } catch (error) {
    console.error('Unexpected thread join route error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
