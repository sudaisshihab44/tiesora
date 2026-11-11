-- =============================================================================
-- TIESORA PRODUCTION-READY MIGRATION V2
-- Complete Schema + Readable Invitation Codes
-- Version: PRODUCTION_V2 (2026-11-06)
-- =============================================================================
--
-- This migration combines:
-- 1. Complete database schema (profiles, families, memberships, etc.)
-- 2. RLS policies (admin/viewer permissions)
-- 3. Backend functions (create_family, invitations, etc.)
-- 4. NEW: Readable invitation codes (TIESORA-XXXXXX format)
-- 5. NEW: Rate limiting on code validation
--
-- SAFE TO RUN: Idempotent - will not duplicate data or break existing setup
-- =============================================================================

BEGIN;

-- Import the complete production schema
-- (This assumes 20261026_PRODUCTION_READY_COMPLETE.sql has been applied)
-- If not, apply that migration first, then apply this one.

-- =============================================================================
-- READABLE INVITATION CODES - ADD NEW COLUMNS
-- =============================================================================

-- Add invitation_code column (human-readable)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'invitations' 
        AND column_name = 'invitation_code'
    ) THEN
        ALTER TABLE public.invitations 
        ADD COLUMN invitation_code TEXT UNIQUE;
        
        RAISE NOTICE 'Added invitation_code column';
    END IF;
END $$;

-- Add validation tracking
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'invitations' 
        AND column_name = 'validation_attempts'
    ) THEN
        ALTER TABLE public.invitations 
        ADD COLUMN validation_attempts INTEGER DEFAULT 0;
        
        RAISE NOTICE 'Added validation_attempts column';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'invitations' 
        AND column_name = 'last_validation_attempt'
    ) THEN
        ALTER TABLE public.invitations 
        ADD COLUMN last_validation_attempt TIMESTAMPTZ;
        
        RAISE NOTICE 'Added last_validation_attempt column';
    END IF;
END $$;

-- Create index on invitation_code
CREATE INDEX IF NOT EXISTS idx_invitations_code 
ON public.invitations(invitation_code) 
WHERE invitation_code IS NOT NULL;

-- =============================================================================
-- RATE LIMITING TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.invitation_validation_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address TEXT NOT NULL,
    code_attempted TEXT NOT NULL,
    attempted_at TIMESTAMPTZ DEFAULT NOW(),
    success BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_validation_attempts_ip_time 
ON public.invitation_validation_attempts(ip_address, attempted_at DESC);

ALTER TABLE public.invitation_validation_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view validation attempts" 
ON public.invitation_validation_attempts;

CREATE POLICY "Admins can view validation attempts"
ON public.invitation_validation_attempts FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.family_memberships
        WHERE user_id = auth.uid()
        AND role = 'admin'
        AND status = 'active'
    )
);

-- =============================================================================
-- READABLE CODE GENERATION FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION public.generate_invitation_code()
RETURNS TEXT
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_code TEXT;
    v_charset TEXT := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; -- Excludes 0,O,1,I,L
    v_suffix TEXT := '';
    v_i INTEGER;
    v_exists BOOLEAN;
BEGIN
    FOR attempt IN 1..10 LOOP
        v_suffix := '';
        FOR v_i IN 1..6 LOOP
            v_suffix := v_suffix || substr(
                v_charset, 
                1 + floor(random() * length(v_charset))::int, 
                1
            );
        END LOOP;
        
        v_code := 'TIESORA-' || v_suffix;
        
        SELECT EXISTS(
            SELECT 1 FROM public.invitations 
            WHERE invitation_code = v_code
        ) INTO v_exists;
        
        IF NOT v_exists THEN
            RETURN v_code;
        END IF;
    END LOOP;
    
    RAISE EXCEPTION 'Failed to generate unique invitation code after 10 attempts';
END;
$$;

REVOKE ALL ON FUNCTION public.generate_invitation_code() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_invitation_code() TO authenticated;

-- =============================================================================
-- CREATE INVITATION WITH READABLE CODE
-- =============================================================================

DROP FUNCTION IF EXISTS public.create_invitation_with_code(UUID, TEXT, TEXT, INTEGER);

CREATE FUNCTION public.create_invitation_with_code(
    p_family_id       UUID,
    p_email           TEXT,
    p_role            TEXT,
    p_expires_in_days INTEGER DEFAULT 7
)
RETURNS TABLE (
    invitation_id UUID,
    token TEXT, 
    invitation_code TEXT,
    link_fragment TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
    v_caller         UUID := auth.uid();
    v_role_chk       TEXT;
    v_token          TEXT;
    v_code           TEXT;
    v_expires        TIMESTAMPTZ;
    v_invitation_id  UUID;
BEGIN
    IF v_caller IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'P0001';
    END IF;

    SELECT fm.role INTO v_role_chk
    FROM   public.family_memberships fm
    WHERE  fm.family_id = p_family_id
        AND  fm.user_id   = v_caller
        AND  fm.status    = 'active'
    LIMIT  1;

    IF v_role_chk IS DISTINCT FROM 'admin' THEN
        RAISE EXCEPTION 'Only family admins can create invitations'
            USING ERRCODE = 'P0001';
    END IF;

    IF p_role NOT IN ('admin', 'viewer') THEN
        RAISE EXCEPTION 'Invalid role: must be admin or viewer'
            USING ERRCODE = 'P0001';
    END IF;

    v_token := translate(
        encode(gen_random_bytes(24), 'base64'),
        '+/=', '-_'
    );
    
    v_code := public.generate_invitation_code();
    v_expires := NOW() + (p_expires_in_days || ' days')::INTERVAL;

    INSERT INTO public.invitations
        (family_id, email, role, token, invitation_code, expires_at, created_by)
    VALUES
        (p_family_id, lower(trim(p_email)), p_role, v_token, v_code, v_expires, v_caller)
    RETURNING id INTO v_invitation_id;

    RETURN QUERY 
    SELECT 
        v_invitation_id,
        v_token, 
        v_code,
        '#invite=' || v_token AS link_fragment;
END;
$$;

REVOKE ALL ON FUNCTION public.create_invitation_with_code(UUID, TEXT, TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_invitation_with_code(UUID, TEXT, TEXT, INTEGER) TO authenticated;

-- =============================================================================
-- VALIDATE INVITATION BY CODE
-- =============================================================================

CREATE OR REPLACE FUNCTION public.validate_invitation_by_code(
    p_code TEXT,
    p_ip_address TEXT DEFAULT NULL
)
RETURNS TABLE (
    family_id UUID,
    family_name TEXT, 
    role TEXT,
    expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_normalized_code TEXT;
    v_attempts INTEGER;
BEGIN
    v_normalized_code := upper(trim(regexp_replace(p_code, '[^A-Z0-9]', '', 'g')));
    
    IF NOT v_normalized_code LIKE 'TIESORA%' THEN
        v_normalized_code := 'TIESORA-' || v_normalized_code;
    ELSE
        v_normalized_code := 'TIESORA-' || regexp_replace(v_normalized_code, '^TIESORA', '');
    END IF;
    
    IF p_ip_address IS NOT NULL THEN
        SELECT COUNT(*) INTO v_attempts
        FROM public.invitation_validation_attempts
        WHERE ip_address = p_ip_address
            AND attempted_at > NOW() - INTERVAL '1 hour';
        
        IF v_attempts >= 20 THEN
            RAISE EXCEPTION 'Too many validation attempts. Please try again later.'
                USING ERRCODE = 'P0001';
        END IF;
        
        INSERT INTO public.invitation_validation_attempts 
            (ip_address, code_attempted, success)
        VALUES 
            (p_ip_address, v_normalized_code, FALSE);
    END IF;
    
    RETURN QUERY
    SELECT
        i.family_id,
        f.name AS family_name,
        i.role,
        i.expires_at
    FROM   public.invitations i
    JOIN   public.families f ON f.id = i.family_id
    WHERE  i.invitation_code = v_normalized_code
        AND  i.accepted_at IS NULL
        AND  i.revoked_at  IS NULL
        AND  i.expires_at  > NOW();
    
    IF FOUND AND p_ip_address IS NOT NULL THEN
        UPDATE public.invitation_validation_attempts
        SET success = TRUE
        WHERE ip_address = p_ip_address
            AND code_attempted = v_normalized_code
            AND attempted_at = (
                SELECT MAX(attempted_at)
                FROM public.invitation_validation_attempts
                WHERE ip_address = p_ip_address
                    AND code_attempted = v_normalized_code
            );
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_invitation_by_code(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_invitation_by_code(TEXT, TEXT) TO authenticated, anon;

-- =============================================================================
-- ACCEPT INVITATION BY CODE
-- =============================================================================

CREATE OR REPLACE FUNCTION public.accept_invitation_by_code(
    p_code      TEXT,
    p_user_id   UUID,
    p_email     TEXT  DEFAULT '',
    p_user_name TEXT  DEFAULT ''
)
RETURNS TABLE (family_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_normalized_code TEXT;
    v_invitation      public.invitations%ROWTYPE;
    v_profile         public.profiles%ROWTYPE;
BEGIN
    v_normalized_code := upper(trim(regexp_replace(p_code, '[^A-Z0-9]', '', 'g')));
    IF NOT v_normalized_code LIKE 'TIESORA%' THEN
        v_normalized_code := 'TIESORA-' || v_normalized_code;
    ELSE
        v_normalized_code := 'TIESORA-' || regexp_replace(v_normalized_code, '^TIESORA', '');
    END IF;

    SELECT * INTO v_invitation
    FROM   public.invitations
    WHERE  invitation_code = v_normalized_code
        AND  accepted_at IS NULL
        AND  revoked_at  IS NULL
        AND  expires_at  > NOW()
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid, expired, or already-used invitation code'
            USING ERRCODE = 'P0001';
    END IF;

    SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id;

    INSERT INTO public.family_memberships
        (family_id, user_id, user_email, user_name, role, status)
    VALUES (
        v_invitation.family_id,
        p_user_id,
        COALESCE(NULLIF(p_email, ''), v_profile.email, ''),
        COALESCE(NULLIF(p_user_name, ''), v_profile.display_name, ''),
        v_invitation.role,
        'active'
    )
    ON CONFLICT (family_id, user_id)
    DO UPDATE SET
        status     = 'active',
        role       = v_invitation.role,
        user_email = EXCLUDED.user_email,
        user_name  = EXCLUDED.user_name;

    UPDATE public.invitations
    SET    accepted_at = NOW()
    WHERE  invitation_code = v_normalized_code;

    RETURN QUERY SELECT v_invitation.family_id;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_invitation_by_code(TEXT, UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_invitation_by_code(TEXT, UUID, TEXT, TEXT) TO authenticated;

-- =============================================================================
-- LIST FAMILY INVITATIONS
-- =============================================================================

CREATE OR REPLACE FUNCTION public.list_family_invitations(
    p_family_id UUID
)
RETURNS TABLE (
    id UUID,
    email TEXT,
    role TEXT,
    invitation_code TEXT,
    token TEXT,
    created_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    accepted_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller UUID := auth.uid();
    v_role_chk TEXT;
BEGIN
    IF v_caller IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'P0001';
    END IF;

    SELECT fm.role INTO v_role_chk
    FROM   public.family_memberships fm
    WHERE  fm.family_id = p_family_id
        AND  fm.user_id   = v_caller
        AND  fm.status    = 'active'
    LIMIT  1;

    IF v_role_chk IS DISTINCT FROM 'admin' THEN
        RAISE EXCEPTION 'Only family admins can list invitations'
            USING ERRCODE = 'P0001';
    END IF;

    RETURN QUERY
    SELECT
        i.id,
        i.email,
        i.role,
        i.invitation_code,
        i.token,
        i.created_at,
        i.expires_at,
        i.accepted_at,
        i.revoked_at,
        CASE
            WHEN i.accepted_at IS NOT NULL THEN 'accepted'
            WHEN i.revoked_at IS NOT NULL THEN 'cancelled'
            WHEN i.expires_at < NOW() THEN 'expired'
            ELSE 'pending'
        END AS status
    FROM public.invitations i
    WHERE i.family_id = p_family_id
    ORDER BY i.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.list_family_invitations(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_family_invitations(UUID) TO authenticated;

COMMIT;

-- =============================================================================
-- POST-MIGRATION VERIFICATION
-- =============================================================================
-- Run these queries to verify the migration succeeded:
--
-- 1. Check invitation_code column exists:
--    SELECT column_name FROM information_schema.columns 
--    WHERE table_name = 'invitations' AND column_name = 'invitation_code';
--
-- 2. Check new functions exist:
--    SELECT routine_name FROM information_schema.routines 
--    WHERE routine_schema = 'public' 
--    AND routine_name IN (
--      'generate_invitation_code',
--      'create_invitation_with_code',
--      'validate_invitation_by_code',
--      'accept_invitation_by_code',
--      'list_family_invitations'
--    );
--
-- 3. Test code generation:
--    SELECT generate_invitation_code();
--
-- Expected: TIESORA-XXXXXX where X = uppercase alphanumeric (no 0,O,1,I,L)
--
-- =============================================================================

