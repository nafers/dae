-- ============================================================
-- DAE user preferences
-- Safe to rerun in Supabase SQL Editor
-- ============================================================

create table if not exists user_preferences (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  match_emails   boolean not null default true,
  reply_emails   boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists user_preferences_updated_at_idx
  on user_preferences (updated_at desc);

alter table user_preferences enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_preferences'
      and policyname = 'users read own preferences'
  ) then
    create policy "users read own preferences" on user_preferences
      for select using (auth.uid() = user_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_preferences'
      and policyname = 'users insert own preferences'
  ) then
    create policy "users insert own preferences" on user_preferences
      for insert with check (auth.uid() = user_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_preferences'
      and policyname = 'users update own preferences'
  ) then
    create policy "users update own preferences" on user_preferences
      for update using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end
$$;
