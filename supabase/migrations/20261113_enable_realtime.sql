-- =============================================================================
-- Enable Realtime for family collaboration tables.
--
-- Adds the tables to Supabase's `supabase_realtime` publication and sets
-- REPLICA IDENTITY FULL so filtered DELETE/UPDATE events include the
-- family_id needed by the client subscription filter.
--
-- Idempotent: skips tables already in the publication. Safe to re-run.
-- =============================================================================

do $$
declare
  table_name text;
  realtime_tables text[] := array[
    'families',
    'family_people',
    'relationships',
    'memories',
    'events',
    'family_memberships',
    'invitations',
    'change_requests',
    'audit_logs'
  ];
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise notice 'supabase_realtime publication is missing; Realtime is not enabled on this project.';
    return;
  end if;

  foreach table_name in array realtime_tables
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = table_name
    ) then
      execute format(
        'alter publication supabase_realtime add table public.%I',
        table_name
      );
      raise notice 'Added public.% to supabase_realtime', table_name;
    end if;

    execute format(
      'alter table public.%I replica identity full',
      table_name
    );
  end loop;
end;
$$;
