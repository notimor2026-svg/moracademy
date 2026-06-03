
-- Remove duplicate badges (English slugs); keep Spanish slugs used in code
DELETE FROM public.employee_badges WHERE badge_id IN (
  SELECT id FROM public.badges WHERE slug IN ('first_access','excellence','induction_complete','first_quiz','perfect_run')
);
DELETE FROM public.badges WHERE slug IN ('first_access','excellence','induction_complete','first_quiz','perfect_run');

-- Add creative new badges to motivate students
INSERT INTO public.badges (slug, nombre, descripcion, icono) VALUES
  ('puntaje_perfecto', 'Puntaje perfecto', 'Obtuviste 100 puntos en una evaluación.', 'Sparkles'),
  ('trilogia_mor', 'Trilogía MOR', 'Aprobaste 3 cursos en MOR ACADEMY.', 'BookMarked'),
  ('maratonista', 'Maratonista del saber', 'Aprobaste 5 cursos. ¡Sigue así!', 'Medal'),
  ('leyenda_mor', 'Leyenda MOR', 'Aprobaste 10 cursos. Eres referente del equipo.', 'Crown'),
  ('racha_imparable', 'Racha imparable', 'Aprobaste 3 evaluaciones consecutivas.', 'Flame'),
  ('explorador', 'Explorador', 'Te inscribiste a un curso del catálogo abierto.', 'Compass'),
  ('autodidacta', 'Autodidacta', 'Completaste 3 cursos opcionales por tu cuenta.', 'BookOpen'),
  ('mente_brillante', 'Mente brillante', 'Alcanzaste 500 XP acumulados.', 'Brain'),
  ('mente_maestra', 'Mente maestra', 'Alcanzaste 1000 XP. ¡Imparable!', 'Rocket'),
  ('coleccionista', 'Coleccionista', 'Obtuviste 5 certificados MOR.', 'Library'),
  ('curioso', 'Mente curiosa', 'Completaste tu primera lección.', 'Lightbulb'),
  ('perseverante', 'Perseverante', 'Aprobaste un curso después de varios intentos.', 'HeartHandshake')
ON CONFLICT (slug) DO NOTHING;
