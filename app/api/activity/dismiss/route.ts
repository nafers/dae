import { NextResponse } from 'next/server'
import { trackAnalyticsEvent } from '@/lib/analytics'
import { getRequestUser } from '@/lib/request-user'

export async function POST(request: Request) {
  try {
    const user = await getRequestUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { itemId } = await request.json()

    if (!itemId || typeof itemId !== 'string') {
      return NextResponse.json({ error: 'Missing itemId' }, { status: 400 })
    }

    await trackAnalyticsEvent({
      eventName: 'activity_dismissed',
      userId: user.id,
      metadata: {
        itemId,
      },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Unexpected activity dismiss route error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
