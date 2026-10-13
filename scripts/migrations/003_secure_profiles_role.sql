-- ==============================================================================
-- Migration: 003_secure_profiles_role.sql
-- Purpose: Remediate SEC-01 (Role Escalation Protection on public.profiles)
-- Status: REVIEW ONLY — Do NOT apply automatically without administrator sign-off.
-- ==============================================================================
--
-- SECURITY ARCHITECTURE & BEHAVIOR:
-- 1. Strict Search Path:
--    The SECURITY DEFINER function sets search_path = '' and fully qualifies all
--    references to pg_catalog, eliminating search path hijacking risks.
--
-- 2. No Application Role Mutations:
--    Role changes are rejected for ALL application users (including existing
--    administrators) when connecting via the standard PostgREST application API.
--    This prevents privilege escalation even in the event of administrator session theft.
--
-- 3. Dedicated Service Role / Admin Bypass:
--    Only direct database sessions ('postgres') or verified Supabase 'service_role'
--    connections (validated cryptographically by PostgREST via JWT_SECRET) can
--    assign or modify user roles.
--
-- 4. INSERT Hardening:
--    Prevents creation of new 'admin' accounts through client signup or direct
--    INSERT calls. Initial admin provisioning remains fully functional via direct
--    database migrations, seed scripts, or service_role operations.
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
  -- 1. Check for trusted administrative execution environments:
  --    - Direct PostgreSQL session as 'postgres' or 'service_role'
  --    - Authenticated API request utilizing the Supabase service_role key
  -- ---------------------------------------------------------------------------
  IF pg_catalog.current_user IN ('postgres', 'service_role') THEN
    RETURN NEW;
  END IF;

  v_jwt_role := pg_catalog.nullif(pg_catalog.current_setting('request.jwt.claim.role', true), '');
  IF v_jwt_role = 'service_role' THEN
    RETURN NEW;
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
  --    Ordinary users and client requests cannot assign the 'admin' role.
  --    Only trusted service_role or database administrators can create admins.
  -- ---------------------------------------------------------------------------
  IF TG_OP = 'INSERT' THEN
    v_normalized_new_role := pg_catalog.lower(pg_catalog.trim(pg_catalog.coalesce(NEW.role, '')));
    IF v_normalized_new_role = 'admin' THEN
      RAISE EXCEPTION 'Access denied: administrator account provisioning requires service_role or database administrator privileges.'
        USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.protect_profiles_role() IS 
'Enforces immutability on public.profiles.role for application callers, preventing privilege escalation.';

-- 2. Bind the trigger to public.profiles for both INSERT and UPDATE
DROP TRIGGER IF EXISTS trg_protect_profiles_role ON public.profiles;

CREATE TRIGGER trg_protect_profiles_role
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profiles_role();

COMMENT ON TRIGGER trg_protect_profiles_role ON public.profiles IS
'Triggers validation on public.profiles to block unauthorized role assignments and escalations (SEC-01).';

COMMIT;
