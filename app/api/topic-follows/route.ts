import { NextResponse } from 'next/server'
import { trackAnalyticsEvent } from '@/lib/analytics'
import { getRequestUser } from '@/lib/request-user'
import { createAdminClient } from '@/lib/supabase/server'
import { isMissingRelationError } from '@/lib/supabase-fallback'

export async function POST(request: Request) {
  try {
    const user = await getRequestUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { topicKey, headline, label, searchQuery, follow } = await request.json()

    if (!topicKey || typeof topicKey !== 'string') {
      return NextResponse.json({ error: 'Missing topicKey' }, { status: 400 })
    }

    const eventName = follow ? 'topic_followed' : 'topic_unfollowed'
    const admin = createAdminClient()

    if (follow) {
      const { error: followError } = await admin.from('topic_follows').upsert(
        {
          user_id: user.id,
          topic_key: topicKey,
          headline: typeof headline === 'string' ? headline : topicKey,
          label: typeof label === 'string' ? label : headline,
          search_query: typeof searchQuery === 'string' ? searchQuery : headline,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id,topic_key',
        }
      )

      if (followError && !isMissingRelationError(followError)) {
        console.error('Topic follow upsert error:', followError)
        return NextResponse.json({ error: 'Unable to update follow state' }, { status: 500 })
      }
    } else {
      const { error: unfollowError } = await admin
        .from('topic_follows')
        .delete()
        .eq('user_id', user.id)
        .eq('topic_key', topicKey)

      if (unfollowError && !isMissingRelationError(unfollowError)) {
        console.error('Topic follow delete error:', unfollowError)
        return NextResponse.json({ error: 'Unable to update follow state' }, { status: 500 })
      }
    }

    await trackAnalyticsEvent({
      eventName,
      userId: user.id,
      metadata: {
        topicKey,
        headline: typeof headline === 'string' ? headline : topicKey,
        label: typeof label === 'string' ? label : headline,
        searchQuery: typeof searchQuery === 'string' ? searchQuery : headline,
      },
    })

    return NextResponse.json({ ok: true, following: Boolean(follow) })
  } catch (error) {
    console.error('Unexpected topic follow route error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
