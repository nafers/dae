import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import OpenAI from 'openai'
import { generateHandle } from '@/lib/handles'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { text } = await request.json()

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Missing text' }, { status: 400 })
    }

    const trimmed = text.trim()
    if (trimmed.length < 10 || trimmed.length > 280) {
      return NextResponse.json({ error: 'Text must be 10–280 characters' }, { status: 400 })
    }

    // Check if user already has an unmatched DAE
    const { data: existing } = await supabase
      .from('daes')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'unmatched')
      .single()

    if (existing) {
      return NextResponse.json({ error: 'You already have a pending DAE' }, { status: 400 })
    }

    // Generate embedding
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: trimmed,
    })
    const embedding = embeddingResponse.data[0].embedding

    const admin = createAdminClient()

    // Store the new DAE
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

    // Search for a matching DAE using pgvector cosine similarity
    const { data: matches, error: matchError } = await admin.rpc('find_match', {
      query_embedding: JSON.stringify(embedding),
      exclude_user_id: user.id,
      match_threshold: 0.82,
    })

    if (matchError) {
      console.error('Match error:', matchError)
      // DAE is saved, just no match found yet
      return NextResponse.json({ status: 'waiting' })
    }

    if (!matches || matches.length === 0) {
      return NextResponse.json({ status: 'waiting' })
    }

    const bestMatch = matches[0]

    // Create the match and thread participants in a transaction via admin
    const handleA = generateHandle()
    let handleB = generateHandle()
    while (handleB === handleA) handleB = generateHandle()

    // Get matched user info
    const { data: matchedDae } = await admin
      .from('daes')
      .select('user_id')
      .eq('id', bestMatch.id)
      .single()

    if (!matchedDae) {
      return NextResponse.json({ status: 'waiting' })
    }

    // Create match record
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

    // Update both DAEs to matched
    await admin
      .from('daes')
      .update({ status: 'matched' })
      .in('id', [newDae.id, bestMatch.id])

    // Create thread participants
    await admin.from('thread_participants').insert([
      { match_id: matchRecord.id, user_id: user.id, dae_id: newDae.id, handle: handleA },
      { match_id: matchRecord.id, user_id: matchedDae.user_id, dae_id: bestMatch.id, handle: handleB },
    ])

    // Send notification emails
    await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        matchId: matchRecord.id,
        userAId: user.id,
        userBId: matchedDae.user_id,
        handleA,
        handleB,
        daeAText: trimmed,
        daeBText: bestMatch.text,
      }),
    })

    return NextResponse.json({ status: 'matched', matchId: matchRecord.id })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
