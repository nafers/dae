import { after, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { generateHandle } from '@/lib/handles'
import { fetchNearMatches } from '@/lib/near-matches'
import { sendTopicFollowDigest } from '@/lib/follow-notifications'
import { findBestMatchCandidate } from '@/lib/matching'
import { trackAnalyticsEvent } from '@/lib/analytics'
import { getRequestUser } from '@/lib/request-user'
import { createAdminClient } from '@/lib/supabase/server'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const MATCH_THRESHOLD = 0.8

export async function POST(request: Request) {
  try {
    const user = await getRequestUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { text } = await request.json()

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Missing text' }, { status: 400 })
    }

    const trimmed = text.trim()
    if (trimmed.length < 10 || trimmed.length > 280) {
      return NextResponse.json({ error: 'Text must be 10-280 characters' }, { status: 400 })
    }

    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: trimmed,
    })
    const embedding = embeddingResponse.data[0].embedding

    const admin = createAdminClient()

    const { data: newDae, error: insertError } = await admin
      .from('daes')
      .insert({
        user_id: user.id,
        text: trimmed,
        embedding: JSON.stringify(embedding),
        status: 'unmatched',
      })
      .select('id')
      .single()

    if (insertError || !newDae) {
      console.error('Insert error:', insertError)
      return NextResponse.json({ error: 'Failed to save DAE' }, { status: 500 })
    }

    const bestMatch = await findBestMatchCandidate({
      currentUserId: user.id,
      sourceText: trimmed,
      sourceEmbedding: embedding,
      threshold: MATCH_THRESHOLD,
    })

    if (!bestMatch) {
      const nearMatches = await fetchNearMatches({
        currentUserId: user.id,
        daeText: trimmed,
        daeEmbedding: embedding,
      })

      after(async () => {
        await sendTopicFollowDigest({
          submitterId: user.id,
          daeId: newDae.id,
          daeText: trimmed,
          status: 'unmatched',
        })
      })

      await trackAnalyticsEvent({
        eventName: 'dae_waiting',
        userId: user.id,
        daeId: newDae.id,
        metadata: {
          nearRoomCount: nearMatches.nearRooms.length,
          nearTopicCount: nearMatches.nearTopics.length,
        },
      })

      if (nearMatches.nearRooms.length > 0 || nearMatches.nearTopics.length > 0) {
        await trackAnalyticsEvent({
          eventName: 'near_match_options_presented',
          userId: user.id,
          daeId: newDae.id,
          metadata: {
            nearRoomIds: nearMatches.nearRooms.map((room) => room.matchId),
            nearTopicKeys: nearMatches.nearTopics.map((topic) => topic.topicKey),
            autoJoinRoomCount: nearMatches.nearRooms.filter((room) => room.joinMode === 'join_now').length,
            approvalRoomCount: nearMatches.nearRooms.filter((room) => room.joinMode === 'request').length,
          },
        })
      }

      return NextResponse.json({
        status: 'waiting',
        daeId: newDae.id,
        ...nearMatches,
      })
    }

    const { data: priorHandleRows } = await admin
      .from('thread_participants')
      .select('user_id, handle')
      .in('user_id', [user.id, bestMatch.userId])

    const usedHandlesByUser = new Map<string, Set<string>>()

    for (const handleRow of priorHandleRows ?? []) {
      const existingHandles = usedHandlesByUser.get(handleRow.user_id) ?? new Set<string>()
      existingHandles.add(handleRow.handle)
      usedHandlesByUser.set(handleRow.user_id, existingHandles)
    }

    const reservedHandles = new Set<string>()
    const handleA = generateHandle(
      new Set([...(usedHandlesByUser.get(user.id) ?? []), ...reservedHandles])
    )
    reservedHandles.add(handleA)
    const handleB = generateHandle(
      new Set([...(usedHandlesByUser.get(bestMatch.userId) ?? []), ...reservedHandles])
    )

    const { data: matchRecord, error: matchInsertError } = await admin
      .from('matches')
      .insert({
        dae_a_id: newDae.id,
        dae_b_id: bestMatch.id,
        similarity: bestMatch.similarity,
      })
      .select('id')
      .single()

    if (matchInsertError || !matchRecord) {
      console.error('Match insert error:', matchInsertError)
      return NextResponse.json({ status: 'waiting' })
    }

    const { error: participantInsertError } = await admin.from('thread_participants').insert([
      { match_id: matchRecord.id, user_id: user.id, dae_id: newDae.id, handle: handleA },
      {
        match_id: matchRecord.id,
        user_id: bestMatch.userId,
        dae_id: bestMatch.id,
        handle: handleB,
      },
    ])

    if (participantInsertError) {
      console.error('Thread participant insert error:', participantInsertError)
      return NextResponse.json({ status: 'waiting' })
    }

    const matchId = matchRecord.id

    await admin
      .from('daes')
      .update({ status: 'matched' })
      .in('id', [newDae.id, bestMatch.id])

    await trackAnalyticsEvent({
      eventName: 'dae_matched',
      userId: user.id,
      matchId,
      daeId: newDae.id,
      metadata: {
        threadStrategy: 'per_matched_dae_pair',
        similarity: bestMatch.similarity,
      },
    })

    after(async () => {
      await Promise.allSettled([
        fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/notify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            matchId,
            userAId: user.id,
            userBId: bestMatch.userId,
            handleA,
            handleB,
            daeAText: trimmed,
            daeBText: bestMatch.text,
          }),
        }),
        sendTopicFollowDigest({
          submitterId: user.id,
          daeId: newDae.id,
          daeText: trimmed,
          status: 'matched',
        }),
      ])
    })

    return NextResponse.json({ status: 'matched', matchId })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
