import { NextResponse } from 'next/server'
import { trackAnalyticsEvents } from '@/lib/analytics'
import {
  fetchThreadParticipantsForVotes,
  fetchThreadRemovalVoteSummary,
  getThreadRemovalVoteThreshold,
} from '@/lib/thread-removal-votes'
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

    const summary = await fetchThreadRemovalVoteSummary({
      matchId,
      currentUserId: user.id,
    })

    return NextResponse.json({ ok: true, ...summary })
  } catch (error) {
    console.error('Unexpected thread removal votes GET error:', error)
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
    const matchId = typeof payload?.matchId === 'string' ? payload.matchId : ''
    const targetUserId = typeof payload?.targetUserId === 'string' ? payload.targetUserId : ''

    if (!matchId || !targetUserId || targetUserId === user.id) {
      return NextResponse.json({ error: 'Invalid removal vote target' }, { status: 400 })
    }

    const { admin, isParticipant } = await ensureParticipant(matchId, user.id)
    if (!isParticipant) {
      return NextResponse.json({ error: 'You do not have access to this thread' }, { status: 403 })
    }

    const participants = await fetchThreadParticipantsForVotes(matchId)
    const participantCount = participants.length
    const threshold = getThreadRemovalVoteThreshold(participantCount)

    if (!threshold) {
      return NextResponse.json({ error: 'Removal votes only unlock in rooms with 3 or more people' }, { status: 400 })
    }

    const targetParticipant = participants.find((participant) => participant.user_id === targetUserId)

    if (!targetParticipant) {
      return NextResponse.json({ error: 'That person is no longer in the room' }, { status: 404 })
    }

    const voteSummaryBefore = await fetchThreadRemovalVoteSummary({
      matchId,
      currentUserId: user.id,
    })
    const existingTargetSummary = voteSummaryBefore.items.find(
      (item) => item.targetUserId === targetUserId
    )

    if (existingTargetSummary?.myVote) {
      return NextResponse.json({
        ok: true,
        removed: false,
        summary: voteSummaryBefore,
      })
    }

    await trackAnalyticsEvents([
      {
        eventName: 'thread_member_removal_voted',
        userId: user.id,
        matchId,
        daeId: targetParticipant.dae_id,
        metadata: {
          targetUserId,
          targetHandle: targetParticipant.handle,
          threshold,
          participantCount,
        },
      },
    ])

    const { error: voteInsertError } = await admin.from('thread_removal_votes').upsert(
      {
        match_id: matchId,
        target_user_id: targetUserId,
        voter_user_id: user.id,
      },
      {
        onConflict: 'match_id,target_user_id,voter_user_id',
        ignoreDuplicates: true,
      }
    )

    if (voteInsertError && !isMissingRelationError(voteInsertError)) {
      console.error('Thread removal vote insert error:', voteInsertError)
      return NextResponse.json({ error: 'Unable to register this vote.' }, { status: 500 })
    }

    const voteSummaryAfter = await fetchThreadRemovalVoteSummary({
      matchId,
      currentUserId: user.id,
    })
    const updatedTargetSummary = voteSummaryAfter.items.find(
      (item) => item.targetUserId === targetUserId
    )

    if (!updatedTargetSummary || updatedTargetSummary.votesCount < threshold) {
      return NextResponse.json({
        ok: true,
        removed: false,
        summary: voteSummaryAfter,
      })
    }

    const { count: deletedMessageCount } = await admin
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('match_id', matchId)
      .eq('sender_id', targetUserId)

    const { error: messageDeleteError } = await admin
      .from('messages')
      .delete()
      .eq('match_id', matchId)
      .eq('sender_id', targetUserId)

    if (messageDeleteError) {
      console.error('Thread removal vote message delete error:', messageDeleteError)
      return NextResponse.json({ error: 'Unable to remove this person yet' }, { status: 500 })
    }

    const { error: participantDeleteError } = await admin
      .from('thread_participants')
      .delete()
      .eq('match_id', matchId)
      .eq('user_id', targetUserId)

    if (participantDeleteError) {
      console.error('Thread removal vote participant delete error:', participantDeleteError)
      return NextResponse.json({ error: 'Unable to remove this person yet' }, { status: 500 })
    }

    const { error: daeUpdateError } = await admin
      .from('daes')
      .update({ status: 'unmatched' })
      .eq('id', targetParticipant.dae_id)
      .eq('user_id', targetUserId)

    if (daeUpdateError) {
      console.error('Thread removal vote dae update error:', daeUpdateError)
      return NextResponse.json({ error: 'Removed them from the room, but could not reopen their DAE.' }, { status: 500 })
    }

    const { error: voteDeleteError } = await admin
      .from('thread_removal_votes')
      .delete()
      .eq('match_id', matchId)
      .or(`target_user_id.eq.${targetUserId},voter_user_id.eq.${targetUserId}`)

    if (voteDeleteError && !isMissingRelationError(voteDeleteError)) {
      console.error('Thread removal vote cleanup error:', voteDeleteError)
    }

    await trackAnalyticsEvents([
      {
        eventName: 'thread_member_removed_by_vote',
        userId: user.id,
        matchId,
        daeId: targetParticipant.dae_id,
        metadata: {
          targetUserId,
          targetHandle: targetParticipant.handle,
          voteCount: updatedTargetSummary.votesCount,
          threshold,
          participantCountBeforeRemoval: participantCount,
          deletedMessageCount: deletedMessageCount ?? 0,
        },
      },
      {
        eventName: 'dae_detached_from_thread',
        userId: targetUserId,
        matchId,
        daeId: targetParticipant.dae_id,
        metadata: {
          via: 'removal_vote',
          voteCount: updatedTargetSummary.votesCount,
          threshold,
        },
      },
    ])

    return NextResponse.json({
      ok: true,
      removed: true,
      targetUserId,
    })
  } catch (error) {
    console.error('Unexpected thread removal votes POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
