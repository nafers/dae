import Link from 'next/link'
import ActivityNav from '@/components/ActivityNav'
import TestAccountSwitcher from '@/components/TestAccountSwitcher'
import { isFounderEmail } from '@/lib/founders'
import { canUseTestSwitcher, getTestAccountEmails } from '@/lib/test-accounts'

type AppTab =
  | 'now'
  | 'submit'
  | 'review'
  | 'threads'
  | 'browse'
  | 'activity'
  | 'settings'
  | 'moderation'

interface Props {
  activeTab: AppTab
  userEmail: string
  eyebrow?: string
  title: string
  description?: string
  children: React.ReactNode
  actions?: React.ReactNode
  compact?: boolean
}

const tabs: Array<{ key: AppTab; href: string; label: string }> = [
  { key: 'now', href: '/now', label: 'Now' },
  { key: 'submit', href: '/submit', label: 'Submit' },
  { key: 'review', href: '/place', label: 'Place' },
  { key: 'threads', href: '/threads', label: 'Chats' },
  { key: 'browse', href: '/topics', label: 'Topics' },
]

const mobileTabs: Array<{ key: AppTab; href: string; label: string }> = [
  ...tabs,
  { key: 'activity', href: '/activity', label: 'Inbox' },
]

const tabStyles: Record<AppTab, { active: string; accent: string }> = {
  now: {
    active:
      'border border-[var(--dae-accent)] bg-[var(--dae-accent-soft)] text-[var(--dae-accent)] shadow-[0_10px_24px_rgba(20,108,103,0.12)]',
    accent: 'text-[var(--dae-accent)]',
  },
  submit: {
    active:
      'border border-[var(--dae-accent)] bg-[var(--dae-accent-soft)] text-[var(--dae-accent)] shadow-[0_10px_24px_rgba(20,108,103,0.12)]',
    accent: 'text-[var(--dae-accent)]',
  },
  review: {
    active:
      'border border-[var(--dae-accent-warm)] bg-[var(--dae-accent-warm-soft)] text-[var(--dae-accent-warm)] shadow-[0_10px_24px_rgba(232,141,43,0.12)]',
    accent: 'text-[var(--dae-accent-warm)]',
  },
  threads: {
    active:
      'border border-[var(--dae-accent-cool)] bg-[var(--dae-accent-cool-soft)] text-[var(--dae-accent-cool)] shadow-[0_10px_24px_rgba(37,99,235,0.12)]',
    accent: 'text-[var(--dae-accent-cool)]',
  },
  browse: {
    active:
      'border border-[var(--dae-accent-rose)] bg-[var(--dae-accent-rose-soft)] text-[var(--dae-accent-rose)] shadow-[0_10px_24px_rgba(200,88,99,0.12)]',
    accent: 'text-[var(--dae-accent-rose)]',
  },
  activity: {
    active:
      'border border-[var(--dae-accent-cool)] bg-[var(--dae-accent-cool-soft)] text-[var(--dae-accent-cool)] shadow-[0_10px_24px_rgba(37,99,235,0.12)]',
    accent: 'text-[var(--dae-accent-cool)]',
  },
  settings: {
    active:
      'border border-[var(--dae-line)] bg-[var(--dae-surface)] text-[var(--dae-ink)] shadow-[0_10px_24px_rgba(32,26,22,0.08)]',
    accent: 'text-[var(--dae-muted)]',
  },
  moderation: {
    active:
      'border border-[var(--dae-accent-rose)] bg-[var(--dae-accent-rose-soft)] text-[var(--dae-accent-rose)] shadow-[0_10px_24px_rgba(200,88,99,0.12)]',
    accent: 'text-[var(--dae-accent-rose)]',
  },
}

export default function AppShell({
  activeTab,
  userEmail,
  eyebrow,
  title,
  description,
  children,
  actions,
  compact = false,
}: Props) {
  const theme = tabStyles[activeTab]
  const founder = isFounderEmail(userEmail)
  const accountReady = Boolean(userEmail)
  const testAccountEmails = canUseTestSwitcher(userEmail) ? getTestAccountEmails() : []

  return (
    <main className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-[var(--dae-line)] bg-[rgba(255,250,244,0.86)] backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/now"
                className="rounded-full border border-[var(--dae-line)] bg-[var(--dae-surface-strong)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--dae-ink)] shadow-sm"
              >
                DAE
              </Link>
              <p className="text-sm text-[var(--dae-muted)]">Does Anyone Else?</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {accountReady ? (
                <>
                  {testAccountEmails.length > 1 ? (
                    <TestAccountSwitcher userEmail={userEmail} testAccountEmails={testAccountEmails} />
                  ) : null}
                  <div className="hidden md:block">
                    <ActivityNav active={activeTab === 'activity'} />
                  </div>
                  {founder ? (
                    <>
                      <Link
                        href="/metrics"
                        className="rounded-full border border-[var(--dae-line)] bg-[var(--dae-surface-strong)] px-3 py-1.5 text-xs font-medium text-[var(--dae-muted)] shadow-sm hover:border-[var(--dae-muted)] hover:text-[var(--dae-ink)]"
                      >
                        Metrics
                      </Link>
                      <Link
                        href="/moderation"
                        className={`rounded-full border px-3 py-1.5 text-xs font-medium shadow-sm transition-colors ${
                          activeTab === 'moderation'
                            ? 'border-[var(--dae-accent-rose)] bg-[var(--dae-accent-rose-soft)] text-[var(--dae-accent-rose)]'
                            : 'border-[var(--dae-line)] bg-[var(--dae-surface-strong)] text-[var(--dae-muted)] hover:border-[var(--dae-muted)] hover:text-[var(--dae-ink)]'
                        }`}
                      >
                        Mod
                      </Link>
                    </>
                  ) : null}
                  <Link
                    href="/settings"
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium shadow-sm transition-colors ${
                      activeTab === 'settings'
                        ? 'border-[var(--dae-line)] bg-[var(--dae-surface)] text-[var(--dae-ink)]'
                        : 'border-[var(--dae-line)] bg-[var(--dae-surface-strong)] text-[var(--dae-muted)] hover:border-[var(--dae-muted)] hover:text-[var(--dae-ink)]'
                    }`}
                  >
                    Settings
                  </Link>
                  {actions}
                  <span className="hidden max-w-[240px] truncate rounded-full border border-[var(--dae-line)] bg-[var(--dae-surface-strong)] px-3 py-1.5 text-xs font-medium text-[var(--dae-muted)] shadow-sm sm:inline-flex">
                    {userEmail}
                  </span>
                </>
              ) : null}
            </div>
          </div>

          <nav className="hidden grid-cols-5 gap-2 md:grid">
            {tabs.map((tab) => {
              const isActive = tab.key === activeTab

              return (
                <Link
                  key={tab.key}
                  href={tab.href}
                  className={`rounded-2xl px-3 py-2.5 text-center text-sm font-medium transition-all ${
                    isActive
                      ? tabStyles[tab.key].active
                      : 'border border-[var(--dae-line)] bg-[var(--dae-surface-strong)] text-[var(--dae-muted)] hover:border-[var(--dae-muted)] hover:text-[var(--dae-ink)]'
                  }`}
                >
                  {tab.label}
                </Link>
              )
            })}
          </nav>
        </div>
      </header>

      <section
        className={`mx-auto w-full max-w-6xl px-4 ${
          compact ? 'py-5 pb-24 md:py-6 md:pb-8' : 'py-6 pb-24 md:py-8 md:pb-8'
        }`}
      >
        <div className="max-w-3xl">
          {eyebrow ? (
            <p className={`text-xs font-semibold uppercase tracking-[0.22em] ${theme.accent}`}>
              {eyebrow}
            </p>
          ) : null}
          <h1
            className={`font-semibold tracking-tight text-[var(--dae-ink)] ${
              eyebrow ? 'mt-2' : ''
            } ${compact ? 'text-2xl md:text-3xl' : 'text-3xl md:text-4xl'}`}
          >
            {title}
          </h1>
          {description ? (
            <p
              className={`mt-2 max-w-2xl text-[var(--dae-muted)] ${
                compact ? 'text-sm leading-6' : 'text-sm leading-6 md:text-base'
              }`}
            >
              {description}
            </p>
          ) : null}
        </div>

        <div className={compact ? 'mt-4' : 'mt-6'}>{children}</div>
      </section>

      {accountReady ? (
        <nav className="fixed inset-x-3 bottom-3 z-30 rounded-[28px] border border-[var(--dae-line)] bg-[rgba(255,250,244,0.96)] p-2 shadow-[0_18px_40px_rgba(32,26,22,0.12)] backdrop-blur-xl md:hidden">
          <div className="grid grid-cols-6 gap-2">
            {mobileTabs.map((tab) => {
              const isActive = tab.key === activeTab

              return (
                <Link
                  key={tab.key}
                  href={tab.href}
                  className={`rounded-2xl px-2 py-2 text-center text-[11px] font-semibold transition-all ${
                    isActive
                      ? tabStyles[tab.key].active
                      : 'border border-[var(--dae-line)] bg-[var(--dae-surface-strong)] text-[var(--dae-muted)]'
                  }`}
                >
                  {tab.label}
                </Link>
              )
            })}
          </div>
        </nav>
      ) : null}
    </main>
  )
}
