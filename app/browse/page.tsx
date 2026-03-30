import { redirect } from 'next/navigation'

interface Props {
  searchParams: Promise<{
    q?: string | string[]
  }>
}

export default async function BrowsePage({ searchParams }: Props) {
  const { q } = await searchParams
  const initialQuery = Array.isArray(q) ? q[0] ?? '' : q ?? ''
  redirect(initialQuery ? `/topics?q=${encodeURIComponent(initialQuery)}` : '/topics')
}
