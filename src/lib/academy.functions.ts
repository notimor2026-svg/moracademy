import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";
import { generateText, Output } from "ai";
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

const QuestionSchema = z.object({
  enunciado: z.string(),
  tipo: z.enum(["opcion_multiple", "verdadero_falso", "multiple_respuesta"]),
  opciones: z.array(z.string()).min(2).max(6),
  respuesta_correcta: z.array(z.number()).min(1),
  justificacion: z.string(),
});

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
      .select("titulo, contenido, text_excerpt, orden, tipo")
      .eq("course_id", quiz.course_id)
      .order("orden");
    const material = (lessons ?? [])
      .filter((l) => (l.orden ?? 0) <= (quiz.posicion ?? 999))
      .map((l) =>
        `## ${l.titulo}\n${l.contenido ?? l.text_excerpt ?? "(material multimedia)"}`,
      )
      .join("\n\n");

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

    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-3-flash-preview");

    const { output } = await generateText({
      model,
      output: Output.object({
        schema: z.object({ preguntas: z.array(QuestionSchema) }),
      }),
      system:
        "Eres un generador de evaluaciones educativas en español. REGLAS ESTRICTAS: usa ÚNICAMENTE el material entregado; no inventes hechos; no uses conocimiento externo; cada pregunta debe ser respondible exclusivamente con el material. Varía las preguntas usando la semilla provista.",
      prompt: `Material del curso (hasta este punto):\n\n${material || "(sin material textual)"}\n\nSemilla de variación: ${emp!.id}-${intento_num}\nGenera exactamente ${quiz.num_preguntas} preguntas. Mezcla tipos (opción múltiple, verdadero/falso, múltiple respuesta). Para cada pregunta indica respuesta_correcta como índices (0-based) de las opciones correctas, y una justificacion citando la sección del material.`,
    });

    const preguntas = output.preguntas.slice(0, quiz.num_preguntas);

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
