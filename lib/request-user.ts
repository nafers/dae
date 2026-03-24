import { headers } from 'next/headers'
import {
  PROXY_AUTHENTICATED_HEADER,
  PROXY_USER_EMAIL_HEADER,
  PROXY_USER_ID_HEADER,
} from '@/lib/auth-headers'
import { createClient } from '@/lib/supabase/server'

export interface RequestUser {
  id: string
  email: string | null
}

export async function getRequestUser(): Promise<RequestUser | null> {
  const headerStore = await headers()
  const isAuthenticated = headerStore.get(PROXY_AUTHENTICATED_HEADER) === '1'
  const proxiedUserId = headerStore.get(PROXY_USER_ID_HEADER)

  if (isAuthenticated && proxiedUserId) {
    return {
      id: proxiedUserId,
      email: headerStore.get(PROXY_USER_EMAIL_HEADER),
    }
  }

  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return null
  }

  return {
    id: user.id,
    email: user.email ?? null,
  }
}
