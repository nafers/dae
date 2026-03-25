import { NextResponse } from 'next/server'
import { trackAnalyticsEvent } from '@/lib/analytics'
import {
  getRoomSignalEventName,
  getTopicSignalEventName,
  type RoomSignalType,
  type TopicSignalType,
} from '@/lib/quality-signals'
import { getRequestUser } from '@/lib/request-user'
import { createAdminClient } from '@/lib/supabase/server'

function sanitizeLabel(value: unknown) {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim().slice(0, 120)
  return trimmed.length > 0 ? trimmed : null
}

export async function POST(request: Request) {
  try {
    const user = await getRequestUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const payload = await request.json()
    const scope = payload?.scope === 'room' ? 'room' : payload?.scope === 'topic' ? 'topic' : null

    if (!scope) {
      return NextResponse.json({ error: 'Invalid scope' }, { status: 400 })
    }

    if (scope === 'topic') {
      const topicKey = typeof payload?.topicKey === 'string' ? payload.topicKey : ''
      const signal =
        payload?.signal === 'same_here' || payload?.signal === 'not_for_me'
          ? (payload.signal as TopicSignalType)
          : null

      if (!topicKey || !signal) {
        return NextResponse.json({ error: 'Missing topic signal details' }, { status: 400 })
      }

      await trackAnalyticsEvent({
        eventName: getTopicSignalEventName(signal),
        userId: user.id,
        metadata: {
          topicKey,
          headline: sanitizeLabel(payload?.headline),
          label: sanitizeLabel(payload?.label),
        },
      })

      return NextResponse.json({ ok: true, signal })
    }

    const matchId = typeof payload?.matchId === 'string' ? payload.matchId : ''
    const signal =
      payload?.signal === 'useful' || payload?.signal === 'not_quite'
        ? (payload.signal as RoomSignalType)
        : null

    if (!matchId || !signal) {
      return NextResponse.json({ error: 'Missing room signal details' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data: participant } = await admin
      .from('thread_participants')
      .select('dae_id')
      .eq('match_id', matchId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!participant) {
      return NextResponse.json({ error: 'You do not have access to this room' }, { status: 403 })
    }

    await trackAnalyticsEvent({
      eventName: getRoomSignalEventName(signal),
      userId: user.id,
      matchId,
      daeId: participant.dae_id,
    })

    return NextResponse.json({ ok: true, signal })
  } catch (error) {
    console.error('Unexpected quality signal route error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
