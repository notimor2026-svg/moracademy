-- Editores de cursos pueden subir/gestionar material didáctico
CREATE POLICY "Editores suben material didactico"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'course-materials'
  AND (
    public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'rrhh')
    OR public.has_role(auth.uid(), 'creador')
  )
);

CREATE POLICY "Editores actualizan material didactico"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'course-materials'
  AND (
    public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'rrhh')
    OR public.has_role(auth.uid(), 'creador')
  )
);

CREATE POLICY "Editores eliminan material didactico"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'course-materials'
  AND (
    public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'rrhh')
    OR public.has_role(auth.uid(), 'creador')
  )
);

CREATE POLICY "Editores ven material didactico"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'course-materials'
  AND (
    public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'rrhh')
    OR public.has_role(auth.uid(), 'creador')
  )
);