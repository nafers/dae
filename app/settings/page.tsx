import Link from 'next/link'
import { redirect } from 'next/navigation'
import AppShell from '@/components/AppShell'
import SettingsPanel from '@/components/SettingsPanel'
import { fetchActiveBlocks } from '@/lib/blocks'
import { getRequestUser } from '@/lib/request-user'
import { fetchUserPreferences } from '@/lib/user-preferences'

export default async function SettingsPage() {
  const user = await getRequestUser()
  if (!user) redirect('/')

  const [preferences, activeBlocks] = await Promise.all([
    fetchUserPreferences(user.id),
    fetchActiveBlocks(user.id),
  ])

  return (
    <AppShell
      activeTab="settings"
      userEmail={user.email ?? ''}
      eyebrow="Settings"
      title="Privacy and notifications"
      description="Control your emails and see how anonymity works in DAE."
    >
      <SettingsPanel
        userEmail={user.email ?? ''}
        initialPreferences={preferences}
        initialBlockedUsers={activeBlocks.map((block) => ({
          userId: block.targetUserId,
          handle: block.targetHandle ?? `User ${block.targetUserId.slice(0, 8)}`,
          matchId: block.matchId,
          createdAt: block.createdAt,
        }))}
      />
    </AppShell>
  )
}
