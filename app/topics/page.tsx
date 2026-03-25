import Link from 'next/link'
import { redirect } from 'next/navigation'
import AppShell from '@/components/AppShell'
import FollowTopicButton from '@/components/FollowTopicButton'
import ShareButton from '@/components/ShareButton'
import { getRequestUser } from '@/lib/request-user'
import { fetchTopicRegistry } from '@/lib/topic-registry'

function TopicStrip({
  title,
  description,
  topics,
}: {
  title: string
  description: string
  topics: Awaited<ReturnType<typeof fetchTopicRegistry>>['items']
}) {
  if (topics.length === 0) {
    return null
  }

  return (
    <section className="rounded-[28px] border border-[var(--dae-line)] bg-[var(--dae-surface-strong)] p-5 shadow-[0_14px_36px_rgba(32,26,22,0.05)]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--dae-accent-rose)]">
            {title}
          </p>
          <p className="mt-1 text-sm text-[var(--dae-muted)]">{description}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {topics.map((topic) => (
          <article
            key={topic.topicKey}
            className="rounded-[24px] border border-[var(--dae-line)] bg-[var(--dae-surface)] p-4"
          >
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-[var(--dae-accent-rose-soft)] px-3 py-1 text-xs font-medium text-[var(--dae-accent-rose)]">
                {topic.label}
              </span>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-[var(--dae-muted)]">
                {topic.daeCount} ideas
              </span>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-[var(--dae-muted)]">
                {topic.uniqueUserCount} people
              </span>
            </div>
            <h2 className="mt-3 text-lg font-semibold text-[var(--dae-ink)]">{topic.headline}</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--dae-muted)]">{topic.summary}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href={`/topics/${encodeURIComponent(topic.topicKey)}`}
                className="rounded-full border border-[var(--dae-accent-cool)] bg-[var(--dae-accent-cool-soft)] px-4 py-2 text-sm font-medium text-[var(--dae-accent-cool)] hover:opacity-95"
              >
                Open topic
              </Link>
              <FollowTopicButton
                topicKey={topic.topicKey}
                headline={topic.headline}
                label={topic.label}
                searchQuery={topic.searchQuery}
                initialFollowing={topic.isFollowed}
              />
              <ShareButton
                path={`/topics/${encodeURIComponent(topic.topicKey)}`}
                title={`DAE topic: ${topic.label}`}
                text={topic.summary}
                label="Share"
              />
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

export default async function TopicsPage() {
  const user = await getRequestUser()

  if (!user) {
    redirect('/?next=/topics')
  }

  const registry = await fetchTopicRegistry(user.id)

  return (
    <AppShell
      activeTab="browse"
      userEmail={user.email ?? ''}
      eyebrow="Topics"
      title="Topic hubs"
      description="Stable places to track what keeps coming up, follow it, and jump into the right room."
    >
      <div className="space-y-5">
        <TopicStrip
          title="Following"
          description="Topics you already said matter to you."
          topics={registry.followed}
        />
        <TopicStrip
          title="Rising"
          description="The strongest signals across the current DAE pool."
          topics={registry.rising}
        />
        <TopicStrip
          title="Fresh"
          description="Newer ideas getting traction right now."
          topics={registry.fresh}
        />
      </div>
    </AppShell>
  )
}
