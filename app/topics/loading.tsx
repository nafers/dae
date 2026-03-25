export default function TopicsLoading() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-8">
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-48 rounded-full bg-stone-200" />
        <div className="h-5 w-96 max-w-full rounded-full bg-stone-100" />
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="rounded-[28px] border border-stone-200 bg-white p-5">
              <div className="h-4 w-20 rounded-full bg-stone-100" />
              <div className="mt-4 h-6 w-2/3 rounded-full bg-stone-200" />
              <div className="mt-3 h-4 w-full rounded-full bg-stone-100" />
              <div className="mt-2 h-4 w-5/6 rounded-full bg-stone-100" />
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
