-- ============================================================
-- RLS hardening
-- Run this in the Supabase SQL Editor. It is idempotent and safe
-- to re-run. Every statement replaces a policy defined in
-- schema.sql / review_materials.sql.
--
-- Fixes, in order of severity:
--   1. Students could rewrite their own exam scores.
--   2. Every signed-in student could read every user's email.
--   3. Admin dashboard analytics returned nothing (missing staff
--      read policy on attempts/answers).
--   4. Admins could not replace or remove reviewer PDFs.
-- ============================================================


-- ------------------------------------------------------------
-- 0. Staff check helper
--
-- A policy ON public.profiles cannot itself SELECT from
-- public.profiles: Postgres re-enters the same policy and raises
-- "infinite recursion detected in policy". SECURITY DEFINER runs
-- the lookup with RLS bypassed, which breaks the cycle.
-- ------------------------------------------------------------
create or replace function public.is_staff()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role in ('admin', 'instructor')
  );
$$;

revoke all on function public.is_staff() from public;
grant execute on function public.is_staff() to authenticated;


-- ------------------------------------------------------------
-- 1. profiles: stop exposing the whole user directory
--
-- Was: for select to authenticated using (true)
-- Any student could run `select * from profiles` through the anon
-- key and read every registered user's full name, email address
-- and role.
-- ------------------------------------------------------------
drop policy if exists "profiles are viewable by authenticated users" on public.profiles;

create policy "users read own profile" on public.profiles
for select to authenticated
using (id = auth.uid());

create policy "staff read all profiles" on public.profiles
for select to authenticated
using (public.is_staff());

-- Unchanged, restated so this file is self-contained. The
-- prevent_profile_role_change trigger still blocks self-promotion.
drop policy if exists "users can update own profile" on public.profiles;

create policy "users can update own profile" on public.profiles
for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());


-- ------------------------------------------------------------
-- 2. exam_attempts: scores must not be writable after the fact
--
-- Was: for all ... using (student_id = auth.uid())
-- FOR ALL grants UPDATE and DELETE too, so any student could run
--   supabase.from('exam_attempts').update({ score: 100 })
-- from the browser console and rewrite their own history, or
-- delete attempts that dragged an average down.
--
-- Attempts are only ever inserted by the app (see
-- submitMockExamAttempt), so INSERT + SELECT is all the client needs.
-- ------------------------------------------------------------
drop policy if exists "students manage own attempts" on public.exam_attempts;

create policy "students read own attempts" on public.exam_attempts
for select to authenticated
using (student_id = auth.uid());

create policy "students insert own attempts" on public.exam_attempts
for insert to authenticated
with check (student_id = auth.uid());

-- Restores the admin dashboard: it aggregates every attempt through
-- the RLS-bound server client, so without this it silently charted
-- an empty result set.
create policy "staff read all attempts" on public.exam_attempts
for select to authenticated
using (public.is_staff());


-- ------------------------------------------------------------
-- 3. exam_answers: same problem, same fix
--
-- FOR ALL let a student flip is_correct on answers they had
-- already submitted, which feeds weak-topic detection.
-- ------------------------------------------------------------
drop policy if exists "students manage own answers" on public.exam_answers;

create policy "students read own answers" on public.exam_answers
for select to authenticated
using (
  exists (
    select 1
    from public.exam_attempts attempts
    where attempts.id = exam_answers.attempt_id
      and attempts.student_id = auth.uid()
  )
);

create policy "students insert own answers" on public.exam_answers
for insert to authenticated
with check (
  exists (
    select 1
    from public.exam_attempts attempts
    where attempts.id = exam_answers.attempt_id
      and attempts.student_id = auth.uid()
  )
);

create policy "staff read all answers" on public.exam_answers
for select to authenticated
using (public.is_staff());


-- ------------------------------------------------------------
-- 4. review-materials storage: admins could upload but never
--    replace or remove a reviewer PDF (no update/delete policy).
-- ------------------------------------------------------------
drop policy if exists "staff update reviewer files" on storage.objects;
drop policy if exists "staff delete reviewer files" on storage.objects;

create policy "staff update reviewer files" on storage.objects
for update to authenticated
using (bucket_id = 'review-materials' and public.is_staff())
with check (bucket_id = 'review-materials' and public.is_staff());

create policy "staff delete reviewer files" on storage.objects
for delete to authenticated
using (bucket_id = 'review-materials' and public.is_staff());


-- ============================================================
-- Verification
-- Run after applying. Expect no FOR ALL policy on the attempt
-- tables, and no `true` qualifier on profiles.
-- ============================================================
-- select tablename, policyname, cmd, qual
-- from pg_policies
-- where schemaname = 'public'
--   and tablename in ('profiles', 'exam_attempts', 'exam_answers')
-- order by tablename, cmd;


-- ============================================================
-- KNOWN, NOT FIXED HERE: the answer key is readable by students.
--
-- exam_choices is world-readable to authenticated users, is_correct
-- included, and getMockExamQuestions ships is_correct into the exam
-- page payload. A student can read the correct answers during a
-- timed attempt, either from the page source or with a direct query.
--
-- This is not an oversight that RLS alone can close: offline mode is
-- a headline feature, and scoring a downloaded pack on-device
-- requires the answer key to be on the device. Options, in order of
-- effort:
--
--   a) Accept it, and treat mock scores as self-study signal rather
--      than invigilated assessment.
--   b) Strip is_correct from the online exam path only, and drop
--      offline submission of exams that were started online.
--   c) Move choice delivery behind an RPC that withholds is_correct
--      until an attempt row exists with submitted_at set, and keep
--      the full key only in explicitly downloaded offline packs.
--
-- Decide before advertising mock exams as exam-condition practice.
-- ============================================================
