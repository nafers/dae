import { NextResponse } from 'next/server'
import { trackAnalyticsEvents } from '@/lib/analytics'
import { fetchBlockedUserIdsForUser } from '@/lib/blocks'
import { getRequestUser } from '@/lib/request-user'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const user = await getRequestUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const blockedUserIds = [...(await fetchBlockedUserIdsForUser(user.id))]
    return NextResponse.json({ ok: true, blockedUserIds })
  } catch (error) {
    console.error('Unexpected blocks GET route error:', error)
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
    const action = payload?.action === 'unblock' ? 'unblock' : 'block'
    const targetUserId = typeof payload?.targetUserId === 'string' ? payload.targetUserId : ''
    const matchId = typeof payload?.matchId === 'string' ? payload.matchId : null

    if (!targetUserId || targetUserId === user.id) {
      return NextResponse.json({ error: 'Invalid target' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data: targetParticipant } = matchId
      ? await admin
          .from('thread_participants')
          .select('handle')
          .eq('match_id', matchId)
          .eq('user_id', targetUserId)
          .maybeSingle()
      : { data: null }

    const analyticsEvents = [
      {
        eventName: action === 'block' ? 'user_blocked' : 'user_unblocked',
        userId: user.id,
        matchId,
        metadata: {
          targetUserId,
          targetHandle: targetParticipant?.handle ?? null,
        },
      },
      ...(action === 'block' && matchId
        ? [
            {
              eventName: 'thread_hidden',
              userId: user.id,
              matchId,
              metadata: {
                via: 'block',
                targetUserId,
              },
            },
            {
              eventName: 'thread_muted',
              userId: user.id,
              matchId,
              metadata: {
                via: 'block',
                targetUserId,
              },
            },
          ]
        : []),
    ]

    await trackAnalyticsEvents(analyticsEvents)

    return NextResponse.json({
      ok: true,
      blocked: action === 'block',
      redirectTo: action === 'block' && matchId ? '/threads' : undefined,
    })
  } catch (error) {
    console.error('Unexpected blocks POST route error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
