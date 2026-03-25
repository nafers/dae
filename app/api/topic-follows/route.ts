import { NextResponse } from 'next/server'
import { trackAnalyticsEvent } from '@/lib/analytics'
import { getRequestUser } from '@/lib/request-user'

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
