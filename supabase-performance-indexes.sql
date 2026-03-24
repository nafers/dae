-- ============================================================
-- DAE performance indexes
-- Safe to rerun in Supabase SQL Editor
-- ============================================================

create index if not exists daes_user_status_created_idx
  on daes (user_id, status, created_at desc);

create index if not exists daes_status_created_idx
  on daes (status, created_at desc);

create index if not exists matches_created_at_idx
  on matches (created_at desc);

create index if not exists thread_participants_user_match_idx
  on thread_participants (user_id, match_id);

create index if not exists thread_participants_user_handle_idx
  on thread_participants (user_id, handle);

create index if not exists messages_match_sender_created_idx
  on messages (match_id, sender_id, created_at desc);

create index if not exists analytics_events_user_match_event_created_idx
  on analytics_events (user_id, match_id, event_name, created_at desc);

create index if not exists analytics_events_match_user_event_created_idx
  on analytics_events (match_id, user_id, event_name, created_at desc);
