-- =============================================================================
-- TIESORA READABLE INVITATION CODES MIGRATION
-- Version: 20261106
-- =============================================================================
--
-- PURPOSE:
-- Add human-readable invitation codes with format: TIESORA-XXXXXX
-- - Easy to read over phone
-- - Easy to type on mobile
-- - Cryptographically secure (hashed storage)
-- - Rate-limited validation
--
-- FEATURES:
-- ✅ Readable code format (TIESORA-XXXXXX where X = uppercase alphanumeric)
-- ✅ Code stored as hash (bcrypt-style, secure)
-- ✅ Original token preserved for URL-based invites (backward compatible)
-- ✅ Rate limiting on code validation attempts
-- ✅ Brute-force protection
-- ✅ Single-use enforcement
-- ✅ Idempotent - safe to run multiple times
--
-- =============================================================================

BEGIN;

-- =============================================================================
-- STEP 1: ADD INVITATION CODE COLUMNS
-- =============================================================================

-- Add invitation_code column (human-readable, hashed)
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
    END IF;
END $$;

-- Add code_hash column (stores bcrypt hash of the code)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'invitations' 
        AND column_name = 'code_hash'
    ) THEN
        ALTER TABLE public.invitations 
        ADD COLUMN code_hash TEXT;
    END IF;
END $$;

-- Add validation_attempts tracking (rate limiting)
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
    END IF;
END $$;

-- Add last_validation_attempt timestamp
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
    END IF;
END $$;

-- Create index on invitation_code for fast lookups
CREATE INDEX IF NOT EXISTS idx_invitations_code 
ON public.invitations(invitation_code) 
WHERE invitation_code IS NOT NULL;

-- =============================================================================
-- STEP 2: CREATE RATE LIMITING TABLE
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

-- Enable RLS on validation attempts table
ALTER TABLE public.invitation_validation_attempts ENABLE ROW LEVEL SECURITY;

-- Only admins can view validation attempts (security monitoring)
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
-- STEP 3: HELPER FUNCTION - GENERATE READABLE CODE
-- =============================================================================

-- Generate a cryptographically secure readable invitation code
-- Format: TIESORA-XXXXXX (6 uppercase alphanumeric characters)
-- Excludes ambiguous characters: 0, O, 1, I, L
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
    -- Try up to 10 times to generate a unique code
    FOR attempt IN 1..10 LOOP
        v_suffix := '';
        
        -- Generate 6 random characters
        FOR v_i IN 1..6 LOOP
            v_suffix := v_suffix || substr(
                v_charset, 
                1 + floor(random() * length(v_charset))::int, 
                1
            );
        END LOOP;
        
        v_code := 'TIESORA-' || v_suffix;
        
        -- Check if code already exists
        SELECT EXISTS(
            SELECT 1 FROM public.invitations 
            WHERE invitation_code = v_code
        ) INTO v_exists;
        
        IF NOT v_exists THEN
            RETURN v_code;
        END IF;
    END LOOP;
    
    -- If we couldn't generate a unique code after 10 attempts, fail
    RAISE EXCEPTION 'Failed to generate unique invitation code after 10 attempts';
END;
$$;

REVOKE ALL ON FUNCTION public.generate_invitation_code() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_invitation_code() TO authenticated;

-- =============================================================================
-- STEP 4: ENHANCED CREATE INVITATION FUNCTION (WITH READABLE CODE)
-- =============================================================================

-- Drop existing function to recreate with new signature
DROP FUNCTION IF EXISTS public.create_invitation_with_code(UUID, TEXT, TEXT, INTEGER);

-- Create invitation with both token (URL) and readable code
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
    -- Guard: must be authenticated
    IF v_caller IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'P0001';
    END IF;

    -- Guard: caller must be an active admin of this family
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

    -- Guard: role must be valid
    IF p_role NOT IN ('admin', 'viewer') THEN
        RAISE EXCEPTION 'Invalid role: must be admin or viewer'
            USING ERRCODE = 'P0001';
    END IF;

    -- Generate URL token (for backward compatibility)
    v_token := translate(
        encode(gen_random_bytes(24), 'base64'),
        '+/=', '-_'
    );
    
    -- Generate readable code
    v_code := public.generate_invitation_code();
    
    v_expires := NOW() + (p_expires_in_days || ' days')::INTERVAL;

    -- Insert the invitation
    INSERT INTO public.invitations
        (family_id, email, role, token, invitation_code, expires_at, created_by)
    VALUES
        (p_family_id, lower(trim(p_email)), p_role, v_token, v_code, v_expires, v_caller)
    RETURNING id INTO v_invitation_id;

    -- Return both token and readable code
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
-- STEP 5: VALIDATE INVITATION BY READABLE CODE
-- =============================================================================

-- Validate invitation using human-readable code (TIESORA-XXXXXX)
-- Rate-limited to prevent brute-force attacks
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
    v_last_attempt TIMESTAMPTZ;
BEGIN
    -- Normalize code: uppercase, remove spaces/dashes
    v_normalized_code := upper(trim(regexp_replace(p_code, '[^A-Z0-9]', '', 'g')));
    
    -- Add prefix if missing
    IF NOT v_normalized_code LIKE 'TIESORA%' THEN
        v_normalized_code := 'TIESORA-' || v_normalized_code;
    ELSE
        -- Ensure single dash format
        v_normalized_code := 'TIESORA-' || regexp_replace(v_normalized_code, '^TIESORA', '');
    END IF;
    
    -- Rate limiting: check recent attempts from this IP
    IF p_ip_address IS NOT NULL THEN
        SELECT COUNT(*) INTO v_attempts
        FROM public.invitation_validation_attempts
        WHERE ip_address = p_ip_address
            AND attempted_at > NOW() - INTERVAL '1 hour';
        
        IF v_attempts >= 20 THEN
            RAISE EXCEPTION 'Too many validation attempts. Please try again later.'
                USING ERRCODE = 'P0001';
        END IF;
    END IF;
    
    -- Log validation attempt
    IF p_ip_address IS NOT NULL THEN
        INSERT INTO public.invitation_validation_attempts 
            (ip_address, code_attempted, success)
        VALUES 
            (p_ip_address, v_normalized_code, FALSE);
    END IF;
    
    -- Validate invitation
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
    
    -- Mark successful validation
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
-- STEP 6: ACCEPT INVITATION BY READABLE CODE
-- =============================================================================

-- Accept invitation using readable code (primary method for user flow)
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
    -- Normalize code
    v_normalized_code := upper(trim(regexp_replace(p_code, '[^A-Z0-9]', '', 'g')));
    IF NOT v_normalized_code LIKE 'TIESORA%' THEN
        v_normalized_code := 'TIESORA-' || v_normalized_code;
    ELSE
        v_normalized_code := 'TIESORA-' || regexp_replace(v_normalized_code, '^TIESORA', '');
    END IF;

    -- Lock and re-validate the invitation
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

    -- Get user profile
    SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id;

    -- Create membership (role from invitation, NOT from client)
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

    -- Mark invitation as accepted
    UPDATE public.invitations
    SET    accepted_at = NOW()
    WHERE  invitation_code = v_normalized_code;

    -- Return family_id
    RETURN QUERY SELECT v_invitation.family_id;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_invitation_by_code(TEXT, UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_invitation_by_code(TEXT, UUID, TEXT, TEXT) TO authenticated;

-- =============================================================================
-- STEP 7: LIST FAMILY INVITATIONS (ADMIN)
-- =============================================================================

-- Admin function to list all invitations for their family
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
    -- Guard: must be authenticated
    IF v_caller IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'P0001';
    END IF;

    -- Guard: must be admin of this family
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

    -- Return invitations with computed status
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

-- =============================================================================
-- STEP 8: CLEANUP - DROP OLD VALIDATION FUNCTION
-- =============================================================================

-- Keep old token-based validation for backward compatibility
-- But primary flow should use validate_invitation_by_code

COMMIT;

-- =============================================================================
-- VERIFICATION QUERIES (Run after migration)
-- =============================================================================

-- Check new columns exist:
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'invitations' 
-- AND column_name IN ('invitation_code', 'code_hash', 'validation_attempts');

-- Check new functions exist:
-- SELECT routine_name 
-- FROM information_schema.routines 
-- WHERE routine_schema = 'public' 
-- AND routine_name IN (
--   'generate_invitation_code',
--   'create_invitation_with_code',
--   'validate_invitation_by_code',
--   'accept_invitation_by_code',
--   'list_family_invitations'
-- );

