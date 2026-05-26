-- Permitir a RRHH actualizar el estado del outbox (lo usa el dispatcher)
CREATE POLICY "notif rrhh update"
ON public.notifications_outbox
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'rrhh'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'rrhh'::app_role));

-- Permitir DELETE de lecciones a RRHH (editor de cursos)
-- (lessons rrhh write ya cubre ALL pero por claridad explícita)

-- Permitir insertar employee_badges a RRHH/sistema (lo escribe el server vía admin client, RLS bypass)
-- No se requiere política adicional porque supabaseAdmin bypassa RLS.

-- Semilla de insignias básicas
INSERT INTO public.badges (slug, nombre, descripcion, icono) VALUES
  ('primer_acceso', 'Primer acceso', 'Te diste de alta en MOR ACADEMY.', 'Sparkles'),
  ('primer_quiz', 'Primera evaluación', 'Completaste tu primera evaluación.', 'Brain'),
  ('induccion_completa', 'Inducción completa', 'Aprobaste todas tus capacitaciones de inducción.', 'Award'),
  ('primer_certificado', 'Primer certificado', 'Obtuviste tu primer certificado MOR.', 'BadgeCheck'),
  ('excelencia', 'Excelencia académica', 'Obtuviste una calificación de 95 o más.', 'Star'),
  ('sin_reintentos', 'A la primera', 'Aprobaste una evaluación en tu primer intento.', 'Zap')
ON CONFLICT (slug) DO NOTHING;
