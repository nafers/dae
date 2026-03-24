import { NextResponse } from 'next/server'
import { canUseTestSwitcher, getTestAccountEmails } from '@/lib/test-accounts'
import { getRequestUser } from '@/lib/request-user'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const targetEmail = requestUrl.searchParams.get('email')?.trim().toLowerCase() ?? ''
  const nextPath = requestUrl.searchParams.get('next')
  const safeNext = nextPath?.startsWith('/') ? nextPath : '/submit'

  const user = await getRequestUser()

  if (!user || !canUseTestSwitcher(user.email)) {
    return NextResponse.redirect(new URL('/', requestUrl.origin))
  }

  if (!targetEmail || !getTestAccountEmails().includes(targetEmail)) {
    return NextResponse.redirect(new URL(safeNext, requestUrl.origin))
  }

  if (user.email?.trim().toLowerCase() === targetEmail) {
    return NextResponse.redirect(new URL(safeNext, requestUrl.origin))
  }

  const admin = createAdminClient()
  const redirectTo = new URL('/auth/callback', requestUrl.origin)
  if (safeNext !== '/submit') {
    redirectTo.searchParams.set('next', safeNext)
  }

  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: targetEmail,
    options: {
      redirectTo: redirectTo.toString(),
    },
  })

  const hashedToken = data?.properties?.hashed_token
  const verificationType = data?.properties?.verification_type

  if (error || !hashedToken || !verificationType) {
    console.error('test_switch_generate_link_failed', {
      currentUserId: user.id,
      currentEmail: user.email ?? null,
      targetEmail,
      errorMessage: error?.message,
    })

    return NextResponse.redirect(new URL(safeNext, requestUrl.origin))
  }

  const callbackUrl = new URL('/auth/callback', requestUrl.origin)
  callbackUrl.searchParams.set('token_hash', hashedToken)
  callbackUrl.searchParams.set('type', verificationType)
  if (safeNext !== '/submit') {
    callbackUrl.searchParams.set('next', safeNext)
  }

  return NextResponse.redirect(callbackUrl, 303)
}
