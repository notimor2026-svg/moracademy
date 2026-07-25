import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";


export const listMyAssignments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: emp } = await supabase
      .from("employees")
      .select("id, nombre, xp")
      .eq("auth_user_id", userId)
      .maybeSingle();
    if (!emp) return { employee: null, assignments: [] };
    // Reconcilia cursos sin evaluación cuyas lecciones ya están completas.
    await syncCompletionWithoutQuiz(emp.id);
    const { data } = await supabase
      .from("course_assignments")
      .select("*, courses(*)")
      .eq("employee_id", emp.id);
    return { employee: emp, assignments: data ?? [] };
  });

// Marca como aprobadas las asignaciones de cursos sin evaluación cuando
// todas sus lecciones ya fueron completadas por el empleado.
async function syncCompletionWithoutQuiz(employeeId: string, courseId?: string) {
  let q = supabaseAdmin
    .from("course_assignments")
    .select("id, course_id")
    .eq("employee_id", employeeId)
    .neq("estado", "aprobado");
  if (courseId) q = q.eq("course_id", courseId);
  const { data: assigns } = await q;
  if (!assigns?.length) return;
  const courseIds = assigns.map((a) => a.course_id);
  const [{ data: lessons }, { data: quizzes }, { data: done }] = await Promise.all([
    supabaseAdmin.from("course_lessons").select("id, course_id").in("course_id", courseIds),
    supabaseAdmin.from("quizzes").select("course_id").in("course_id", courseIds),
    supabaseAdmin
      .from("lesson_progress")
      .select("lesson_id")
      .eq("employee_id", employeeId)
      .eq("completado", true),
  ]);
  const withQuiz = new Set((quizzes ?? []).map((q) => q.course_id));
  const doneIds = new Set((done ?? []).map((d) => d.lesson_id));
  const toApprove: string[] = [];
  for (const a of assigns) {
    if (withQuiz.has(a.course_id)) continue;
    const ls = (lessons ?? []).filter((l) => l.course_id === a.course_id);
    if (!ls.length) continue;
    if (ls.every((l) => doneIds.has(l.id))) toApprove.push(a.id);
  }
  if (toApprove.length) {
    await supabaseAdmin
      .from("course_assignments")
      .update({ estado: "aprobado", fecha_finalizacion: new Date().toISOString() })
      .in("id", toApprove);
  }
}


export const getCourseDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ course_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: emp } = await supabase
      .from("employees")
      .select("id")
      .eq("auth_user_id", userId)
      .maybeSingle();
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const isRrhh = (roles ?? []).some(
      (r: any) => r.role === "rrhh" || r.role === "super_admin",
    );

    // Solo rrhh, el empleado asignado, su jefe directo, o cursos abiertos a todos.
    if (!isRrhh) {
      if (!emp) throw new Error("No tienes acceso a este curso.");
      const { data: courseRow } = await supabaseAdmin
        .from("courses")
        .select("abierto_a_todos")
        .eq("id", data.course_id)
        .maybeSingle();
      const isOpen = !!courseRow?.abierto_a_todos;
      if (!isOpen) {
        const { data: assigns } = await supabaseAdmin
          .from("course_assignments")
          .select("employee_id, employees!inner(jefe_id)")
          .eq("course_id", data.course_id);
        const allowed = (assigns ?? []).some((a: any) => {
          if (a.employee_id === emp.id) return true;
          if (a.employees?.jefe_id && a.employees.jefe_id === emp.id) return true;
          return false;
        });
        if (!allowed) throw new Error("No tienes acceso a este curso.");
      }
    }


    const [{ data: course }, { data: lessons }, { data: quizzes }] = await Promise.all([
      supabase.from("courses").select("*").eq("id", data.course_id).single(),
      supabase
        .from("course_lessons")
        .select("*")
        .eq("course_id", data.course_id)
        .order("orden"),
      supabase
        .from("quizzes")
        .select("id, course_id, lesson_id, posicion, nombre, num_preguntas, umbral, intentos_permitidos, bloquea_avance, es_final, created_at")
        .eq("course_id", data.course_id)
        .order("posicion"),
    ]);
    let progress: Record<string, boolean> = {};
    if (emp) {
      const { data: lp } = await supabase
        .from("lesson_progress")
        .select("lesson_id, completado")
        .eq("employee_id", emp.id);
      progress = Object.fromEntries((lp ?? []).map((r) => [r.lesson_id, r.completado]));
    }
    return { course, lessons: lessons ?? [], quizzes: quizzes ?? [], progress, employeeId: emp?.id };
  });

export const markLessonComplete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ lesson_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: emp } = await supabase
      .from("employees")
      .select("id")
      .eq("auth_user_id", userId)
      .single();
    await supabase.from("lesson_progress").upsert(
      {
        employee_id: emp!.id,
        lesson_id: data.lesson_id,
        completado: true,
        completed_at: new Date().toISOString(),
      },
      { onConflict: "employee_id,lesson_id" },
    );

    // Si el curso no tiene evaluaciones y ya completó todas las lecciones,
    // se marca la asignación como aprobada (p. ej. material didáctico).
    const { data: lessonRow } = await supabaseAdmin
      .from("course_lessons")
      .select("course_id")
      .eq("id", data.lesson_id)
      .maybeSingle();
    const courseId = lessonRow?.course_id;
    if (courseId) {
      const [{ data: allLessons }, { data: quizRows }] = await Promise.all([
        supabaseAdmin.from("course_lessons").select("id").eq("course_id", courseId),
        supabaseAdmin.from("quizzes").select("id").eq("course_id", courseId),
      ]);
      const lessonIds = (allLessons ?? []).map((l) => l.id);
      if (!(quizRows ?? []).length && lessonIds.length) {
        const { data: done } = await supabaseAdmin
          .from("lesson_progress")
          .select("lesson_id")
          .eq("employee_id", emp!.id)
          .eq("completado", true)
          .in("lesson_id", lessonIds);
        const doneIds = new Set((done ?? []).map((d) => d.lesson_id));
        if (lessonIds.every((id) => doneIds.has(id))) {
          await supabaseAdmin
            .from("course_assignments")
            .update({ estado: "aprobado", fecha_finalizacion: new Date().toISOString() })
            .eq("course_id", courseId)
            .eq("employee_id", emp!.id);
        }
      }
    }
    return { ok: true };
  });


// Enlace temporal (1 h) para leer/descargar material didáctico de una lección.
export const getLessonFileUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ lesson_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: lesson } = await supabaseAdmin
      .from("course_lessons")
      .select("id, course_id, storage_path, titulo")
      .eq("id", data.lesson_id)
      .maybeSingle();
    if (!lesson?.storage_path) throw new Error("La lección no tiene material adjunto.");

    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const isStaff = (roles ?? []).some(
      (r: any) => r.role === "rrhh" || r.role === "super_admin" || r.role === "creador",
    );

    if (!isStaff) {
      const { data: emp } = await supabase
        .from("employees")
        .select("id")
        .eq("auth_user_id", userId)
        .maybeSingle();
      if (!emp) throw new Error("No tienes acceso a este material.");
      const { data: courseRow } = await supabaseAdmin
        .from("courses")
        .select("abierto_a_todos")
        .eq("id", lesson.course_id)
        .maybeSingle();
      if (!courseRow?.abierto_a_todos) {
        const { data: assigns } = await supabaseAdmin
          .from("course_assignments")
          .select("employee_id, employees!inner(jefe_id)")
          .eq("course_id", lesson.course_id);
        const allowed = (assigns ?? []).some(
          (a: any) => a.employee_id === emp.id || a.employees?.jefe_id === emp.id,
        );
        if (!allowed) throw new Error("No tienes acceso a este material.");
      }
    }

    const { data: signed, error } = await supabaseAdmin.storage
      .from("course-materials")
      .createSignedUrl(lesson.storage_path, 60 * 60);
    if (error || !signed?.signedUrl) throw new Error(error?.message ?? "No se pudo generar el enlace.");
    return { url: signed.signedUrl };
  });



// =================== QUIZ (preguntas manuales) ===================

const QuestionSchema = z.object({
  enunciado: z.string().min(1),
  tipo: z.enum(["opcion_multiple", "multiple_respuesta"]),
  opciones: z.array(z.string().min(1)).min(2).max(8),
  respuesta_correcta: z.array(z.number().int().nonnegative()).min(1),
});

type QuizQuestion = z.infer<typeof QuestionSchema>;

const shuffle = <T,>(arr: T[]): T[] => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const randomizeQuestions = (questions: QuizQuestion[]): QuizQuestion[] => {
  return shuffle(questions).map((q) => {
    const indices = q.opciones.map((_, i) => i);
    const order = shuffle(indices);
    const opciones = order.map((i) => q.opciones[i]);
    const respuesta_correcta = q.respuesta_correcta
      .map((origIdx) => order.indexOf(origIdx))
      .filter((i) => i >= 0)
      .sort((a, b) => a - b);
    return { ...q, opciones, respuesta_correcta };
  });
};

/** Quita la clave de respuestas antes de enviar las preguntas al navegador. */
const stripAnswers = (questions: QuizQuestion[]) =>
  (questions ?? []).map(({ respuesta_correcta, ...rest }) => rest as Omit<QuizQuestion, "respuesta_correcta">);



export const startQuizAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ quiz_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: emp } = await supabase
      .from("employees")
      .select("id")
      .eq("auth_user_id", userId)
      .single();

    // Verificación de acceso con el cliente del usuario (RLS), sin traer
    // la clave de respuestas.
    const { data: quizAccess } = await supabase
      .from("quizzes")
      .select("id, umbral, intentos_permitidos")
      .eq("id", data.quiz_id)
      .single();
    if (!quizAccess) throw new Error("Quiz no encontrado.");

    // Las preguntas (con respuestas correctas) solo se leen en el servidor.
    const { data: quiz } = await supabaseAdmin
      .from("quizzes")
      .select("*")
      .eq("id", data.quiz_id)
      .single();
    if (!quiz) throw new Error("Quiz no encontrado.");

    // Reutiliza un intento abierto (no enviado) si existe, para no
    // consumir intentos por recargas o navegación accidental.
    const { data: openAttempt } = await supabaseAdmin
      .from("quiz_attempts")
      .select("id, intento_num, preguntas")
      .eq("quiz_id", data.quiz_id)
      .eq("employee_id", emp!.id)
      .is("finished_at", null)
      .order("intento_num", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (openAttempt) {
      return {
        attempt_id: openAttempt.id,
        preguntas: stripAnswers(openAttempt.preguntas as QuizQuestion[]),
        intento_num: openAttempt.intento_num,
      };
    }

    // Cuenta solo intentos finalizados para determinar el próximo número.
    const { data: finished } = await supabase
      .from("quiz_attempts")
      .select("intento_num")
      .eq("quiz_id", data.quiz_id)
      .eq("employee_id", emp!.id)
      .not("finished_at", "is", null)
      .order("intento_num", { ascending: false })
      .limit(1);
    const intento_num = (finished?.[0]?.intento_num ?? 0) + 1;

    if (intento_num > quiz.intentos_permitidos) {
      throw new Error("Has agotado los intentos permitidos.");
    }

    const baseQuestions = (quiz.preguntas as QuizQuestion[] | null) ?? [];
    if (!baseQuestions.length) {
      throw new Error("Esta evaluación aún no tiene preguntas configuradas. Contacta al administrador.");
    }
    const preguntas = randomizeQuestions(baseQuestions);

    const { data: attempt, error } = await supabaseAdmin
      .from("quiz_attempts")
      .insert({
        quiz_id: data.quiz_id,
        employee_id: emp!.id,
        intento_num,
        preguntas,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { attempt_id: attempt.id, preguntas: stripAnswers(preguntas), intento_num };
  });


export const submitQuizAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        attempt_id: z.string().uuid(),
        respuestas: z.array(z.array(z.number())),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: me } = await supabase
      .from("employees")
      .select("id")
      .eq("auth_user_id", userId)
      .single();
    if (!me) throw new Error("Empleado no encontrado.");
    const { data: attempt } = await supabaseAdmin
      .from("quiz_attempts")
      .select("*, quizzes(*)")
      .eq("id", data.attempt_id)
      .eq("employee_id", me.id)
      .single();
    if (!attempt) throw new Error("Intento no encontrado.");
    const preguntas = attempt.preguntas as Array<{ respuesta_correcta: number[] }>;
    let correctas = 0;
    preguntas.forEach((p, i) => {
      const r = (data.respuestas[i] ?? []).slice().sort().join(",");
      const c = (p.respuesta_correcta ?? []).slice().sort().join(",");
      if (r === c && r !== "") correctas++;
    });
    const score = Math.round((correctas / preguntas.length) * 100);
    const aprobado = score >= attempt.quizzes.umbral;

    await supabaseAdmin
      .from("quiz_attempts")
      .update({
        respuestas: data.respuestas,
        score,
        aprobado,
        finished_at: new Date().toISOString(),
      })
      .eq("id", data.attempt_id);

    // Actualiza asignación
    const { data: emp } = await supabase
      .from("employees")
      .select("id")
      .eq("auth_user_id", userId)
      .single();
    const { data: assignment } = await supabaseAdmin
      .from("course_assignments")
      .select("*")
      .eq("employee_id", emp!.id)
      .eq("course_id", attempt.quizzes.course_id)
      .maybeSingle();

    if (assignment) {
      const intentos = (assignment.intentos_consumidos ?? 0) + 1;
      const mejor = Math.max(assignment.mejor_nota ?? 0, score);
      let estado: string = assignment.estado;
      if (aprobado) estado = "aprobado";
      else if (intentos >= attempt.quizzes.intentos_permitidos) {
        estado = "bloqueado";
        await supabaseAdmin.from("notifications_outbox").insert({
          tipo: "bloqueo",
          destinatario: "rrhh",
          payload: { employee_id: emp!.id, course_id: attempt.quizzes.course_id },
        });
      } else {
        estado = "en_curso";
      }
      await supabaseAdmin
        .from("course_assignments")
        .update({
          intentos_consumidos: intentos,
          mejor_nota: mejor,
          estado,
          fecha_finalizacion: aprobado ? new Date().toISOString() : null,
        })
        .eq("id", assignment.id);

      // Certificado
      if (aprobado) {
        const { data: course } = await supabaseAdmin
          .from("courses")
          .select("permite_certificado")
          .eq("id", attempt.quizzes.course_id)
          .single();
        if (course?.permite_certificado) {
          const codigo = `MA-${Date.now().toString(36).toUpperCase()}-${Math.random()
            .toString(36)
            .slice(2, 6)
            .toUpperCase()}`;
          await supabaseAdmin.from("certificates").insert({
            assignment_id: assignment.id,
            employee_id: emp!.id,
            course_id: attempt.quizzes.course_id,
            codigo,
            nota: score,
          });
        }
        await supabaseAdmin.rpc;
      }
    }

    return { score, aprobado, preguntas };
  });

const ManualQuestionInput = z.object({
  enunciado: z.string().min(1).max(1000),
  tipo: z.enum(["opcion_multiple", "multiple_respuesta"]),
  opciones: z.array(z.string().min(1).max(500)).min(2).max(8),
  respuesta_correcta: z.array(z.number().int().nonnegative()).min(1),
});

const validateManualQuestions = (preguntas: z.infer<typeof ManualQuestionInput>[]) => {
  preguntas.forEach((q, i) => {
    const valid = q.respuesta_correcta.every((idx) => idx < q.opciones.length);
    if (!valid) throw new Error(`Pregunta ${i + 1}: índice de respuesta correcta fuera de rango.`);
    if (q.tipo === "opcion_multiple" && q.respuesta_correcta.length !== 1) {
      throw new Error(`Pregunta ${i + 1}: opción múltiple debe tener exactamente 1 respuesta correcta.`);
    }
    if (q.tipo === "multiple_respuesta" && q.respuesta_correcta.length < 1) {
      throw new Error(`Pregunta ${i + 1}: selección múltiple debe tener al menos 1 respuesta correcta.`);
    }
  });
};

const QuizConfigInput = z.object({
  enabled: z.boolean(),
  alcance: z.enum(["final", "por_leccion"]).default("final"),
  umbral: z.number().min(50).max(100).default(80),
  intentos_permitidos: z.number().min(1).max(10).default(3),
  // Para alcance "final": preguntas únicas
  preguntas: z.array(ManualQuestionInput).default([]),
  // Para alcance "por_leccion": preguntas indexadas por la posición de la lección (0-based)
  preguntas_por_leccion: z.array(z.array(ManualQuestionInput)).default([]),
});

export const createCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        nombre: z.string().min(2).max(160),
        descripcion: z.string().max(2000).optional(),
        tipo: z.enum(["induccion", "constante", "material"]).default("constante"),
        nota_minima: z.number().min(50).max(100).default(80),
        intentos_max: z.number().min(1).max(10).default(3),
        abierto_a_todos: z.boolean().default(false),
        lecciones: z
          .array(
            z.object({
              titulo: z.string().min(1),
              tipo: z.enum(["texto", "video_url", "enlace", "archivo"]).default("texto"),
              contenido: z.string().optional(),
              url_externa: z.string().optional(),
              storage_path: z.string().optional().nullable(),
              obligatorio: z.boolean().default(true),
            }),
          )
          .min(1),
        quiz: QuizConfigInput.optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: course, error } = await supabaseAdmin
      .from("courses")
      .insert({
        nombre: data.nombre,
        descripcion: data.descripcion,
        tipo: data.tipo,
        nota_minima: data.nota_minima,
        intentos_max: data.intentos_max,
        abierto_a_todos: data.abierto_a_todos,
        estado: "activa",
        created_by: context.userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    const lessonsToInsert = data.lecciones.map((l, idx) => ({
      course_id: course.id,
      titulo: l.titulo,
      tipo: l.tipo,
      contenido: l.contenido ?? null,
      url_externa: l.url_externa ?? null,
      storage_path: l.storage_path ?? null,
      obligatorio: l.obligatorio,
      orden: idx + 1,
      text_excerpt: l.contenido?.slice(0, 4000) ?? null,
    }));
    const { data: insertedLessons } = await supabaseAdmin
      .from("course_lessons")
      .insert(lessonsToInsert)
      .select("id, orden");

    if (data.quiz?.enabled) {
      const q = data.quiz;
      if (q.alcance === "final") {
        validateManualQuestions(q.preguntas);
        if (!q.preguntas.length) throw new Error("La evaluación final debe tener al menos una pregunta.");
        await supabaseAdmin.from("quizzes").insert({
          course_id: course.id,
          nombre: "Evaluación final",
          posicion: 9999,
          es_final: true,
          umbral: q.umbral,
          intentos_permitidos: q.intentos_permitidos,
          num_preguntas: q.preguntas.length,
          preguntas: q.preguntas,
        });
      } else {
        const sortedLessons = (insertedLessons ?? []).sort((a, b) => a.orden - b.orden);
        const rows = sortedLessons
          .map((lesson, idx) => {
            const preguntas = q.preguntas_por_leccion[idx] ?? [];
            if (!preguntas.length) return null;
            validateManualQuestions(preguntas);
            return {
              course_id: course.id,
              lesson_id: lesson.id,
              nombre: `Evaluación lección ${idx + 1}`,
              posicion: lesson.orden,
              es_final: false,
              umbral: q.umbral,
              intentos_permitidos: q.intentos_permitidos,
              num_preguntas: preguntas.length,
              preguntas,
            };
          })
          .filter(Boolean) as any[];
        if (!rows.length) throw new Error("Debes agregar preguntas a al menos una lección.");
        await supabaseAdmin.from("quizzes").insert(rows);
      }
    }
    return { course };
  });

// =================== CRUD de quizzes (manual) para edición ===================

async function requireRrhhRole(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const roles = (data ?? []).map((r) => r.role);
  if (
    !roles.includes("rrhh" as any) &&
    !roles.includes("super_admin" as any) &&
    !roles.includes("creador" as any)
  ) {
    throw new Error("No tienes permisos.");
  }
}

export const upsertQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid().optional(),
        course_id: z.string().uuid(),
        lesson_id: z.string().uuid().nullable().optional(),
        nombre: z.string().min(1).max(160),
        es_final: z.boolean().default(false),
        posicion: z.number().int().min(0).max(99999).default(9999),
        umbral: z.number().min(50).max(100).default(80),
        intentos_permitidos: z.number().min(1).max(10).default(3),
        preguntas: z.array(ManualQuestionInput).min(1),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireRrhhRole(context.userId);
    validateManualQuestions(data.preguntas);
    const payload = {
      course_id: data.course_id,
      lesson_id: data.lesson_id ?? null,
      nombre: data.nombre,
      es_final: data.es_final,
      posicion: data.posicion,
      umbral: data.umbral,
      intentos_permitidos: data.intentos_permitidos,
      num_preguntas: data.preguntas.length,
      preguntas: data.preguntas,
    };
    if (data.id) {
      const { error } = await supabaseAdmin.from("quizzes").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: ins, error } = await supabaseAdmin
      .from("quizzes")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: ins.id };
  });

export const deleteQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireRrhhRole(context.userId);
    const { error } = await supabaseAdmin.from("quizzes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ course_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireRrhhRole(context.userId);
    const cid = data.course_id;
    // Borra dependencias en orden para evitar violaciones de FK.
    const { data: lessons } = await supabaseAdmin
      .from("course_lessons")
      .select("id")
      .eq("course_id", cid);
    const lessonIds = (lessons ?? []).map((l) => l.id);
    const { data: assigns } = await supabaseAdmin
      .from("course_assignments")
      .select("id")
      .eq("course_id", cid);
    const assignIds = (assigns ?? []).map((a) => a.id);
    const { data: quizzes } = await supabaseAdmin
      .from("quizzes")
      .select("id")
      .eq("course_id", cid);
    const quizIds = (quizzes ?? []).map((q) => q.id);

    if (quizIds.length) {
      await supabaseAdmin.from("quiz_attempts").delete().in("quiz_id", quizIds);
    }
    if (lessonIds.length) {
      await supabaseAdmin.from("lesson_progress").delete().in("lesson_id", lessonIds);
    }
    if (assignIds.length) {
      await supabaseAdmin.from("certificates").delete().in("assignment_id", assignIds);
    }
    await supabaseAdmin.from("certificates").delete().eq("course_id", cid);
    await supabaseAdmin.from("quizzes").delete().eq("course_id", cid);
    await supabaseAdmin.from("course_lessons").delete().eq("course_id", cid);
    await supabaseAdmin.from("course_assignments").delete().eq("course_id", cid);
    const { error } = await supabaseAdmin.from("courses").delete().eq("id", cid);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listOpenCourses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { data: emp } = await supabaseAdmin
      .from("employees")
      .select("id")
      .eq("auth_user_id", userId)
      .maybeSingle();
    const { data: open } = await supabaseAdmin
      .from("courses")
      .select("id, nombre, descripcion, duracion_min, tipo")
      .eq("abierto_a_todos", true)
      .eq("estado", "activa")
      .order("created_at", { ascending: false });
    let assignedIds = new Set<string>();
    if (emp) {
      const { data: assigns } = await supabaseAdmin
        .from("course_assignments")
        .select("course_id")
        .eq("employee_id", emp.id);
      assignedIds = new Set((assigns ?? []).map((a) => a.course_id));
    }
    return (open ?? []).filter((c) => !assignedIds.has(c.id));
  });

export const enrollOpenCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ course_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: emp } = await supabaseAdmin
      .from("employees")
      .select("id")
      .eq("auth_user_id", userId)
      .maybeSingle();
    if (!emp) throw new Error("No se encontró tu perfil de empleado.");
    const { data: course } = await supabaseAdmin
      .from("courses")
      .select("id, abierto_a_todos, estado")
      .eq("id", data.course_id)
      .maybeSingle();
    if (!course || !course.abierto_a_todos || course.estado !== "activa") {
      throw new Error("Este curso no está disponible para auto-inscripción.");
    }
    const { data: existing } = await supabaseAdmin
      .from("course_assignments")
      .select("id")
      .eq("course_id", data.course_id)
      .eq("employee_id", emp.id)
      .maybeSingle();
    if (existing) return { assignment_id: existing.id, already: true };
    const { data: created, error } = await supabaseAdmin
      .from("course_assignments")
      .insert({
        course_id: data.course_id,
        employee_id: emp.id,
        origen: "auto_inscripcion",
        estado: "pendiente",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { assignment_id: created.id, already: false };
  });




export const listMyCertificates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: emp } = await supabase
      .from("employees")
      .select("id, nombre, dui")
      .eq("auth_user_id", userId)
      .maybeSingle();
    if (!emp) return [];
    const { data } = await supabase
      .from("certificates")
      .select("*, courses(nombre, duracion_min)")
      .eq("employee_id", emp.id)
      .order("fecha_emision", { ascending: false });
    return (data ?? []).map((c) => ({ ...c, employees: { nombre: emp.nombre, dui: emp.dui } }));
  });

export const teamOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: jefe } = await supabase
      .from("employees")
      .select("id")
      .eq("auth_user_id", userId)
      .maybeSingle();
    if (!jefe) return { team: [] };
    const { data: team } = await supabase
      .from("employees")
      .select("id, nombre, dui, area, cargo, estado")
      .eq("jefe_id", jefe.id);
    const ids = (team ?? []).map((t) => t.id);
    if (!ids.length) return { team: [] };
    const { data: assigns } = await supabase
      .from("course_assignments")
      .select("employee_id, estado, mejor_nota, courses(nombre, tipo)")
      .in("employee_id", ids);
    return {
      team: (team ?? []).map((t) => ({
        ...t,
        assignments: (assigns ?? []).filter((a) => a.employee_id === t.id),
      })),
    };
  });

export const adminMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const [emps, assigns, certs] = await Promise.all([
      supabaseAdmin.from("employees").select("id, estado"),
      supabaseAdmin.from("course_assignments").select("estado"),
      supabaseAdmin.from("certificates").select("id"),
    ]);
    const a = assigns.data ?? [];
    return {
      empleados: emps.data?.length ?? 0,
      en_induccion: a.filter((x) => x.estado === "en_curso").length,
      aprobados: a.filter((x) => x.estado === "aprobado").length,
      reprobados: a.filter((x) => x.estado === "reprobado").length,
      bloqueados: a.filter((x) => x.estado === "bloqueado").length,
      certificados: certs.data?.length ?? 0,
    };
  });

// ============== GAMIFICATION ==============
export const gamificationOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: emp } = await supabase
      .from("employees")
      .select("id, nombre, xp, area")
      .eq("auth_user_id", userId)
      .maybeSingle();

    // Award badges based on activity (idempotent)
    if (emp) await awardBadgesFor(emp.id);

    const [{ data: myBadges }, { data: allBadges }, { data: top }] = await Promise.all([
      supabaseAdmin
        .from("employee_badges")
        .select("badge_id, awarded_at, badges(nombre, descripcion, icono, slug)")
        .eq("employee_id", emp?.id ?? "00000000-0000-0000-0000-000000000000"),
      supabaseAdmin.from("badges").select("*").order("nombre"),
      supabaseAdmin
        .from("employees")
        .select("id, nombre, area, xp")
        .order("xp", { ascending: false })
        .limit(10),
    ]);

    return {
      me: emp,
      myBadges: myBadges ?? [],
      allBadges: allBadges ?? [],
      ranking: (top ?? []).map((r, i) => ({ ...r, rank: i + 1, isMe: r.id === emp?.id })),
    };
  });

async function awardBadgesFor(employeeId: string) {
  const { data: badges } = await supabaseAdmin.from("badges").select("id, slug");
  if (!badges?.length) return;
  const bySlug = Object.fromEntries(badges.map((b) => [b.slug, b.id]));

  const [
    { data: assigns },
    { data: attempts },
    { data: certs },
    { data: already },
    { data: lessons },
    { data: emp },
  ] = await Promise.all([
    supabaseAdmin
      .from("course_assignments")
      .select("estado, origen, intentos_consumidos, mejor_nota")
      .eq("employee_id", employeeId),
    supabaseAdmin
      .from("quiz_attempts")
      .select("aprobado, score, intento_num, finished_at")
      .eq("employee_id", employeeId)
      .order("finished_at", { ascending: true }),
    supabaseAdmin
      .from("certificates")
      .select("id, nota")
      .eq("employee_id", employeeId),
    supabaseAdmin
      .from("employee_badges")
      .select("badge_id")
      .eq("employee_id", employeeId),
    supabaseAdmin
      .from("lesson_progress")
      .select("id")
      .eq("employee_id", employeeId)
      .eq("completado", true)
      .limit(1),
    supabaseAdmin.from("employees").select("xp").eq("id", employeeId).single(),
  ]);

  const owned = new Set((already ?? []).map((b) => b.badge_id));
  const toAward: { employee_id: string; badge_id: string }[] = [];
  const add = (slug: string) => {
    const id = bySlug[slug];
    if (id && !owned.has(id)) toAward.push({ employee_id: employeeId, badge_id: id });
  };

  const aprobados = (assigns ?? []).filter((a) => a.estado === "aprobado");
  const inducciones = (assigns ?? []).filter((a) => a.origen === "induccion");
  const opcionales = (assigns ?? []).filter((a) => a.origen === "auto_inscripcion");
  const opcionalesAprobados = opcionales.filter((a) => a.estado === "aprobado");

  // Mejor racha de evaluaciones aprobadas consecutivas
  let racha = 0;
  let mejorRacha = 0;
  for (const a of attempts ?? []) {
    if (a.aprobado) {
      racha += 1;
      mejorRacha = Math.max(mejorRacha, racha);
    } else {
      racha = 0;
    }
  }

  add("primer_acceso");
  if ((lessons ?? []).length) add("curioso");
  if ((attempts ?? []).length) add("primer_quiz");
  if (inducciones.length && inducciones.every((a) => a.estado === "aprobado"))
    add("induccion_completa");
  if ((certs ?? []).length) add("primer_certificado");
  if ((certs ?? []).some((c) => (c.nota ?? 0) >= 95)) add("excelencia");
  if ((attempts ?? []).some((a) => a.aprobado && a.intento_num === 1)) add("sin_reintentos");
  if ((attempts ?? []).some((a) => (a.score ?? 0) >= 100)) add("puntaje_perfecto");
  if ((attempts ?? []).some((a) => a.aprobado && (a.intento_num ?? 1) >= 3)) add("perseverante");
  if (mejorRacha >= 3) add("racha_imparable");
  if (aprobados.length >= 3) add("trilogia_mor");
  if (aprobados.length >= 5) add("maratonista");
  if (aprobados.length >= 10) add("leyenda_mor");
  if (opcionales.length >= 1) add("explorador");
  if (opcionalesAprobados.length >= 3) add("autodidacta");
  if ((certs ?? []).length >= 5) add("coleccionista");
  if ((emp?.xp ?? 0) >= 500) add("mente_brillante");
  if ((emp?.xp ?? 0) >= 1000) add("mente_maestra");

  if (toAward.length) {
    await supabaseAdmin.from("employee_badges").insert(toAward);
    const xpGain = toAward.length * 50;
    await supabaseAdmin
      .from("employees")
      .update({ xp: (emp?.xp ?? 0) + xpGain })
      .eq("id", employeeId);
  }
}
