import Link from 'next/link'
import { redirect } from 'next/navigation'
import AppShell from '@/components/AppShell'
import BrowseTopics from '@/components/BrowseTopics'
import { isFounderEmail } from '@/lib/founders'
import { createClient } from '@/lib/supabase/server'
import { fetchCachedBrowseTopics } from '@/lib/browse-directory'

interface WaitingDaeOption {
  id: string
}

export default async function BrowsePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/')

  const [{ data: waitingDaes }, browseTopics] = await Promise.all([
    supabase
      .from('daes')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'unmatched')
      .order('created_at', { ascending: false }),
    fetchCachedBrowseTopics(),
  ])

  const typedWaitingDaes = (waitingDaes ?? []) as WaitingDaeOption[]

  return (
    <AppShell
      activeTab="browse"
      userEmail={user.email ?? ''}
      eyebrow="Browse"
      title="Browse ideas"
      description={
        typedWaitingDaes.length > 0 ? 'Search ideas. Review to attach yours.' : 'Search the pool.'
      }
      actions={
        isFounderEmail(user.email) ? (
          <Link
            href="/metrics"
            className="rounded-full border border-[var(--dae-line)] bg-[var(--dae-surface-strong)] px-3 py-1.5 text-xs font-medium text-[var(--dae-muted)] shadow-sm hover:border-[var(--dae-muted)] hover:text-[var(--dae-ink)]"
          >
            Metrics
          </Link>
        ) : undefined
      }
    >
      {browseTopics.length === 0 ? (
        <div className="rounded-[28px] border border-[var(--dae-line)] bg-[var(--dae-surface-strong)] p-8 text-center shadow-[0_14px_36px_rgba(32,26,22,0.05)]">
          <h2 className="text-2xl font-semibold text-[var(--dae-ink)]">Nothing to browse yet.</h2>
        </div>
      ) : (
        <BrowseTopics topics={browseTopics} waitingCount={typedWaitingDaes.length} />
      )}
    </AppShell>
  )
}
