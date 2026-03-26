import { NextResponse } from 'next/server'
import { trackAnalyticsEvent } from '@/lib/analytics'
import { isFounderEmail } from '@/lib/founders'
import { getRequestUser } from '@/lib/request-user'
import { createAdminClient } from '@/lib/supabase/server'
import { isMissingRelationError } from '@/lib/supabase-fallback'

function sanitizeAction(value: unknown) {
  if (
    value === 'hide' ||
    value === 'unhide' ||
    value === 'pin' ||
    value === 'unpin' ||
    value === 'set_alias' ||
    value === 'clear_alias'
  ) {
    return value
  }

  return null
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
    const topicKey = typeof payload?.topicKey === 'string' ? payload.topicKey : ''
    const action = sanitizeAction(payload?.action)
    const targetTopicKey =
      typeof payload?.targetTopicKey === 'string' ? payload.targetTopicKey : null

    if (!topicKey || !action) {
      return NextResponse.json({ error: 'Missing topic details' }, { status: 400 })
    }

    const eventName =
      action === 'hide'
        ? 'topic_hidden'
        : action === 'unhide'
          ? 'topic_unhidden'
          : action === 'pin'
            ? 'topic_pinned'
            : action === 'unpin'
              ? 'topic_unpinned'
              : action === 'set_alias'
                ? 'topic_alias_set'
                : 'topic_alias_cleared'

    if (action === 'set_alias' && (!targetTopicKey || targetTopicKey === topicKey)) {
      return NextResponse.json({ error: 'Choose a different target topic' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { error: upsertError } = await admin.from('topic_registry_state').upsert(
      {
        topic_key: topicKey,
        hidden: action === 'hide' ? true : action === 'unhide' ? false : undefined,
        pinned: action === 'pin' ? true : action === 'unpin' ? false : undefined,
        alias_target_key:
          action === 'set_alias'
            ? targetTopicKey
            : action === 'clear_alias'
              ? null
              : undefined,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'topic_key',
      }
    )

    if (upsertError && !isMissingRelationError(upsertError)) {
      console.error('Topic curation upsert error:', upsertError)
      return NextResponse.json({ error: 'Unable to update topic state' }, { status: 500 })
    }

    await trackAnalyticsEvent({
      eventName,
      userId: user.id,
      metadata: {
        topicKey,
        sourceTopicKey: topicKey,
        targetTopicKey,
      },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Unexpected topic curation route error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
