-- Migration: Create atomic import transaction function
-- This function handles the secure, atomic import of approved family data
-- from staging tables into the main family database

CREATE OR REPLACE FUNCTION import_approved_family_data(
  p_job_id UUID,
  p_family_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_status TEXT;
  v_imported_people INTEGER := 0;
  v_imported_relationships INTEGER := 0;
  v_errors TEXT[] := ARRAY[]::TEXT[];
  v_person_mapping JSONB := '{}'::JSONB;
  v_extracted_member RECORD;
  v_extracted_rel RECORD;
  v_new_person_id UUID;
  v_person1_id UUID;
  v_person2_id UUID;
  v_result JSON;
BEGIN
  -- Check if user has admin access to this family
  IF NOT EXISTS (
    SELECT 1 FROM family_memberships
    WHERE family_id = p_family_id
      AND user_id = auth.uid()
      AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied: Admin permission required';
  END IF;

  -- Verify job exists and belongs to this family
  SELECT status INTO v_job_status
  FROM family_import_jobs
  WHERE id = p_job_id
    AND family_id = p_family_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Import job not found';
  END IF;

  IF v_job_status != 'ready_to_import' THEN
    RAISE EXCEPTION 'Import job is not ready (status: %)', v_job_status;
  END IF;

  -- Update job status to importing
  UPDATE family_import_jobs
  SET status = 'importing',
      updated_at = NOW()
  WHERE id = p_job_id;

  -- Begin transaction for import
  BEGIN
    -- Import verified and needs_review members
    FOR v_extracted_member IN
      SELECT *
      FROM extracted_family_members
      WHERE import_job_id = p_job_id
        AND verification_status IN ('verified', 'needs_review')
      ORDER BY generation_level ASC NULLS LAST, full_name ASC
    LOOP
      BEGIN
        -- Insert into family_people
        INSERT INTO family_people (
          family_id,
          full_name,
          gender,
          birth_date,
          death_date,
          living_status,
          biography,
          created_by,
          created_at,
          updated_at
        )
        VALUES (
          p_family_id,
          v_extracted_member.full_name,
          COALESCE(v_extracted_member.gender, 'unspecified'),
          v_extracted_member.birth_date,
          v_extracted_member.death_date,
          COALESCE(v_extracted_member.living_status, 'unknown'),
          v_extracted_member.biography,
          auth.uid(),
          NOW(),
          NOW()
        )
        RETURNING id INTO v_new_person_id;

        -- Store mapping of extracted ID to actual person ID
        v_person_mapping := v_person_mapping || 
          jsonb_build_object(v_extracted_member.id::TEXT, v_new_person_id::TEXT);

        -- Update extracted member with linked_person_id
        UPDATE extracted_family_members
        SET linked_person_id = v_new_person_id,
            updated_at = NOW()
        WHERE id = v_extracted_member.id;

        v_imported_people := v_imported_people + 1;

      EXCEPTION WHEN OTHERS THEN
        v_errors := array_append(v_errors, 
          'Failed to import ' || v_extracted_member.full_name || ': ' || SQLERRM);
      END;
    END LOOP;

    -- Import verified relationships
    FOR v_extracted_rel IN
      SELECT *
      FROM extracted_relationships
      WHERE import_job_id = p_job_id
        AND verification_status IN ('verified', 'needs_review')
      ORDER BY created_at ASC
    LOOP
      BEGIN
        -- Get mapped person IDs
        v_person1_id := (v_person_mapping->>v_extracted_rel.source_extracted_id::TEXT)::UUID;
        v_person2_id := (v_person_mapping->>v_extracted_rel.target_extracted_id::TEXT)::UUID;

        -- Skip if either person wasn't imported
        IF v_person1_id IS NULL OR v_person2_id IS NULL THEN
          v_errors := array_append(v_errors,
            'Skipped relationship: one or both people not imported (' || 
            v_extracted_rel.relationship_type || ')');
          CONTINUE;
        END IF;

        -- Insert relationship based on type
        IF v_extracted_rel.relationship_type IN ('parent', 'biological_parent', 'adoptive_parent', 'step_parent') THEN
          -- Parent-child relationship
          INSERT INTO relationships (
            family_id,
            source_person_id,
            target_person_id,
            relationship_type,
            relationship_status,
            created_by,
            created_at
          )
          VALUES (
            p_family_id,
            v_person1_id,  -- parent
            v_person2_id,  -- child
            CASE 
              WHEN v_extracted_rel.relationship_type = 'adoptive_parent' THEN 'adoptive_parent'
              WHEN v_extracted_rel.relationship_type = 'step_parent' THEN 'step_parent'
              ELSE 'parent'
            END,
            'confirmed',
            auth.uid(),
            NOW()
          );

          v_imported_relationships := v_imported_relationships + 1;

        ELSIF v_extracted_rel.relationship_type IN ('spouse', 'partner') THEN
          -- Spouse/partner relationship
          INSERT INTO relationships (
            family_id,
            source_person_id,
            target_person_id,
            relationship_type,
            relationship_status,
            created_by,
            created_at
          )
          VALUES (
            p_family_id,
            v_person1_id,
            v_person2_id,
            v_extracted_rel.relationship_type,
            'confirmed',
            auth.uid(),
            NOW()
          );

          v_imported_relationships := v_imported_relationships + 1;

        ELSIF v_extracted_rel.relationship_type = 'sibling' THEN
          -- Sibling relationship
          INSERT INTO relationships (
            family_id,
            source_person_id,
            target_person_id,
            relationship_type,
            relationship_status,
            created_by,
            created_at
          )
          VALUES (
            p_family_id,
            v_person1_id,
            v_person2_id,
            'sibling',
            'confirmed',
            auth.uid(),
            NOW()
          );

          v_imported_relationships := v_imported_relationships + 1;

        ELSE
          v_errors := array_append(v_errors,
            'Unknown relationship type: ' || v_extracted_rel.relationship_type);
        END IF;

      EXCEPTION WHEN OTHERS THEN
        v_errors := array_append(v_errors,
          'Failed to create relationship: ' || SQLERRM);
      END;
    END LOOP;

    -- Update job status
    UPDATE family_import_jobs
    SET status = CASE 
                   WHEN array_length(v_errors, 1) > 0 THEN 'completed_with_errors'
                   ELSE 'completed'
                 END,
        completed_at = NOW(),
        import_summary = jsonb_build_object(
          'importedPeople', v_imported_people,
          'importedRelationships', v_imported_relationships,
          'errorCount', COALESCE(array_length(v_errors, 1), 0),
          'errors', v_errors,
          'personMapping', v_person_mapping
        ),
        updated_at = NOW()
    WHERE id = p_job_id;

    -- Record in review history
    INSERT INTO import_review_history (
      import_job_id,
      action_type,
      changes,
      notes,
      created_at
    )
    VALUES (
      p_job_id,
      'complete_import',
      jsonb_build_object(
        'importedPeople', v_imported_people,
        'importedRelationships', v_imported_relationships,
        'errorCount', COALESCE(array_length(v_errors, 1), 0)
      ),
      'Import completed: ' || v_imported_people || ' people, ' || 
        v_imported_relationships || ' relationships',
      NOW()
    );

    -- Build result JSON
    v_result := json_build_object(
      'success', CASE WHEN array_length(v_errors, 1) IS NULL OR array_length(v_errors, 1) = 0 
                      THEN true ELSE false END,
      'importedPeople', v_imported_people,
      'importedRelationships', v_imported_relationships,
      'errors', v_errors,
      'personIdMapping', v_person_mapping
    );

    RETURN v_result;

  EXCEPTION WHEN OTHERS THEN
    -- Rollback will happen automatically
    -- Update job to failed status
    UPDATE family_import_jobs
    SET status = 'failed',
        import_summary = jsonb_build_object('error', SQLERRM),
        updated_at = NOW()
    WHERE id = p_job_id;

    RAISE EXCEPTION 'Import failed: %', SQLERRM;
  END;
END;
$$;

-- Grant execute permission to authenticated users
-- RLS will check admin permission inside the function
GRANT EXECUTE ON FUNCTION import_approved_family_data(UUID, UUID) TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION import_approved_family_data IS 
  'Atomically imports approved family data from staging tables to main tables. ' ||
  'Requires admin permission. Returns JSON with import results.';
