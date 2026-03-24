import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { trackAnalyticsEvent } from '@/lib/analytics'

const EMAIL_OTP_TYPES = ['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email'] as const

type EmailOtpType = (typeof EMAIL_OTP_TYPES)[number]

function isEmailOtpType(value: string | null): value is EmailOtpType {
  return value !== null && EMAIL_OTP_TYPES.includes(value as EmailOtpType)
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const tokenHash = requestUrl.searchParams.get('token_hash')
  const type = requestUrl.searchParams.get('type')
  const nextPath = requestUrl.searchParams.get('next')
  const safeNext = nextPath?.startsWith('/') ? nextPath : '/submit'

  if (code || (tokenHash && isEmailOtpType(type))) {
    const cookieStore = await cookies()
    const response = NextResponse.redirect(new URL(safeNext, requestUrl.origin))
    const allCookies = cookieStore.getAll().map(({ name, value }) => ({ name, value }))
    const cookieNames = allCookies.map((cookie) => cookie.name)

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return allCookies
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              const existingCookie = allCookies.find((cookie) => cookie.name === name)
              if (existingCookie) {
                existingCookie.value = value
              } else {
                allCookies.push({ name, value })
              }

              response.cookies.set(name, value, options)
            })
          },
        },
      }
    )

    const authResult = code
      ? await supabase.auth.exchangeCodeForSession(code)
      : await supabase.auth.verifyOtp({
          token_hash: tokenHash as string,
          type: type as EmailOtpType,
        })

    const { error } = authResult
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      await trackAnalyticsEvent({
        eventName: 'auth_completed',
        userId: user?.id ?? null,
        metadata: {
          nextPath: safeNext,
        },
      })

      console.log('auth_callback_success', {
        hasCode: Boolean(code),
        hasTokenHash: Boolean(tokenHash),
        type: type ?? null,
        next: safeNext,
        cookieNames,
      })
      return response
    }

    console.error('auth_callback_exchange_failed', {
      hasCode: Boolean(code),
      hasTokenHash: Boolean(tokenHash),
      type: type ?? null,
      next: safeNext,
      cookieNames,
      errorMessage: error.message,
      errorStatus: 'status' in error ? error.status : undefined,
      errorCode: 'code' in error ? error.code : undefined,
    })
  }

  return NextResponse.redirect(new URL('/?error=auth', requestUrl.origin))
}
