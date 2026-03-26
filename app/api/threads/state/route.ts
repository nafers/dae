import { NextResponse } from 'next/server'
import { trackAnalyticsEvent } from '@/lib/analytics'
import { getRequestUser } from '@/lib/request-user'
import { createAdminClient } from '@/lib/supabase/server'
import { isMissingRelationError } from '@/lib/supabase-fallback'

type ThreadAction = 'seen' | 'mute' | 'unmute' | 'hide' | 'unhide' | 'report'

const actionEventMap: Record<ThreadAction, string> = {
  seen: 'thread_seen',
  mute: 'thread_muted',
  unmute: 'thread_unmuted',
  hide: 'thread_hidden',
  unhide: 'thread_unhidden',
  report: 'thread_reported',
}

function sanitizeReason(reason: unknown) {
  if (typeof reason !== 'string') {
    return null
  }

  const trimmed = reason.trim().slice(0, 80)
  return trimmed.length > 0 ? trimmed : null
}

export async function POST(request: Request) {
  try {
    const { matchId, action, reason } = await request.json()
    const threadAction =
      action === 'seen' ||
      action === 'mute' ||
      action === 'unmute' ||
      action === 'hide' ||
      action === 'unhide' ||
      action === 'report'
        ? (action as ThreadAction)
        : null

    if (!matchId || typeof matchId !== 'string') {
      return NextResponse.json({ error: 'Missing matchId' }, { status: 400 })
    }

    if (!threadAction) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const user = await getRequestUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const admin = createAdminClient()
    const { data: participant } = await admin
      .from('thread_participants')
      .select('id, dae_id')
      .eq('match_id', matchId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!participant) {
      return NextResponse.json({ error: 'You do not have access to this thread' }, { status: 403 })
    }

    const timestamp = new Date().toISOString()
    const reportReason = threadAction === 'report' ? sanitizeReason(reason) ?? 'other' : null
    const threadStatePatch = {
      user_id: user.id,
      match_id: matchId,
      muted: threadAction === 'mute' ? true : threadAction === 'unmute' ? false : undefined,
      hidden: threadAction === 'hide' ? true : threadAction === 'unhide' ? false : undefined,
      last_seen_at:
        threadAction === 'seen' || threadAction === 'mute' || threadAction === 'unmute'
          ? timestamp
          : undefined,
      last_reported_at: threadAction === 'report' ? timestamp : undefined,
      last_report_reason: threadAction === 'report' ? reportReason : undefined,
      updated_at: timestamp,
    }

    const { error: threadStateError } = await admin.from('thread_user_states').upsert(threadStatePatch, {
      onConflict: 'user_id,match_id',
    })

    if (threadStateError && !isMissingRelationError(threadStateError)) {
      console.error('Thread state upsert error:', threadStateError)
      return NextResponse.json({ error: 'Unable to update this thread' }, { status: 500 })
    }

    if (threadAction === 'report') {
      const { data: roomStateRow, error: roomStateFetchError } = await admin
        .from('room_moderation_states')
        .select('report_count')
        .eq('match_id', matchId)
        .maybeSingle()

      if (roomStateFetchError && !isMissingRelationError(roomStateFetchError)) {
        console.error('Room moderation fetch error:', roomStateFetchError)
        return NextResponse.json({ error: 'Unable to report this thread' }, { status: 500 })
      }

      if (!roomStateFetchError) {
        const { error: roomStateUpsertError } = await admin.from('room_moderation_states').upsert(
          {
            match_id: matchId,
            report_count: (roomStateRow?.report_count ?? 0) + 1,
            updated_by: user.id,
            updated_at: timestamp,
          },
          {
            onConflict: 'match_id',
          }
        )

        if (roomStateUpsertError) {
          console.error('Room moderation upsert error:', roomStateUpsertError)
          return NextResponse.json({ error: 'Unable to report this thread' }, { status: 500 })
        }
      }
    }

    await trackAnalyticsEvent({
      eventName: actionEventMap[threadAction],
      userId: user.id,
      matchId,
      daeId: participant.dae_id,
      metadata:
        threadAction === 'report'
          ? {
              reason: reportReason,
            }
          : null,
    })

    return NextResponse.json({
      ok: true,
      hidden: threadAction === 'hide' ? true : threadAction === 'unhide' ? false : undefined,
      muted: threadAction === 'mute' ? true : threadAction === 'unmute' ? false : undefined,
    })
  } catch (error) {
    console.error('Unexpected thread state route error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
