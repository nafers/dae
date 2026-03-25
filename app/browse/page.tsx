import Link from 'next/link'
import { redirect } from 'next/navigation'
import AppShell from '@/components/AppShell'
import BrowseTopics from '@/components/BrowseTopics'
import { fetchTopicSignalSummaries } from '@/lib/quality-signals'
import { getRequestUser } from '@/lib/request-user'
import { createAdminClient } from '@/lib/supabase/server'
import { fetchTopicRegistry } from '@/lib/topic-registry'

interface Props {
  searchParams: Promise<{
    q?: string | string[]
  }>
}

export default async function BrowsePage({ searchParams }: Props) {
  const { q } = await searchParams
  const initialQuery = Array.isArray(q) ? q[0] ?? '' : q ?? ''
  const user = await getRequestUser()

  if (!user) redirect('/')

  const admin = createAdminClient()
  const [{ count: waitingCount }, topicRegistry] = await Promise.all([
    admin
      .from('daes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'unmatched'),
    fetchTopicRegistry(user.id),
  ])
  const browseTopics = topicRegistry.items
  const topicSignalSummaries = await fetchTopicSignalSummaries({
    topicKeys: browseTopics.map((topic) => topic.topicKey),
    currentUserId: user.id,
  })

  return (
    <AppShell
      activeTab="browse"
      userEmail={user.email ?? ''}
      eyebrow="Browse"
      title="Browse ideas"
      description={
        (waitingCount ?? 0) > 0
          ? `Search ideas. ${topicRegistry.followed.length} following. Review to attach yours.`
          : `Search the pool. ${topicRegistry.followed.length} following.`
      }
      actions={
        <Link
          href="/topics"
          className="rounded-full border border-[var(--dae-line)] bg-[var(--dae-surface-strong)] px-3 py-1.5 text-xs font-medium text-[var(--dae-muted)] shadow-sm hover:border-[var(--dae-muted)] hover:text-[var(--dae-ink)]"
        >
          Topics
        </Link>
      }
    >
      {browseTopics.length === 0 ? (
        <div className="rounded-[28px] border border-[var(--dae-line)] bg-[var(--dae-surface-strong)] p-8 text-center shadow-[0_14px_36px_rgba(32,26,22,0.05)]">
          <h2 className="text-2xl font-semibold text-[var(--dae-ink)]">Nothing to browse yet.</h2>
        </div>
      ) : (
        <BrowseTopics
          topics={browseTopics}
          waitingCount={waitingCount ?? 0}
          initialQuery={initialQuery}
          followedTopicKeys={topicRegistry.followed.map((topic) => topic.topicKey)}
          signalSummaries={Object.fromEntries(topicSignalSummaries.entries())}
        />
      )}
    </AppShell>
  )
}
