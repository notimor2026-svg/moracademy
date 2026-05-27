
-- 1) Add super_admin to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';

-- 2) Helper function: is_super_admin (uses text cast to avoid same-tx enum literal)
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role::text = 'super_admin'
  )
$$;

-- 3) Policies on user_roles for super_admin management
DROP POLICY IF EXISTS "user_roles super_admin read" ON public.user_roles;
CREATE POLICY "user_roles super_admin read" ON public.user_roles
  FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "user_roles super_admin insert" ON public.user_roles;
CREATE POLICY "user_roles super_admin insert" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "user_roles super_admin delete" ON public.user_roles;
CREATE POLICY "user_roles super_admin delete" ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "user_roles super_admin update" ON public.user_roles;
CREATE POLICY "user_roles super_admin update" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- 4) Allow super_admin to also update/insert employees beyond rrhh
DROP POLICY IF EXISTS "emp super_admin update" ON public.employees;
CREATE POLICY "emp super_admin update" ON public.employees
  FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()));
