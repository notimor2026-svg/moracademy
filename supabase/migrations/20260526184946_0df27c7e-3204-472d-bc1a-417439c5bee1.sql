
-- Helper functions (SECURITY DEFINER) para evitar recursión en RLS de employees
CREATE OR REPLACE FUNCTION public.current_employee_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.employees WHERE auth_user_id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_manager_of(_employee_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.id = _employee_id
      AND e.jefe_id = public.current_employee_id()
  )
$$;

-- Reemplaza política recursiva en employees
DROP POLICY IF EXISTS "emp self read" ON public.employees;
CREATE POLICY "emp self read"
ON public.employees FOR SELECT
TO authenticated
USING (
  auth_user_id = auth.uid()
  OR public.has_role(auth.uid(), 'rrhh')
  OR jefe_id = public.current_employee_id()
);

-- También arregla las políticas dependientes que hacen subselect sobre employees
DROP POLICY IF EXISTS "cert read" ON public.certificates;
CREATE POLICY "cert read"
ON public.certificates FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'rrhh')
  OR employee_id = public.current_employee_id()
  OR public.is_manager_of(employee_id)
);

DROP POLICY IF EXISTS "assign read" ON public.course_assignments;
CREATE POLICY "assign read"
ON public.course_assignments FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'rrhh')
  OR employee_id = public.current_employee_id()
  OR public.is_manager_of(employee_id)
);

DROP POLICY IF EXISTS "assign self update progress" ON public.course_assignments;
CREATE POLICY "assign self update progress"
ON public.course_assignments FOR UPDATE
TO authenticated
USING (employee_id = public.current_employee_id());

DROP POLICY IF EXISTS "lp read" ON public.lesson_progress;
CREATE POLICY "lp read"
ON public.lesson_progress FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'rrhh')
  OR employee_id = public.current_employee_id()
  OR public.is_manager_of(employee_id)
);

DROP POLICY IF EXISTS "lp self write" ON public.lesson_progress;
CREATE POLICY "lp self write"
ON public.lesson_progress FOR ALL
TO authenticated
USING (employee_id = public.current_employee_id())
WITH CHECK (employee_id = public.current_employee_id());

DROP POLICY IF EXISTS "qa read" ON public.quiz_attempts;
CREATE POLICY "qa read"
ON public.quiz_attempts FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'rrhh')
  OR employee_id = public.current_employee_id()
  OR public.is_manager_of(employee_id)
);

DROP POLICY IF EXISTS "qa self write" ON public.quiz_attempts;
CREATE POLICY "qa self write"
ON public.quiz_attempts FOR ALL
TO authenticated
USING (
  employee_id = public.current_employee_id()
  OR public.has_role(auth.uid(), 'rrhh')
)
WITH CHECK (
  employee_id = public.current_employee_id()
  OR public.has_role(auth.uid(), 'rrhh')
);
