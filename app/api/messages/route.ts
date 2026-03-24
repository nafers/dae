import { after, NextResponse } from 'next/server'
import { trackAnalyticsEvents } from '@/lib/analytics'
import { sendThreadMessageNotifications } from '@/lib/message-notifications'
import { getRequestUser } from '@/lib/request-user'
import { createAdminClient } from '@/lib/supabase/server'

async function getAuthedParticipant(matchId: string) {
  const user = await getRequestUser()
  if (!user) {
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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const matchId = searchParams.get('matchId')

    if (!matchId) {
      return NextResponse.json({ error: 'Missing matchId' }, { status: 400 })
    }

    const access = await getAuthedParticipant(matchId)
    if ('error' in access) {
      return access.error
    }

    const { admin } = access
    const { data: messages, error } = await admin
      .from('messages')
      .select('id, sender_id, content, created_at')
      .eq('match_id', matchId)
      .order('created_at', { ascending: true })
      .limit(200)

    if (error) {
      console.error('Message fetch error:', error)
      return NextResponse.json({ error: 'Failed to load messages' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, messages: messages ?? [] })
  } catch (error) {
    console.error('Unexpected message GET route error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { matchId, content } = await request.json()

    if (!matchId || typeof matchId !== 'string') {
      return NextResponse.json({ error: 'Missing matchId' }, { status: 400 })
    }

    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'Missing content' }, { status: 400 })
    }

    const trimmed = content.trim()
    if (!trimmed || trimmed.length > 1000) {
      return NextResponse.json({ error: 'Message must be 1-1000 characters' }, { status: 400 })
    }

    const access = await getAuthedParticipant(matchId)
    if ('error' in access) {
      return access.error
    }

    const { admin, user } = access
    const [{ count: existingMessageCount }, { count: existingSenderMessageCount }] = await Promise.all([
      admin.from('messages').select('*', { count: 'exact', head: true }).eq('match_id', matchId),
      admin
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('match_id', matchId)
        .eq('sender_id', user.id),
    ])

    const { data: message, error: insertError } = await admin
      .from('messages')
      .insert({
        match_id: matchId,
        sender_id: user.id,
        content: trimmed,
      })
      .select('id, sender_id, content, created_at')
      .single()

    if (insertError || !message) {
      console.error('Message insert error:', insertError)
      return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
    }

    after(async () => {
      await Promise.allSettled([
        trackAnalyticsEvents([
          {
            eventName: 'message_sent',
            userId: user.id,
            matchId,
            metadata: {
              contentLength: trimmed.length,
            },
          },
          ...(existingMessageCount === 0
            ? [
                {
                  eventName: 'first_message_in_thread',
                  userId: user.id,
                  matchId,
                },
              ]
            : []),
          ...(existingSenderMessageCount === 0
            ? [
                {
                  eventName: 'first_message_from_user_in_thread',
                  userId: user.id,
                  matchId,
                },
              ]
            : []),
        ]),
        sendThreadMessageNotifications({
          matchId,
          senderId: user.id,
          content: trimmed,
        }),
      ])
    })

    return NextResponse.json({ ok: true, message })
  } catch (error) {
    console.error('Unexpected message route error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
