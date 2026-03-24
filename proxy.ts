import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import {
  PROXY_AUTHENTICATED_HEADER,
  PROXY_USER_EMAIL_HEADER,
  PROXY_USER_ID_HEADER,
} from '@/lib/auth-headers'

export async function proxy(request: NextRequest) {
  const canonicalUrl = process.env.NEXT_PUBLIC_APP_URL
  const requestHeaders = new Headers(request.headers)

  if (canonicalUrl) {
    const canonical = new URL(canonicalUrl)
    const currentHost = request.nextUrl.host

    if (
      currentHost !== canonical.host &&
      currentHost.endsWith('.vercel.app')
    ) {
      const redirectUrl = new URL(
        request.nextUrl.pathname + request.nextUrl.search,
        canonicalUrl
      )
      return NextResponse.redirect(redirectUrl, 308)
    }
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // Refresh the session so server-rendered pages see the latest auth cookies.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    requestHeaders.set(PROXY_AUTHENTICATED_HEADER, '1')
    requestHeaders.set(PROXY_USER_ID_HEADER, user.id)
    requestHeaders.set(PROXY_USER_EMAIL_HEADER, user.email ?? '')
  } else {
    requestHeaders.set(PROXY_AUTHENTICATED_HEADER, '0')
    requestHeaders.delete(PROXY_USER_ID_HEADER)
    requestHeaders.delete(PROXY_USER_EMAIL_HEADER)
  }

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })

  for (const cookie of supabaseResponse.cookies.getAll()) {
    response.cookies.set(cookie)
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
