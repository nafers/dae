import { NextResponse } from 'next/server'
import { trackAnalyticsEvent } from '@/lib/analytics'
import { createAdminClient, createClient } from '@/lib/supabase/server'

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

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
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

    await trackAnalyticsEvent({
      eventName: actionEventMap[threadAction],
      userId: user.id,
      matchId,
      daeId: participant.dae_id,
      metadata:
        threadAction === 'report'
          ? {
              reason: sanitizeReason(reason) ?? 'other',
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
