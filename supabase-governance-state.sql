-- ============================================================
-- DAE governance/state upgrade
-- Run this in Supabase SQL Editor
-- ============================================================

create table if not exists topic_follows (
  user_id uuid not null references auth.users(id) on delete cascade,
  topic_key text not null,
  headline text not null,
  label text not null,
  search_query text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, topic_key)
);

create index if not exists topic_follows_user_updated_idx
  on topic_follows (user_id, updated_at desc);

create table if not exists topic_registry_state (
  topic_key text primary key,
  pinned boolean not null default false,
  hidden boolean not null default false,
  alias_target_key text,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists topic_registry_state_alias_idx
  on topic_registry_state (alias_target_key);

create table if not exists thread_user_states (
  user_id uuid not null references auth.users(id) on delete cascade,
  match_id uuid not null references matches(id) on delete cascade,
  muted boolean not null default false,
  hidden boolean not null default false,
  last_seen_at timestamptz,
  last_reported_at timestamptz,
  last_report_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, match_id)
);

create index if not exists thread_user_states_match_idx
  on thread_user_states (match_id, updated_at desc);

create table if not exists room_moderation_states (
  match_id uuid primary key references matches(id) on delete cascade,
  hidden boolean not null default false,
  join_locked boolean not null default false,
  report_count integer not null default 0,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists thread_join_requests (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  requester_id uuid not null references auth.users(id) on delete cascade,
  dae_id uuid not null references daes(id) on delete cascade,
  dae_text text not null,
  source text,
  fit_score float,
  fit_reason text,
  topic text,
  state text not null default 'requested'
    check (state in ('requested', 'approved', 'declined', 'cancelled')),
  responder_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create unique index if not exists thread_join_requests_pending_unique
  on thread_join_requests (match_id, requester_id, dae_id)
  where state = 'requested';

create index if not exists thread_join_requests_match_state_idx
  on thread_join_requests (match_id, state, created_at desc);

create index if not exists thread_join_requests_requester_idx
  on thread_join_requests (requester_id, created_at desc);

create table if not exists thread_removal_votes (
  match_id uuid not null references matches(id) on delete cascade,
  target_user_id uuid not null references auth.users(id) on delete cascade,
  voter_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (match_id, target_user_id, voter_user_id)
);

create index if not exists thread_removal_votes_target_idx
  on thread_removal_votes (match_id, target_user_id, created_at desc);

alter table topic_follows enable row level security;
alter table thread_user_states enable row level security;
alter table topic_registry_state enable row level security;
alter table room_moderation_states enable row level security;
alter table thread_join_requests enable row level security;
alter table thread_removal_votes enable row level security;

create policy "users read own topic follows" on topic_follows
  for select using (auth.uid() = user_id);
create policy "users insert own topic follows" on topic_follows
  for insert with check (auth.uid() = user_id);
create policy "users update own topic follows" on topic_follows
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "users delete own topic follows" on topic_follows
  for delete using (auth.uid() = user_id);

create policy "users read own thread user state" on thread_user_states
  for select using (auth.uid() = user_id);
create policy "users insert own thread user state" on thread_user_states
  for insert with check (auth.uid() = user_id);
create policy "users update own thread user state" on thread_user_states
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- admin/service-role only tables intentionally have RLS enabled with no anon/auth policies
