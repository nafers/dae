interface Props {
  title?: string
  blocks?: number
}

export default function PageSkeleton({ title = 'Loading', blocks = 3 }: Props) {
  return (
    <main className="min-h-screen">
      <span className="sr-only">{title}</span>
      <header className="sticky top-0 z-30 border-b border-[var(--dae-line)] bg-[rgba(255,250,244,0.88)] backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="h-9 w-28 animate-pulse rounded-full bg-[var(--dae-surface)]" />
            <div className="h-8 w-40 animate-pulse rounded-full bg-[var(--dae-surface)]" />
          </div>
          <div className="grid grid-cols-4 gap-2 md:grid-cols-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className="h-11 animate-pulse rounded-2xl border border-[var(--dae-line)] bg-[var(--dae-surface)]"
              />
            ))}
          </div>
        </div>
      </header>

      <section className="mx-auto w-full max-w-6xl px-4 py-6 pb-28 md:py-8 md:pb-8">
        <div className="max-w-3xl">
          <div className="h-4 w-24 animate-pulse rounded-full bg-[var(--dae-surface)]" />
          <div className="mt-3 h-10 w-64 animate-pulse rounded-2xl bg-[var(--dae-surface)]" />
          <div className="mt-3 h-5 w-80 max-w-full animate-pulse rounded-2xl bg-[var(--dae-surface)]" />
        </div>

        <div className="mt-6 space-y-4">
          {Array.from({ length: blocks }).map((_, index) => (
            <div
              key={index}
              className="rounded-[28px] border border-[var(--dae-line)] bg-[var(--dae-surface-strong)] p-5 shadow-[0_14px_36px_rgba(32,26,22,0.05)]"
            >
              <div className="h-4 w-28 animate-pulse rounded-full bg-[var(--dae-surface)]" />
              <div className="mt-4 h-7 w-56 max-w-full animate-pulse rounded-2xl bg-[var(--dae-surface)]" />
              <div className="mt-4 h-20 animate-pulse rounded-[24px] bg-[var(--dae-surface)]" />
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
