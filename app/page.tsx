import AuthGate from '@/components/AuthGate'
import { fetchEntryPreview } from '@/lib/entry-preview'
import { getRequestUser } from '@/lib/request-user'
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
  const safeNext = nextPath?.startsWith('/') ? nextPath : '/submit'

  if (authCode) {
    const callbackParams = new URLSearchParams({ code: authCode })
    if (nextPath?.startsWith('/')) {
      callbackParams.set('next', nextPath)
    }
    redirect(`/auth/callback?${callbackParams.toString()}`)
  }

  const user = await getRequestUser()
  if (user) {
    redirect(safeNext)
  }
  const entryPreview = nextPath?.startsWith('/') ? await fetchEntryPreview(nextPath) : null

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
          {entryPreview ? (
            <div className="mb-5 rounded-[24px] bg-[var(--dae-surface)] px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--dae-accent-cool)]">
                {entryPreview.eyebrow}
              </p>
              <h2 className="mt-2 text-lg font-semibold text-[var(--dae-ink)]">{entryPreview.title}</h2>
              <p className="mt-1 text-sm leading-6 text-[var(--dae-muted)]">{entryPreview.detail}</p>
            </div>
          ) : null}
          <AuthGate nextPath={safeNext} authError={authError} />
        </div>
      </div>
    </main>
  )
}
