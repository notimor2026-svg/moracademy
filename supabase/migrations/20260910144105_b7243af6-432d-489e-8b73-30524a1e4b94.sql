DELETE FROM public.certificates c
USING public.certificates c2
WHERE c.assignment_id = c2.assignment_id
  AND c.fecha_emision > c2.fecha_emision;

DELETE FROM public.certificates c
USING public.certificates c2
WHERE c.assignment_id = c2.assignment_id
  AND c.fecha_emision = c2.fecha_emision
  AND c.id > c2.id;

CREATE UNIQUE INDEX IF NOT EXISTS certificates_assignment_id_key
  ON public.certificates (assignment_id);