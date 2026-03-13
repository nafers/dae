import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SubmitForm from '@/components/SubmitForm'
import Link from 'next/link'

export default async function SubmitPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/')

  // Check if user already has an unmatched DAE
  const { data: existingDae } = await supabase
    .from('daes')
    .select('id, text, status')
    .eq('user_id', user.id)
    .eq('status', 'unmatched')
    .single()

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-16 bg-stone-50">
      <div className="w-full max-w-md">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-stone-900">Does anyone else…</h1>
          <Link
            href="/threads"
            className="text-sm text-stone-500 hover:text-stone-800 transition-colors"
          >
            My matches →
          </Link>
        </div>

        {existingDae ? (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
              <p className="text-sm font-medium text-amber-700 mb-1">⏳ Waiting for a match</p>
              <p className="text-stone-700">
                "Does anyone else {existingDae.text}"
              </p>
            </div>
            <p className="text-sm text-stone-400 text-center">
              You'll get an email the moment someone matches with you.
              Hang tight — it could be minutes or days.
            </p>
          </div>
        ) : (
          <SubmitForm />
        )}
      </div>
    </main>
  )
}
