create table public.schedule_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (length(title) between 1 and 200),
  kind text not null check (kind in ('work','volunteering','study','quiz','personal','other')),
  date date not null,
  start_time time not null,
  end_time time not null,
  check (end_time > start_time),
  created_at timestamptz not null default now()
);
create index schedule_blocks_user_date on public.schedule_blocks(user_id, date);
alter table public.schedule_blocks enable row level security;
create policy "schedule blocks: own rows" on public.schedule_blocks
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.schedule_blocks to authenticated;
