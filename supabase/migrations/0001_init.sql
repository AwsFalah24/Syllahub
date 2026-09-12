-- SyllaHub initial schema
-- Run with: supabase db push   (or paste into the Supabase SQL editor)

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type plan_tier as enum ('free', 'paid');
create type assignment_type as enum ('assignment', 'exam', 'quiz', 'reading', 'project', 'other');
create type note_type as enum ('late_policy', 'attendance', 'instruction', 'office_hours', 'contact', 'other');
create type meeting_kind as enum ('lecture', 'lab', 'tutorial', 'seminar', 'other');
create type digest_frequency as enum ('none', 'daily', 'weekly');
create type upload_status as enum ('pending', 'parsed', 'saved', 'failed');

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  school text,
  onboarded boolean not null default false,
  timezone text not null default 'America/New_York',

  plan plan_tier not null default 'free',
  plan_expires_at timestamptz,
  stripe_customer_id text unique,
  stripe_subscription_id text,
  stripe_price_id text,

  -- reminders
  reminder_days integer[] not null default '{3,1}',
  email_reminders boolean not null default true,
  push_reminders boolean not null default true,
  digest digest_frequency not null default 'weekly',
  last_digest_at timestamptz,

  -- planner preferences
  study_hours_per_day numeric not null default 3,
  study_start_hour integer not null default 9,
  study_end_hour integer not null default 21,

  ics_token uuid not null default gen_random_uuid() unique,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create a profile row when a user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Courses
-- ---------------------------------------------------------------------------
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  code text,
  professor text,
  term text,
  color text not null default 'violet',
  target_grade numeric not null default 85,
  term_start date,
  term_end date,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index courses_user_idx on public.courses (user_id, archived);

-- ---------------------------------------------------------------------------
-- Grading components (e.g. "Midterm 25%", "Homework 20%")
-- ---------------------------------------------------------------------------
create table public.grading_components (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  weight_percent numeric not null default 0,
  -- optional direct grade for components with no individual items (e.g. Participation)
  grade_override numeric,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index grading_components_course_idx on public.grading_components (course_id);

-- ---------------------------------------------------------------------------
-- Assignments / exams / quizzes / readings
-- ---------------------------------------------------------------------------
create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  component_id uuid references public.grading_components (id) on delete set null,
  title text not null,
  type assignment_type not null default 'assignment',
  due_at timestamptz,
  all_day boolean not null default true,
  -- optional explicit weight (used when the item is not part of a component)
  weight_percent numeric,
  score numeric,
  max_score numeric not null default 100,
  completed boolean not null default false,
  estimated_hours numeric,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index assignments_user_due_idx on public.assignments (user_id, due_at);
create index assignments_course_idx on public.assignments (course_id);

-- ---------------------------------------------------------------------------
-- Course notes: policies, professor instructions, office hours, contact
-- ---------------------------------------------------------------------------
create table public.course_notes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  type note_type not null default 'instruction',
  content text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index course_notes_course_idx on public.course_notes (course_id);

-- ---------------------------------------------------------------------------
-- Class meeting times (for the weekly planner + calendar)
-- ---------------------------------------------------------------------------
create table public.course_meetings (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6), -- 0 = Sunday
  start_time time not null,
  end_time time not null,
  location text,
  kind meeting_kind not null default 'lecture',
  created_at timestamptz not null default now()
);
create index course_meetings_course_idx on public.course_meetings (course_id);

-- ---------------------------------------------------------------------------
-- Reminders (one row per assignment x days_before x channel actually sent)
-- ---------------------------------------------------------------------------
create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  days_before integer not null,
  channel text not null check (channel in ('push', 'email')),
  remind_at timestamptz not null,
  sent boolean not null default false,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (assignment_id, days_before, channel)
);
create index reminders_user_idx on public.reminders (user_id, remind_at);

-- ---------------------------------------------------------------------------
-- Web push subscriptions
-- ---------------------------------------------------------------------------
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- ---------------------------------------------------------------------------
-- Syllabus uploads + parse cache
-- ---------------------------------------------------------------------------
create table public.parse_cache (
  content_hash text primary key,
  parsed jsonb not null,
  model text,
  created_at timestamptz not null default now()
);

create table public.syllabus_uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  course_id uuid references public.courses (id) on delete set null,
  file_name text not null,
  storage_path text,
  mime_type text,
  content_hash text,
  status upload_status not null default 'pending',
  parsed jsonb,
  error text,
  created_at timestamptz not null default now()
);
create index syllabus_uploads_user_idx on public.syllabus_uploads (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles for each row execute procedure public.set_updated_at();
create trigger courses_updated_at before update on public.courses for each row execute procedure public.set_updated_at();
create trigger assignments_updated_at before update on public.assignments for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security: every table is strictly per-user.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.grading_components enable row level security;
alter table public.assignments enable row level security;
alter table public.course_notes enable row level security;
alter table public.course_meetings enable row level security;
alter table public.reminders enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.syllabus_uploads enable row level security;
alter table public.parse_cache enable row level security; -- service role only

create policy "profiles: own row" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "courses: own rows" on public.courses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "grading_components: own rows" on public.grading_components
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "assignments: own rows" on public.assignments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "course_notes: own rows" on public.course_notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "course_meetings: own rows" on public.course_meetings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "reminders: own rows" on public.reminders
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "push_subscriptions: own rows" on public.push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "syllabus_uploads: own rows" on public.syllabus_uploads
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- parse_cache has no user policies: only the service role (server) reads/writes it.

-- ---------------------------------------------------------------------------
-- Storage bucket for syllabus files (private; path prefix = user id)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'syllabi',
  'syllabi',
  false,
  20971520,
  array['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/heic']
)
on conflict (id) do nothing;

create policy "syllabi: users manage own folder"
  on storage.objects for all
  using (bucket_id = 'syllabi' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'syllabi' and auth.uid()::text = (storage.foldername(name))[1]);

-- ---------------------------------------------------------------------------
-- Helper: count of active courses (used for free-tier gating on the server)
-- ---------------------------------------------------------------------------
create or replace function public.active_course_count(uid uuid)
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::int from public.courses where user_id = uid and archived = false;
$$;
