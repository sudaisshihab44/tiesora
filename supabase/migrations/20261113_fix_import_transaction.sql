-- ============================================================================
-- Fix: import_approved_family_data
-- Date: 2026-11-13
--
-- The previous function referenced columns that do not exist:
--   family_import_jobs.completed_at, family_import_jobs.import_summary
--   extracted_family_members.linked_person_id
-- and used statuses/relationship types rejected by the table constraints
-- ('ready_to_import', 'completed_with_errors', 'confirmed', 'sibling').
--
-- This version matches the actual schema:
--   - job status must be 'approved' (or 'processed')
--   - writes imported_at / imported_person_count / imported_relationship_count
--   - sets extracted rows' imported flags and imported_person_id
--   - normalises child/adopted_child edges to parent/adoptive_parent
--   - skips sibling edges (the app infers siblings from shared parents)
--   - writes import_review_history with the correct columns
-- ============================================================================

begin;

create or replace function public.import_approved_family_data(
  p_job_id uuid,
  p_family_id uuid
)
returns json
language plpgsql
security definer
set search_path = public, extensions, pg_catalog
as $$
declare
  v_job_status text;
  v_imported_people integer := 0;
  v_imported_relationships integer := 0;
  v_errors text[] := array[]::text[];
  v_person_mapping jsonb := '{}'::jsonb;
  v_extracted_member record;
  v_extracted_rel record;
  v_new_person_id uuid;
  v_new_relationship_id uuid;
  v_person1_id uuid;
  v_person2_id uuid;
  v_result json;
begin
  -- Admin check
  if not exists (
    select 1
    from public.family_memberships
    where family_id = p_family_id
      and user_id = auth.uid()
      and role = 'admin'
      and status = 'active'
  ) then
    raise exception 'Access denied: Admin permission required';
  end if;

  -- Job check
  select status
  into v_job_status
  from public.family_import_jobs
  where id = p_job_id
    and family_id = p_family_id;

  if not found then
    raise exception 'Import job not found';
  end if;

  if v_job_status not in ('approved', 'processed') then
    raise exception 'Import job is not approved (status: %)', v_job_status;
  end if;

  update public.family_import_jobs
  set status = 'importing',
      updated_at = now()
  where id = p_job_id;

  begin
    -- Import members that are verified or need review
    for v_extracted_member in
      select *
      from public.extracted_family_members
      where import_job_id = p_job_id
        and verification_status in ('verified', 'needs_review')
        and imported = false
      order by generation_level asc nulls last, full_name asc
    loop
      begin
        insert into public.family_people (
          family_id,
          full_name,
          display_name,
          gender,
          birth_date,
          birth_place,
          death_date,
          death_place,
          date_precision,
          living_status,
          biography,
          avatar_path,
          generation_level,
          branch,
          created_by,
          created_at,
          updated_at
        )
        values (
          p_family_id,
          v_extracted_member.full_name,
          coalesce(nullif(v_extracted_member.display_name, ''), v_extracted_member.full_name),
          coalesce(v_extracted_member.gender, 'unspecified'),
          v_extracted_member.birth_date,
          v_extracted_member.birth_place,
          v_extracted_member.death_date,
          v_extracted_member.death_place,
          case
            when v_extracted_member.birth_year is not null
                 and v_extracted_member.birth_date is null then 'about'
            else 'unknown'
          end,
          coalesce(v_extracted_member.living_status, 'unknown'),
          v_extracted_member.biography,
          null,
          coalesce(v_extracted_member.generation_level, 1),
          v_extracted_member.branch,
          auth.uid(),
          now(),
          now()
        )
        returning id into v_new_person_id;

        v_person_mapping := v_person_mapping ||
          jsonb_build_object(v_extracted_member.id::text, v_new_person_id::text);

        update public.extracted_family_members
        set imported = true,
            imported_person_id = v_new_person_id,
            imported_at = now(),
            updated_at = now()
        where id = v_extracted_member.id;

        v_imported_people := v_imported_people + 1;

      exception when others then
        v_errors := array_append(
          v_errors,
          'Failed to import ' || v_extracted_member.full_name || ': ' || sqlerrm
        );
      end;
    end loop;

    -- Import relationships
    for v_extracted_rel in
      select *
      from public.extracted_relationships
      where import_job_id = p_job_id
        and verification_status in ('verified', 'needs_review')
        and imported = false
      order by created_at asc
    loop
      begin
        v_person1_id := (v_person_mapping->>v_extracted_rel.source_extracted_id::text)::uuid;
        v_person2_id := (v_person_mapping->>v_extracted_rel.target_extracted_id::text)::uuid;

        if v_person1_id is null or v_person2_id is null then
          v_errors := array_append(
            v_errors,
            'Skipped relationship: one or both people not imported (' ||
              v_extracted_rel.relationship_type || ')'
          );
          continue;
        end if;

        if v_person1_id = v_person2_id then
          v_errors := array_append(v_errors, 'Skipped self-relationship');
          continue;
        end if;

        -- Canonical edges only. The main relationships table rejects
        -- 'child', 'adopted_child', 'sibling', and 'confirmed'.
        if v_extracted_rel.relationship_type = 'child' then
          insert into public.relationships (
            family_id, source_person_id, target_person_id,
            relationship_type, relationship_status, created_by, created_at
          ) values (
            p_family_id, v_person2_id, v_person1_id,
            'parent', 'verified', auth.uid(), now()
          )
          returning id into v_new_relationship_id;

        elsif v_extracted_rel.relationship_type = 'adopted_child' then
          insert into public.relationships (
            family_id, source_person_id, target_person_id,
            relationship_type, relationship_status, created_by, created_at
          ) values (
            p_family_id, v_person2_id, v_person1_id,
            'adoptive_parent', 'verified', auth.uid(), now()
          )
          returning id into v_new_relationship_id;

        elsif v_extracted_rel.relationship_type in (
          'parent', 'adoptive_parent', 'step_parent'
        ) then
          insert into public.relationships (
            family_id, source_person_id, target_person_id,
            relationship_type, relationship_status, created_by, created_at
          ) values (
            p_family_id, v_person1_id, v_person2_id,
            v_extracted_rel.relationship_type, 'verified', auth.uid(), now()
          )
          returning id into v_new_relationship_id;

        elsif v_extracted_rel.relationship_type in ('spouse', 'partner', 'guardian') then
          insert into public.relationships (
            family_id, source_person_id, target_person_id,
            relationship_type, relationship_status, created_by, created_at
          ) values (
            p_family_id, v_person1_id, v_person2_id,
            v_extracted_rel.relationship_type, 'verified', auth.uid(), now()
          )
          returning id into v_new_relationship_id;

        else
          v_errors := array_append(
            v_errors,
            'Skipped unsupported relationship type: ' || v_extracted_rel.relationship_type
          );
          continue;
        end if;

        update public.extracted_relationships
        set imported = true,
            imported_relationship_id = v_new_relationship_id,
            imported_at = now(),
            updated_at = now()
        where id = v_extracted_rel.id;

        v_imported_relationships := v_imported_relationships + 1;

      exception when others then
        v_errors := array_append(
          v_errors,
          'Failed to create relationship: ' || sqlerrm
        );
      end;
    end loop;

    update public.family_import_jobs
    set status = 'completed',
        imported_at = now(),
        imported_person_count = v_imported_people,
        imported_relationship_count = v_imported_relationships,
        processing_error = nullif(array_to_string(v_errors, '; '), ''),
        updated_at = now()
    where id = p_job_id;

    insert into public.import_review_history (
      import_job_id,
      reviewed_by,
      action,
      target_type,
      target_id,
      changes,
      notes
    ) values (
      p_job_id,
      auth.uid(),
      'job_approved',
      'job',
      p_job_id,
      jsonb_build_object(
        'importedPeople', v_imported_people,
        'importedRelationships', v_imported_relationships,
        'errorCount', coalesce(array_length(v_errors, 1), 0)
      ),
      'Import completed: ' || v_imported_people || ' people, ' ||
        v_imported_relationships || ' relationships'
    );

    v_result := json_build_object(
      'success', coalesce(array_length(v_errors, 1), 0) = 0,
      'importedPeople', v_imported_people,
      'importedRelationships', v_imported_relationships,
      'errors', v_errors,
      'personIdMapping', v_person_mapping
    );

    return v_result;

  exception when others then
    update public.family_import_jobs
    set status = 'failed',
        processing_error = sqlerrm,
        updated_at = now()
    where id = p_job_id;

    raise exception 'Import failed: %', sqlerrm;
  end;
end;
$$;

revoke all on function public.import_approved_family_data(uuid, uuid) from public;
grant execute on function public.import_approved_family_data(uuid, uuid) to authenticated;

commit;
