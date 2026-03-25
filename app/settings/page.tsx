import Link from 'next/link'
import { redirect } from 'next/navigation'
import AppShell from '@/components/AppShell'
import SettingsPanel from '@/components/SettingsPanel'
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
    >
      <SettingsPanel userEmail={user.email ?? ''} initialPreferences={preferences} />
    </AppShell>
  )
}
