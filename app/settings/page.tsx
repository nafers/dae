import Link from 'next/link'
import { redirect } from 'next/navigation'
import AppShell from '@/components/AppShell'
import SettingsPanel from '@/components/SettingsPanel'
import { isFounderEmail } from '@/lib/founders'
import { getRequestUser } from '@/lib/request-user'
import { fetchUserPreferences } from '@/lib/user-preferences'

export default async function SettingsPage() {
  const user = await getRequestUser()
  if (!user) redirect('/')

  const preferences = await fetchUserPreferences(user.id)

  return (
    <AppShell
      activeTab="settings"
      userEmail={user.email ?? ''}
      eyebrow="Settings"
      title="Privacy and notifications"
      description="Control your emails and see how anonymity works in DAE."
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
      <SettingsPanel userEmail={user.email ?? ''} initialPreferences={preferences} />
    </AppShell>
  )
}
