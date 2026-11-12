-- ============================================================================
-- Tiesora - Supabase schema validation
--
-- READ-ONLY. Every statement is a SELECT. Safe to run against production.
--
-- How to use:
--   1. Open Supabase Dashboard -> SQL Editor -> New query
--   2. Paste this entire file and click Run
--   3. Copy the full result table and share it back
--
-- What it reports:
--   - which expected tables exist and their approximate row counts / RLS state
--   - which RPC functions exist
--   - which storage buckets exist
--   - app/schema column mismatches
--   - policy coverage per table
--   - role / relationship / date check constraints
--   - storage object policies
--   - which tables are in the realtime publication
-- ============================================================================

with
expected_tables(name) as (
  values
    ('profiles'),
    ('families'),
    ('family_memberships'),
    ('family_people'),
    ('relationships'),
    ('invitations'),
    ('change_requests'),
    ('memories'),
    ('events'),
    ('notifications'),
    ('audit_logs'),
    ('family_import_jobs'),
    ('family_import_pages'),
    ('extracted_family_members'),
    ('extracted_relationships'),
    ('import_conflicts'),
    ('import_review_history')
),

table_check as (
  select
    'table'::text as section,
    e.name::text as item,
    case when c.oid is null then 'MISSING' else 'OK' end::text as status,
    case
      when c.oid is null then 'table not found in public schema'
      else 'rows~' || coalesce(s.n_live_tup::text, '?')
           || ', rls=' || coalesce(c.relrowsecurity::text, '?')
    end::text as detail
  from expected_tables e
  left join pg_class c
    on c.relname = e.name
   and c.relnamespace = 'public'::regnamespace
   and c.relkind = 'r'
  left join pg_stat_user_tables s
    on s.schemaname = 'public'
   and s.relname = e.name
),

expected_functions(name) as (
  values
    ('get_user_family_role'),
    ('bootstrap_family_admin'),
    ('create_family_with_admin'),
    ('create_invitation'),
    ('validate_invitation'),
    ('accept_invitation'),
    ('import_approved_family_data'),
    ('create_import_job'),
    ('handle_new_user')
),

function_check as (
  select
    'function'::text as section,
    e.name::text as item,
    case when p.oid is null then 'MISSING' else 'OK' end::text as status,
    case
      when p.oid is null then 'function not found in public schema'
      else pg_get_function_identity_arguments(p.oid)
    end::text as detail
  from expected_functions e
  left join pg_proc p
    on p.proname = e.name
   and p.pronamespace = 'public'::regnamespace
),

-- Return types matter: CREATE OR REPLACE FUNCTION cannot change them.
function_signature_check as (
  select
    'function_signature'::text as section,
    p.proname::text as item,
    'INFO'::text as status,
    (pg_get_function_identity_arguments(p.oid)
      || ' -> '
      || pg_get_function_result(p.oid))::text as detail
  from pg_proc p
  where p.pronamespace = 'public'::regnamespace
    and p.proname in (
      'create_invitation',
      'validate_invitation',
      'accept_invitation',
      'create_family_with_admin',
      'bootstrap_family_admin',
      'import_approved_family_data',
      'create_import_job'
    )
),

bucket_check as (
  select
    'bucket'::text as section,
    e.name::text as item,
    case when b.id is null then 'MISSING' else 'OK' end::text as status,
    case
      when b.id is null then 'storage bucket not found'
      else 'public=' || b."public"::text
    end::text as detail
  from (values ('family-import-pdfs'), ('family-photos')) e(name)
  left join storage.buckets b on b.id = e.name
),

column_check as (
  select
    'column'::text as section,
    (e.tbl || '.' || e.col)::text as item,
    case when c.column_name is null then 'MISSING' else 'OK' end::text as status,
    coalesce(c.data_type, 'column not found')::text as detail
  from (values
    ('profiles', 'full_name'),
    ('profiles', 'email_verified'),
    ('family_memberships', 'user_email'),
    ('family_memberships', 'user_name'),
    ('memories', 'created_by_name'),
    ('change_requests', 'requested_by_name'),
    ('audit_logs', 'user_name'),
    ('family_people', 'birth_date'),
    ('family_people', 'date_precision'),
    ('families', 'privacy_settings')
  ) e(tbl, col)
  left join information_schema.columns c
    on c.table_schema = 'public'
   and c.table_name = e.tbl
   and c.column_name = e.col
),

policy_check as (
  select
    'policy'::text as section,
    p.tablename::text as item,
    'INFO'::text as status,
    (count(*)::text || ' policies: ' ||
      string_agg(p.policyname, '; ' order by p.policyname))::text as detail
  from pg_policies p
  where p.schemaname = 'public'
  group by p.tablename
),

constraint_check as (
  select
    'constraint'::text as section,
    (c.conrelid::regclass::text || ' / ' || c.conname)::text as item,
    'INFO'::text as status,
    pg_get_constraintdef(c.oid)::text as detail
  from pg_constraint c
  where c.connamespace = 'public'::regnamespace
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) ~ '(role|relationship_type|birth_date|death_date)'
),

storage_policy_check as (
  select
    'storage_policy'::text as section,
    p.policyname::text as item,
    'INFO'::text as status,
    (p.cmd || ': ' || coalesce(p.qual, p.with_check, ''))::text as detail
  from pg_policies p
  where p.schemaname = 'storage'
    and p.tablename = 'objects'
),

storage_object_check as (
  select
    'storage_objects'::text as section,
    o.bucket_id::text as item,
    'INFO'::text as status,
    (count(*)::text || ' objects')::text as detail
  from storage.objects o
  group by o.bucket_id
),

realtime_check as (
  select
    'realtime'::text as section,
    t.tablename::text as item,
    'INFO'::text as status,
    'in supabase_realtime publication'::text as detail
  from pg_publication_tables t
  where t.pubname = 'supabase_realtime'
    and t.schemaname = 'public'
),

auth_trigger_check as (
  select
    'trigger'::text as section,
    'auth.users / on_auth_user_created'::text as item,
    case
      when exists (
        select 1
        from pg_trigger t
        where t.tgname = 'on_auth_user_created'
          and t.tgrelid = 'auth.users'::regclass
      ) then 'OK'
      else 'MISSING'
    end::text as status,
    'creates public.profiles row on signup'::text as detail
)

select section, item, status, detail from table_check
union all select section, item, status, detail from function_check
union all select section, item, status, detail from function_signature_check
union all select section, item, status, detail from bucket_check
union all select section, item, status, detail from column_check
union all select section, item, status, detail from policy_check
union all select section, item, status, detail from constraint_check
union all select section, item, status, detail from storage_policy_check
union all select section, item, status, detail from storage_object_check
union all select section, item, status, detail from realtime_check
union all select section, item, status, detail from auth_trigger_check
order by section, status, item;
