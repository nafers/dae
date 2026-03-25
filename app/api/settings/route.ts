import { NextResponse } from 'next/server'
import { getRequestUser } from '@/lib/request-user'
import { createAdminClient } from '@/lib/supabase/server'
import { fetchUserPreferences, normalizeUserPreferences } from '@/lib/user-preferences'

export async function GET() {
  try {
    const user = await getRequestUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const preferences = await fetchUserPreferences(user.id)
    return NextResponse.json({ ok: true, preferences })
  } catch (error) {
    console.error('Unexpected settings GET route error:', error)
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
    const preferences = normalizeUserPreferences({
      match_emails: payload?.matchEmails,
      reply_emails: payload?.replyEmails,
    })

    const admin = createAdminClient()
    const { error } = await admin.from('user_preferences').upsert(
      {
        user_id: user.id,
        match_emails: preferences.matchEmails,
        reply_emails: preferences.replyEmails,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id',
      }
    )

    if (error) {
      console.error('Settings update error:', error)
      return NextResponse.json({ error: 'Unable to update preferences' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, preferences })
  } catch (error) {
    console.error('Unexpected settings POST route error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
