-- Friend-test funnel snapshots for DAE
-- Requires supabase-analytics.sql to be applied first

-- 1. Daily auth completions
select
  date_trunc('day', created_at) as day,
  count(*) as auth_completions
from analytics_events
where event_name = 'auth_completed'
group by 1
order by 1 desc;

-- 2. Daily submission outcomes
select
  date_trunc('day', created_at) as day,
  count(*) filter (where event_name = 'dae_waiting') as waiting_submissions,
  count(*) filter (where event_name = 'dae_matched') as matched_submissions
from analytics_events
where event_name in ('dae_waiting', 'dae_matched')
group by 1
order by 1 desc;

-- 3. Match room strategy sanity check
select
  coalesce(metadata->>'threadStrategy', 'legacy_or_unknown') as thread_strategy,
  count(*) as matched_submissions
from analytics_events
where event_name = 'dae_matched'
group by 1
order by 2 desc;

-- 4. Notification delivery results
select
  metadata->>'status' as delivery_status,
  count(*) as events
from analytics_events
where event_name = 'match_email_sent'
group by 1
order by 2 desc;

-- 5. Unique thread opens
select
  count(distinct concat_ws(':', user_id::text, match_id::text)) as unique_thread_opens
from analytics_events
where event_name = 'thread_opened';

-- 6. Threads that actually got chat activity
select
  count(distinct match_id) as threads_with_messages,
  count(distinct case when message_count >= 3 then match_id end) as threads_with_three_plus_messages
from (
  select
    match_id,
    count(*) as message_count
  from messages
  group by match_id
) message_counts;

-- 7. Explicit message engagement events
select
  count(*) filter (where event_name = 'message_sent') as messages_sent,
  count(*) filter (where event_name = 'first_message_in_thread') as first_thread_messages,
  count(*) filter (where event_name = 'first_message_from_user_in_thread') as first_user_replies
from analytics_events
where event_name in ('message_sent', 'first_message_in_thread', 'first_message_from_user_in_thread');

-- 8. Match quality feedback
select
  coalesce(metadata->>'verdict', 'unknown') as verdict,
  count(*) as votes
from analytics_events
where event_name = 'match_feedback_submitted'
group by 1
order by 2 desc;

-- 9. Simple funnel totals
with auth as (
  select count(*) as count
  from analytics_events
  where event_name = 'auth_completed'
),
submissions as (
  select count(*) as count
  from daes
),
matched as (
  select count(*) as count
  from analytics_events
  where event_name = 'dae_matched'
),
opened as (
  select count(distinct concat_ws(':', user_id::text, match_id::text)) as count
  from analytics_events
  where event_name = 'thread_opened'
),
messaged as (
  select count(distinct match_id) as count
  from messages
)
select
  auth.count as auth_completed,
  submissions.count as daes_submitted,
  matched.count as matched_submissions,
  opened.count as unique_thread_opens,
  messaged.count as threads_with_messages
from auth, submissions, matched, opened, messaged;
