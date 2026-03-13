import { redirect, notFound } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import ChatThread from '@/components/ChatThread'

interface Props {
  params: Promise<{ matchId: string }>
}

export default async function ThreadPage({ params }: Props) {
  const { matchId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect(`/?next=/threads/${matchId}`)

  const admin = createAdminClient()

  // Get both participants for this match (relaxed RLS via admin)
  const { data: participants, error } = await admin
    .from('thread_participants')
    .select(`
      user_id,
      handle,
      dae_id,
      daes ( text )
    `)
    .eq('match_id', matchId)

  if (error || !participants || participants.length !== 2) {
    notFound()
  }

  // Verify the current user is one of the participants
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const myParticipant = (participants as any[]).find((p) => p.user_id === user.id)
  if (!myParticipant) notFound()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const theirParticipant = (participants as any[]).find((p) => p.user_id !== user.id)!

  // Get initial messages
  const { data: initialMessages } = await admin
    .from('messages')
    .select('id, sender_id, content, created_at')
    .eq('match_id', matchId)
    .order('created_at', { ascending: true })
    .limit(50)

  return (
    <ChatThread
      matchId={matchId}
      myHandle={myParticipant.handle}
      myDae={(myParticipant.daes as any)?.text ?? ''}
      theirHandle={theirParticipant.handle}
      theirDae={(theirParticipant.daes as any)?.text ?? ''}
      myUserId={user.id}
      initialMessages={initialMessages ?? []}
    />
  )
}
