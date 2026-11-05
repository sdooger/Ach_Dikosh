-- Achievers v2: all four stages. Run AFTER schema.sql, once.
-- Supabase → SQL Editor → New query → paste this file → Run.

-- ---------- profile fields (registration, privacy, employer view) ----------
alter table profiles add column if not exists university text default '';
alter table profiles add column if not exists field_of_study text default '';
alter table profiles add column if not exists grad_year int;
alter table profiles add column if not exists location text default '';
alter table profiles add column if not exists interests text default '';
alter table profiles add column if not exists target_industries text default '';
alter table profiles add column if not exists target_roles text default '';
alter table profiles add column if not exists intro jsonb;
alter table profiles add column if not exists onboarding int default 0;
alter table profiles add column if not exists discoverable boolean default false;
alter table profiles add column if not exists share_assessments boolean default false;
alter table profiles add column if not exists is_recruiter boolean default false;
alter table profiles add column if not exists company jsonb;
alter table profiles add column if not exists saved_topics jsonb default '[]';
alter table profiles add column if not exists premium_demo boolean default false;
alter table profiles add column if not exists is_demo boolean default false;

-- ---------- experiences: CV records + showcase (situation / contribution / challenge / outcome) ----------
alter table experiences add column if not exists kind text default 'work';
alter table experiences add column if not exists title text default '';
alter table experiences add column if not exists situation text default '';
alter table experiences add column if not exists challenge text default '';
alter table experiences add column if not exists outcome text default '';
alter table experiences add column if not exists skills jsonb default '[]';
alter table experiences add column if not exists evidence_url text default '';
alter table experiences drop constraint if exists experiences_source_check;
alter table experiences add constraint experiences_source_check check (source in ('cv','imported','self'));

-- ---------- evidence: more origins, link to experience, sensitivity ----------
alter table evidence drop constraint if exists evidence_source_check;
alter table evidence add constraint evidence_source_check
  check (source in ('cv','imported','self','peer','practice','learning','contribution','assessed','verified'));
alter table evidence add column if not exists experience_id uuid;
alter table evidence add column if not exists sensitive boolean default false;
alter table evidence add column if not exists ref text;

alter table reference_requests add column if not exists experience_id uuid;
alter table reference_requests add column if not exists experience_title text default '';

-- ---------- new tables ----------
create table if not exists personality (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  answers jsonb, scores jsonb,
  created_at timestamptz default now()
);

create table if not exists topics (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) on delete set null,
  title text not null, category text not null, description text default '',
  skills jsonb default '[]', publisher text default '', deadline date, reference text default '',
  created_at timestamptz default now()
);

create table if not exists contributions (
  id uuid primary key default gen_random_uuid(),
  topic_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  parent_id text,
  author_label text default '',
  idea text not null, reasoning text default '', implementation text default '', risks text default '', link text default '',
  created_at timestamptz default now()
);

create table if not exists course_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id text not null, status text default 'completed', score int, access text default 'free',
  created_at timestamptz default now(),
  unique (user_id, course_id)
);

create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) on delete set null,
  title text not null, company text default '', description text default '', qualifications text default '',
  skills jsonb default '[]', location text default '', employment_type text default '', deadline date,
  assessment jsonb,
  created_at timestamptz default now()
);

create table if not exists applications (
  id uuid primary key default gen_random_uuid(),
  job_id text not null,
  candidate_id uuid not null references auth.users(id) on delete cascade,
  route text default 'applied',
  status text default 'Application Received',
  invite_response text,
  interview jsonb,
  notes text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (job_id, candidate_id)
);

create table if not exists assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  application_id uuid,
  job_id text,
  kind text not null,
  scenario jsonb, answers jsonb, result jsonb, telemetry jsonb,
  status text default 'in_progress',
  created_at timestamptz default now(),
  submitted_at timestamptz
);

-- ---------- access helpers ----------
create or replace function is_recruiter() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_recruiter from profiles where id = auth.uid()), false);
$$;

-- A recruiter may see a candidate who is discoverable or who applied / was invited
create or replace function can_view_candidate(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select c = auth.uid() or (
    (select coalesce(is_recruiter, false) from profiles where id = auth.uid())
    and (exists (select 1 from profiles where id = c and discoverable)
         or exists (select 1 from applications where candidate_id = c))
  );
$$;

create or replace function shares_assessments(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select c = auth.uid() or coalesce((select share_assessments from profiles where id = c), false);
$$;

grant execute on function is_recruiter() to authenticated;
grant execute on function can_view_candidate(uuid) to authenticated;
grant execute on function shares_assessments(uuid) to authenticated;

-- ---------- row-level security ----------
alter table personality enable row level security;
alter table topics enable row level security;
alter table contributions enable row level security;
alter table course_progress enable row level security;
alter table jobs enable row level security;
alter table applications enable row level security;
alter table assessments enable row level security;

-- profiles: own row read/write; recruiters read eligible candidates
drop policy if exists own_profile on profiles;
drop policy if exists profile_select on profiles;
drop policy if exists profile_insert on profiles;
drop policy if exists profile_update on profiles;
create policy profile_select on profiles for select using (can_view_candidate(id));
create policy profile_insert on profiles for insert with check (auth.uid() = id);
create policy profile_update on profiles for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists exp_view on experiences;
create policy exp_view on experiences for select using (can_view_candidate(user_id));

-- evidence marked sensitive (initial reasoning results) is only shared if the candidate allows it
drop policy if exists ev_view on evidence;
create policy ev_view on evidence for select using (can_view_candidate(user_id) and (not sensitive or shares_assessments(user_id)));

-- personality: never visible to anyone but the candidate
drop policy if exists own_personality on personality;
create policy own_personality on personality for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists topics_read on topics;
drop policy if exists topics_write on topics;
drop policy if exists topics_edit on topics;
create policy topics_read on topics for select using (auth.role() = 'authenticated');
create policy topics_write on topics for insert with check (created_by = auth.uid() and is_recruiter());
create policy topics_edit on topics for update using (created_by = auth.uid());

drop policy if exists contrib_read on contributions;
drop policy if exists contrib_write on contributions;
drop policy if exists contrib_delete on contributions;
create policy contrib_read on contributions for select using (auth.role() = 'authenticated');
create policy contrib_write on contributions for insert with check (user_id = auth.uid());
create policy contrib_delete on contributions for delete using (user_id = auth.uid());

drop policy if exists own_courses on course_progress;
drop policy if exists courses_view on course_progress;
create policy own_courses on course_progress for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy courses_view on course_progress for select using (can_view_candidate(user_id));

drop policy if exists jobs_read on jobs;
drop policy if exists jobs_write on jobs;
drop policy if exists jobs_edit on jobs;
create policy jobs_read on jobs for select using (auth.role() = 'authenticated');
create policy jobs_write on jobs for insert with check (created_by = auth.uid() and is_recruiter());
create policy jobs_edit on jobs for update using (created_by = auth.uid());

drop policy if exists apps_read on applications;
drop policy if exists apps_insert on applications;
drop policy if exists apps_update on applications;
create policy apps_read on applications for select using (candidate_id = auth.uid() or is_recruiter());
create policy apps_insert on applications for insert with check (candidate_id = auth.uid() or is_recruiter());
create policy apps_update on applications for update using (candidate_id = auth.uid() or is_recruiter());

drop policy if exists own_assess on assessments;
drop policy if exists assess_view on assessments;
create policy own_assess on assessments for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy assess_view on assessments for select using (is_recruiter() and can_view_candidate(user_id));

-- referee answers are linked to the experience they were asked about
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
  update reference_requests set response = left(p_response, 3000), status = 'answered', answered_at = now() where id = r.id;
  insert into evidence(user_id, skill_id, source, title, detail, level, ref_id, experience_id)
  values (r.user_id, r.skill_id, 'peer', r.relationship || ': ' || r.referee_name, '"' || left(p_response, 600) || '"', 3, r.id, r.experience_id);
  return true;
end $$;
revoke all on function submit_reference(uuid, text) from public;
grant execute on function submit_reference(uuid, text) to anon, authenticated;

-- referee page also shows which experience the question is about
drop function if exists get_reference(uuid);
create function get_reference(p_token uuid)
returns table(referee_name text, relationship text, skill_label text, student_first_name text, status text, experience_title text)
language sql security definer set search_path = public as $$
  select referee_name, relationship, skill_label, student_first_name, status, experience_title
  from reference_requests where token = p_token;
$$;
revoke all on function get_reference(uuid) from public;
grant execute on function get_reference(uuid) to anon, authenticated;

-- recruiters can add a human evaluation to an assessment result
drop policy if exists assess_review on assessments;
create policy assess_review on assessments for update using (is_recruiter() and can_view_candidate(user_id));
