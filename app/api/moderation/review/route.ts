import { NextResponse } from 'next/server'
import { trackAnalyticsEvent } from '@/lib/analytics'
import { isFounderEmail } from '@/lib/founders'
import { getRequestUser } from '@/lib/request-user'

function sanitizeDecision(value: unknown) {
  if (value === 'reviewed' || value === 'watch' || value === 'follow_up') {
    return value
  }

  return null
}

function sanitizeNotes(value: unknown) {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim().slice(0, 240)
  return trimmed.length > 0 ? trimmed : null
}

export async function POST(request: Request) {
  try {
    const user = await getRequestUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    if (!isFounderEmail(user.email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const payload = await request.json()
    const reportKey = typeof payload?.reportKey === 'string' ? payload.reportKey : ''
    const matchId = typeof payload?.matchId === 'string' ? payload.matchId : null
    const decision = sanitizeDecision(payload?.decision)
    const notes = sanitizeNotes(payload?.notes)

    if (!reportKey || !decision) {
      return NextResponse.json({ error: 'Missing moderation review details' }, { status: 400 })
    }

    await trackAnalyticsEvent({
      eventName: 'moderation_report_reviewed',
      userId: user.id,
      matchId,
      metadata: {
        reportKey,
        decision,
        notes,
      },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Unexpected moderation review route error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
