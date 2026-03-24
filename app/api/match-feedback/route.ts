import { NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { trackAnalyticsEvent } from '@/lib/analytics'

async function getAuthedParticipant(matchId: string) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) }
  }

  const admin = createAdminClient()
  const { data: participant } = await admin
    .from('thread_participants')
    .select('id')
    .eq('match_id', matchId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!participant) {
    return {
      error: NextResponse.json({ error: 'You do not have access to this thread' }, { status: 403 }),
    }
  }

  return { admin, user }
}

export async function POST(request: Request) {
  try {
    const { matchId, verdict } = await request.json()

    if (!matchId || typeof matchId !== 'string') {
      return NextResponse.json({ error: 'Missing matchId' }, { status: 400 })
    }

    if (verdict !== 'good' && verdict !== 'bad') {
      return NextResponse.json({ error: 'Invalid verdict' }, { status: 400 })
    }

    const access = await getAuthedParticipant(matchId)
    if ('error' in access) {
      return access.error
    }

    const { admin, user } = access
    const { data: existingFeedback } = await admin
      .from('analytics_events')
      .select('metadata')
      .eq('event_name', 'match_feedback_submitted')
      .eq('user_id', user.id)
      .eq('match_id', matchId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existingFeedback) {
      return NextResponse.json({
        ok: true,
        verdict: (existingFeedback.metadata as { verdict?: string } | null)?.verdict ?? verdict,
        existing: true,
      })
    }

    await trackAnalyticsEvent({
      eventName: 'match_feedback_submitted',
      userId: user.id,
      matchId,
      metadata: {
        verdict,
      },
    })

    return NextResponse.json({ ok: true, verdict })
  } catch (error) {
    console.error('Unexpected match feedback route error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
