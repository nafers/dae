import AuthGate from '@/components/AuthGate'
import { redirect } from 'next/navigation'

interface Props {
  searchParams: Promise<{
    code?: string | string[]
    error?: string | string[]
    next?: string | string[]
  }>
}

export default async function Home({ searchParams }: Props) {
  const { code, error, next } = await searchParams
  const authCode = Array.isArray(code) ? code[0] : code
  const authError = Array.isArray(error) ? error[0] : error
  const nextPath = Array.isArray(next) ? next[0] : next

  if (authCode) {
    const callbackParams = new URLSearchParams({ code: authCode })
    if (nextPath?.startsWith('/')) {
      callbackParams.set('next', nextPath)
    }
    redirect(`/auth/callback?${callbackParams.toString()}`)
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--dae-accent)]">
            DAE
          </p>
          <h1 className="mt-3 text-5xl font-semibold tracking-tight text-[var(--dae-ink)]">
            Does Anyone Else?
          </h1>
          <p className="mt-3 text-sm text-[var(--dae-muted)]">
            Sign in. Submit. Match. Chat.
          </p>
        </div>

        <div className="rounded-[32px] border border-[var(--dae-line)] bg-[var(--dae-surface-strong)] p-6 shadow-[0_18px_40px_rgba(32,26,22,0.06)]">
          <AuthGate nextPath={nextPath} authError={authError} />
        </div>
      </div>
    </main>
  )
}
