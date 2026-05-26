
-- =========================================================
-- MOR ACADEMY — Esquema base (Fase 1)
-- =========================================================

-- 1) Roles
CREATE TYPE public.app_role AS ENUM ('colaborador', 'rrhh', 'jefe_directo');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "user_roles self read" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'rrhh'));

-- 2) Talent Pipeline (simulado)
CREATE TABLE public.closed_requisitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,
  cargo TEXT NOT NULL,
  area TEXT NOT NULL,
  fecha_cierre DATE NOT NULL DEFAULT CURRENT_DATE,
  capacitaciones_induccion JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.closed_requisitions TO authenticated;
GRANT ALL ON public.closed_requisitions TO service_role;
ALTER TABLE public.closed_requisitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "req rrhh read" ON public.closed_requisitions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'rrhh'));

-- 3) Empleados
CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  dui TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  email TEXT,
  area TEXT,
  cargo TEXT,
  fecha_ingreso DATE,
  jefe_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  estado TEXT NOT NULL DEFAULT 'activo',
  tipo_proceso TEXT NOT NULL DEFAULT 'ambos',
  requisicion_id UUID REFERENCES public.closed_requisitions(id) ON DELETE SET NULL,
  xp INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.employees TO authenticated;
GRANT ALL ON public.employees TO service_role;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "emp self read" ON public.employees
  FOR SELECT TO authenticated USING (
    auth_user_id = auth.uid()
    OR public.has_role(auth.uid(), 'rrhh')
    OR jefe_id IN (SELECT id FROM public.employees WHERE auth_user_id = auth.uid())
  );
CREATE POLICY "emp rrhh write" ON public.employees
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'rrhh'));
CREATE POLICY "emp rrhh update" ON public.employees
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'rrhh'));

-- 4) Cursos
CREATE TABLE public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  tipo TEXT NOT NULL DEFAULT 'constante',
  duracion_min INTEGER DEFAULT 60,
  area TEXT,
  cargo TEXT,
  estado TEXT NOT NULL DEFAULT 'borrador',
  vigencia_dias INTEGER,
  nota_minima INTEGER NOT NULL DEFAULT 80,
  intentos_max INTEGER NOT NULL DEFAULT 3,
  requiere_aprobacion_manual BOOLEAN NOT NULL DEFAULT false,
  permite_certificado BOOLEAN NOT NULL DEFAULT true,
  cover_color TEXT DEFAULT '#1f2a44',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.courses TO authenticated;
GRANT ALL ON public.courses TO service_role;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "courses read" ON public.courses
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "courses rrhh write" ON public.courses
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'rrhh'));
CREATE POLICY "courses rrhh update" ON public.courses
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'rrhh'));
CREATE POLICY "courses rrhh delete" ON public.courses
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'rrhh'));

-- 5) Lecciones (estructura plana con orden; módulo/sección como metadatos)
CREATE TABLE public.course_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  modulo TEXT,
  seccion TEXT,
  orden INTEGER NOT NULL DEFAULT 0,
  titulo TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'texto',
  contenido TEXT,
  url_externa TEXT,
  storage_path TEXT,
  obligatorio BOOLEAN NOT NULL DEFAULT true,
  duracion_min INTEGER DEFAULT 5,
  text_excerpt TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_lessons TO authenticated;
GRANT ALL ON public.course_lessons TO service_role;
ALTER TABLE public.course_lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lessons read" ON public.course_lessons
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "lessons rrhh write" ON public.course_lessons
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'rrhh')) WITH CHECK (public.has_role(auth.uid(), 'rrhh'));

-- 6) Quizzes
CREATE TABLE public.quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES public.course_lessons(id) ON DELETE SET NULL,
  posicion INTEGER NOT NULL DEFAULT 999,
  nombre TEXT NOT NULL DEFAULT 'Evaluación',
  num_preguntas INTEGER NOT NULL DEFAULT 5,
  umbral INTEGER NOT NULL DEFAULT 80,
  intentos_permitidos INTEGER NOT NULL DEFAULT 3,
  bloquea_avance BOOLEAN NOT NULL DEFAULT true,
  es_final BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quizzes TO authenticated;
GRANT ALL ON public.quizzes TO service_role;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quizzes read" ON public.quizzes FOR SELECT TO authenticated USING (true);
CREATE POLICY "quizzes rrhh write" ON public.quizzes
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'rrhh')) WITH CHECK (public.has_role(auth.uid(), 'rrhh'));

-- 7) Asignaciones
CREATE TABLE public.course_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  origen TEXT NOT NULL DEFAULT 'manual',
  requisicion_id UUID REFERENCES public.closed_requisitions(id) ON DELETE SET NULL,
  estado TEXT NOT NULL DEFAULT 'pendiente',
  intentos_consumidos INTEGER NOT NULL DEFAULT 0,
  mejor_nota INTEGER,
  fecha_asignacion TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_vencimiento DATE,
  fecha_finalizacion TIMESTAMPTZ,
  UNIQUE (employee_id, course_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_assignments TO authenticated;
GRANT ALL ON public.course_assignments TO service_role;
ALTER TABLE public.course_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "assign read" ON public.course_assignments
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'rrhh')
    OR employee_id IN (SELECT id FROM public.employees WHERE auth_user_id = auth.uid())
    OR employee_id IN (SELECT id FROM public.employees WHERE jefe_id IN (SELECT id FROM public.employees WHERE auth_user_id = auth.uid()))
  );
CREATE POLICY "assign rrhh write" ON public.course_assignments
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'rrhh')) WITH CHECK (public.has_role(auth.uid(), 'rrhh'));
CREATE POLICY "assign self update progress" ON public.course_assignments
  FOR UPDATE TO authenticated USING (employee_id IN (SELECT id FROM public.employees WHERE auth_user_id = auth.uid()));

-- 8) Progreso de lecciones
CREATE TABLE public.lesson_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES public.course_lessons(id) ON DELETE CASCADE,
  completado BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  UNIQUE (employee_id, lesson_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_progress TO authenticated;
GRANT ALL ON public.lesson_progress TO service_role;
ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lp read" ON public.lesson_progress
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'rrhh')
    OR employee_id IN (SELECT id FROM public.employees WHERE auth_user_id = auth.uid())
    OR employee_id IN (SELECT id FROM public.employees WHERE jefe_id IN (SELECT id FROM public.employees WHERE auth_user_id = auth.uid()))
  );
CREATE POLICY "lp self write" ON public.lesson_progress
  FOR ALL TO authenticated
  USING (employee_id IN (SELECT id FROM public.employees WHERE auth_user_id = auth.uid()))
  WITH CHECK (employee_id IN (SELECT id FROM public.employees WHERE auth_user_id = auth.uid()));

-- 9) Intentos de quiz
CREATE TABLE public.quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  intento_num INTEGER NOT NULL DEFAULT 1,
  preguntas JSONB NOT NULL DEFAULT '[]'::jsonb,
  respuestas JSONB,
  score INTEGER,
  aprobado BOOLEAN,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE ON public.quiz_attempts TO authenticated;
GRANT ALL ON public.quiz_attempts TO service_role;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qa read" ON public.quiz_attempts
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'rrhh')
    OR employee_id IN (SELECT id FROM public.employees WHERE auth_user_id = auth.uid())
    OR employee_id IN (SELECT id FROM public.employees WHERE jefe_id IN (SELECT id FROM public.employees WHERE auth_user_id = auth.uid()))
  );
CREATE POLICY "qa self write" ON public.quiz_attempts
  FOR ALL TO authenticated
  USING (employee_id IN (SELECT id FROM public.employees WHERE auth_user_id = auth.uid()) OR public.has_role(auth.uid(),'rrhh'))
  WITH CHECK (employee_id IN (SELECT id FROM public.employees WHERE auth_user_id = auth.uid()) OR public.has_role(auth.uid(),'rrhh'));

-- 10) Certificados
CREATE TABLE public.certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.course_assignments(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  codigo TEXT NOT NULL UNIQUE,
  nota INTEGER NOT NULL,
  fecha_emision TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.certificates TO authenticated;
GRANT ALL ON public.certificates TO service_role;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cert read" ON public.certificates
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'rrhh')
    OR employee_id IN (SELECT id FROM public.employees WHERE auth_user_id = auth.uid())
    OR employee_id IN (SELECT id FROM public.employees WHERE jefe_id IN (SELECT id FROM public.employees WHERE auth_user_id = auth.uid()))
  );

-- 11) Insignias y logros
CREATE TABLE public.badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  icono TEXT
);
GRANT SELECT ON public.badges TO authenticated;
GRANT ALL ON public.badges TO service_role;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "badges read" ON public.badges FOR SELECT TO authenticated USING (true);

CREATE TABLE public.employee_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, badge_id)
);
GRANT SELECT, INSERT ON public.employee_badges TO authenticated;
GRANT ALL ON public.employee_badges TO service_role;
ALTER TABLE public.employee_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "eb read" ON public.employee_badges FOR SELECT TO authenticated USING (true);

-- 12) Auditoría y notificaciones
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID,
  accion TEXT NOT NULL,
  entidad TEXT,
  entidad_id UUID,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit rrhh" ON public.audit_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'rrhh'));

CREATE TABLE public.notifications_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL,
  destinatario TEXT,
  payload JSONB,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.notifications_outbox TO authenticated;
GRANT ALL ON public.notifications_outbox TO service_role;
ALTER TABLE public.notifications_outbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif rrhh" ON public.notifications_outbox FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'rrhh'));

-- 13) Trigger: auto-completar curso cuando todas las lecciones obligatorias están listas + quizzes aprobados
-- (lo manejamos en server function para simplicidad)

-- 14) Seed insignias
INSERT INTO public.badges (slug, nombre, descripcion, icono) VALUES
  ('first_access', 'Primer acceso', 'Iniciaste tu viaje en MOR ACADEMY', 'Sparkles'),
  ('first_quiz', 'Primer quiz aprobado', 'Aprobaste tu primera evaluación', 'CheckCircle2'),
  ('induction_complete', 'Inducción completa', 'Completaste tu proceso de inducción', 'GraduationCap'),
  ('perfect_run', 'Sin reintentos', 'Aprobaste un curso al primer intento', 'Zap'),
  ('excellence', 'Excelencia académica', 'Obtuviste 95+ en una evaluación', 'Trophy'),
  ('full_progress', '100% de avance', 'Completaste todo un curso', 'Target');

-- 15) Seed requisiciones cerradas (simula MOR Talent Pipeline)
INSERT INTO public.closed_requisitions (codigo, cargo, area, capacitaciones_induccion) VALUES
  ('REQ-2025-0142', 'Analista de Operaciones', 'Operaciones',
    '[{"nombre":"Bienvenida a MOR","duracion":30},{"nombre":"Cultura organizacional","duracion":45},{"nombre":"Seguridad operacional","duracion":60},{"nombre":"Sistemas internos: introducción","duracion":40}]'::jsonb),
  ('REQ-2025-0151', 'Ingeniero Agrónomo', 'Campo',
    '[{"nombre":"Bienvenida a MOR","duracion":30},{"nombre":"Cultura organizacional","duracion":45},{"nombre":"Manejo seguro de agroquímicos","duracion":90},{"nombre":"Buenas prácticas agrícolas","duracion":60}]'::jsonb),
  ('REQ-2025-0159', 'Asistente Administrativo', 'Administración',
    '[{"nombre":"Bienvenida a MOR","duracion":30},{"nombre":"Cultura organizacional","duracion":45},{"nombre":"Manejo de información confidencial","duracion":40}]'::jsonb),
  ('REQ-2025-0163', 'Supervisor de Bodega', 'Logística',
    '[{"nombre":"Bienvenida a MOR","duracion":30},{"nombre":"Seguridad en bodega","duracion":60},{"nombre":"Control de inventarios","duracion":50},{"nombre":"Liderazgo de equipo","duracion":60}]'::jsonb);
