import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";
import { isValidDui, duiEmail, duiPassword } from "@/lib/dui";

const requireRrhh = async (userId: string) => {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (!data?.some((r) => r.role === "rrhh")) {
    throw new Error("Solo Recursos Humanos puede ejecutar esta acción.");
  }
};

export const getMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: roles }, { data: emp }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase
        .from("employees")
        .select("*")
        .eq("auth_user_id", userId)
        .maybeSingle(),
    ]);
    return {
      userId,
      roles: (roles ?? []).map((r) => r.role),
      employee: emp,
    };
  });

const CreateEmployeeSchema = z.object({
  dui: z.string().refine(isValidDui, "DUI inválido"),
  nombre: z.string().min(2).max(120),
  email: z.string().email().optional().or(z.literal("")),
  area: z.string().max(80).optional(),
  cargo: z.string().max(80).optional(),
  fecha_ingreso: z.string().optional(),
  jefe_id: z.string().uuid().optional().nullable(),
  tipo_proceso: z.enum(["induccion", "constante", "ambos"]).default("ambos"),
  requisicion_id: z.string().uuid().optional().nullable(),
  pipeline_requisition_id: z.string().uuid().optional().nullable(),
  pipeline_required_trainings: z.array(z.string().min(1).max(200)).optional(),
  es_jefe: z.boolean().optional(),
});


export const createEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => CreateEmployeeSchema.parse(d))
  .handler(async ({ data, context }) => {
    await requireRrhh(context.userId);

    // 1) Crea auth user
    const email = duiEmail(data.dui);
    const password = duiPassword(data.dui);
    const { data: created, error: cErr } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { dui: data.dui, nombre: data.nombre },
      });
    if (cErr || !created.user) {
      throw new Error(cErr?.message ?? "No se pudo crear el usuario.");
    }
    const authUserId = created.user.id;

    // 2) Inserta empleado
    const { data: emp, error: eErr } = await supabaseAdmin
      .from("employees")
      .insert({
        auth_user_id: authUserId,
        dui: data.dui,
        nombre: data.nombre,
        email: data.email || null,
        area: data.area || null,
        cargo: data.cargo || null,
        fecha_ingreso: data.fecha_ingreso || null,
        jefe_id: data.jefe_id || null,
        tipo_proceso: data.tipo_proceso,
        requisicion_id: data.requisicion_id || null,
      })
      .select()
      .single();
    if (eErr) throw new Error(eErr.message);

    // 3) Roles
    const roles: { user_id: string; role: "colaborador" | "jefe_directo" }[] = [
      { user_id: authUserId, role: "colaborador" },
    ];
    if (data.es_jefe) roles.push({ user_id: authUserId, role: "jefe_directo" });
    await supabaseAdmin.from("user_roles").insert(roles);

    // 4) Genera asignaciones de inducción desde la requisición
    if (
      (data.tipo_proceso === "induccion" || data.tipo_proceso === "ambos") &&
      data.requisicion_id
    ) {
      const { data: req } = await supabaseAdmin
        .from("closed_requisitions")
        .select("capacitaciones_induccion")
        .eq("id", data.requisicion_id)
        .single();
      const caps = (req?.capacitaciones_induccion as Array<{ nombre: string; duracion?: number }>) ?? [];
      for (const cap of caps) {
        // Busca o crea un curso de inducción con ese nombre
        let courseId: string;
        const { data: existing } = await supabaseAdmin
          .from("courses")
          .select("id")
          .eq("nombre", cap.nombre)
          .eq("tipo", "induccion")
          .maybeSingle();
        if (existing) {
          courseId = existing.id;
        } else {
          const { data: nc, error: ncErr } = await supabaseAdmin
            .from("courses")
            .insert({
              nombre: cap.nombre,
              tipo: "induccion",
              duracion_min: cap.duracion ?? 30,
              estado: "activa",
              descripcion: `Capacitación de inducción importada desde MOR Talent Pipeline.`,
              created_by: context.userId,
            })
            .select("id")
            .single();
          if (ncErr) throw new Error(ncErr.message);
          courseId = nc.id;
        }
        await supabaseAdmin.from("course_assignments").upsert(
          {
            employee_id: emp.id,
            course_id: courseId,
            origen: "induccion",
            requisicion_id: data.requisicion_id,
          },
          { onConflict: "employee_id,course_id", ignoreDuplicates: true },
        );
    }

    // 4b) Genera asignaciones desde capacitaciones requeridas en MOR Talent Pipeline
    if (
      (data.tipo_proceso === "induccion" || data.tipo_proceso === "ambos") &&
      data.pipeline_required_trainings?.length
    ) {
      for (const nombre of data.pipeline_required_trainings) {
        const trimmed = nombre.trim();
        if (!trimmed) continue;
        let courseId: string;
        const { data: existing } = await supabaseAdmin
          .from("courses")
          .select("id")
          .eq("nombre", trimmed)
          .eq("tipo", "induccion")
          .maybeSingle();
        if (existing) {
          courseId = existing.id;
        } else {
          const { data: nc, error: ncErr } = await supabaseAdmin
            .from("courses")
            .insert({
              nombre: trimmed,
              tipo: "induccion",
              duracion_min: 30,
              estado: "borrador",
              descripcion:
                "Capacitación obligatoria importada desde MOR Talent Pipeline. Pendiente de cargar material y evaluación.",
              created_by: context.userId,
            })
            .select("id")
            .single();
          if (ncErr) throw new Error(ncErr.message);
          courseId = nc.id;
        }
        await supabaseAdmin.from("course_assignments").upsert(
          {
            employee_id: emp.id,
            course_id: courseId,
            origen: "induccion",
          },
          { onConflict: "employee_id,course_id", ignoreDuplicates: true },
        );
      }
    }

    }

    await supabaseAdmin.from("audit_log").insert({
      actor_id: context.userId,
      accion: "employee.create",
      entidad: "employees",
      entidad_id: emp.id,
      payload: { dui: data.dui },
    });

    return { employee: emp };
  });

export const listRequisitions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireRrhh(context.userId);
    const { data } = await supabaseAdmin
      .from("closed_requisitions")
      .select("*")
      .order("fecha_cierre", { ascending: false })
      .limit(50);
    return data ?? [];
  });

export const listEmployees = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireRrhh(context.userId);
    const { data } = await supabaseAdmin
      .from("employees")
      .select("*")
      .order("created_at", { ascending: false });
    return data ?? [];
  });

export const assignCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        employee_ids: z.array(z.string().uuid()).min(1),
        course_id: z.string().uuid(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireRrhh(context.userId);
    const rows = data.employee_ids.map((eid) => ({
      employee_id: eid,
      course_id: data.course_id,
      origen: "manual" as const,
    }));
    await supabaseAdmin
      .from("course_assignments")
      .upsert(rows, {
        onConflict: "employee_id,course_id",
        ignoreDuplicates: true,
      });
    return { assigned: rows.length };
  });

export const unblockAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ assignment_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireRrhh(context.userId);
    await supabaseAdmin
      .from("course_assignments")
      .update({ estado: "en_curso", intentos_consumidos: 0 })
      .eq("id", data.assignment_id);
    await supabaseAdmin.from("audit_log").insert({
      actor_id: context.userId,
      accion: "assignment.unblock",
      entidad_id: data.assignment_id,
    });
    return { ok: true };
  });

export const listAllAssignments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireRrhh(context.userId);
    const { data } = await supabaseAdmin
      .from("course_assignments")
      .select("*, employees(id, nombre, dui, area, cargo), courses(id, nombre, tipo)")
      .order("fecha_asignacion", { ascending: false });
    return data ?? [];
  });

export const listCoursesBasic = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireRrhh(context.userId);
    const { data } = await supabaseAdmin
      .from("courses")
      .select("id, nombre, tipo, estado")
      .eq("estado", "activa")
      .order("nombre");
    return data ?? [];
  });

export const reportData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ kind: z.enum(["empleados", "asignaciones", "certificados", "intentos", "bloqueos"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireRrhh(context.userId);
    if (data.kind === "empleados") {
      const { data: rows } = await supabaseAdmin
        .from("employees")
        .select("dui, nombre, email, area, cargo, fecha_ingreso, tipo_proceso, estado, xp");
      return rows ?? [];
    }
    if (data.kind === "asignaciones") {
      const { data: rows } = await supabaseAdmin
        .from("course_assignments")
        .select("estado, origen, intentos_consumidos, mejor_nota, fecha_asignacion, fecha_finalizacion, employees(dui, nombre, area), courses(nombre, tipo)");
      return (rows ?? []).map((r: any) => ({
        dui: r.employees?.dui, empleado: r.employees?.nombre, area: r.employees?.area,
        curso: r.courses?.nombre, tipo_curso: r.courses?.tipo,
        estado: r.estado, origen: r.origen,
        intentos: r.intentos_consumidos, mejor_nota: r.mejor_nota,
        asignado: r.fecha_asignacion, finalizado: r.fecha_finalizacion,
      }));
    }
    if (data.kind === "certificados") {
      const { data: rows } = await supabaseAdmin
        .from("certificates")
        .select("codigo, nota, fecha_emision, employees(dui, nombre), courses(nombre)");
      return (rows ?? []).map((r: any) => ({
        codigo: r.codigo, dui: r.employees?.dui, empleado: r.employees?.nombre,
        curso: r.courses?.nombre, nota: r.nota, emitido: r.fecha_emision,
      }));
    }
    if (data.kind === "intentos") {
      const { data: rows } = await supabaseAdmin
        .from("quiz_attempts")
        .select("intento_num, score, aprobado, started_at, finished_at, employees(dui, nombre), quizzes(course_id, courses(nombre))");
      return (rows ?? []).map((r: any) => ({
        dui: r.employees?.dui, empleado: r.employees?.nombre,
        curso: r.quizzes?.courses?.nombre,
        intento: r.intento_num, score: r.score, aprobado: r.aprobado,
        iniciado: r.started_at, finalizado: r.finished_at,
      }));
    }
    // bloqueos
    const { data: rows } = await supabaseAdmin
      .from("course_assignments")
      .select("intentos_consumidos, mejor_nota, employees(dui, nombre), courses(nombre)")
      .eq("estado", "bloqueado");
    return (rows ?? []).map((r: any) => ({
      dui: r.employees?.dui, empleado: r.employees?.nombre,
      curso: r.courses?.nombre, intentos: r.intentos_consumidos, mejor_nota: r.mejor_nota,
    }));
  });

export const getCertificate = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ certificate_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: cert } = await supabase
      .from("certificates")
      .select("*, employees(nombre, dui), courses(nombre, descripcion)")
      .eq("id", data.certificate_id)
      .maybeSingle();
    if (!cert) throw new Error("Certificado no encontrado.");
    return cert;
  });

// Ayuda dev: garantiza al menos un usuario RRHH (cuando no hay ninguno)
export const ensureFirstRrhh = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: any } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "rrhh")
      .limit(1);
    if (any && any.length) return { promoted: false };
    await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: context.userId, role: "rrhh" });
    return { promoted: true };
  });

// ============== AUDIT LOG ==============
export const listAuditLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        entidad: z.string().optional(),
        accion: z.string().optional(),
        since: z.string().optional(),
        limit: z.number().min(1).max(500).default(200),
      })
      .partial()
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await requireRrhh(context.userId);
    let q = supabaseAdmin
      .from("audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 200);
    if (data.entidad) q = q.eq("entidad", data.entidad);
    if (data.accion) q = q.eq("accion", data.accion);
    if (data.since) q = q.gte("created_at", data.since);
    const { data: rows } = await q;
    if (!rows?.length) return { rows: [], actors: {} as Record<string, string> };
    const actorIds = Array.from(new Set(rows.map((r) => r.actor_id).filter(Boolean))) as string[];
    let actors: Record<string, string> = {};
    if (actorIds.length) {
      const { data: emps } = await supabaseAdmin
        .from("employees")
        .select("auth_user_id, nombre")
        .in("auth_user_id", actorIds);
      actors = Object.fromEntries((emps ?? []).map((e) => [e.auth_user_id!, e.nombre]));
    }
    return { rows, actors };
  });

// ============== COURSE EDITOR ==============
export const getCourseEdit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ course_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireRrhh(context.userId);
    const [{ data: course }, { data: lessons }, { data: quizzes }] = await Promise.all([
      supabaseAdmin.from("courses").select("*").eq("id", data.course_id).single(),
      supabaseAdmin.from("course_lessons").select("*").eq("course_id", data.course_id).order("orden"),
      supabaseAdmin.from("quizzes").select("*").eq("course_id", data.course_id).order("posicion"),
    ]);
    return { course, lessons: lessons ?? [], quizzes: quizzes ?? [] };
  });

export const updateCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        course_id: z.string().uuid(),
        nombre: z.string().min(2).max(160),
        descripcion: z.string().max(2000).optional().nullable(),
        tipo: z.enum(["induccion", "constante"]),
        estado: z.enum(["borrador", "activa", "archivada"]),
        nota_minima: z.number().min(50).max(100),
        intentos_max: z.number().min(1).max(10),
        duracion_min: z.number().min(1).max(1000).optional().nullable(),
        permite_certificado: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireRrhh(context.userId);
    const { course_id, ...patch } = data;
    const { error } = await supabaseAdmin.from("courses").update(patch).eq("id", course_id);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("audit_log").insert({
      actor_id: context.userId,
      accion: "course.update",
      entidad: "courses",
      entidad_id: course_id,
      payload: patch,
    });
    return { ok: true };
  });

export const upsertLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid().optional(),
        course_id: z.string().uuid(),
        titulo: z.string().min(1).max(200),
        tipo: z.enum(["texto", "video_url", "enlace", "pdf"]).default("texto"),
        contenido: z.string().optional().nullable(),
        url_externa: z.string().optional().nullable(),
        obligatorio: z.boolean().default(true),
        orden: z.number().min(0).max(9999),
        duracion_min: z.number().min(0).max(600).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireRrhh(context.userId);
    const payload = {
      ...data,
      text_excerpt: data.contenido?.slice(0, 4000) ?? null,
    };
    if (data.id) {
      const { error } = await supabaseAdmin.from("course_lessons").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: ins, error } = await supabaseAdmin
      .from("course_lessons")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: ins.id };
  });

export const deleteLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireRrhh(context.userId);
    const { error } = await supabaseAdmin.from("course_lessons").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reorderLessons = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        order: z.array(z.object({ id: z.string().uuid(), orden: z.number() })).min(1),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireRrhh(context.userId);
    await Promise.all(
      data.order.map((o) =>
        supabaseAdmin.from("course_lessons").update({ orden: o.orden }).eq("id", o.id),
      ),
    );
    return { ok: true };
  });

// ============== NOTIFICATIONS DISPATCHER ==============
const SUBJECTS: Record<string, string> = {
  asignacion: "Tienes una nueva capacitación asignada",
  vencimiento: "Capacitación próxima a vencer",
  bloqueo: "Tu capacitación ha sido bloqueada",
  aprobacion: "¡Felicidades! Has aprobado una capacitación",
  certificado: "Tu certificado está listo",
};

export const dispatchNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireRrhh(context.userId);
    const { data: pending } = await supabaseAdmin
      .from("notifications_outbox")
      .select("*")
      .eq("status", "pending")
      .limit(100);
    if (!pending?.length) return { sent: 0, failed: 0 };

    const apiKey = process.env.LOVABLE_API_KEY;
    const senderDomain = process.env.LOVABLE_EMAIL_DOMAIN ?? "notify.saram.com.sv";
    const from = `MOR ACADEMY <no-reply@${senderDomain}>`;

    let sent = 0;
    let failed = 0;

    for (const n of pending) {
      try {
        const payload = (n.payload ?? {}) as Record<string, any>;
        let to: string | null = n.destinatario ?? null;

        // Resolve recipient
        if (!to || to === "rrhh") {
          if (payload.employee_id) {
            const { data: emp } = await supabaseAdmin
              .from("employees")
              .select("email, nombre")
              .eq("id", payload.employee_id)
              .maybeSingle();
            payload.empleado_nombre = emp?.nombre;
            to = emp?.email ?? null;
          }
          if (n.destinatario === "rrhh") {
            // Send to first RRHH user
            const { data: roles } = await supabaseAdmin
              .from("user_roles")
              .select("user_id")
              .eq("role", "rrhh")
              .limit(1);
            if (roles?.[0]) {
              const { data: rrhhEmp } = await supabaseAdmin
                .from("employees")
                .select("email")
                .eq("auth_user_id", roles[0].user_id)
                .maybeSingle();
              to = rrhhEmp?.email ?? to;
            }
          }
        }

        const subject = SUBJECTS[n.tipo] ?? `Notificación MOR ACADEMY: ${n.tipo}`;
        const body = `<div style="font-family:Inter,system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1f2a44">
          <h2 style="margin:0 0 12px">${subject}</h2>
          <p>Hola${payload.empleado_nombre ? ` ${payload.empleado_nombre}` : ""},</p>
          <p>Esta es una notificación automática de MOR ACADEMY.</p>
          <pre style="background:#f4f6fb;padding:12px;border-radius:8px;font-size:12px;overflow:auto">${JSON.stringify(payload, null, 2)}</pre>
          <p style="color:#64748b;font-size:12px">Si no esperabas este correo, ignóralo.</p>
        </div>`;

        if (!to || !apiKey) {
          // Mark as skipped (no recipient or no key); use 'failed' to keep schema simple
          await supabaseAdmin
            .from("notifications_outbox")
            .update({ status: "failed" })
            .eq("id", n.id);
          failed++;
          continue;
        }

        const res = await fetch("https://ai.gateway.lovable.dev/v1/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({ from, to: [to], subject, html: body }),
        });

        if (res.ok) {
          await supabaseAdmin.from("notifications_outbox").update({ status: "sent" }).eq("id", n.id);
          sent++;
        } else {
          await supabaseAdmin.from("notifications_outbox").update({ status: "failed" }).eq("id", n.id);
          failed++;
        }
      } catch {
        await supabaseAdmin.from("notifications_outbox").update({ status: "failed" }).eq("id", n.id);
        failed++;
      }
    }

    await supabaseAdmin.from("audit_log").insert({
      actor_id: context.userId,
      accion: "notifications.dispatch",
      entidad: "notifications_outbox",
      payload: { sent, failed },
    });

    return { sent, failed };
  });

export const listOutbox = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireRrhh(context.userId);
    const { data } = await supabaseAdmin
      .from("notifications_outbox")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    return data ?? [];
  });
