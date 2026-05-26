# MOR ACADEMY — Plan de Fase 1

Módulo completo de inducción y capacitación para una sola empresa, con login por DUI, gestión de RRHH, dashboards por rol, creador de cursos con quizzes generados por IA, certificados y gamificación sobria.

## Decisiones confirmadas
- **Logo**: usar el escudo MOR ACADEMY adjunto como identidad visual (login, sidebar, headers, certificados, emails).
- **Talent Pipeline**: ya existe → integración leyendo sus tablas de requisiciones cerradas y capacitaciones asociadas.
- **Quizzes**: Lovable AI Gateway (Gemini 3 Flash), generación on-demand, estrictamente desde el material hasta el punto del quiz, con variación por intento y persona.
- **Alcance**: Fase 1 = núcleo funcional. Reportes ad-hoc avanzados, auditoría extendida y gamificación premium → Fase 2.

---

## 1. Identidad visual y branding
- Logo en `src/assets/mor-academy-logo.png`, componente `<MorAcademyLogo />` con variantes (full, escudo, blanco sobre azul).
- Paleta basada en el logo: navy `#1f2a44` (primario), blanco hueso, gris pizarra, dorado sobrio para gamificación.
- Tipografía: Inter para UI, Fraunces para títulos de certificados.
- Tokens en `src/styles.css`: `--primary`, `--primary-glow`, `--accent-gold`, `--surface`, `--success`, `--warning`, `--danger`, `--gradient-hero`, `--shadow-elevated`.
- Variantes shadcn propias (botón `premium`, badge `achievement`, card `course`).
- Eliminar cualquier rastro de "MOR Induction Hub".

## 2. Roles, autenticación y acceso
- **Login solo con DUI**, validación de formato `########-#`.
- Auth basada en Lovable Cloud. Server route `/api/auth/dui-login` busca el empleado y emite sesión vía Supabase Admin (`generateLink` o intercambio interno con password derivado y oculto).
- Roles en tabla aparte (`user_roles` + enum `app_role`: `colaborador`, `rrhh`, `jefe_directo`) con función `has_role()` SECURITY DEFINER.
- Layouts: `_authenticated`, `_authenticated/_rrhh`, `_authenticated/_jefe`. Colaborador → dashboard general.
- Si DUI no existe: "DUI no encontrado. Contacta a Recursos Humanos."

## 3. Modelo de datos (migraciones)
Tablas en `public` (con GRANTs + RLS):
- `employees` (dui UNIQUE, nombre, email, area, cargo, fecha_ingreso, jefe_id, estado, tipo_proceso, requisicion_id, auth_user_id).
- `user_roles` (estándar Lovable).
- `courses` (tipo, duracion, area, cargo, estado, vigencia, nota_minima, intentos_max, requiere_aprobacion_manual, permite_certificado).
- `course_modules`, `course_sections`, `course_lessons` (tipo: texto/video_archivo/video_url/pdf/ppt/imagen/enlace/recurso/quiz/evaluacion_final + payload jsonb + obligatorio).
- `lesson_progress` (employee_id, lesson_id, completado, segundos_vistos).
- `course_assignments` (employee_id, course_id, origen `induccion|manual`, requisicion_id, fecha_vencimiento, estado `pendiente|en_curso|aprobado|reprobado|bloqueado`, intentos_consumidos, mejor_nota).
- `quizzes` (course_id, posicion, num_preguntas, umbral, intentos_permitidos, bloquea_avance).
- `quiz_attempts` (intento_num, preguntas jsonb, respuestas jsonb, score, aprobado).
- `certificates` (codigo UNIQUE, nota, fecha_emision, pdf_url).
- `badges`, `employee_badges`, `xp_ledger`.
- `audit_log`, `notifications_outbox`.
- Vista `closed_requisitions_v` sobre las tablas existentes de **MOR Talent Pipeline** (se inspecciona el schema en la primera migración).
- Buckets de Storage: `course-content` y `certificates` (privados, signed URLs).
- RLS: colaborador ve lo suyo; jefe ve su equipo (`jefe_id = self`); RRHH full vía `has_role`. GRANTs `authenticated` + `service_role`, sin `anon`.

## 4. Flujos funcionales

**RRHH crea empleado**
1. Form con DUI, nombre, email, área, cargo, fecha ingreso, jefe, tipo de proceso.
2. Si incluye inducción → dropdown poblado por `closed_requisitions_v` (últimas N, buscable).
3. Al guardar: crea `employees`, rol `colaborador`, y genera `course_assignments` (`origen='induccion'`) por cada capacitación de la requisición.
4. Capacitaciones constantes se asignan manualmente (multi-select).

**Colaborador toma curso**
- Vista con sidebar de módulos/secciones/lecciones. Reglas de avance obligatorio (scroll 100%, video ≥95%, quiz aprobado, descarga confirmada).
- Bloqueo de "siguiente" hasta completar la anterior si es obligatoria.

**Generación de quizzes (IA)**
- Server function `generateQuiz({quizId, attemptNum, employeeId})`:
  - Recolecta contenido textual desde el inicio del curso hasta `quizzes.posicion` (texto, descripciones de video, texto extraído de PDFs).
  - Llama a Lovable AI Gateway (`google/gemini-3-flash-preview`) con `Output.object` (zod) pidiendo `num_preguntas` con tipos: opción múltiple, V/F, múltiple respuesta, ordenamiento, relación, situacional.
  - Prompt estricto: "usa SOLO el material entregado, no inventes, cita la sección"; seed = `${employeeId}-${attemptNum}` para variar.
  - Persiste preguntas/respuestas en `quiz_attempts` para auditoría y reproducibilidad.
- Retroalimentación inmediata con cita al material.

**Intentos y bloqueo**
- Cada intento incrementa contador. Si supera umbral → aprobado. Si agota intentos → estado `bloqueado` + insert en `notifications_outbox` (correo a RRHH).
- RRHH puede desbloquear desde tabla de asignaciones.

**Certificados**
- Al aprobar curso con `permite_certificado=true`: server function genera PDF con `@react-pdf/renderer` (logo, nombre, curso, fecha, nota, código UUID), sube a bucket y guarda registro.

**Notificaciones por correo**
- Email infra de Lovable Cloud (queue + dispatcher). Plantillas: asignación, próximo vencimiento, bloqueo, aprobación, certificado emitido.

## 5. Dashboards
- **Colaborador** (`/`): bienvenida, cursos asignados con progreso, próximos pasos, certificados, insignias, ranking sobrio, vencidos.
- **RRHH** (`/admin`): KPIs (totales, en inducción, aprobados, reprobados, bloqueados), tablas maestras con filtros (DUI, nombre, jefe, área, cargo, tipo, estado, requisición, fechas), cursos, certificados, alertas. Acciones: crear empleado/curso, asignar, desbloquear.
- **Jefe directo** (`/team`): solo empleados con `jefe_id = self`, progreso, estado, bloqueos, certificados, alertas.

## 6. Creador de cursos (RRHH)
- Wizard de 4 pasos: Información → Estructura (drag-and-drop con `@dnd-kit`) → Reglas (intentos, nota mínima, aprobación manual, certificado, vigencia) → Publicación.
- Editor de lección con tipos: texto enriquecido (TipTap), upload (PDF/PPT/imagen/video), URL externa (YouTube/Vimeo/Drive), enlace de recurso, quiz.
- Para PDFs: extracción de texto en server function (pdf-parse) al subir, guardada en `payload.text_excerpt` para alimentar quizzes.

## 7. Gamificación (sobria)
- Barras de progreso, XP simple (`xp_ledger`), insignias predefinidas (primer acceso, primer quiz, inducción completa, 100%, sin reintentos, excelencia ≥95%).
- Ranking por XP visible para colaboradores (nombre + nivel, sin datos sensibles).
- Animaciones discretas con Motion al desbloquear logros.

## 8. Auditoría y reportes (base)
- Cada acción relevante de RRHH/colaborador escribe en `audit_log`.
- Vista de auditoría filtrable por actor/entidad/fecha.
- Reportes Fase 1: 6 reportes predefinidos exportables a CSV/Excel (empleados, asignaciones, intentos, certificados, bloqueos, gamificación). Constructor ad-hoc → Fase 2.

## 9. Detalles técnicos
- **Stack**: TanStack Start v1 (ya provisto). Lovable Cloud para DB/Auth/Storage/Email.
- Server functions en `src/lib/*.functions.ts` (con `requireSupabaseAuth`); helpers en `*.server.ts` (AI gateway, PDF, extracción).
- AI Gateway helper en `src/lib/ai-gateway.server.ts` (patrón estándar Lovable AI).
- Rutas principales:
  - `/login`
  - `/_authenticated/index` (colaborador)
  - `/_authenticated/courses/$courseId`, `.../lessons/$lessonId`
  - `/_authenticated/certificates`
  - `/_authenticated/team` (jefe)
  - `/_authenticated/admin` (RRHH, gate por rol con `beforeLoad`)
  - `/_authenticated/admin/employees/new`
  - `/_authenticated/admin/courses/new`, `.../$courseId/edit`
  - `/_authenticated/admin/reports`, `.../audit`
  - `/api/auth/dui-login`
- Responsive mobile-first, sidebar colapsable.

## 10. Fuera de Fase 1 (Fase 2)
- Constructor de reportes ad-hoc con columnas/filtros/guardado y exportación PDF.
- Auditoría con diff completo y export.
- Gamificación extendida (niveles avanzados, ranking por área, recompensas premium).
- 2FA / login alternativo.
- Multi-empresa.

## Riesgos y notas
- La vista `closed_requisitions_v` requiere inspeccionar el esquema actual de MOR Talent Pipeline antes de crearla; se ajustará en la primera migración.
- Costos de IA: cada intento consume tokens, se cachean preguntas por `(quizId, employeeId, attemptNum)`.
- Extracción de texto de PPT en Worker es limitada → Fase 1 acepta PPT como recurso descargable y solicita a RRHH cargar también un PDF/resumen que alimente quizzes.
