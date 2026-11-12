-- ============================================================================
-- Tiesora - Phase 1: Supabase source-of-truth alignment
-- Date: 2026-11-12
-- Idempotent. Safe to run more than once.
--
-- PRECONDITION
--   The 11 core tables must already exist. If validation reports any of them
--   as MISSING, run this first:
--       supabase/migrations/APPLY_TO_SUPABASE_IDEMPOTENT.sql
--   then run this file.
--
-- WHAT THIS MIGRATION DOES
--   1.  Aborts early if the core schema is missing.
--   2.  Adds columns the app expects but older migrations omitted:
--         profiles.full_name / email_verified
--         family_memberships.user_email / user_name
--         memories.created_by_name
--         change_requests.requested_by_name
--         audit_logs.user_name
--   3.  Normalises legacy roles and re-asserts the admin/viewer constraints.
--   4.  Recreates the last-admin protection trigger.
--   5.  Adds INSERT/UPDATE policies for notifications and audit logs
--       (they were SELECT-only, so client writes would fail).
--   6.  Tightens profile visibility to self + shared-family members.
--   7.  Adds notify_family_admins() for safe admin notifications.
--   8.  Makes family-photos private when it is empty, and scopes photo / PDF
--       object access by family folder.
--   9.  Sets search_path and restricts EXECUTE on SECURITY DEFINER functions.
--   10. Adds indexes for the queries the new data layer will run.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 0. Precondition
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.profiles') is null
     or to_regclass('public.families') is null
     or to_regclass('public.family_memberships') is null
     or to_regclass('public.family_people') is null
     or to_regclass('public.relationships') is null
     or to_regclass('public.invitations') is null
     or to_regclass('public.change_requests') is null
     or to_regclass('public.memories') is null
     or to_regclass('public.events') is null
     or to_regclass('public.notifications') is null
     or to_regclass('public.audit_logs') is null then
    raise exception
      'Tiesora core schema is incomplete. Run APPLY_TO_SUPABASE_IDEMPOTENT.sql first, then re-run this migration.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1. Columns the app expects
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists full_name text,
  add column if not exists email_verified boolean not null default false;

update public.profiles
set full_name = display_name
where full_name is null;

alter table public.family_memberships
  add column if not exists user_email text not null default '',
  add column if not exists user_name  text not null default '';

update public.family_memberships fm
set user_email = coalesce(nullif(fm.user_email, ''), p.email, ''),
    user_name  = coalesce(nullif(fm.user_name, ''), p.display_name, p.full_name, '')
from public.profiles p
where p.id = fm.user_id
  and (coalesce(fm.user_email, '') = '' or coalesce(fm.user_name, '') = '');

alter table public.memories
  add column if not exists created_by_name text not null default '';

update public.memories m
set created_by_name = coalesce(p.display_name, p.full_name, '')
from public.profiles p
where p.id = m.created_by
  and coalesce(m.created_by_name, '') = '';

alter table public.change_requests
  add column if not exists requested_by_name text not null default '';

update public.change_requests cr
set requested_by_name = coalesce(p.display_name, p.full_name, '')
from public.profiles p
where p.id = cr.requested_by
  and coalesce(cr.requested_by_name, '') = '';

alter table public.audit_logs
  add column if not exists user_name text not null default '';

update public.audit_logs al
set user_name = coalesce(p.display_name, p.full_name, '')
from public.profiles p
where p.id = al.user_id
  and coalesce(al.user_name, '') = '';

-- ---------------------------------------------------------------------------
-- 2. Normalise legacy roles and re-assert admin/viewer constraints
-- ---------------------------------------------------------------------------
update public.family_memberships
set role = 'admin'
where role in ('owner', 'editor', 'contributor');

update public.invitations
set role = 'admin'
where role in ('owner', 'editor', 'contributor');

alter table public.family_memberships
  drop constraint if exists family_memberships_role_check;

alter table public.family_memberships
  add constraint family_memberships_role_check
  check (role in ('admin', 'viewer'));

alter table public.invitations
  drop constraint if exists invitations_role_check;

alter table public.invitations
  add constraint invitations_role_check
  check (role in ('admin', 'viewer'));

-- ---------------------------------------------------------------------------
-- 3. Last-admin protection (safe to recreate)
-- ---------------------------------------------------------------------------
create or replace function public.ensure_family_has_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_count integer;
begin
  -- Allow cascade cleanup when the whole family is being deleted. The family
  -- row is removed first, so this membership delete is not an admin leaving.
  if tg_op = 'DELETE'
     and not exists (
       select 1 from public.families where id = old.family_id
     ) then
    return old;
  end if;

  select count(*)
  into admin_count
  from public.family_memberships
  where family_id = coalesce(old.family_id, new.family_id)
    and role = 'admin'
    and status = 'active'
    and id <> coalesce(old.id, new.id);

  if admin_count = 0 then
    raise exception
      'Cannot remove the last administrator from a family. Assign another admin first.'
      using errcode = 'P0001';
  end if;

  -- Allow the demotion when another admin remains. Returning OLD here would
  -- silently revert every admin demotion, not just the last-admin case.
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_ensure_family_has_admin_update on public.family_memberships;
create trigger trg_ensure_family_has_admin_update
  before update of role, status
  on public.family_memberships
  for each row
  when (
    old.role = 'admin'
    and (new.role <> 'admin' or new.status <> 'active')
  )
  execute function public.ensure_family_has_admin();

drop trigger if exists trg_ensure_family_has_admin_delete on public.family_memberships;
create trigger trg_ensure_family_has_admin_delete
  before delete
  on public.family_memberships
  for each row
  when (old.role = 'admin')
  execute function public.ensure_family_has_admin();

-- ---------------------------------------------------------------------------
-- 4. Notifications: private read + own-row write
-- ---------------------------------------------------------------------------
drop policy if exists "Notifications strictly private to user" on public.notifications;
create policy "Notifications strictly private to user"
  on public.notifications
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users can insert own notifications" on public.notifications;
create policy "Users can insert own notifications"
  on public.notifications
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and (
      family_id is null
      or public.get_user_family_role(family_id) is not null
    )
  );

drop policy if exists "Users can update own notifications" on public.notifications;
create policy "Users can update own notifications"
  on public.notifications
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 5. Audit logs: members can append their own entries; logs stay immutable
-- ---------------------------------------------------------------------------
drop policy if exists "Audit logs viewable by family members" on public.audit_logs;
create policy "Audit logs viewable by family members"
  on public.audit_logs
  for select
  to authenticated
  using (public.get_user_family_role(family_id) is not null);

drop policy if exists "Members can insert their own audit logs" on public.audit_logs;
create policy "Members can insert their own audit logs"
  on public.audit_logs
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.get_user_family_role(family_id) is not null
  );

-- ---------------------------------------------------------------------------
-- 6. Tighten profile visibility: self + shared-family members only
-- ---------------------------------------------------------------------------
drop policy if exists "Profiles are readable by authenticated users" on public.profiles;
drop policy if exists "Profiles readable by authenticated users" on public.profiles;
drop policy if exists "Profiles readable by self or shared-family members" on public.profiles;

create policy "Profiles readable by self or shared-family members"
  on public.profiles
  for select
  to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1
      from public.family_memberships me
      join public.family_memberships them
        on them.family_id = me.family_id
      where me.user_id = auth.uid()
        and me.status = 'active'
        and them.user_id = profiles.id
        and them.status = 'active'
    )
  );

-- ---------------------------------------------------------------------------
-- 7. Tighten INSERT policies so actors cannot spoof created_by / requested_by
-- ---------------------------------------------------------------------------
drop policy if exists "Admins can insert people" on public.family_people;
create policy "Admins can insert people"
  on public.family_people
  for insert
  to authenticated
  with check (
    public.get_user_family_role(family_id) = 'admin'
    and created_by = auth.uid()
  );

drop policy if exists "Admins can insert relationships" on public.relationships;
create policy "Admins can insert relationships"
  on public.relationships
  for insert
  to authenticated
  with check (
    public.get_user_family_role(family_id) = 'admin'
    and created_by = auth.uid()
  );

drop policy if exists "Admins can insert memories" on public.memories;
create policy "Admins can insert memories"
  on public.memories
  for insert
  to authenticated
  with check (
    public.get_user_family_role(family_id) = 'admin'
    and created_by = auth.uid()
  );

drop policy if exists "Admins can insert events" on public.events;
create policy "Admins can insert events"
  on public.events
  for insert
  to authenticated
  with check (
    public.get_user_family_role(family_id) = 'admin'
    and created_by = auth.uid()
  );

drop policy if exists "Any member can submit change requests" on public.change_requests;
create policy "Any member can submit change requests"
  on public.change_requests
  for insert
  to authenticated
  with check (
    public.get_user_family_role(family_id) is not null
    and requested_by = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- 8. Safe admin notification RPC
-- ---------------------------------------------------------------------------
create or replace function public.notify_family_admins(
  p_family_id uuid,
  p_type      text,
  p_title     text,
  p_message   text,
  p_link_tab  text default null,
  p_link_id   text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = 'P0001';
  end if;

  if public.get_user_family_role(p_family_id) is null then
    raise exception 'Not a member of this family' using errcode = 'P0001';
  end if;

  if p_type not in (
    'invitation',
    'change_request_submitted',
    'change_request_approved',
    'change_request_rejected',
    'birthday_reminder',
    'event_reminder',
    'new_memory'
  ) then
    raise exception 'Invalid notification type: %', p_type using errcode = 'P0001';
  end if;

  insert into public.notifications
    (user_id, family_id, type, title, message, link_tab, link_id)
  select
    m.user_id,
    p_family_id,
    p_type,
    p_title,
    p_message,
    p_link_tab,
    p_link_id
  from public.family_memberships m
  where m.family_id = p_family_id
    and m.status = 'active'
    and m.role = 'admin'
    and m.user_id <> auth.uid();
end;
$$;

revoke all on function public.notify_family_admins(uuid, text, text, text, text, text) from public;
grant execute on function public.notify_family_admins(uuid, text, text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 9. Storage: buckets + family-folder scoped policies
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values
  ('family-photos', 'family-photos', false),
  ('family-import-pdfs', 'family-import-pdfs', false)
on conflict (id) do nothing;

-- Flip family-photos to private only while it is empty. If it already holds
-- objects, leave it public until the photo migration moves those objects.
update storage.buckets
set public = false
where id = 'family-photos'
  and not exists (
    select 1 from storage.objects o where o.bucket_id = 'family-photos'
  );

-- Helper: the caller's role in the family folder that owns an object name.
-- Path convention: {family_id}/{...}
create or replace function public.storage_family_role(object_name text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select public.get_user_family_role(
    case
      when (storage.foldername(object_name))[1]
           ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then ((storage.foldername(object_name))[1])::uuid
      else null
    end
  );
$$;

revoke all on function public.storage_family_role(text) from public;
grant execute on function public.storage_family_role(text) to authenticated;

-- Drop both legacy and current photo policy names.
drop policy if exists "Authenticated users can upload family photos" on storage.objects;
drop policy if exists "Anyone can view family photos" on storage.objects;
drop policy if exists "Admins can upload family photos" on storage.objects;
drop policy if exists "Members can view family photos" on storage.objects;
drop policy if exists "Family members can view photos" on storage.objects;
drop policy if exists "Family admins can upload photos" on storage.objects;
drop policy if exists "Family admins can update photos" on storage.objects;
drop policy if exists "Family admins can delete photos" on storage.objects;

create policy "Family members can view photos"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'family-photos'
    and public.storage_family_role(name) is not null
  );

create policy "Family admins can upload photos"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'family-photos'
    and public.storage_family_role(name) = 'admin'
  );

create policy "Family admins can update photos"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'family-photos'
    and public.storage_family_role(name) = 'admin'
  )
  with check (
    bucket_id = 'family-photos'
    and public.storage_family_role(name) = 'admin'
  );

create policy "Family admins can delete photos"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'family-photos'
    and public.storage_family_role(name) = 'admin'
  );

-- PDF policies: same family-folder convention, admin writes / member reads.
drop policy if exists "Users can upload PDFs to their family folders" on storage.objects;
drop policy if exists "Users can read PDFs from their family folders" on storage.objects;
drop policy if exists "Admins can delete family PDFs" on storage.objects;
drop policy if exists "Admins can update family PDF metadata" on storage.objects;
drop policy if exists "Admins can upload PDFs to their family folders" on storage.objects;
drop policy if exists "Admins can view PDFs from their family folders" on storage.objects;
drop policy if exists "Admins can delete PDFs from their family folders" on storage.objects;
drop policy if exists "Admins can update PDFs from their family folders" on storage.objects;
drop policy if exists "Admins can upload family PDFs" on storage.objects;
drop policy if exists "Family admins can upload PDFs" on storage.objects;
drop policy if exists "Family members can read PDFs" on storage.objects;
drop policy if exists "Family admins can delete PDFs" on storage.objects;
drop policy if exists "Family admins can update PDF metadata" on storage.objects;

create policy "Family admins can upload PDFs"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'family-import-pdfs'
    and public.storage_family_role(name) = 'admin'
  );

create policy "Family members can read PDFs"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'family-import-pdfs'
    and public.storage_family_role(name) is not null
  );

create policy "Family admins can update PDF metadata"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'family-import-pdfs'
    and public.storage_family_role(name) = 'admin'
  )
  with check (
    bucket_id = 'family-import-pdfs'
    and public.storage_family_role(name) = 'admin'
  );

create policy "Family admins can delete PDFs"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'family-import-pdfs'
    and public.storage_family_role(name) = 'admin'
  );

-- ---------------------------------------------------------------------------
-- 10. Harden SECURITY DEFINER functions
-- ---------------------------------------------------------------------------
do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as signature
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.prosecdef
      and p.prokind = 'f'
  loop
    -- Keep `extensions` on the path: pgcrypto (gen_random_bytes) lives there
    -- on Supabase, and create_invitation relies on it.
    execute format(
      'alter function %s set search_path = public, extensions, pg_catalog',
      fn.signature
    );
    execute format('revoke all on function %s from public', fn.signature);
    begin
      execute format('revoke all on function %s from anon', fn.signature);
    exception
      when undefined_object then null;
    end;
    execute format('grant execute on function %s to authenticated', fn.signature);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 11. Indexes for the data layer
-- ---------------------------------------------------------------------------
create index if not exists idx_memberships_user_active
  on public.family_memberships (user_id, status);

create index if not exists idx_change_requests_family_status
  on public.change_requests (family_id, status, created_at desc);

create index if not exists idx_notifications_user_created
  on public.notifications (user_id, created_at desc);

create index if not exists idx_memories_family_created
  on public.memories (family_id, created_at desc);

create index if not exists idx_events_family_created
  on public.events (family_id, created_at desc);

create index if not exists idx_audit_family_created
  on public.audit_logs (family_id, created_at desc);

create index if not exists idx_relationships_family_type
  on public.relationships (family_id, relationship_type);

commit;

-- ============================================================================
-- DONE.
-- Run supabase/validation/check_schema.sql again to verify:
--   - profiles.full_name / email_verified = OK
--   - family_memberships.user_email / user_name = OK
--   - memories.created_by_name, change_requests.requested_by_name,
--     audit_logs.user_name = OK
--   - policies on notifications / audit_logs / storage.objects = present
--   - function notify_family_admins = OK
-- ============================================================================
