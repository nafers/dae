import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/server'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: Request) {
  try {
    const { matchId, userAId, userBId, handleA, handleB, daeAText, daeBText } = await request.json()

    const admin = createAdminClient()

    // Get emails for both users
    const [{ data: userA }, { data: userB }] = await Promise.all([
      admin.auth.admin.getUserById(userAId),
      admin.auth.admin.getUserById(userBId),
    ])

    const appUrl = process.env.NEXT_PUBLIC_APP_URL
    const threadUrl = `${appUrl}/threads/${matchId}`

    const emailHtml = (myHandle: string, theirHandle: string, myDae: string, theirDae: string) => `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #1c1917;">
        <h1 style="font-size: 24px; font-weight: 700; margin-bottom: 8px;">Someone else does this too 🎉</h1>
        <p style="color: #78716c; margin-bottom: 24px;">You've been matched with someone who submitted something similar.</p>

        <div style="background: #f5f5f4; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
          <p style="font-size: 12px; font-weight: 600; color: #a8a29e; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.05em;">Your DAE</p>
          <p style="margin: 0; font-style: italic; color: #292524;">"Does anyone else ${myDae}"</p>
        </div>

        <div style="background: #fef3c7; border-radius: 12px; padding: 20px; margin-bottom: 32px;">
          <p style="font-size: 12px; font-weight: 600; color: #a8a29e; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.05em;">${theirHandle}'s DAE</p>
          <p style="margin: 0; font-style: italic; color: #292524;">"Does anyone else ${theirDae}"</p>
        </div>

        <a href="${threadUrl}" style="display: block; background: #1c1917; color: white; text-align: center; padding: 14px 24px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 16px;">
          Start the conversation →
        </a>

        <p style="margin-top: 24px; font-size: 12px; color: #a8a29e; text-align: center;">
          You are <strong>${myHandle}</strong> in this conversation. Your real name is never shared.
        </p>
      </div>
    `

    const results = await Promise.allSettled([
      resend.emails.send({
        from: 'DAE <onboarding@resend.dev>',
        to: userA?.user?.email!,
        subject: 'Someone else does this too 🎉',
        html: emailHtml(handleA, handleB, daeAText, daeBText),
      }),
      resend.emails.send({
        from: 'DAE <onboarding@resend.dev>',
        to: userB?.user?.email!,
        subject: 'Someone else does this too 🎉',
        html: emailHtml(handleB, handleA, daeBText, daeAText),
      }),
    ])

    return NextResponse.json({ ok: true, results })
  } catch (error) {
    console.error('Notify error:', error)
    return NextResponse.json({ error: 'Failed to send notifications' }, { status: 500 })
  }
}
