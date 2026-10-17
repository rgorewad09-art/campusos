-- =============================================================================
-- Migration: 008_fix_profiles_trigger_nullif.sql
-- Description: Corrects PostgreSQL built-in function qualification and cleanly
--              separates INSERT and UPDATE paths in protect_profiles_role().
--
-- ROOT CAUSE:
-- 1. In PostgreSQL, `NULLIF` is a built-in grammar construct (like COALESCE or CASE),
--    NOT a function in pg_catalog. Attempting to call `pg_catalog.nullif(...)`
--    causes PostgreSQL error 42883: function pg_catalog.nullif does not exist.
-- 2. Similarly, `TRIM` is an SQL grammar construct; the actual function in pg_catalog
--    is `pg_catalog.btrim(text)`. Calling `pg_catalog.trim(text)` causes error 42883.
-- 3. In modern PostgREST / Supabase, the verified role claim is stored in
--    `request.jwt.claims` JSON object rather than `request.jwt.claim.role`.
-- 4. Role normalization on UPDATE is unnecessary and dangerous; role immutability
--    is strictly enforced by comparing OLD.role and NEW.role directly.
--
-- SECURITY PRESERVATION:
-- - Service-role and database administrator bypasses are strictly preserved.
-- - Role immutability on UPDATE is strictly preserved: any role change throws 42501.
-- - Ordinary INSERTs cannot create elevated roles ('admin', 'teacher') (throws 42501).
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.protect_profiles_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_jwt_role text;
  v_raw_claims text;
  v_normalized_new_role text;
BEGIN
  -- ---------------------------------------------------------------------------
  -- 1. Identify execution context:
  --    Extract the verified JWT role set by PostgREST from the incoming request.
  -- ---------------------------------------------------------------------------
  -- Check standard individual claim setting
  v_jwt_role := NULLIF(pg_catalog.current_setting('request.jwt.claim.role', true), '');

  -- Also check PostgREST full claims JSON if claim.role is not individually present
  IF v_jwt_role IS NULL THEN
    v_raw_claims := NULLIF(pg_catalog.current_setting('request.jwt.claims', true), '');
    IF v_raw_claims IS NOT NULL THEN
      BEGIN
        v_jwt_role := NULLIF(v_raw_claims::jsonb ->> 'role', '');
      EXCEPTION WHEN OTHERS THEN
        v_jwt_role := NULL;
      END;
    END IF;
  END IF;

  IF v_jwt_role IS NOT NULL THEN
    -- A. PostgREST API Request:
    -- Only requests authenticated with the Supabase service_role key may bypass
    IF v_jwt_role = 'service_role' THEN
      RETURN NEW;
    END IF;
    -- Any other API caller ('authenticated', 'anon', etc.) proceeds to strict checks below
  ELSE
    -- B. Direct Database Session (psql, Supabase SQL Editor, migrations):
    -- Only genuine database administrators may bypass
    IF SESSION_USER IN ('postgres', 'supabase_admin') THEN
      RETURN NEW;
    END IF;
  END IF;

  -- ---------------------------------------------------------------------------
  -- 2. Handle UPDATE operations:
  --    Strictly prevent modifying the role column.
  --    Profile updates that leave 'role' unchanged (e.g. display_name, updated_at)
  --    are permitted without executing string normalization logic.
  -- ---------------------------------------------------------------------------
  IF TG_OP = 'UPDATE' THEN
    IF NEW.role IS NOT DISTINCT FROM OLD.role THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'Modifying profile role is forbidden. Current: %, Attempted: %.',
      OLD.role, NEW.role
      USING ERRCODE = '42501';
  END IF;

  -- ---------------------------------------------------------------------------
  -- 3. Handle INSERT operations:
  --    Application users cannot assign elevated roles ('admin', 'teacher').
  --    Uses pg_catalog.btrim and pg_catalog.lower for schema-isolated normalization.
  -- ---------------------------------------------------------------------------
  IF TG_OP = 'INSERT' THEN
    IF NEW.role IS NULL OR pg_catalog.btrim(NEW.role::text) = '' THEN
      NEW.role := 'student';
    ELSE
      v_normalized_new_role := pg_catalog.lower(pg_catalog.btrim(NEW.role::text));
      IF v_normalized_new_role NOT IN ('student', 'teacher', 'admin') THEN
        RAISE EXCEPTION 'Invalid role specified: %. Permitted roles: student, teacher, admin.', NEW.role
          USING ERRCODE = '22023';
      ELSIF v_normalized_new_role IN ('admin', 'teacher') THEN
        RAISE EXCEPTION 'Unauthorized: Only service_role can assign % role.', v_normalized_new_role
          USING ERRCODE = '42501';
      END IF;
      NEW.role := v_normalized_new_role;
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.protect_profiles_role() IS 
'Enforces role immutability and blocks unauthorized role escalation on public.profiles.';

-- Re-bind trigger to ensure clean trigger definition state
DROP TRIGGER IF EXISTS trg_protect_profiles_role ON public.profiles;

CREATE TRIGGER trg_protect_profiles_role
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profiles_role();

COMMIT;
