-- 1) QUIZZES: restrict reads to assigned employees / rrhh / managers
DROP POLICY IF EXISTS "quizzes read" ON public.quizzes;
CREATE POLICY "quizzes read" ON public.quizzes
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'rrhh'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.course_assignments ca
    WHERE ca.course_id = quizzes.course_id
      AND (
        ca.employee_id = public.current_employee_id()
        OR public.is_manager_of(ca.employee_id)
      )
  )
);

-- 2) COURSE_LESSONS: restrict reads to assigned employees / rrhh / managers
DROP POLICY IF EXISTS "lessons read" ON public.course_lessons;
CREATE POLICY "lessons read" ON public.course_lessons
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'rrhh'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.course_assignments ca
    WHERE ca.course_id = course_lessons.course_id
      AND (
        ca.employee_id = public.current_employee_id()
        OR public.is_manager_of(ca.employee_id)
      )
  )
);

-- 3) EMPLOYEE_BADGES: restrict reads
DROP POLICY IF EXISTS "eb read" ON public.employee_badges;
CREATE POLICY "eb read" ON public.employee_badges
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'rrhh'::app_role)
  OR employee_id = public.current_employee_id()
  OR public.is_manager_of(employee_id)
);

-- 4) CERTIFICATES: add explicit restrictive deny for client writes
-- (Creation is performed exclusively server-side via supabaseAdmin / SECURITY DEFINER paths)
CREATE POLICY "cert no client insert" ON public.certificates
AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (false);

CREATE POLICY "cert no client update" ON public.certificates
AS RESTRICTIVE FOR UPDATE TO authenticated
USING (false) WITH CHECK (false);

CREATE POLICY "cert no client delete" ON public.certificates
AS RESTRICTIVE FOR DELETE TO authenticated
USING (false);
