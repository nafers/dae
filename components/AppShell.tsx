import Link from 'next/link'
import TestAccountSwitcher from '@/components/TestAccountSwitcher'
import { canUseTestSwitcher, getTestAccountEmails } from '@/lib/test-accounts'

type AppTab = 'submit' | 'review' | 'threads' | 'browse'

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
  { key: 'submit', href: '/submit', label: 'Submit' },
  { key: 'review', href: '/review', label: 'Review' },
  { key: 'threads', href: '/threads', label: 'Chats' },
  { key: 'browse', href: '/browse', label: 'Browse' },
]

const tabStyles: Record<AppTab, { active: string; accent: string }> = {
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
  const testAccountEmails = canUseTestSwitcher(userEmail) ? getTestAccountEmails() : []

  return (
    <main className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-[var(--dae-line)] bg-[rgba(255,250,244,0.86)] backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/submit"
                className="rounded-full border border-[var(--dae-line)] bg-[var(--dae-surface-strong)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--dae-ink)] shadow-sm"
              >
                DAE
              </Link>
              <p className="text-sm text-[var(--dae-muted)]">Does Anyone Else?</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {testAccountEmails.length > 1 ? (
                <TestAccountSwitcher userEmail={userEmail} testAccountEmails={testAccountEmails} />
              ) : null}
              {actions}
              <span className="max-w-[240px] truncate rounded-full border border-[var(--dae-line)] bg-[var(--dae-surface-strong)] px-3 py-1.5 text-xs font-medium text-[var(--dae-muted)] shadow-sm">
                {userEmail}
              </span>
            </div>
          </div>

          <nav className="grid grid-cols-4 gap-2">
            {tabs.map((tab) => {
              const isActive = tab.key === activeTab

              return (
                <Link
                  key={tab.key}
                  href={tab.href}
                  className={`rounded-2xl px-3 py-2.5 text-center text-sm font-medium transition-all ${
                    isActive
                      ? theme.active
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

      <section className={`mx-auto w-full max-w-6xl px-4 ${compact ? 'py-5 md:py-6' : 'py-6 md:py-8'}`}>
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
    </main>
  )
}
