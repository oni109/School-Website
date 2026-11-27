-- =====================================================================
-- Epiphany Schools — database schema & security
-- ---------------------------------------------------------------------
-- All school data is stored as JSON documents in one table, `records`,
-- keyed by (collection, id) — e.g. ('students', 's0037'). The web app
-- keeps its existing data model and syncs changed rows.
--
-- Security is enforced HERE, not in the browser:
--   * Row-level security decides who can read/write which rows.
--   * Logins are Supabase Auth accounts linked to a `users` record via
--     data.authId, which only the admin-users Edge Function can set.
--   * Public visitors only read website content; they submit forms and
--     check results through the narrow functions at the bottom.
-- =====================================================================

create table if not exists public.records (
  collection text not null check (char_length(collection) between 1 and 40),
  id text not null check (char_length(id) between 1 and 200),
  data jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  primary key (collection, id),
  constraint records_size check (pg_column_size(data) < 3000000)
);
create index if not exists records_users_auth_idx on public.records ((data->>'authId')) where collection = 'users';
create index if not exists records_class_idx on public.records (collection, (data->>'classId'));
create index if not exists records_student_idx on public.records (collection, (data->>'studentId'));
alter table public.records enable row level security;

-- Private helper schema (not exposed through the API)
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, anon;

create or replace function private.iso_now() returns text
language sql stable set search_path = '' as $$
  select to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
$$;

-- The signed-in person's users record (null for visitors / unlinked accounts)
create or replace function private.app_me() returns jsonb
language sql stable security definer set search_path = '' as $$
  select r.data from public.records r
  where r.collection = 'users'
    and r.data->>'authId' = (select auth.uid())::text
    and coalesce((r.data->>'active')::boolean, true)
  limit 1
$$;
create or replace function private.app_role() returns text
language sql stable security definer set search_path = '' as $$ select private.app_me()->>'role' $$;
create or replace function private.app_uid() returns text
language sql stable security definer set search_path = '' as $$ select private.app_me()->>'id' $$;

create or replace function private.my_student_ids() returns text[]
language plpgsql stable security definer set search_path = '' as $$
declare me jsonb := private.app_me(); r text := me->>'role'; out text[];
begin
  if me is null then return '{}'; end if;
  if r = 'parent' then
    select coalesce(array_agg(x), '{}') into out from jsonb_array_elements_text(coalesce(me->'childIds', '[]'::jsonb)) x;
  elsif r = 'student' then
    out := array[me->>'studentId'];
  elsif r = 'teacher' then
    select coalesce(array_agg(s.id), '{}') into out from public.records s
    where s.collection = 'students' and s.data->>'classId' = any(private.my_class_ids());
  elsif r = 'admin' then
    select coalesce(array_agg(s.id), '{}') into out from public.records s where s.collection = 'students';
  end if;
  return coalesce(out, '{}');
end $$;

create or replace function private.my_class_ids() returns text[]
language plpgsql stable security definer set search_path = '' as $$
declare me jsonb := private.app_me(); r text := me->>'role'; out text[];
begin
  if me is null then return '{}'; end if;
  if r = 'admin' then
    select coalesce(array_agg(id), '{}') into out from public.records where collection = 'classes';
  elsif r = 'teacher' then
    select coalesce(array_agg(distinct x), '{}') into out from (
      select jsonb_array_elements_text(coalesce(me->'classIds', '[]'::jsonb)) as x
      union
      select c.id from public.records c where c.collection = 'classes' and c.data->>'teacherId' = me->>'id'
    ) t;
  else
    select coalesce(array_agg(distinct s.data->>'classId'), '{}') into out from public.records s
    where s.collection = 'students' and s.id = any(private.my_student_ids());
  end if;
  return coalesce(out, '{}');
end $$;

-- Fee balance for the current term (used to optionally withhold results)
create or replace function private.fee_balance(p_student text) returns numeric
language sql stable security definer set search_path = '' as $$
  with st as (select data from public.records where collection = 'meta' and id = 'settings'),
       s as (select data from public.records where collection = 'students' and id = p_student),
       c as (select data from public.records where collection = 'classes' and id = (select data->>'classId' from s)),
       due as (
         select coalesce(sum((i->>'amount')::numeric), 0) as v
         from public.records f, jsonb_array_elements(coalesce(f.data->'items', '[]'::jsonb)) i
         where f.collection = 'feeSchedule' and f.data->>'group' = (select data->>'group' from c)),
       paid as (
         select coalesce(sum((p.data->>'amount')::numeric), 0) as v
         from public.records p
         where p.collection = 'payments' and p.data->>'studentId' = p_student
           and p.data->>'session' = (select data->>'session' from st)
           and (p.data->>'term')::int = (select (data->>'term')::int from st))
  select (select v from due) - (select v from paid)
$$;

create or replace function private.results_withheld(p_student text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select (data->>'blockResultsIfOwing')::boolean from public.records where collection = 'meta' and id = 'settings'), false)
     and private.fee_balance(p_student) > 0
$$;

-- Students whose results this person may see
create or replace function private.my_visible_result_ids() returns text[]
language plpgsql stable security definer set search_path = '' as $$
declare r text := private.app_role();
begin
  if r in ('admin', 'teacher') then return private.my_student_ids(); end if;
  if r in ('parent', 'student') then
    return coalesce((select array_agg(x) from unnest(private.my_student_ids()) x where not private.results_withheld(x)), '{}');
  end if;
  return '{}';
end $$;

-- Attendance registers filtered down to the given students' own marks
create or replace function private.attendance_for(p_ids text[]) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', r.id, 'classId', r.data->>'classId', 'date', r.data->>'date',
           'records', (select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb)
                       from jsonb_each(r.data->'records') e where e.key = any(p_ids)))), '[]'::jsonb)
  from public.records r
  where r.collection = 'attendance'
    and exists (select 1 from jsonb_object_keys(r.data->'records') k where k = any(p_ids))
$$;

-- Class position, subject positions and class statistics for one student,
-- computed without revealing any other child's scores.
create or replace function private.result_context(p_student text, p_session text, p_term int) returns jsonb
language sql stable security definer set search_path = '' as $$
  with stu as (select data from public.records where collection = 'students' and id = p_student),
       cls as (select data from public.records where collection = 'classes' and id = (select data->>'classId' from stu)),
       subj as (select jsonb_array_elements_text(m.data->((select data->>'group' from cls))) as subject
                from public.records m where m.collection = 'meta' and m.id = 'subjects'),
       mates as (select id from public.records
                 where collection = 'students' and data->>'classId' = (select data->>'classId' from stu)
                   and coalesce(data->>'status', 'Active') = 'Active'),
       complete as (
         select r.data->>'studentId' as sid, r.data->>'subject' as subject,
                (r.data->>'ca1')::numeric + (r.data->>'ca2')::numeric + (r.data->>'exam')::numeric as total
         from public.records r
         where r.collection = 'scores' and r.data->>'studentId' in (select id from mates)
           and r.data->>'session' = p_session and (r.data->>'term')::int = p_term
           and r.data->>'subject' in (select subject from subj)
           and jsonb_typeof(r.data->'ca1') = 'number' and jsonb_typeof(r.data->'ca2') = 'number' and jsonb_typeof(r.data->'exam') = 'number'),
       stats as (select subject, avg(total) as avg, max(total) as high, min(total) as low from complete group by subject),
       subjpos as (select subject, sid, rank() over (partition by subject order by total desc) as pos from complete),
       avgs as (select sid, avg(total) as average from complete group by sid),
       ranked as (select sid, rank() over (order by average desc) as pos from avgs)
  select jsonb_build_object(
    'session', p_session, 'term', p_term,
    'count', (select count(*) from mates),
    'classAvg', (select avg(average) from avgs),
    'position', (select pos from ranked where sid = p_student),
    'stats', coalesce((select jsonb_object_agg(subject, jsonb_build_object('avg', avg, 'high', high, 'low', low)) from stats), '{}'::jsonb),
    'subjectPositions', coalesce((select jsonb_object_agg(subject, pos) from subjpos where sid = p_student), '{}'::jsonb))
$$;

-- Who may create / change a row (row-level security for writes)
create or replace function private.rec_can_write(p_collection text, p_id text, p_data jsonb) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare me jsonb := private.app_me(); r text := me->>'role'; u text := me->>'id';
begin
  if me is null then return false; end if;
  if r = 'admin' then return true; end if;
  case p_collection
    when 'attendance', 'homework' then return r = 'teacher' and p_data->>'classId' = any(private.my_class_ids());
    when 'scores', 'reports' then return r = 'teacher' and p_data->>'studentId' = any(private.my_student_ids());
    when 'announcements' then return r = 'teacher' and p_data->>'author' = u and coalesce(p_data->>'audience', 'all') in ('all', 'parent', 'student');
    when 'messages' then return r in ('teacher', 'parent') and coalesce(p_data->'participants' ? u, false);
    when 'log' then return p_data->>'user' = u;
    when 'users' then return p_id = u;
    else return false;
  end case;
end $$;

revoke all on all functions in schema private from public;
grant execute on all functions in schema private to authenticated;

-- ---------------------------------------------------------------------
-- Row-level security policies
-- ---------------------------------------------------------------------
drop policy if exists records_select_anon on public.records;
create policy records_select_anon on public.records for select to anon using (
  collection in ('meta', 'classes', 'events', 'gallery', 'faqs', 'testimonials', 'feeSchedule')
  or (collection = 'news' and coalesce((data->>'published')::boolean, true))
);

drop policy if exists records_select_auth on public.records;
create policy records_select_auth on public.records for select to authenticated using (
  (select private.app_role()) = 'admin'
  or collection in ('meta', 'classes', 'events', 'gallery', 'faqs', 'testimonials', 'feeSchedule', 'timetables')
  or (collection = 'news' and coalesce((data->>'published')::boolean, true))
  or (collection = 'users' and (
        id = (select private.app_uid())
        or data->>'role' in ('admin', 'teacher')
        or ((select private.app_role()) = 'teacher' and data->'childIds' ?| (select private.my_student_ids()))))
  or (collection = 'students' and id = any((select private.my_student_ids())))
  or (collection in ('scores', 'reports') and data->>'studentId' = any((select private.my_visible_result_ids())))
  or (collection = 'attendance' and (select private.app_role()) = 'teacher' and data->>'classId' = any((select private.my_class_ids())))
  or (collection = 'payments' and data->>'studentId' = any((select private.my_student_ids())))
  or (collection = 'homework' and data->>'classId' = any((select private.my_class_ids())))
  or (collection = 'announcements' and (
        data->>'audience' = 'all' or data->>'audience' = (select private.app_role()) or data->>'author' = (select private.app_uid())))
  or (collection = 'messages' and data->'participants' ? (select private.app_uid()))
);

drop policy if exists records_insert on public.records;
create policy records_insert on public.records for insert to authenticated
  with check (private.rec_can_write(collection, id, data));

drop policy if exists records_update on public.records;
create policy records_update on public.records for update to authenticated
  using (private.rec_can_write(collection, id, data))
  with check (private.rec_can_write(collection, id, data));

drop policy if exists records_delete on public.records;
create policy records_delete on public.records for delete to authenticated using (
  (select private.app_role()) = 'admin'
  or (collection in ('homework', 'announcements') and private.rec_can_write(collection, id, data))
);

-- ---------------------------------------------------------------------
-- Guard trigger: timestamps, ids, and protected account fields
-- ---------------------------------------------------------------------
create or replace function private.records_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  k text;
  trusted boolean := coalesce(auth.role(), '') = 'service_role' or current_user in ('postgres', 'supabase_admin');
  is_admin boolean := trusted or coalesce(private.app_role() = 'admin', false);
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  if new.collection <> 'meta' and jsonb_typeof(new.data) = 'object' then
    new.data := jsonb_set(new.data, '{id}', to_jsonb(new.id));
  end if;
  if new.collection = 'users' then
    new.data := new.data - 'password';           -- passwords live only in Supabase Auth
    if tg_op = 'UPDATE' then
      if not is_admin then                         -- people may edit their own contact details only
        foreach k in array array['role', 'classIds', 'childIds', 'studentId', 'active', 'authId', 'username'] loop
          if old.data ? k then new.data := jsonb_set(new.data, array[k], old.data->k);
          else new.data := new.data - k; end if;
        end loop;
      elsif not trusted then                       -- login links are set only by the admin-users function
        if old.data ? 'authId' then new.data := jsonb_set(new.data, '{authId}', old.data->'authId');
        else new.data := new.data - 'authId'; end if;
      end if;
    elsif not trusted then
      new.data := new.data - 'authId';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists records_guard on public.records;
create trigger records_guard before insert or update on public.records
  for each row execute function private.records_guard();

-- Live updates
do $$ begin
  alter publication supabase_realtime add table public.records;
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- Functions the website and portal call (RPC)
-- ---------------------------------------------------------------------
create or replace function private.add_log(p_user text, p_text text) returns void
language sql security definer set search_path = '' as $$
  insert into public.records (collection, id, data)
  values ('log', 'log_' || replace(gen_random_uuid()::text, '-', ''),
          jsonb_build_object('at', private.iso_now(), 'user', p_user, 'text', left(p_text, 500)))
$$;

create or replace function private.norm_phone(p text) returns text
language sql immutable set search_path = '' as $$
  select regexp_replace(regexp_replace(coalesce(p, ''), '\D', '', 'g'), '^234', '0')
$$;

create or replace function private.clean(p text, n int) returns text
language sql immutable set search_path = '' as $$ select left(trim(coalesce(p, '')), n) $$;

-- Has the school finished first-time setup?
create or replace function public.is_setup_done() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.records where collection = 'users' and data ? 'authId')
$$;

-- Online admission application (public)
create or replace function public.submit_application(p jsonb) returns text
language plpgsql security definer set search_path = '' as $$
declare
  c jsonb := coalesce(p->'child', '{}'::jsonb);
  par jsonb := coalesce(p->'parent', '{}'::jsonb);
  cls jsonb; n int; ref text; today text := to_char(now(), 'YYYY-MM-DD');
begin
  if length(p::text) > 20000 then raise exception 'Application is too large.'; end if;
  if private.clean(c->>'firstName', 80) = '' or private.clean(c->>'lastName', 80) = '' or private.clean(par->>'name', 120) = '' then
    raise exception 'Please fill in the required fields.'; end if;
  if coalesce(c->>'gender', '') not in ('Female', 'Male') then raise exception 'Please choose a gender.'; end if;
  if coalesce(c->>'dob', '') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Please enter a valid date of birth.'; end if;
  if length(private.norm_phone(par->>'phone')) not between 10 and 14 then raise exception 'Please enter a valid phone number.'; end if;
  select data into cls from public.records where collection = 'classes' and data->>'name' = p->>'classSought' limit 1;
  if cls is null then raise exception 'Please choose a valid class.'; end if;

  perform pg_advisory_xact_lock(hashtext('epiphany.application_ref'));
  select coalesce(max((regexp_match(data->>'ref', '(\d+)$'))[1]::int), 100) into n
  from public.records where collection = 'applications';
  ref := 'APP-' || to_char(now(), 'YYYY') || '-' || lpad((n + 1)::text, 4, '0');

  insert into public.records (collection, id, data) values ('applications', 'app_' || replace(gen_random_uuid()::text, '-', ''),
    jsonb_build_object(
      'ref', ref, 'status', 'Submitted', 'created', today,
      'child', jsonb_build_object('firstName', private.clean(c->>'firstName', 80), 'lastName', private.clean(c->>'lastName', 80),
        'otherName', private.clean(c->>'otherName', 80), 'gender', c->>'gender', 'dob', c->>'dob',
        'stateOfOrigin', private.clean(c->>'stateOfOrigin', 60), 'religion', private.clean(c->>'religion', 60)),
      'classSought', cls->>'name', 'section', cls->>'section',
      'prevSchool', private.clean(p->>'prevSchool', 200), 'lastClass', private.clean(p->>'lastClass', 60), 'heard', private.clean(p->>'heard', 60),
      'parent', jsonb_build_object('name', private.clean(par->>'name', 120), 'phone', private.clean(par->>'phone', 20),
        'email', private.clean(par->>'email', 120), 'relationship', private.clean(par->>'relationship', 30),
        'address', private.clean(par->>'address', 200), 'occupation', private.clean(par->>'occupation', 80)),
      'medical', private.clean(p->>'medical', 1000), 'notes', private.clean(p->>'notes', 1000), 'examDate', '',
      'history', jsonb_build_array(jsonb_build_object('at', today, 'status', 'Submitted', 'note', 'Application received online.'))));
  perform private.add_log('public', 'New admission application ' || ref || ' for ' || private.clean(c->>'firstName', 80) || ' ' || private.clean(c->>'lastName', 80) || ' (' || (cls->>'name') || ').');
  return ref;
end $$;

-- Track an application with reference + phone (public)
create or replace function public.track_application(p_ref text, p_phone text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('ref', data->'ref', 'child', jsonb_build_object('firstName', data->'child'->'firstName', 'lastName', data->'child'->'lastName'),
           'classSought', data->'classSought', 'status', data->'status', 'examDate', data->'examDate', 'history', data->'history')
  from public.records
  where collection = 'applications' and upper(data->>'ref') = upper(trim(p_ref))
    and private.norm_phone(data->'parent'->>'phone') = private.norm_phone(p_phone)
    and length(private.norm_phone(p_phone)) >= 10
  limit 1
$$;

-- Contact form (public)
create or replace function public.submit_enquiry(p jsonb) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if private.clean(p->>'name', 120) = '' or private.clean(p->>'message', 3000) = '' then raise exception 'Please fill in the required fields.'; end if;
  if length(private.norm_phone(p->>'phone')) not between 10 and 14 then raise exception 'Please enter a valid phone number.'; end if;
  insert into public.records (collection, id, data) values ('enquiries', 'enq_' || replace(gen_random_uuid()::text, '-', ''),
    jsonb_build_object('name', private.clean(p->>'name', 120), 'phone', private.clean(p->>'phone', 20), 'email', private.clean(p->>'email', 120),
      'level', private.clean(p->>'level', 40), 'message', private.clean(p->>'message', 3000), 'created', private.iso_now(), 'status', 'New'));
  perform private.add_log('public', 'New enquiry from ' || private.clean(p->>'name', 120) || '.');
  return true;
end $$;

-- Newsletter sign-up (public)
create or replace function public.subscribe_updates(p_email text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare e text := lower(private.clean(p_email, 160));
begin
  if e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Please enter a valid email address.'; end if;
  insert into public.records (collection, id, data) values ('subscribers', 'sub_' || md5(e), jsonb_build_object('email', e, 'created', private.iso_now()))
  on conflict (collection, id) do nothing;
  return true;
end $$;

-- Result checker with admission number + PIN (public)
create or replace function public.check_result(p_adm text, p_pin text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  st jsonb; sess text; trm int; stu record; pin record; uses int; maxu int;
begin
  select data into st from public.records where collection = 'meta' and id = 'settings';
  sess := st->>'session'; trm := (st->>'term')::int;
  select id, data into stu from public.records where collection = 'students' and upper(data->>'admNo') = upper(trim(p_adm)) limit 1;
  select id, data into pin from public.records where collection = 'pins' and data->>'pin' = regexp_replace(coalesce(p_pin, ''), '\s', '', 'g') limit 1 for update;
  if stu.id is null or pin.id is null then return jsonb_build_object('ok', false, 'error', 'invalid'); end if;
  if pin.data->>'studentId' is not null and pin.data->>'studentId' <> stu.id then return jsonb_build_object('ok', false, 'error', 'used_other'); end if;
  uses := coalesce((pin.data->>'uses')::int, 0); maxu := coalesce((pin.data->>'maxUses')::int, 5);
  if uses >= maxu then return jsonb_build_object('ok', false, 'error', 'exhausted', 'maxUses', maxu); end if;
  if private.results_withheld(stu.id) then return jsonb_build_object('ok', false, 'error', 'withheld'); end if;
  update public.records set data = data || jsonb_build_object('studentId', stu.id, 'uses', uses + 1, 'lastUsed', private.iso_now())
  where collection = 'pins' and id = pin.id;
  return jsonb_build_object('ok', true, 'uses', uses + 1, 'maxUses', maxu,
    'student', jsonb_build_object('id', stu.id, 'admNo', stu.data->'admNo', 'firstName', stu.data->'firstName', 'lastName', stu.data->'lastName',
       'otherName', stu.data->'otherName', 'gender', stu.data->'gender', 'classId', stu.data->'classId', 'status', stu.data->'status'),
    'scores', (select coalesce(jsonb_agg(data), '[]'::jsonb) from public.records
               where collection = 'scores' and data->>'studentId' = stu.id and data->>'session' = sess and (data->>'term')::int = trm),
    'report', (select data from public.records where collection = 'reports' and id = stu.id || '|' || sess || '|' || trm),
    'attendance', private.attendance_for(array[stu.id]),
    'context', private.result_context(stu.id, sess, trm),
    'teacher', (select jsonb_build_object('id', u.id, 'role', 'teacher', 'title', u.data->'title', 'firstName', u.data->'firstName', 'lastName', u.data->'lastName')
                from public.records c join public.records u on u.collection = 'users' and u.id = c.data->>'teacherId'
                where c.collection = 'classes' and c.id = stu.data->>'classId'));
end $$;

-- Signed-in: class position & statistics for a child / own result
create or replace function public.result_context(p_student text, p_session text, p_term int) returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when p_student = any(private.my_visible_result_ids()) then private.result_context(p_student, p_session, p_term) end
$$;

-- Signed-in parents/students: attendance marks for their own children only
create or replace function public.my_attendance() returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when private.app_role() in ('parent', 'student') then private.attendance_for(private.my_student_ids()) else '[]'::jsonb end
$$;

-- Parents/students tick homework as done
create or replace function public.toggle_homework(p_homework text, p_student text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare hw jsonb; cls text; done jsonb;
begin
  if private.app_role() not in ('parent', 'student', 'admin') or not (p_student = any(private.my_student_ids())) then raise exception 'Not allowed.'; end if;
  select data into hw from public.records where collection = 'homework' and id = p_homework for update;
  select data->>'classId' into cls from public.records where collection = 'students' and id = p_student;
  if hw is null or hw->>'classId' is distinct from cls then raise exception 'Homework not found.'; end if;
  done := coalesce(hw->'doneBy', '[]'::jsonb);
  if done ? p_student then
    select coalesce(jsonb_agg(x), '[]'::jsonb) into done from jsonb_array_elements(done) x where x <> to_jsonb(p_student);
  else
    done := done || to_jsonb(p_student);
  end if;
  update public.records set data = jsonb_set(data, '{doneBy}', done) where collection = 'homework' and id = p_homework;
  return done;
end $$;

-- Reply in a conversation (appends safely even if two people reply at once)
create or replace function public.post_message(p_thread text, p_text text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me jsonb := private.app_me(); u text := me->>'id'; t jsonb; now_iso text := private.iso_now();
begin
  if me is null then raise exception 'Please sign in.'; end if;
  if length(trim(coalesce(p_text, ''))) = 0 or length(p_text) > 5000 then raise exception 'Message is empty or too long.'; end if;
  select data into t from public.records where collection = 'messages' and id = p_thread for update;
  if t is null or not (t->'participants' ? u or (me->>'role' = 'admin' and t->'participants' ? 'office')) then raise exception 'Conversation not found.'; end if;
  t := jsonb_set(t, '{messages}', coalesce(t->'messages', '[]'::jsonb) || jsonb_build_object('from', u, 'at', now_iso, 'text', trim(p_text)));
  t := t || jsonb_build_object('updated', now_iso, 'readBy', jsonb_build_array(u));
  update public.records set data = t where collection = 'messages' and id = p_thread;
  return t;
end $$;

create or replace function public.mark_thread_read(p_thread text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me jsonb := private.app_me(); u text := me->>'id'; t jsonb; rb jsonb;
begin
  select data into t from public.records where collection = 'messages' and id = p_thread for update;
  if me is null or t is null or not (t->'participants' ? u or (me->>'role' = 'admin' and t->'participants' ? 'office')) then return null; end if;
  rb := coalesce(t->'readBy', '[]'::jsonb);
  if not rb ? u then
    rb := rb || to_jsonb(u);
    update public.records set data = jsonb_set(data, '{readBy}', rb) where collection = 'messages' and id = p_thread;
  end if;
  return rb;
end $$;

revoke all on function public.is_setup_done(), public.submit_application(jsonb), public.track_application(text, text),
  public.submit_enquiry(jsonb), public.subscribe_updates(text), public.check_result(text, text),
  public.result_context(text, text, int), public.my_attendance(), public.toggle_homework(text, text),
  public.post_message(text, text), public.mark_thread_read(text) from public;
grant execute on function public.is_setup_done(), public.submit_application(jsonb), public.track_application(text, text),
  public.submit_enquiry(jsonb), public.subscribe_updates(text), public.check_result(text, text) to anon, authenticated;
grant execute on function public.result_context(text, text, int), public.my_attendance(), public.toggle_homework(text, text),
  public.post_message(text, text), public.mark_thread_read(text) to authenticated;
