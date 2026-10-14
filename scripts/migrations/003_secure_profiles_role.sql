-- ==============================================================================
-- Migration: 003_secure_profiles_role.sql
-- Purpose: Remediate SEC-01 (Role Escalation Protection on public.profiles)
-- Status: REVIEW ONLY — Do NOT apply automatically without administrator sign-off.
-- ==============================================================================
--
-- SECURITY ARCHITECTURE & BEHAVIOR:
-- 1. No CURRENT_USER Bypass:
--    Avoids using CURRENT_USER to establish caller identity. In a SECURITY DEFINER
--    function, CURRENT_USER always evaluates to the function owner (postgres),
--    which previously created an unintended bypass.
--
-- 2. Strict Execution Environment Isolation:
--    - PostgREST API requests: The trigger verifies request.jwt.claim.role.
--      Only 'service_role' (cryptographically verified by PostgREST via JWT secret)
--      can bypass role restrictions.
--    - Direct database sessions (psql, Supabase SQL Editor, migrations):
--      When request.jwt.claim.role is absent, the trigger verifies that
--      SESSION_USER is a genuine database administrator ('postgres', 'supabase_admin').
--
-- 3. Strict Application Role Immutability:
--    - UPDATE: Any attempt by application users ('authenticated', 'anon') to change
--      'role' is unconditionally rejected with error 42501.
--    - INSERT: Application users cannot assign elevated roles ('admin', 'teacher').
--
-- 4. Legitimate Server-Side Provisioning:
--    Administrative provisioning remains fully functional via server actions utilizing
--    the server-only SUPABASE_SERVICE_ROLE_KEY (adminClient) or direct SQL migrations.
-- ==============================================================================

BEGIN;

-- 1. Create or replace the protective trigger function with empty search_path
CREATE OR REPLACE FUNCTION public.protect_profiles_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_jwt_role text;
  v_normalized_new_role text;
BEGIN
  -- ---------------------------------------------------------------------------
  -- 1. Identify execution context:
  --    Extract the verified JWT role set by PostgREST from the incoming request.
  -- ---------------------------------------------------------------------------
  v_jwt_role := pg_catalog.nullif(pg_catalog.current_setting('request.jwt.claim.role', true), '');

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
  --    Application users cannot change their own or another user's role.
  --    Profile updates that leave 'role' unchanged are permitted.
  -- ---------------------------------------------------------------------------
  IF TG_OP = 'UPDATE' THEN
    IF NEW.role IS NOT DISTINCT FROM OLD.role THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'Access denied: role modification is strictly prohibited through the application API.'
      USING ERRCODE = '42501';
  END IF;

  -- ---------------------------------------------------------------------------
  -- 3. Handle INSERT operations:
  --    Ordinary users and client requests cannot assign 'admin' or 'teacher' roles.
  --    Only trusted service_role or database administrators can create elevated roles.
  -- ---------------------------------------------------------------------------
  IF TG_OP = 'INSERT' THEN
    v_normalized_new_role := pg_catalog.lower(pg_catalog.trim(COALESCE(NEW.role, '')));
    IF v_normalized_new_role IN ('admin', 'teacher') THEN
      RAISE EXCEPTION 'Access denied: administrative and staff account provisioning requires service_role or database administrator privileges.'
        USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.protect_profiles_role() IS 
'Enforces role immutability on public.profiles for application callers without relying on CURRENT_USER.';

-- 2. Bind the trigger to public.profiles for both INSERT and UPDATE
DROP TRIGGER IF EXISTS trg_protect_profiles_role ON public.profiles;

CREATE TRIGGER trg_protect_profiles_role
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profiles_role();

COMMENT ON TRIGGER trg_protect_profiles_role ON public.profiles IS
'Triggers validation on public.profiles to block unauthorized role assignments and escalations (SEC-01).';

COMMIT;
