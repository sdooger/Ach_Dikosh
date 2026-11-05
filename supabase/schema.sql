-- Achievers: database schema for Step 1 (Register + Skill Fingerprint + referee feedback)
-- Run once in Supabase: Dashboard → SQL Editor → paste this file → Run.

create extension if not exists pgcrypto;

-- One row per student account
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text default '',
  headline text default '',
  target_role text default '',
  notes text default '',
  projects text default '',
  linkedin text default '',
  work_style jsonb,
  reasoning jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Uploaded CVs (file in storage bucket "cvs", extracted text here)
create table if not exists cv_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text,
  file_path text,
  text text not null,
  created_at timestamptz default now()
);

-- Experiences found in the CV or written by the student
create table if not exists experiences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text, org text, period text, contribution text,
  source text not null check (source in ('cv','self')),
  created_at timestamptz default now()
);

-- Every piece of evidence for a taxonomy skill, with its source label
create table if not exists evidence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  skill_id text not null,
  source text not null check (source in ('cv','self','peer','practice','contribution','assessed')),
  title text,
  detail text,
  level int check (level between 1 and 5),
  ref_id uuid,
  created_at timestamptz default now()
);
create index if not exists evidence_user_idx on evidence(user_id);

-- Meet Me Through Others: a referee answers through a link, without an account
create table if not exists reference_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  referee_name text not null,
  relationship text not null,
  skill_id text not null,
  skill_label text not null,
  student_first_name text default '',
  response text,
  status text not null default 'pending' check (status in ('pending','answered')),
  created_at timestamptz default now(),
  answered_at timestamptz
);

-- Row-level security: each student sees and edits only their own rows
alter table profiles enable row level security;
alter table cv_documents enable row level security;
alter table experiences enable row level security;
alter table evidence enable row level security;
alter table reference_requests enable row level security;

drop policy if exists own_profile on profiles;
create policy own_profile on profiles for all using (auth.uid() = id) with check (auth.uid() = id);
drop policy if exists own_cv on cv_documents;
create policy own_cv on cv_documents for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists own_exp on experiences;
create policy own_exp on experiences for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists own_ev on evidence;
create policy own_ev on evidence for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists own_refs on reference_requests;
create policy own_refs on reference_requests for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Referee side: read one request by its token, and answer it once.
create or replace function get_reference(p_token uuid)
returns table(referee_name text, relationship text, skill_label text, student_first_name text, status text)
language sql security definer set search_path = public as $$
  select referee_name, relationship, skill_label, student_first_name, status
  from reference_requests where token = p_token;
$$;

create or replace function submit_reference(p_token uuid, p_response text)
returns boolean
language plpgsql security definer set search_path = public as $$
declare r reference_requests;
begin
  if length(trim(coalesce(p_response,''))) < 20 then
    raise exception 'Answer is too short';
  end if;
  select * into r from reference_requests where token = p_token and status = 'pending' for update;
  if not found then return false; end if;
  update reference_requests set response = left(p_response, 2000), status = 'answered', answered_at = now() where id = r.id;
  insert into evidence(user_id, skill_id, source, title, detail, level, ref_id)
  values (r.user_id, r.skill_id, 'peer', r.relationship || ': ' || r.referee_name, '"' || left(p_response, 600) || '"', 3, r.id);
  return true;
end $$;

revoke all on function get_reference(uuid) from public;
revoke all on function submit_reference(uuid, text) from public;
grant execute on function get_reference(uuid) to anon, authenticated;
grant execute on function submit_reference(uuid, text) to anon, authenticated;

-- Private storage bucket for CV files; each student uses a folder named after their user id
insert into storage.buckets (id, name, public) values ('cvs', 'cvs', false) on conflict (id) do nothing;
drop policy if exists cv_files_own on storage.objects;
create policy cv_files_own on storage.objects for all
  using (bucket_id = 'cvs' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'cvs' and (storage.foldername(name))[1] = auth.uid()::text);
