INSERT INTO public.certificates (assignment_id, employee_id, course_id, codigo, nota)
SELECT ca.id, ca.employee_id, ca.course_id,
       'MA-' || upper(substr(replace(ca.id::text, '-', ''), 1, 8)),
       COALESCE(ca.mejor_nota, 100)
FROM public.course_assignments ca
JOIN public.courses c ON c.id = ca.course_id
LEFT JOIN public.certificates ce ON ce.assignment_id = ca.id
WHERE ca.estado = 'aprobado'
  AND c.permite_certificado = true
  AND ce.id IS NULL;