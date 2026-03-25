import { NextResponse } from 'next/server'
import { trackAnalyticsEvent } from '@/lib/analytics'
import { getRequestUser } from '@/lib/request-user'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const user = await getRequestUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const payload = await request.json()
    if (payload?.confirm !== 'DELETE') {
      return NextResponse.json({ error: 'Confirmation text is required' }, { status: 400 })
    }

    await trackAnalyticsEvent({
      eventName: 'account_delete_requested',
      userId: user.id,
    })

    const admin = createAdminClient()
    const { error } = await admin.auth.admin.deleteUser(user.id)

    if (error) {
      console.error('Account delete error:', error)
      return NextResponse.json({ error: 'Unable to delete account right now' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Unexpected account delete route error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
