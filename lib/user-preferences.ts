import { createAdminClient } from '@/lib/supabase/server'

export interface UserPreferences {
  matchEmails: boolean
  replyEmails: boolean
}

interface UserPreferencesRow {
  user_id: string
  match_emails: boolean | null
  reply_emails: boolean | null
}

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  matchEmails: true,
  replyEmails: true,
}

export function normalizeUserPreferences(
  row: Pick<UserPreferencesRow, 'match_emails' | 'reply_emails'> | null | undefined
): UserPreferences {
  return {
    matchEmails: row?.match_emails ?? DEFAULT_USER_PREFERENCES.matchEmails,
    replyEmails: row?.reply_emails ?? DEFAULT_USER_PREFERENCES.replyEmails,
  }
}

export async function fetchUserPreferencesMap(userIds: string[]) {
  const uniqueUserIds = [...new Set(userIds.filter(Boolean))]
  const preferenceMap = new Map<string, UserPreferences>()

  if (uniqueUserIds.length === 0) {
    return preferenceMap
  }

  const admin = createAdminClient()
  const { data } = await admin
    .from('user_preferences')
    .select('user_id, match_emails, reply_emails')
    .in('user_id', uniqueUserIds)

  for (const row of (data ?? []) as UserPreferencesRow[]) {
    preferenceMap.set(row.user_id, normalizeUserPreferences(row))
  }

  return preferenceMap
}

export async function fetchUserPreferences(userId: string) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('user_preferences')
    .select('match_emails, reply_emails')
    .eq('user_id', userId)
    .maybeSingle()

  return normalizeUserPreferences(data)
}
