
-- 1) course_assignments: quitar self-update; el servidor (service role) maneja el progreso
DROP POLICY IF EXISTS "assign self update progress" ON public.course_assignments;

-- 2) lesson_progress: exigir que la lección pertenezca a un curso asignado al empleado
DROP POLICY IF EXISTS "lp self write" ON public.lesson_progress;

CREATE POLICY "lp self insert"
ON public.lesson_progress
FOR INSERT
TO authenticated
WITH CHECK (
  employee_id = public.current_employee_id()
  AND EXISTS (
    SELECT 1
    FROM public.course_lessons cl
    JOIN public.course_assignments ca ON ca.course_id = cl.course_id
    WHERE cl.id = lesson_progress.lesson_id
      AND ca.employee_id = public.current_employee_id()
  )
);

CREATE POLICY "lp self update"
ON public.lesson_progress
FOR UPDATE
TO authenticated
USING (employee_id = public.current_employee_id())
WITH CHECK (
  employee_id = public.current_employee_id()
  AND EXISTS (
    SELECT 1
    FROM public.course_lessons cl
    JOIN public.course_assignments ca ON ca.course_id = cl.course_id
    WHERE cl.id = lesson_progress.lesson_id
      AND ca.employee_id = public.current_employee_id()
  )
);

-- 3) quiz_attempts: solo INSERT del propio empleado, ligado a una asignación válida.
--    Sin UPDATE/DELETE desde el cliente (los intentos son inmutables; el servidor con
--    service_role los completa).
DROP POLICY IF EXISTS "qa self write" ON public.quiz_attempts;

CREATE POLICY "qa self insert"
ON public.quiz_attempts
FOR INSERT
TO authenticated
WITH CHECK (
  employee_id = public.current_employee_id()
  AND EXISTS (
    SELECT 1
    FROM public.quizzes q
    JOIN public.course_assignments ca ON ca.course_id = q.course_id
    WHERE q.id = quiz_attempts.quiz_id
      AND ca.employee_id = public.current_employee_id()
  )
);
