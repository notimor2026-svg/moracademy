import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";
import { generateObject } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

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

const questionTypes = [
  "opcion_multiple",
  "verdadero_falso",
  "relacionar_columnas",
  "completar_espacios",
  "multiple_respuesta",
  "situacional_analisis",
] as const;

const QuestionSchema = z.object({
  enunciado: z.string().min(8),
  tipo: z.enum(questionTypes),
  dificultad: z.enum(["basica", "media", "avanzada"]).default("media"),
  opciones: z.array(z.string().min(1)).min(2).max(8),
  respuesta_correcta: z.array(z.number().int()).min(1),
  justificacion: z.string().min(8),
});

type QuizQuestion = z.infer<typeof QuestionSchema>;

const normalizeQuestion = (question: QuizQuestion): QuizQuestion | null => {
  const tipo = questionTypes.includes(question.tipo) ? question.tipo : "opcion_multiple";
  const opciones = question.tipo === "verdadero_falso"
    ? ["Verdadero", "Falso"]
    : Array.from(new Set(question.opciones.map((option) => option.trim()).filter(Boolean))).slice(0, 8);
  if (!question.enunciado.trim() || opciones.length < 2) return null;
  const respuesta_correcta = question.respuesta_correcta
    .filter((index) => Number.isInteger(index) && index >= 0 && index < opciones.length)
    .slice(0, tipo === "multiple_respuesta" || tipo === "relacionar_columnas" ? opciones.length : 1);
  if (!respuesta_correcta.length) return null;
  return {
    enunciado: question.enunciado.trim(),
    tipo,
    dificultad: question.dificultad ?? "media",
    opciones,
    respuesta_correcta,
    justificacion: question.justificacion.trim() || "Respuesta basada en el material del curso.",
  };
};

const sanitizeQuestions = (questions: QuizQuestion[], count: number) => {
  const clean = questions.map(normalizeQuestion).filter((q): q is QuizQuestion => Boolean(q));
  const seen = new Set<string>();
  return clean.filter((question) => {
    const key = question.enunciado.toLowerCase().replace(/\W+/g, " ").trim().slice(0, 90);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, count);
};

const buildFallbackQuestions = (material: string, count: number): QuizQuestion[] => {
  const cleaned = material
    .replace(/[#*_>`-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const sentences = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 35)
    .slice(0, Math.max(count, 3));
  const source = sentences.length ? sentences : [cleaned || "El curso no contiene suficiente material textual para generar preguntas detalladas."];
  const genericOptions = ["Según el material del curso", "No se menciona en el material", "Una afirmación externa", "Una conclusión no relacionada"];

  return Array.from({ length: count }, (_, index) => {
    const sentence = source[index % source.length];
    const excerpt = sentence.length > 180 ? `${sentence.slice(0, 177)}…` : sentence;
    if (index % 5 === 1) {
      return {
        enunciado: `Verdadero o falso: ${excerpt}`,
        tipo: "verdadero_falso",
        dificultad: "basica",
        opciones: ["Verdadero", "Falso"],
        respuesta_correcta: [0],
        justificacion: `La afirmación aparece en el material: “${excerpt}”.`,
      };
    }
    if (index % 5 === 2) {
      return {
        enunciado: "Selecciona las afirmaciones que sí están respaldadas por el material del curso.",
        tipo: "multiple_respuesta",
        dificultad: "media",
        opciones: [excerpt, "Una idea no mencionada en el recurso", "Una conclusión ajena al contenido", "Un dato externo al curso"],
        respuesta_correcta: [0],
        justificacion: `La afirmación correcta proviene del material: “${excerpt}”.`,
      };
    }
    if (index % 5 === 3) {
      return {
        enunciado: "Completa la idea central con la opción que mejor representa el contenido estudiado.",
        tipo: "completar_espacios",
        dificultad: "media",
        opciones: [excerpt, "un procedimiento no cubierto", "una práctica contraria", "un concepto no relacionado"],
        respuesta_correcta: [0],
        justificacion: `La opción correcta completa la idea con información del curso: “${excerpt}”.`,
      };
    }
    if (index % 5 === 4) {
      return {
        enunciado: "Ante una situación laboral relacionada con el tema, ¿qué interpretación se alinea mejor con el curso?",
        tipo: "situacional_analisis",
        dificultad: "avanzada",
        opciones: [excerpt, "Ignorar el contenido del curso", "Aplicar un criterio externo", "Elegir una acción sin analizar el material"],
        respuesta_correcta: [0],
        justificacion: `La interpretación correcta se basa en el fragmento: “${excerpt}”.`,
      };
    }
    return {
      enunciado: `¿Cuál opción coincide mejor con el material revisado?`,
      tipo: "opcion_multiple",
      dificultad: "basica",
      opciones: [excerpt, ...genericOptions.slice(1)],
      respuesta_correcta: [0],
      justificacion: `La respuesta correcta corresponde al fragmento del material: “${excerpt}”.`,
    };
  });
};

export const startQuizAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ quiz_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Falta LOVABLE_API_KEY.");

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

    // Contenido hasta este punto
    const { data: lessons } = await supabase
      .from("course_lessons")
      .select("titulo, contenido, text_excerpt, orden, tipo, url_externa, storage_path, modulo, seccion")
      .eq("course_id", quiz.course_id)
      .order("orden");
    const material = (lessons ?? [])
      .filter((l) => (l.orden ?? 0) <= (quiz.posicion ?? 999))
      .map((l) => {
        const parts = [
          `## ${l.titulo}`,
          l.modulo ? `Módulo: ${l.modulo}` : "",
          l.seccion ? `Sección: ${l.seccion}` : "",
          `Tipo de recurso: ${l.tipo ?? "texto"}`,
          l.contenido || l.text_excerpt || "",
          l.url_externa ? `Recurso externo mostrado al alumno: ${l.url_externa}` : "",
          l.storage_path ? `Documento o imagen del curso: ${l.storage_path}` : "",
        ].filter(Boolean);
        return parts.join("\n");
      })
      .join("\n\n");

    const { data: prev } = await supabase
      .from("quiz_attempts")
      .select("intento_num, preguntas")
      .eq("quiz_id", data.quiz_id)
      .eq("employee_id", emp!.id)
      .order("intento_num", { ascending: false })
      .limit(1);
    const intento_num = (prev?.[0]?.intento_num ?? 0) + 1;
    const previousQuestions = ((prev?.[0]?.preguntas as Array<{ enunciado?: string }> | null) ?? [])
      .map((question) => question.enunciado)
      .filter(Boolean)
      .slice(0, 10)
      .join("\n- ");

    if (intento_num > quiz.intentos_permitidos) {
      throw new Error("Has agotado los intentos permitidos.");
    }

    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-2.5-flash");

    const materialForAi = (material || "Sin material textual suficiente.").slice(0, 18000);
    let preguntas: QuizQuestion[] = [];

    try {
      const { object } = await generateObject({
        model,
        output: "array",
        schema: QuestionSchema,
        maxOutputTokens: 8192,
        temperature: 0.7,
        system:
          "Eres un diseñador instruccional experto en evaluaciones corporativas. Genera preguntas en español usando exclusivamente el contenido visible o disponible para el alumno en el curso. No inventes datos externos. Si un recurso es video, documento, imagen o enlace y solo hay título/URL/ruta disponible, genera preguntas únicamente sobre los datos textuales proporcionados de ese recurso. Devuelve datos que cumplan exactamente el esquema.",
        prompt: `Contenido mostrado al alumno en el curso:\n\n${materialForAi}\n\nPreguntas usadas recientemente que debes evitar:\n- ${previousQuestions || "Ninguna"}\n\nSemilla única para evitar repetición: ${emp!.id}-${data.quiz_id}-${intento_num}-${Date.now()}\nCantidad exacta requerida: ${quiz.num_preguntas}\n\nRequisitos:\n- Todas las preguntas deben evaluar comprensión real del contenido anterior.\n- Varía tipos entre: opcion_multiple, verdadero_falso, relacionar_columnas, completar_espacios, multiple_respuesta y situacional_analisis.\n- Varía dificultad entre basica, media y avanzada.\n- Evita preguntas repetidas o demasiado similares.\n- respuesta_correcta debe contener índices 0-based de opciones correctas.\n- Para verdadero_falso usa exactamente ["Verdadero","Falso"].\n- Para relacionar_columnas, cada opción debe tener formato "Concepto → Relación" y respuesta_correcta debe incluir los índices de los pares correctos.\n- Para completar_espacios, el enunciado debe contener ____ y las opciones son posibles respuestas.\n- Para situacional_analisis, plantea una situación breve aplicable al contenido del curso.\n- La justificación debe citar o resumir la parte del contenido usada.`,
      });
      preguntas = sanitizeQuestions(object, quiz.num_preguntas);
    } catch (error) {
      console.error("No se pudieron generar preguntas con IA; usando respaldo local.", error instanceof Error ? error.message : error);
    }

    if (preguntas.length < quiz.num_preguntas) {
      const fallback = buildFallbackQuestions(material, quiz.num_preguntas - preguntas.length);
      preguntas = [...preguntas, ...fallback].slice(0, quiz.num_preguntas);
    }

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
        quiz_final: z
          .object({
            num_preguntas: z.number().min(3).max(15).default(5),
            umbral: z.number().min(50).max(100).default(80),
            intentos_permitidos: z.number().min(1).max(10).default(3),
          })
          .optional(),
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
    await supabaseAdmin.from("course_lessons").insert(lessonsToInsert);
    if (data.quiz_final) {
      await supabaseAdmin.from("quizzes").insert({
        course_id: course.id,
        nombre: "Evaluación final",
        posicion: 9999,
        es_final: true,
        ...data.quiz_final,
      });
    }
    return { course };
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
