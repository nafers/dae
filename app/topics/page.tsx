import { redirect } from 'next/navigation'
import AppShell from '@/components/AppShell'
import TopicCatalog from '@/components/TopicCatalog'
import { getRequestUser } from '@/lib/request-user'
import { createAdminClient } from '@/lib/supabase/server'
import { fetchTopicRegistry } from '@/lib/topic-registry'

interface Props {
  searchParams: Promise<{
    q?: string | string[]
  }>
}

export default async function TopicsPage({ searchParams }: Props) {
  const { q } = await searchParams
  const initialQuery = Array.isArray(q) ? q[0] ?? '' : q ?? ''
  const user = await getRequestUser()

  if (!user) {
    redirect('/?next=/topics')
  }

  const admin = createAdminClient()
  const [registry, { count: waitingCount }] = await Promise.all([
    fetchTopicRegistry(user.id),
    admin
      .from('daes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'unmatched'),
  ])

  return (
    <AppShell
      activeTab="browse"
      userEmail={user.email ?? ''}
      eyebrow="Topics"
      title="Topic hubs"
      description="The stable idea layer in DAE. Follow what keeps coming up, search it, and move into the right room from there."
    >
      <TopicCatalog topics={registry.items} waitingCount={waitingCount ?? 0} initialQuery={initialQuery} />
    </AppShell>
  )
}
