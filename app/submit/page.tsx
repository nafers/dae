import Link from 'next/link'
import { redirect } from 'next/navigation'
import AppShell from '@/components/AppShell'
import SubmitForm from '@/components/SubmitForm'
import { getRequestUser } from '@/lib/request-user'
import { createAdminClient } from '@/lib/supabase/server'

interface Props {
  searchParams: Promise<{
    draft?: string | string[]
    invite?: string | string[]
  }>
}

export default async function SubmitPage({ searchParams }: Props) {
  const { draft, invite } = await searchParams
  const initialDraft = Array.isArray(draft) ? draft[0] ?? '' : draft ?? ''
  const inviteMatchId = Array.isArray(invite) ? invite[0] ?? '' : invite ?? ''
  const user = await getRequestUser()

  if (!user) redirect('/')

  const admin = createAdminClient()
  const { count: waitingCount } = await admin
    .from('daes')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'unmatched')

  return (
    <AppShell
      activeTab="submit"
      userEmail={user.email ?? ''}
      title="Does anyone else?"
    >
      <div className="space-y-4">
        <section className="flex flex-col gap-3 rounded-[28px] border border-[var(--dae-line)] bg-[var(--dae-surface-strong)] p-4 shadow-[0_14px_36px_rgba(32,26,22,0.05)] lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[var(--dae-accent-soft)] px-3 py-1 text-sm font-medium text-[var(--dae-accent)]">
              {waitingCount ?? 0} waiting
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/review"
              className="rounded-full border border-[var(--dae-accent-warm)] bg-[var(--dae-accent-warm-soft)] px-4 py-2 text-sm font-medium text-[var(--dae-accent-warm)] hover:opacity-95"
            >
              Review
            </Link>
            <Link
              href="/threads"
              className="rounded-full border border-[var(--dae-accent-cool)] bg-[var(--dae-accent-cool-soft)] px-4 py-2 text-sm font-medium text-[var(--dae-accent-cool)] hover:opacity-95"
            >
              Chats
            </Link>
            <Link
              href="/browse"
              className="rounded-full border border-[var(--dae-accent-rose)] bg-[var(--dae-accent-rose-soft)] px-4 py-2 text-sm font-medium text-[var(--dae-accent-rose)] hover:opacity-95"
            >
              Browse
            </Link>
            <Link
              href="/topics"
              className="rounded-full border border-[var(--dae-line)] bg-white px-4 py-2 text-sm font-medium text-[var(--dae-ink)] hover:border-[var(--dae-muted)]"
            >
              Topics
            </Link>
          </div>
        </section>

        <SubmitForm initialText={initialDraft} initialInviteMatchId={inviteMatchId} />
      </div>
    </AppShell>
  )
}
