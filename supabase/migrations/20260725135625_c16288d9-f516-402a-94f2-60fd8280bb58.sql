REVOKE SELECT ON public.quizzes FROM authenticated;
GRANT SELECT (id, course_id, lesson_id, posicion, nombre, num_preguntas, umbral, intentos_permitidos, bloquea_avance, es_final, created_at) ON public.quizzes TO authenticated;
REVOKE SELECT ON public.quiz_attempts FROM authenticated;
GRANT SELECT (id, quiz_id, employee_id, intento_num, respuestas, score, aprobado, started_at, finished_at) ON public.quiz_attempts TO authenticated;
GRANT ALL ON public.quizzes TO service_role;
GRANT ALL ON public.quiz_attempts TO service_role;