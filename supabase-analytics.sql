-- ============================================================
-- DAE analytics instrumentation for the friends test
-- Run this after the main supabase-setup.sql
-- ============================================================

create table if not exists analytics_events (
  id         uuid primary key default gen_random_uuid(),
  event_name text not null,
  user_id    uuid references auth.users(id) on delete set null,
  match_id   uuid references matches(id) on delete set null,
  dae_id     uuid references daes(id) on delete set null,
  metadata   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_event_created_idx
  on analytics_events (event_name, created_at desc);

create index if not exists analytics_events_user_created_idx
  on analytics_events (user_id, created_at desc);

create index if not exists analytics_events_match_created_idx
  on analytics_events (match_id, created_at desc);

alter table analytics_events enable row level security;

-- No public policies are added here.
-- The app writes analytics via the service-role client only.
