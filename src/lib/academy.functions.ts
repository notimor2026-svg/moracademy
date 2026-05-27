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
    const { data } = await supabase
      .from("course_assignments")
      .select("*, courses(*)")
      .eq("employee_id", emp.id);
    return { employee: emp, assignments: data ?? [] };
  });

export const getCourseDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ course_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const [{ data: course }, { data: lessons }, { data: quizzes }, { data: emp }] =
      await Promise.all([
        supabase.from("courses").select("*").eq("id", data.course_id).single(),
        supabase
          .from("course_lessons")
          .select("*")
          .eq("course_id", data.course_id)
          .order("orden"),
        supabase.from("quizzes").select("*").eq("course_id", data.course_id).order("posicion"),
        supabase.from("employees").select("id").eq("auth_user_id", userId).maybeSingle(),
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
    return { ok: true };
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

    const { data: quiz } = await supabase
      .from("quizzes")
      .select("*")
      .eq("id", data.quiz_id)
      .single();
    if (!quiz) throw new Error("Quiz no encontrado.");

    const { data: prev } = await supabase
      .from("quiz_attempts")
      .select("intento_num")
      .eq("quiz_id", data.quiz_id)
      .eq("employee_id", emp!.id)
      .order("intento_num", { ascending: false })
      .limit(1);
    const intento_num = (prev?.[0]?.intento_num ?? 0) + 1;

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
    return { attempt_id: attempt.id, preguntas, intento_num };
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
    const { data: attempt } = await supabase
      .from("quiz_attempts")
      .select("*, quizzes(*)")
      .eq("id", data.attempt_id)
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
        tipo: z.enum(["induccion", "constante"]).default("constante"),
        nota_minima: z.number().min(50).max(100).default(80),
        intentos_max: z.number().min(1).max(10).default(3),
        lecciones: z
          .array(
            z.object({
              titulo: z.string().min(1),
              tipo: z.enum(["texto", "video_url", "enlace"]).default("texto"),
              contenido: z.string().optional(),
              url_externa: z.string().optional(),
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
  if (!roles.includes("rrhh" as any) && !roles.includes("super_admin" as any)) {
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

  const [{ data: assigns }, { data: attempts }, { data: certs }, { data: already }] =
    await Promise.all([
      supabaseAdmin
        .from("course_assignments")
        .select("estado, origen, intentos_consumidos, mejor_nota")
        .eq("employee_id", employeeId),
      supabaseAdmin
        .from("quiz_attempts")
        .select("aprobado, score, intento_num")
        .eq("employee_id", employeeId),
      supabaseAdmin
        .from("certificates")
        .select("id, nota")
        .eq("employee_id", employeeId),
      supabaseAdmin
        .from("employee_badges")
        .select("badge_id")
        .eq("employee_id", employeeId),
    ]);

  const owned = new Set((already ?? []).map((b) => b.badge_id));
  const toAward: { employee_id: string; badge_id: string }[] = [];
  const add = (slug: string) => {
    const id = bySlug[slug];
    if (id && !owned.has(id)) toAward.push({ employee_id: employeeId, badge_id: id });
  };

  add("primer_acceso");
  if ((attempts ?? []).length) add("primer_quiz");
  const inducciones = (assigns ?? []).filter((a) => a.origen === "induccion");
  if (inducciones.length && inducciones.every((a) => a.estado === "aprobado")) add("induccion_completa");
  if ((certs ?? []).length) add("primer_certificado");
  if ((certs ?? []).some((c) => (c.nota ?? 0) >= 95)) add("excelencia");
  if ((attempts ?? []).some((a) => a.aprobado && a.intento_num === 1)) add("sin_reintentos");

  if (toAward.length) {
    await supabaseAdmin.from("employee_badges").insert(toAward);
    // +50 XP per badge
    const xpGain = toAward.length * 50;
    await supabaseAdmin.rpc;
    const { data: cur } = await supabaseAdmin
      .from("employees")
      .select("xp")
      .eq("id", employeeId)
      .single();
    await supabaseAdmin
      .from("employees")
      .update({ xp: (cur?.xp ?? 0) + xpGain })
      .eq("id", employeeId);
  }
}
