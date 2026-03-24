import { NextResponse } from 'next/server'
import { trackAnalyticsEvent } from '@/lib/analytics'
import { getRequestUser } from '@/lib/request-user'
import { createAdminClient } from '@/lib/supabase/server'

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const daeId = searchParams.get('daeId')

    if (!daeId) {
      return NextResponse.json({ error: 'Missing daeId' }, { status: 400 })
    }

    const user = await getRequestUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const admin = createAdminClient()
    const { data: dae, error: daeError } = await admin
      .from('daes')
      .select('id, status')
      .eq('id', daeId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (daeError || !dae) {
      return NextResponse.json({ error: 'DAE not found' }, { status: 404 })
    }

    if (dae.status !== 'unmatched') {
      return NextResponse.json({ error: 'Only unmatched DAEs can be removed' }, { status: 400 })
    }

    const { error: deleteError } = await admin
      .from('daes')
      .delete()
      .eq('id', daeId)
      .eq('user_id', user.id)

    if (deleteError) {
      console.error('DAE delete error:', deleteError)
      return NextResponse.json({ error: 'Unable to remove DAE' }, { status: 500 })
    }

    await trackAnalyticsEvent({
      eventName: 'dae_cancelled',
      userId: user.id,
      daeId,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Unexpected dae delete route error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
