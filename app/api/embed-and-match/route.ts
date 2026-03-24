import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { generateHandle } from '@/lib/handles'
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

    const { data: matches, error: matchError } = await admin.rpc('find_match', {
      query_embedding: JSON.stringify(embedding),
      exclude_user_id: user.id,
      match_threshold: MATCH_THRESHOLD,
    })

    if (matchError) {
      console.error('Match error:', matchError)
      return NextResponse.json({ status: 'waiting' })
    }

    if (!matches || matches.length === 0) {
      await trackAnalyticsEvent({
        eventName: 'dae_waiting',
        userId: user.id,
        daeId: newDae.id,
      })

      return NextResponse.json({ status: 'waiting' })
    }

    const bestMatch = matches[0]

    const { data: matchedDae } = await admin
      .from('daes')
      .select('user_id')
      .eq('id', bestMatch.id)
      .single()

    if (!matchedDae) {
      return NextResponse.json({ status: 'waiting' })
    }

    const { data: priorHandleRows } = await admin
      .from('thread_participants')
      .select('user_id, handle')
      .in('user_id', [user.id, matchedDae.user_id])

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
      new Set([...(usedHandlesByUser.get(matchedDae.user_id) ?? []), ...reservedHandles])
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
        user_id: matchedDae.user_id,
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

    await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        matchId,
        userAId: user.id,
        userBId: matchedDae.user_id,
        handleA,
        handleB,
        daeAText: trimmed,
        daeBText: bestMatch.text,
      }),
    })

    return NextResponse.json({ status: 'matched', matchId })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
