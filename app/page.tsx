import AuthGate from '@/components/AuthGate'

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-16 bg-stone-50">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold tracking-tight text-stone-900 mb-3">
            Does Anyone Else…
          </h1>
          <p className="text-stone-500 text-lg leading-relaxed">
            Submit something you've always wondered about yourself.
            Find out you're not alone — and talk to the one person who gets it.
          </p>
        </div>

        {/* How it works */}
        <div className="bg-white rounded-2xl border border-stone-200 p-6 mb-8 space-y-4">
          <div className="flex gap-3 items-start">
            <span className="text-2xl">✍️</span>
            <div>
              <p className="font-medium text-stone-800">Submit a DAE</p>
              <p className="text-stone-500 text-sm">Something you do, think, or feel that you've wondered about</p>
            </div>
          </div>
          <div className="flex gap-3 items-start">
            <span className="text-2xl">🔍</span>
            <div>
              <p className="font-medium text-stone-800">We find your match</p>
              <p className="text-stone-500 text-sm">AI matches you with someone who submitted something similar</p>
            </div>
          </div>
          <div className="flex gap-3 items-start">
            <span className="text-2xl">💬</span>
            <div>
              <p className="font-medium text-stone-800">Talk anonymously</p>
              <p className="text-stone-500 text-sm">Chat with your match — no names, just curiosity</p>
            </div>
          </div>
        </div>

        <AuthGate />
      </div>
    </main>
  )
}
