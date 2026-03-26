import { Resend } from 'resend'
import { trackAnalyticsEvents } from '@/lib/analytics'
import { fetchActiveBlockPairs, hasActiveBlockBetween } from '@/lib/blocks'
import { getThreadUserState, fetchThreadUserStates } from '@/lib/thread-state'
import { chooseRepresentativeText, getTopicLabel } from '@/lib/topic-label'
import { createAdminClient } from '@/lib/supabase/server'
import { fetchUserPreferencesMap } from '@/lib/user-preferences'

interface ThreadParticipantRow {
  user_id: string
  handle: string
  dae_id: string
  daes: { text: string } | Array<{ text: string }> | null
}

interface NotificationTarget {
  userId: string
  email: string
}

interface MessageStateRow {
  sender_id: string
  content: string
  created_at: string
}

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const NOTIFICATION_FROM = 'Hey DAE <hello@heydae.app>'
const NOTIFICATION_SUBJECT = 'New reply in DAE'
const ACTIVE_RECENCY_WINDOW_MS = 1000 * 60 * 2
const SOFT_GRACE_WINDOW_MS = 1000 * 60 * 12
const NOTIFICATION_COOLDOWN_MS = 1000 * 60 * 12

function getDaeText(relation: ThreadParticipantRow['daes']) {
  if (Array.isArray(relation)) {
    return relation[0]?.text ?? ''
  }

  return relation?.text ?? ''
}

function isRecent(timestamp: string | null, windowMs: number) {
  if (!timestamp) {
    return false
  }

  return Date.now() - new Date(timestamp).getTime() < windowMs
}

export async function sendThreadMessageNotifications({
  matchId,
  senderId,
  content,
}: {
  matchId: string
  senderId: string
  content: string
}) {
  if (!resend || !process.env.NEXT_PUBLIC_APP_URL) {
    return
  }

  try {
    const admin = createAdminClient()
    const [{ data: participants }, { data: recentNotificationEvents }] = await Promise.all([
      admin
        .from('thread_participants')
        .select(`
          user_id,
          handle,
          dae_id,
          daes ( text )
        `)
        .eq('match_id', matchId),
      admin
        .from('analytics_events')
        .select('user_id, created_at')
        .eq('event_name', 'message_email_sent')
        .eq('match_id', matchId)
        .order('created_at', { ascending: false })
        .limit(50),
    ])

    const threadParticipants = (participants ?? []) as ThreadParticipantRow[]
    const sender = threadParticipants.find((participant) => participant.user_id === senderId)
    const recipients = threadParticipants.filter((participant) => participant.user_id !== senderId)

    if (!sender || recipients.length === 0) {
      return
    }

    const recipientTargets = (
      await Promise.all(
        recipients.map(async (participant) => {
          const { data } = await admin.auth.admin.getUserById(participant.user_id)
          const email = data.user?.email ?? null

          return email
            ? ({
                userId: participant.user_id,
                email,
              } satisfies NotificationTarget)
            : null
        })
      )
    ).filter((target): target is NotificationTarget => target !== null)
    const preferenceMap = await fetchUserPreferencesMap(recipientTargets.map((target) => target.userId))
    const blockPairs = await fetchActiveBlockPairs([senderId, ...recipientTargets.map((target) => target.userId)])

    if (recipientTargets.length === 0) {
      return
    }

    const stateMap = await fetchThreadUserStates({
      userIds: recipientTargets.map((target) => target.userId),
      matchIds: [matchId],
    })
    const lastSeenValues = recipientTargets
      .map((target) => getThreadUserState(stateMap, target.userId, matchId).lastSeenAt)
      .filter((value): value is string => Boolean(value))
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
    const oldestRelevantSeenAt =
      lastSeenValues[0] ?? new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString()
    const { data: recentMessages } = await admin
      .from('messages')
      .select('sender_id, content, created_at')
      .eq('match_id', matchId)
      .gt('created_at', oldestRelevantSeenAt)
      .order('created_at', { ascending: false })
      .limit(200)
    const latestNotificationByUser = new Map<string, string>()

    for (const event of recentNotificationEvents ?? []) {
      const userId = event.user_id
      if (!userId || latestNotificationByUser.has(userId)) {
        continue
      }

      latestNotificationByUser.set(userId, event.created_at)
    }

    const topicTexts = threadParticipants.map((participant) => getDaeText(participant.daes)).filter(Boolean)
    const topicLabel = getTopicLabel(topicTexts)
    const headline = chooseRepresentativeText(topicTexts)
    const threadUrl = `${process.env.NEXT_PUBLIC_APP_URL}/threads/${matchId}?jump=unread`
    const senderDae = getDaeText(sender.daes)
    const analyticsEvents = []

    for (const target of recipientTargets) {
      const recipientParticipant = recipients.find((participant) => participant.user_id === target.userId)
      if (!recipientParticipant) {
        continue
      }

      if (hasActiveBlockBetween(blockPairs, senderId, target.userId)) {
        analyticsEvents.push({
          eventName: 'message_email_skipped',
          userId: target.userId,
          matchId,
          daeId: recipientParticipant.dae_id,
          metadata: {
            reason: 'blocked',
          },
        })
        continue
      }

      const preferences = preferenceMap.get(target.userId)
      if (preferences && !preferences.replyEmails) {
        analyticsEvents.push({
          eventName: 'message_email_skipped',
          userId: target.userId,
          matchId,
          daeId: recipientParticipant.dae_id,
          metadata: {
            reason: 'reply_emails_off',
          },
        })
        continue
      }

      const state = getThreadUserState(stateMap, target.userId, matchId)
      const cooldownTimestamp = latestNotificationByUser.get(target.userId) ?? null
      const unreadCount = ((recentMessages ?? []) as MessageStateRow[]).filter(
        (message) =>
          message.sender_id !== target.userId &&
          (!state.lastSeenAt || new Date(message.created_at).getTime() > new Date(state.lastSeenAt).getTime())
      ).length
      const unreadPreview = ((recentMessages ?? []) as MessageStateRow[])
        .filter(
          (message) =>
            message.sender_id !== target.userId &&
            (!state.lastSeenAt || new Date(message.created_at).getTime() > new Date(state.lastSeenAt).getTime())
        )
        .slice(0, 2)
        .map((message) => {
          const speaker =
            threadParticipants.find((participant) => participant.user_id === message.sender_id)?.handle ?? 'Someone'

          return `${speaker}: ${message.content}`
        })
        .reverse()
      const shouldWaitForMore =
        unreadCount <= 1 && Boolean(state.lastSeenAt) && isRecent(state.lastSeenAt, SOFT_GRACE_WINDOW_MS)

      if (
        state.hidden ||
        state.muted ||
        isRecent(state.lastSeenAt, ACTIVE_RECENCY_WINDOW_MS) ||
        isRecent(cooldownTimestamp, NOTIFICATION_COOLDOWN_MS) ||
        shouldWaitForMore
      ) {
        analyticsEvents.push({
          eventName: 'message_email_skipped',
          userId: target.userId,
          matchId,
          daeId: recipientParticipant.dae_id,
          metadata: {
            reason: state.hidden
              ? 'hidden'
              : state.muted
                ? 'muted'
                : isRecent(state.lastSeenAt, ACTIVE_RECENCY_WINDOW_MS)
                  ? 'active_recently'
                  : isRecent(cooldownTimestamp, NOTIFICATION_COOLDOWN_MS)
                    ? 'cooldown'
                    : 'waiting_for_more',
            unreadCount,
          },
        })
        continue
      }

      const recipientHandle = recipientParticipant.handle
      const recipientDae = getDaeText(recipientParticipant.daes)

      try {
        await resend.emails.send({
          from: NOTIFICATION_FROM,
          to: target.email,
          subject:
            unreadCount > 1
              ? `${NOTIFICATION_SUBJECT}: ${topicLabel} (${unreadCount} new)`
              : `${NOTIFICATION_SUBJECT}: ${topicLabel}`,
          html: `
          <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; color: #1c1917;">
            <p style="font-size: 12px; font-weight: 700; color: #0f766e; text-transform: uppercase; letter-spacing: 0.08em; margin: 0 0 12px;">DAE</p>
            <h1 style="font-size: 24px; line-height: 1.3; font-weight: 700; margin: 0 0 8px;">${sender.handle} replied.</h1>
            <p style="margin: 0 0 20px; color: #57534e;">Topic: ${headline}</p>
            <p style="margin: 0 0 18px; color: #57534e;">${unreadCount > 1 ? `${unreadCount} unread messages are waiting.` : 'There is a new unread reply waiting.'}</p>
            ${
              unreadPreview.length > 0
                ? `<div style="background: #fffaf0; border-radius: 14px; padding: 14px; margin-bottom: 14px;">
              <p style="font-size: 12px; font-weight: 700; color: #9a3412; text-transform: uppercase; letter-spacing: 0.08em; margin: 0 0 8px;">While you were away</p>
              <p style="margin: 0; color: #57534e;">${unreadPreview.join('<br/>')}</p>
            </div>`
                : ''
            }

            <div style="background: #f8fafc; border-radius: 18px; padding: 18px; margin-bottom: 14px;">
              <p style="font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em; margin: 0 0 6px;">${sender.handle}</p>
              <p style="margin: 0; color: #1c1917;">${content}</p>
            </div>

            <div style="display: grid; gap: 12px; margin-bottom: 22px;">
              <div style="background: #ecfeff; border-radius: 14px; padding: 14px;">
                <p style="font-size: 12px; font-weight: 700; color: #0f766e; text-transform: uppercase; letter-spacing: 0.08em; margin: 0 0 6px;">Your DAE</p>
                <p style="margin: 0; color: #1c1917;">${recipientDae}</p>
              </div>
              <div style="background: #fff7ed; border-radius: 14px; padding: 14px;">
                <p style="font-size: 12px; font-weight: 700; color: #c2410c; text-transform: uppercase; letter-spacing: 0.08em; margin: 0 0 6px;">${sender.handle}'s DAE</p>
                <p style="margin: 0; color: #1c1917;">${senderDae}</p>
              </div>
            </div>

            <a href="${threadUrl}" style="display: inline-block; background: #0f766e; color: #ffffff; padding: 12px 18px; border-radius: 999px; text-decoration: none; font-weight: 700;">
              Open chat
            </a>

            <p style="margin-top: 18px; font-size: 12px; color: #78716c;">
              You are ${recipientHandle} in this room.
            </p>
          </div>
        `,
        })

        analyticsEvents.push({
          eventName: 'message_email_sent',
          userId: target.userId,
          matchId,
          daeId: recipientParticipant.dae_id,
          metadata: {
            senderId,
            senderHandle: sender.handle,
            unreadCount,
            unreadPreviewCount: unreadPreview.length,
          },
        })
      } catch (error) {
        console.error('Thread message notification send failed:', {
          matchId,
          senderId,
          recipientUserId: target.userId,
          error,
        })

        analyticsEvents.push({
          eventName: 'message_email_failed',
          userId: target.userId,
          matchId,
          daeId: recipientParticipant.dae_id,
          metadata: {
            senderId,
          },
        })
      }
    }

    await trackAnalyticsEvents(analyticsEvents)
  } catch (error) {
    console.error('Unexpected thread message notification error:', {
      matchId,
      senderId,
      error,
    })
  }
}
