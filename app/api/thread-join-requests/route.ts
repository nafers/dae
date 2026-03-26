import { NextResponse } from 'next/server'
import { generateHandle } from '@/lib/handles'
import { trackAnalyticsEvents } from '@/lib/analytics'
import { fetchRoomModerationStates, getRoomModerationState } from '@/lib/moderation-state'
import { userHasBlockedParticipantInMatch } from '@/lib/thread-access'
import { fetchPendingJoinRequestsForMatch } from '@/lib/thread-join-requests'
import { getRequestUser } from '@/lib/request-user'
import { createAdminClient } from '@/lib/supabase/server'
import { isMissingRelationError } from '@/lib/supabase-fallback'

async function ensureParticipant(matchId: string, userId: string) {
  const admin = createAdminClient()
  const { data: participant } = await admin
    .from('thread_participants')
    .select('id')
    .eq('match_id', matchId)
    .eq('user_id', userId)
    .maybeSingle()

  return { admin, isParticipant: Boolean(participant) }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const matchId = searchParams.get('matchId')

    if (!matchId) {
      return NextResponse.json({ error: 'Missing matchId' }, { status: 400 })
    }

    const user = await getRequestUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { isParticipant } = await ensureParticipant(matchId, user.id)
    if (!isParticipant) {
      return NextResponse.json({ error: 'You do not have access to this thread' }, { status: 403 })
    }

    const requests = await fetchPendingJoinRequestsForMatch(matchId)
    return NextResponse.json({ ok: true, requests })
  } catch (error) {
    console.error('Unexpected thread join request GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await getRequestUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const payload = await request.json()
    const action = typeof payload?.action === 'string' ? payload.action : 'request'
    const matchId = typeof payload?.matchId === 'string' ? payload.matchId : ''

    if (!matchId) {
      return NextResponse.json({ error: 'Missing matchId' }, { status: 400 })
    }

    const admin = createAdminClient()
    const roomState = getRoomModerationState(await fetchRoomModerationStates([matchId]), matchId)

    if (action === 'request') {
      const daeId = typeof payload?.daeId === 'string' ? payload.daeId : ''
      const sourceContext =
        payload?.sourceContext && typeof payload.sourceContext === 'object'
          ? (payload.sourceContext as Record<string, unknown>)
          : null

      if (!daeId) {
        return NextResponse.json({ error: 'Missing daeId' }, { status: 400 })
      }

      if (roomState.hidden) {
        return NextResponse.json({ error: 'That room is no longer open for discovery' }, { status: 400 })
      }

      if (roomState.joinLocked) {
        return NextResponse.json({ error: 'New joins are paused for this room' }, { status: 400 })
      }

      const [{ data: dae }, { data: existingParticipant }, hasActiveBlock] = await Promise.all([
        admin
          .from('daes')
          .select('id, text, status')
          .eq('id', daeId)
          .eq('user_id', user.id)
          .maybeSingle(),
        admin
          .from('thread_participants')
          .select('id')
          .eq('match_id', matchId)
          .eq('user_id', user.id)
          .maybeSingle(),
        userHasBlockedParticipantInMatch({
          currentUserId: user.id,
          matchId,
        }),
      ])

      if (!dae) {
        return NextResponse.json({ error: 'That DAE is not available' }, { status: 404 })
      }

      if (dae.status !== 'unmatched') {
        return NextResponse.json({ error: 'Only waiting DAEs can request a room' }, { status: 400 })
      }

      if (existingParticipant) {
        return NextResponse.json({ error: 'You are already in this room' }, { status: 400 })
      }

      if (hasActiveBlock) {
        return NextResponse.json({ error: 'A block is active in this room' }, { status: 400 })
      }

      const pendingRequests = await fetchPendingJoinRequestsForMatch(matchId)
      const existingRequest = pendingRequests.find(
        (joinRequest) => joinRequest.requesterId === user.id && joinRequest.daeId === daeId
      )

      if (existingRequest) {
        return NextResponse.json({
          ok: true,
          requestId: existingRequest.requestId,
          status: 'requested',
        })
      }

      const requestId = crypto.randomUUID()
      const { error: requestInsertError } = await admin.from('thread_join_requests').insert({
        id: requestId,
        match_id: matchId,
        requester_id: user.id,
        dae_id: daeId,
        dae_text: dae.text,
        source: typeof sourceContext?.source === 'string' ? sourceContext.source : 'manual_review',
        fit_score:
          typeof sourceContext?.fitScore === 'number' ? Number(sourceContext.fitScore.toFixed(3)) : null,
        fit_reason: typeof sourceContext?.fitReason === 'string' ? sourceContext.fitReason : null,
        topic: typeof sourceContext?.topic === 'string' ? sourceContext.topic : null,
        state: 'requested',
      })

      if (requestInsertError && !isMissingRelationError(requestInsertError)) {
        console.error('Thread join request insert error:', requestInsertError)
        return NextResponse.json({ error: 'Unable to create this join request' }, { status: 500 })
      }

      await trackAnalyticsEvents([
        {
          eventName: 'thread_join_requested',
          userId: user.id,
          matchId,
          daeId,
          metadata: {
            requestId,
            requesterId: user.id,
            daeId,
            daeText: dae.text,
            matchId,
            source: typeof sourceContext?.source === 'string' ? sourceContext.source : 'manual_review',
            fitScore:
              typeof sourceContext?.fitScore === 'number' ? Number(sourceContext.fitScore.toFixed(3)) : null,
            fitReason: typeof sourceContext?.fitReason === 'string' ? sourceContext.fitReason : null,
            topic: typeof sourceContext?.topic === 'string' ? sourceContext.topic : null,
          },
        },
      ])

      return NextResponse.json({ ok: true, requestId, status: 'requested' })
    }

    const requestId = typeof payload?.requestId === 'string' ? payload.requestId : ''
    if (!requestId) {
      return NextResponse.json({ error: 'Missing requestId' }, { status: 400 })
    }

    const pendingRequests = await fetchPendingJoinRequestsForMatch(matchId)
    const joinRequest = pendingRequests.find((candidate) => candidate.requestId === requestId)

    if (!joinRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    if (action === 'cancel') {
      if (joinRequest.requesterId !== user.id) {
        return NextResponse.json({ error: 'You cannot cancel this request' }, { status: 403 })
      }

      const { error: cancelError } = await admin
        .from('thread_join_requests')
        .update({
          state: 'cancelled',
          responder_id: user.id,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', requestId)

      if (cancelError && !isMissingRelationError(cancelError)) {
        console.error('Thread join request cancel error:', cancelError)
        return NextResponse.json({ error: 'Unable to cancel this request' }, { status: 500 })
      }

      await trackAnalyticsEvents([
        {
          eventName: 'thread_join_request_cancelled',
          userId: user.id,
          matchId,
          daeId: joinRequest.daeId,
          metadata: {
            requestId,
            requesterId: joinRequest.requesterId,
            source: joinRequest.source,
          },
        },
      ])

      return NextResponse.json({ ok: true })
    }

    const { isParticipant } = await ensureParticipant(matchId, user.id)
    if (!isParticipant) {
      return NextResponse.json({ error: 'Only room participants can manage requests' }, { status: 403 })
    }

    if (action === 'decline') {
      const { error: declineError } = await admin
        .from('thread_join_requests')
        .update({
          state: 'declined',
          responder_id: user.id,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', requestId)

      if (declineError && !isMissingRelationError(declineError)) {
        console.error('Thread join request decline error:', declineError)
        return NextResponse.json({ error: 'Unable to decline this request' }, { status: 500 })
      }

      await trackAnalyticsEvents([
        {
          eventName: 'thread_join_request_declined',
          userId: user.id,
          matchId,
          daeId: joinRequest.daeId,
          metadata: {
            requestId,
            requesterId: joinRequest.requesterId,
            source: joinRequest.source,
          },
        },
      ])

      return NextResponse.json({ ok: true })
    }

    if (action !== 'approve') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    if (roomState.hidden || roomState.joinLocked) {
      return NextResponse.json({ error: 'This room is not accepting new people right now' }, { status: 400 })
    }

    const [
      { data: existingParticipant },
      { data: requesterDae },
      { data: threadParticipants },
      { data: priorHandleRows },
      requesterHasActiveBlock,
    ] =
      await Promise.all([
        admin
          .from('thread_participants')
          .select('id')
          .eq('match_id', matchId)
          .eq('user_id', joinRequest.requesterId)
          .maybeSingle(),
        admin
          .from('daes')
          .select('id, status')
          .eq('id', joinRequest.daeId)
          .eq('user_id', joinRequest.requesterId)
          .maybeSingle(),
        admin
          .from('thread_participants')
          .select('handle')
          .eq('match_id', matchId),
        admin
          .from('thread_participants')
          .select('handle')
          .eq('user_id', joinRequest.requesterId),
        userHasBlockedParticipantInMatch({
          currentUserId: joinRequest.requesterId,
          matchId,
        }),
      ])

    if (existingParticipant) {
      return NextResponse.json({ error: 'That user already joined this room' }, { status: 400 })
    }

    if (!requesterDae || requesterDae.status !== 'unmatched') {
      return NextResponse.json({ error: 'That DAE is no longer waiting' }, { status: 400 })
    }

    if (requesterHasActiveBlock) {
      return NextResponse.json({ error: 'A block is active in this room' }, { status: 400 })
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
      user_id: joinRequest.requesterId,
      dae_id: joinRequest.daeId,
      handle,
    })

    if (participantInsertError) {
      console.error('Join request participant insert error:', participantInsertError)
      return NextResponse.json({ error: 'Unable to approve this request' }, { status: 500 })
    }

    const { error: daeUpdateError } = await admin
      .from('daes')
      .update({ status: 'matched' })
      .eq('id', joinRequest.daeId)
      .eq('user_id', joinRequest.requesterId)

    if (daeUpdateError) {
      console.error('Join request dae update error:', daeUpdateError)
      return NextResponse.json({ error: 'Unable to attach this DAE' }, { status: 500 })
    }

    const { error: approveError } = await admin
      .from('thread_join_requests')
      .update({
        state: 'approved',
        responder_id: user.id,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', requestId)

    if (approveError && !isMissingRelationError(approveError)) {
      console.error('Thread join request approve error:', approveError)
      return NextResponse.json({ error: 'Attached the DAE, but could not finalize the request.' }, { status: 500 })
    }

    await trackAnalyticsEvents([
      {
        eventName: 'thread_join_request_approved',
        userId: user.id,
        matchId,
        daeId: joinRequest.daeId,
        metadata: {
          requestId,
          requesterId: joinRequest.requesterId,
          handle,
          source: joinRequest.source,
          fitScore: joinRequest.fitScore,
          fitReason: joinRequest.fitReason,
          topic: joinRequest.topic,
        },
      },
      {
        eventName: 'dae_attached_to_thread',
        userId: joinRequest.requesterId,
        matchId,
        daeId: joinRequest.daeId,
        metadata: {
          via: 'join_request',
          approvedBy: user.id,
          source: joinRequest.source,
          fitScore: joinRequest.fitScore,
          fitReason: joinRequest.fitReason,
          topic: joinRequest.topic,
        },
      },
    ])

    return NextResponse.json({ ok: true, handle })
  } catch (error) {
    console.error('Unexpected thread join request route error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
