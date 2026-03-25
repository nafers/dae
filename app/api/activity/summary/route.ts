import { NextResponse } from 'next/server'
import { fetchActivityFeed } from '@/lib/activity'
import { getRequestUser } from '@/lib/request-user'

export async function GET() {
  try {
    const user = await getRequestUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { summary } = await fetchActivityFeed(user.id)

    return NextResponse.json({
      ok: true,
      count: summary.totalCount,
      unreadCount: summary.unreadCount,
      waitingCount: summary.waitingCount,
      freshMatchCount: summary.freshMatchCount,
    })
  } catch (error) {
    console.error('Unexpected activity summary route error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
