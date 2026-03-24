import { NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'

interface DaeRelation {
  text: string
}

interface ThreadParticipantRow {
  user_id: string
  handle: string
  dae_id: string
  daes: DaeRelation | DaeRelation[] | null
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const matchId = searchParams.get('matchId')

    if (!matchId) {
      return NextResponse.json({ error: 'Missing matchId' }, { status: 400 })
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
    const { data: accessRow } = await admin
      .from('thread_participants')
      .select('id')
      .eq('match_id', matchId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!accessRow) {
      return NextResponse.json({ error: 'You do not have access to this thread' }, { status: 403 })
    }

    const { data: participants, error } = await admin
      .from('thread_participants')
      .select(`
        user_id,
        handle,
        dae_id,
        daes ( text )
      `)
      .eq('match_id', matchId)

    if (error) {
      console.error('Thread participant fetch error:', error)
      return NextResponse.json({ error: 'Failed to load participants' }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      participants: ((participants ?? []) as ThreadParticipantRow[]).map((participant) => ({
        userId: participant.user_id,
        handle: participant.handle,
        daeId: participant.dae_id,
        dae:
          Array.isArray(participant.daes)
            ? (participant.daes[0]?.text ?? '')
            : (participant.daes?.text ?? ''),
      })),
    })
  } catch (error) {
    console.error('Unexpected thread participant route error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
