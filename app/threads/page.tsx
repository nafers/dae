import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function ThreadsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/')

  // Get all threads this user is part of
  const { data: participants } = await supabase
    .from('thread_participants')
    .select(`
      match_id,
      handle,
      dae_id,
      daes ( text ),
      matches ( created_at )
    `)
    .eq('user_id', user.id)
    .order('created_at', { referencedTable: 'matches', ascending: false })

  return (
    <main className="min-h-screen bg-stone-50 px-4 py-12">
      <div className="w-full max-w-md mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-stone-900">My Matches</h1>
          <Link
            href="/submit"
            className="text-sm text-stone-500 hover:text-stone-800 transition-colors"
          >
            ← Submit a DAE
          </Link>
        </div>

        {!participants || participants.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-4">🔍</div>
            <h2 className="text-lg font-medium text-stone-700 mb-2">No matches yet</h2>
            <p className="text-stone-400 text-sm mb-6">
              Submit a DAE and we'll email you when someone matches.
            </p>
            <Link
              href="/submit"
              className="inline-block py-3 px-6 bg-stone-900 text-white rounded-xl font-medium hover:bg-stone-700 transition-colors"
            >
              Submit a DAE →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {participants.map((p) => {
              const daeText = (p.daes as any)?.text ?? ''
              const createdAt = (p.matches as any)?.created_at
              const date = createdAt ? new Date(createdAt).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric'
              }) : ''

              return (
                <Link
                  key={p.match_id}
                  href={`/threads/${p.match_id}`}
                  className="block bg-white rounded-2xl border border-stone-200 p-5 hover:border-stone-400 transition-colors"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-medium text-stone-400">You are {p.handle}</span>
                    <span className="text-xs text-stone-300">{date}</span>
                  </div>
                  <p className="text-stone-700 text-sm leading-relaxed line-clamp-2">
                    "Does anyone else {daeText}"
                  </p>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
