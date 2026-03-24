import { NextResponse } from 'next/server'
import { trackAnalyticsEvents } from '@/lib/analytics'
import { getRequestUser } from '@/lib/request-user'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const { matchId, mode } = await request.json()

    if (!matchId || typeof matchId !== 'string') {
      return NextResponse.json({ error: 'Missing matchId' }, { status: 400 })
    }

    if (mode !== 'leave' && mode !== 'detach') {
      return NextResponse.json({ error: 'Invalid leave mode' }, { status: 400 })
    }

    const user = await getRequestUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const admin = createAdminClient()
    const [{ data: participant }, { count: participantCountBeforeLeave }, { count: messageCount }] =
      await Promise.all([
      admin
        .from('thread_participants')
        .select('id, dae_id, handle')
        .eq('match_id', matchId)
        .eq('user_id', user.id)
        .maybeSingle(),
      admin.from('thread_participants').select('*', { count: 'exact', head: true }).eq('match_id', matchId),
      ...(mode === 'detach'
        ? [
            admin
              .from('messages')
              .select('*', { count: 'exact', head: true })
              .eq('match_id', matchId)
              .eq('sender_id', user.id),
          ]
        : [Promise.resolve({ count: 0 })]),
    ])

    if (!participant) {
      return NextResponse.json({ error: 'You are not part of this chat' }, { status: 404 })
    }

    if (mode === 'detach') {
      const { error: messageDeleteError } = await admin
        .from('messages')
        .delete()
        .eq('match_id', matchId)
        .eq('sender_id', user.id)

      if (messageDeleteError) {
        console.error('Thread detach message delete error:', messageDeleteError)
        return NextResponse.json({ error: 'Unable to clear your chat history' }, { status: 500 })
      }
    }

    const { error: deleteError } = await admin
      .from('thread_participants')
      .delete()
      .eq('id', participant.id)
      .eq('user_id', user.id)

    if (deleteError) {
      console.error('Thread leave delete error:', deleteError)
      return NextResponse.json({ error: 'Unable to leave this chat' }, { status: 500 })
    }

    if (mode === 'detach') {
      const { error: daeUpdateError } = await admin
        .from('daes')
        .update({ status: 'unmatched' })
        .eq('id', participant.dae_id)
        .eq('user_id', user.id)

      if (daeUpdateError) {
        console.error('Thread detach dae update error:', daeUpdateError)
        return NextResponse.json({ error: 'Left the chat, but could not reopen your DAE.' }, { status: 500 })
      }
    }

    await trackAnalyticsEvents([
      {
        eventName: 'thread_left',
        userId: user.id,
        matchId,
        daeId: participant.dae_id,
        metadata: {
          mode,
          participantCountBeforeLeave: participantCountBeforeLeave ?? null,
          handle: participant.handle,
          deletedMessageCount: mode === 'detach' ? messageCount ?? 0 : 0,
        },
      },
      ...(mode === 'detach'
        ? [
            {
              eventName: 'dae_detached_from_thread',
              userId: user.id,
              matchId,
              daeId: participant.dae_id,
              metadata: {
                participantCountBeforeLeave: participantCountBeforeLeave ?? null,
              },
            },
          ]
        : []),
    ])

    return NextResponse.json({
      ok: true,
      redirectTo: mode === 'detach' ? '/review' : '/threads',
    })
  } catch (error) {
    console.error('Unexpected thread leave route error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
