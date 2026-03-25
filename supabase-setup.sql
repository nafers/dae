-- ============================================================
-- DAE App — Run this entire file in Supabase SQL Editor
-- ============================================================

-- 1. Enable pgvector extension
create extension if not exists vector;

-- 2. DAEs table
create table if not exists daes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  text       text not null check (char_length(text) between 10 and 280),
  embedding  vector(1536),
  status     text not null default 'unmatched'
               check (status in ('unmatched', 'matched')),
  created_at timestamptz not null default now()
);

create index if not exists daes_embedding_idx
  on daes using ivfflat (embedding vector_cosine_ops) with (lists = 10);
create index if not exists daes_user_status_created_idx
  on daes (user_id, status, created_at desc);
create index if not exists daes_status_created_idx
  on daes (status, created_at desc);

-- 3. Matches table
create table if not exists matches (
  id         uuid primary key default gen_random_uuid(),
  dae_a_id   uuid not null references daes(id) on delete cascade,
  dae_b_id   uuid not null references daes(id) on delete cascade,
  similarity float not null,
  created_at timestamptz not null default now()
);

create index if not exists matches_created_at_idx
  on matches (created_at desc);

-- 4. Thread participants table
create table if not exists thread_participants (
  id         uuid primary key default gen_random_uuid(),
  match_id   uuid not null references matches(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  dae_id     uuid not null references daes(id) on delete cascade,
  handle     text not null,
  unique (match_id, user_id)
);

create index if not exists thread_participants_user_match_idx
  on thread_participants (user_id, match_id);
create index if not exists thread_participants_user_handle_idx
  on thread_participants (user_id, handle);

-- 5. Messages table
create table if not exists messages (
  id         uuid primary key default gen_random_uuid(),
  match_id   uuid not null references matches(id) on delete cascade,
  sender_id  uuid not null references auth.users(id) on delete cascade,
  content    text not null check (char_length(content) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists messages_match_created_idx
  on messages (match_id, created_at);
create index if not exists messages_match_sender_created_idx
  on messages (match_id, sender_id, created_at desc);

-- 6. User preferences
create table if not exists user_preferences (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  match_emails   boolean not null default true,
  reply_emails   boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists user_preferences_updated_at_idx
  on user_preferences (updated_at desc);

-- 7. Row Level Security
alter table daes enable row level security;
alter table matches enable row level security;
alter table thread_participants enable row level security;
alter table messages enable row level security;
alter table user_preferences enable row level security;

-- DAE policies: users can see and insert their own
create policy "users read own daes" on daes
  for select using (auth.uid() = user_id);
create policy "users insert own daes" on daes
  for insert with check (auth.uid() = user_id);

create policy "users read own preferences" on user_preferences
  for select using (auth.uid() = user_id);
create policy "users insert own preferences" on user_preferences
  for insert with check (auth.uid() = user_id);
create policy "users update own preferences" on user_preferences
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Thread participant policies: participants see all rows for their matches
create policy "participants read threads" on thread_participants
  for select using (
    exists (
      select 1 from thread_participants tp2
      where tp2.match_id = thread_participants.match_id
      and tp2.user_id = auth.uid()
    )
  );

-- Message policies: participants can read and send in their threads
create policy "participants read messages" on messages
  for select using (
    exists (
      select 1 from thread_participants tp
      where tp.match_id = messages.match_id
      and tp.user_id = auth.uid()
    )
  );
create policy "participants send messages" on messages
  for insert with check (
    auth.uid() = sender_id and
    exists (
      select 1 from thread_participants tp
      where tp.match_id = messages.match_id
      and tp.user_id = auth.uid()
    )
  );

-- 8. Matching function (called from the API)
create or replace function find_match(
  query_embedding vector(1536),
  exclude_user_id uuid,
  match_threshold float default 0.82
)
returns table (
  id uuid,
  text text,
  user_id uuid,
  similarity float
)
language sql stable
as $$
  select
    d.id,
    d.text,
    d.user_id,
    1 - (d.embedding <=> query_embedding) as similarity
  from daes d
  where
    d.status = 'unmatched'
    and d.user_id <> exclude_user_id
    and 1 - (d.embedding <=> query_embedding) >= match_threshold
  order by d.embedding <=> query_embedding
  limit 1;
$$;

-- ============================================================
-- After running this SQL, go to:
-- Supabase Dashboard > Database > Replication
-- and enable Realtime for the "messages" table
-- ============================================================
