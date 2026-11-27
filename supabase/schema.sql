create table if not exists public.devflow_user_data (
  user_id uuid primary key references auth.users (id) on delete cascade,
  tasks jsonb not null default '[]'::jsonb,
  projects jsonb not null default '[]'::jsonb,
  github_username text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.devflow_user_data enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update on table public.devflow_user_data to authenticated;

drop policy if exists "Users can read their own DevFlow data" on public.devflow_user_data;
drop policy if exists "Users can insert their own DevFlow data" on public.devflow_user_data;
drop policy if exists "Users can update their own DevFlow data" on public.devflow_user_data;

create policy "Users can read their own DevFlow data"
  on public.devflow_user_data for select
  using (auth.uid() = user_id);

create policy "Users can insert their own DevFlow data"
  on public.devflow_user_data for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own DevFlow data"
  on public.devflow_user_data for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

notify pgrst, 'reload schema';
