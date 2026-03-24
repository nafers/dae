import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  const canonicalUrl = process.env.NEXT_PUBLIC_APP_URL

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
  await supabase.auth.getUser()

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
