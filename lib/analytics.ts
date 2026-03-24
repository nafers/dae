import { createAdminClient } from '@/lib/supabase/server'

interface AnalyticsEventInput {
  eventName: string
  userId?: string | null
  matchId?: string | null
  daeId?: string | null
  metadata?: Record<string, unknown> | null
}

let hasWarnedMissingAnalyticsTable = false

function isMissingAnalyticsTableError(error: { code?: string; message?: string } | null) {
  if (!error) return false

  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    error.message?.includes('analytics_events') === true
  )
}

export async function trackAnalyticsEvent(event: AnalyticsEventInput) {
  await trackAnalyticsEvents([event])
}

export async function trackAnalyticsEvents(events: AnalyticsEventInput[]) {
  if (events.length === 0) return

  try {
    const admin = createAdminClient()
    const { error } = await admin.from('analytics_events').insert(
      events.map((event) => ({
        event_name: event.eventName,
        user_id: event.userId ?? null,
        match_id: event.matchId ?? null,
        dae_id: event.daeId ?? null,
        metadata: event.metadata ?? {},
      }))
    )

    if (!error) return

    if (isMissingAnalyticsTableError(error)) {
      if (!hasWarnedMissingAnalyticsTable) {
        console.warn(
          'analytics_events table is missing. Run supabase-analytics.sql to enable friend-test instrumentation.'
        )
        hasWarnedMissingAnalyticsTable = true
      }
      return
    }

    console.error('Analytics event insert error:', {
      code: error.code,
      message: error.message,
      eventNames: events.map((event) => event.eventName),
    })
  } catch (error) {
    console.error('Unexpected analytics event error:', error)
  }
}
