import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";
import { isValidDui, duiEmail } from "@/lib/dui";
import { accountPassword } from "@/lib/account-password.server";

// Único DUI autorizado para acceder al módulo de administración.
// Cualquier otro usuario, aún si tuviera rol "rrhh" en la BD, no debe ver
// ni operar el Centro de Control.
export const ADMIN_DUI = "05182956-2";

const requireRrhh = async (userId: string) => {
  const { data: emp } = await supabaseAdmin
    .from("employees")
    .select("dui")
    .eq("auth_user_id", userId)
    .maybeSingle();
  if (emp?.dui === ADMIN_DUI) return;
  const { data: roles } = await supabaseAdmin
    .from("user_roles").select("role").eq("user_id", userId);
  const roleSet = new Set((roles ?? []).map((r) => r.role as string));
  if (roleSet.has("super_admin") || roleSet.has("rrhh")) return;
  throw new Error("Solo el administrador autorizado puede ejecutar esta acción.");
};

const requireSuperAdmin = async (userId: string) => {
  const { data: roles } = await supabaseAdmin
    .from("user_roles").select("role").eq("user_id", userId);
  const isSuper = (roles ?? []).some((r) => (r.role as string) === "super_admin");
  if (!isSuper) {
    const { data: emp } = await supabaseAdmin
      .from("employees").select("dui").eq("auth_user_id", userId).maybeSingle();
    if (emp?.dui !== ADMIN_DUI) {
      throw new Error("Solo el Super Administrador puede ejecutar esta acción.");
    }
  }
};

// Permite a quienes pueden gestionar cursos: admin maestro, super_admin, rrhh o creador.
const requireCourseEditor = async (userId: string) => {
  const { data: roles } = await supabaseAdmin
    .from("user_roles").select("role").eq("user_id", userId);
  const roleSet = new Set((roles ?? []).map((r) => r.role as string));
  if (roleSet.has("super_admin") || roleSet.has("rrhh") || roleSet.has("creador")) return;
  const { data: emp } = await supabaseAdmin
    .from("employees").select("dui").eq("auth_user_id", userId).maybeSingle();
  if (emp?.dui !== ADMIN_DUI) {
    throw new Error("No tienes permisos para gestionar cursos.");
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
    const roleList = (roles ?? []).map((r) => r.role as string);
    const isSuper = roleList.includes("super_admin") || emp?.dui === ADMIN_DUI;
    const isCreador = roleList.includes("creador");
    return {
      userId,
      roles: roleList,
      employee: emp,
      isAdmin: emp?.dui === ADMIN_DUI || isSuper || isCreador,
      isSuperAdmin: isSuper,
      isCreador,
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
    const password = accountPassword(data.dui);
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

    // 4) Genera asignaciones de inducción desde la requisición (closed_requisitions)
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
    }

    // 4b) Genera asignaciones desde capacitaciones requeridas en MOR Talent Pipeline
    //     (INDEPENDIENTE de 4a — el formulario envía pipeline_required_trainings
    //     cuando se selecciona una requisición del Pipeline externo).
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

// ============== MOR TALENT PIPELINE INTEGRATION ==============
// El Pipeline vive en otro proyecto Lovable Cloud. Lo consultamos con su
// publishable key (pública por diseño; no es secreto). Para que esta llamada
// devuelva datos, en el proyecto Pipeline debe existir una policy de SELECT
// sobre public.requisitions que permita al rol `anon` leer las plazas con
// status = 'plaza_cubierta' (ver instrucciones al usuario).
const PIPELINE_URL = "https://bhuqyykpjnoirpqxlstt.supabase.co";
const PIPELINE_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJodXF5eWtwam5vaXJwcXhsc3R0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3OTEzNjgsImV4cCI6MjA5MjM2NzM2OH0.A9Rii_GncLhLCSZaSUzUI-vVHGiqE-JFO5iUT7nMgg8";

export type PipelineRequisition = {
  id: string;
  code: string;
  position_title: string;
  management_area: string | null;
  department: string | null;
  required_trainings: string[];
  status: string | null;
  updated_at: string | null;
};

export const listPipelineRequisitions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PipelineRequisition[]> => {
    await requireRrhh(context.userId);
    const headers = {
      apikey: PIPELINE_ANON,
      Authorization: `Bearer ${PIPELINE_ANON}`,
      "Content-Type": "application/json",
    };
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 10000);

    const call = (input: string, init?: RequestInit) =>
      fetch(input, { ...init, headers, signal: ctl.signal });

    let rows:
      | Array<{
          id: string;
          code: string;
          position_title: string;
          management_area: string | null;
          department?: string | null;
          departments?: { name: string } | null;
          required_trainings: string[] | null;
          status: string | null;
          updated_at: string | null;
        }>
      | null = null;
    let lastError = "";

    try {
      // 1) Vía preferida: RPC pública del sistema de requisiciones (expone solo
      //    columnas seguras de TODAS las requisiciones).
      const rpc = await call(`${PIPELINE_URL}/rest/v1/rpc/academy_list_requisitions`, {
        method: "POST",
        body: "{}",
      });
      if (rpc.ok) {
        rows = await rpc.json();
      } else {
        lastError = `rpc ${rpc.status}: ${(await rpc.text()).slice(0, 160)}`;
        // 2) Respaldo: lectura directa de la tabla (si existe policy anónima).
        const rest = await call(
          `${PIPELINE_URL}/rest/v1/requisitions` +
            `?select=id,code,position_title,management_area,required_trainings,status,updated_at,departments(name)` +
            `&order=updated_at.desc&limit=1000`,
        );
        if (rest.ok) rows = await rest.json();
        else lastError += ` | rest ${rest.status}: ${(await rest.text()).slice(0, 160)}`;
      }
    } catch (e: any) {
      clearTimeout(timer);
      if (e?.name === "AbortError") {
        throw new Error("El sistema de requisiciones tardó demasiado en responder. Reintenta.");
      }
      throw new Error(`No se pudo contactar al sistema de requisiciones: ${e?.message ?? "error de red"}`);
    }
    clearTimeout(timer);

    if (!rows) {
      throw new Error(
        "No se pudo leer el sistema de requisiciones. Falta habilitar el acceso de lectura " +
          `(función academy_list_requisitions) en ese proyecto. Detalle: ${lastError}`,
      );
    }

    return rows.map((r) => ({
      id: r.id,
      code: r.code,
      position_title: r.position_title,
      management_area: r.management_area,
      department: r.department ?? r.departments?.name ?? null,
      required_trainings: r.required_trainings ?? [],
      status: r.status,
      updated_at: r.updated_at,
    }));
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
        course_ids: z.array(z.string().uuid()).min(1),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireRrhh(context.userId);
    const rows = data.employee_ids.flatMap((eid) =>
      data.course_ids.map((cid) => ({
        employee_id: eid,
        course_id: cid,
        origen: "manual" as const,
      })),
    );
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

// (Eliminado) ensureFirstRrhh: permitía que cualquier usuario autenticado se
// auto-asignara el rol RRHH. La asignación de roles se hace desde
// Gestión de Usuarios por un super administrador.

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
    await requireCourseEditor(context.userId);
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
        tipo: z.enum(["induccion", "constante", "material"]),
        estado: z.enum(["borrador", "activa", "archivada"]),
        nota_minima: z.number().min(50).max(100),
        intentos_max: z.number().min(1).max(10),
        duracion_min: z.number().min(1).max(1000).optional().nullable(),
        permite_certificado: z.boolean(),
        abierto_a_todos: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireCourseEditor(context.userId);
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
        tipo: z.enum(["texto", "video_url", "enlace", "pdf", "archivo"]).default("texto"),
        contenido: z.string().optional().nullable(),
        url_externa: z.string().optional().nullable(),
        storage_path: z.string().optional().nullable(),
        obligatorio: z.boolean().default(true),
        orden: z.number().min(0).max(9999),
        duracion_min: z.number().min(0).max(600).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireCourseEditor(context.userId);
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
    await requireCourseEditor(context.userId);
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
    await requireCourseEditor(context.userId);
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

// ============== AD-HOC REPORTS ==============

const ReportFiltersSchema = z.object({
  entidad: z.enum(["empleados", "asignaciones", "certificados", "intentos"]),
  area: z.string().optional(),
  cargo: z.string().optional(),
  estado: z.string().optional(),
  tipo_proceso: z.string().optional(),
  origen: z.string().optional(),
  curso_id: z.string().uuid().optional(),
  aprobado: z.boolean().optional(),
  desde: z.string().optional(),
  hasta: z.string().optional(),
  search: z.string().optional(),
  limit: z.number().min(1).max(5000).default(2000),
});

export const runAdHocReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => ReportFiltersSchema.parse(d))
  .handler(async ({ data, context }) => {
    await requireRrhh(context.userId);
    const { entidad, area, cargo, estado, tipo_proceso, origen, curso_id, aprobado, desde, hasta, search, limit } = data;

    if (entidad === "empleados") {
      let q = supabaseAdmin
        .from("employees")
        .select("dui, nombre, email, area, cargo, fecha_ingreso, tipo_proceso, estado, xp, requisicion_id, created_at")
        .limit(limit)
        .order("nombre");
      if (area) q = q.eq("area", area);
      if (cargo) q = q.eq("cargo", cargo);
      if (estado) q = q.eq("estado", estado);
      if (tipo_proceso) q = q.eq("tipo_proceso", tipo_proceso);
      if (desde) q = q.gte("fecha_ingreso", desde);
      if (hasta) q = q.lte("fecha_ingreso", hasta);
      if (search) q = q.or(`nombre.ilike.%${search}%,dui.ilike.%${search}%,email.ilike.%${search}%`);
      const { data: rows, error } = await q;
      if (error) throw new Error(error.message);
      return rows ?? [];
    }

    if (entidad === "asignaciones") {
      let q = supabaseAdmin
        .from("course_assignments")
        .select("estado, origen, intentos_consumidos, mejor_nota, fecha_asignacion, fecha_finalizacion, fecha_vencimiento, employees(dui, nombre, area, cargo), courses(id, nombre, tipo)")
        .limit(limit)
        .order("fecha_asignacion", { ascending: false });
      if (estado) q = q.eq("estado", estado);
      if (origen) q = q.eq("origen", origen);
      if (curso_id) q = q.eq("course_id", curso_id);
      if (desde) q = q.gte("fecha_asignacion", desde);
      if (hasta) q = q.lte("fecha_asignacion", hasta);
      const { data: rows, error } = await q;
      if (error) throw new Error(error.message);
      let mapped = (rows ?? []).map((r: any) => ({
        dui: r.employees?.dui, empleado: r.employees?.nombre, area: r.employees?.area, cargo: r.employees?.cargo,
        curso: r.courses?.nombre, tipo_curso: r.courses?.tipo,
        estado: r.estado, origen: r.origen,
        intentos: r.intentos_consumidos, mejor_nota: r.mejor_nota,
        asignado: r.fecha_asignacion, finalizado: r.fecha_finalizacion, vencimiento: r.fecha_vencimiento,
      }));
      if (area) mapped = mapped.filter((m) => m.area === area);
      if (cargo) mapped = mapped.filter((m) => m.cargo === cargo);
      if (search) {
        const s = search.toLowerCase();
        mapped = mapped.filter((m) => `${m.empleado} ${m.dui} ${m.curso}`.toLowerCase().includes(s));
      }
      return mapped;
    }

    if (entidad === "certificados") {
      let q = supabaseAdmin
        .from("certificates")
        .select("codigo, nota, fecha_emision, employees(dui, nombre, area, cargo), courses(id, nombre), course_id")
        .limit(limit)
        .order("fecha_emision", { ascending: false });
      if (curso_id) q = q.eq("course_id", curso_id);
      if (desde) q = q.gte("fecha_emision", desde);
      if (hasta) q = q.lte("fecha_emision", hasta);
      const { data: rows, error } = await q;
      if (error) throw new Error(error.message);
      let mapped = (rows ?? []).map((r: any) => ({
        codigo: r.codigo, dui: r.employees?.dui, empleado: r.employees?.nombre,
        area: r.employees?.area, cargo: r.employees?.cargo,
        curso: r.courses?.nombre, nota: r.nota, emitido: r.fecha_emision,
      }));
      if (area) mapped = mapped.filter((m) => m.area === area);
      if (cargo) mapped = mapped.filter((m) => m.cargo === cargo);
      if (search) {
        const s = search.toLowerCase();
        mapped = mapped.filter((m) => `${m.empleado} ${m.dui} ${m.curso} ${m.codigo}`.toLowerCase().includes(s));
      }
      return mapped;
    }

    // intentos
    let q = supabaseAdmin
      .from("quiz_attempts")
      .select("intento_num, score, aprobado, started_at, finished_at, employees(dui, nombre, area, cargo), quizzes(course_id, courses(id, nombre))")
      .limit(limit)
      .order("started_at", { ascending: false });
    if (typeof aprobado === "boolean") q = q.eq("aprobado", aprobado);
    if (desde) q = q.gte("started_at", desde);
    if (hasta) q = q.lte("started_at", hasta);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    let mapped = (rows ?? []).map((r: any) => ({
      dui: r.employees?.dui, empleado: r.employees?.nombre,
      area: r.employees?.area, cargo: r.employees?.cargo,
      curso: r.quizzes?.courses?.nombre,
      intento: r.intento_num, score: r.score, aprobado: r.aprobado,
      iniciado: r.started_at, finalizado: r.finished_at,
    }));
    if (curso_id) mapped = mapped.filter((m: any) => (rows ?? []).find((r: any) => r.quizzes?.courses?.id === curso_id && r.employees?.dui === m.dui));
    if (area) mapped = mapped.filter((m) => m.area === area);
    if (cargo) mapped = mapped.filter((m) => m.cargo === cargo);
    if (search) {
      const s = search.toLowerCase();
      mapped = mapped.filter((m) => `${m.empleado} ${m.dui} ${m.curso}`.toLowerCase().includes(s));
    }
    return mapped;
  });

export const listSavedReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireRrhh(context.userId);
    const { data, error } = await supabaseAdmin
      .from("saved_reports")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const saveReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid().optional(),
      nombre: z.string().min(1).max(120),
      entidad: z.enum(["empleados", "asignaciones", "certificados", "intentos"]),
      config: z.record(z.string(), z.any()),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireRrhh(context.userId);
    if (data.id) {
      const { error } = await supabaseAdmin
        .from("saved_reports")
        .update({ nombre: data.nombre, entidad: data.entidad, config: data.config, updated_at: new Date().toISOString() })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: ins, error } = await supabaseAdmin
      .from("saved_reports")
      .insert({ nombre: data.nombre, entidad: data.entidad, config: data.config, owner_user_id: context.userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: ins.id };
  });

export const deleteSavedReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireRrhh(context.userId);
    const { error } = await supabaseAdmin.from("saved_reports").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// Gestión de Usuarios (Super Administrador)
// ============================================================

const ASSIGNABLE_ROLES = ["colaborador", "rrhh", "jefe_directo", "super_admin", "creador"] as const;
type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export const listSystemUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireSuperAdmin(context.userId);
    const { data: emps, error } = await supabaseAdmin
      .from("employees")
      .select("id, auth_user_id, dui, nombre, email, area, cargo, estado, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const userIds = (emps ?? []).map((e) => e.auth_user_id).filter(Boolean) as string[];
    let rolesByUser: Record<string, string[]> = {};
    if (userIds.length) {
      const { data: rs } = await supabaseAdmin
        .from("user_roles").select("user_id, role").in("user_id", userIds);
      rolesByUser = (rs ?? []).reduce((acc, r) => {
        const k = r.user_id as string;
        (acc[k] ||= []).push(r.role as string);
        return acc;
      }, {} as Record<string, string[]>);
    }
    return (emps ?? []).map((e) => ({
      ...e,
      roles: e.auth_user_id ? rolesByUser[e.auth_user_id] ?? [] : [],
    }));
  });

export const updateSystemUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      employee_id: z.string().uuid(),
      nombre: z.string().min(2).max(120).optional(),
      email: z.string().email().or(z.literal("")).optional(),
      area: z.string().max(80).optional().nullable(),
      cargo: z.string().max(80).optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireSuperAdmin(context.userId);
    const patch: {
      nombre?: string; email?: string | null; area?: string | null; cargo?: string | null;
    } = {};
    if (data.nombre !== undefined) patch.nombre = data.nombre;
    if (data.email !== undefined) patch.email = data.email || null;
    if (data.area !== undefined) patch.area = data.area || null;
    if (data.cargo !== undefined) patch.cargo = data.cargo || null;
    const { error } = await supabaseAdmin
      .from("employees").update(patch).eq("id", data.employee_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setUserActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ employee_id: z.string().uuid(), activo: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireSuperAdmin(context.userId);
    const { data: emp, error: e1 } = await supabaseAdmin
      .from("employees").select("auth_user_id, dui").eq("id", data.employee_id).maybeSingle();
    if (e1 || !emp) throw new Error("Empleado no encontrado.");
    if (emp.dui === ADMIN_DUI && !data.activo) {
      throw new Error("No puedes desactivar al Super Administrador maestro.");
    }
    const { error } = await supabaseAdmin
      .from("employees")
      .update({ estado: data.activo ? "activo" : "inactivo" })
      .eq("id", data.employee_id);
    if (error) throw new Error(error.message);
    // Banear/desbanear en auth para impedir login si está inactivo.
    if (emp.auth_user_id) {
      await supabaseAdmin.auth.admin.updateUserById(emp.auth_user_id, {
        ban_duration: data.activo ? "none" : "876000h",
      });
    }
    return { ok: true };
  });

export const setUserRoles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      employee_id: z.string().uuid(),
      roles: z.array(z.enum(ASSIGNABLE_ROLES)).max(5),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireSuperAdmin(context.userId);
    const { data: emp, error: e1 } = await supabaseAdmin
      .from("employees").select("auth_user_id, dui").eq("id", data.employee_id).maybeSingle();
    if (e1 || !emp?.auth_user_id) throw new Error("Empleado sin cuenta de acceso.");
    // Proteger al super admin maestro: siempre conserva super_admin.
    const finalRoles = new Set<AssignableRole>(data.roles);
    if (emp.dui === ADMIN_DUI) finalRoles.add("super_admin");
    if (finalRoles.size === 0) finalRoles.add("colaborador");

    const { error: delErr } = await supabaseAdmin
      .from("user_roles").delete().eq("user_id", emp.auth_user_id);
    if (delErr) throw new Error(delErr.message);
    const rows = Array.from(finalRoles).map((r) => ({
      user_id: emp.auth_user_id!,
      role: r as unknown as never,
    }));
    const { error: insErr } = await supabaseAdmin.from("user_roles").insert(rows);
    if (insErr) throw new Error(insErr.message);
    return { ok: true, roles: Array.from(finalRoles) };
  });

export const createSystemUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      dui: z.string().refine(isValidDui, "DUI inválido"),
      nombre: z.string().min(2).max(120),
      email: z.string().email().or(z.literal("")).optional(),
      area: z.string().max(80).optional(),
      cargo: z.string().max(80).optional(),
      roles: z.array(z.enum(ASSIGNABLE_ROLES)).min(1).max(5),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireSuperAdmin(context.userId);

    // Crear auth user con password derivada del DUI.
    const email = duiEmail(data.dui);
    const password = accountPassword(data.dui);
    const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { dui: data.dui, nombre: data.nombre },
    });
    if (cErr || !created.user) throw new Error(cErr?.message ?? "No se pudo crear el usuario.");
    const authUserId = created.user.id;

    const { data: emp, error: empErr } = await supabaseAdmin
      .from("employees")
      .insert({
        auth_user_id: authUserId,
        dui: data.dui,
        nombre: data.nombre,
        email: data.email || null,
        area: data.area || null,
        cargo: data.cargo || null,
        estado: "activo",
        tipo_proceso: "ambos",
      })
      .select("id").single();
    if (empErr) {
      await supabaseAdmin.auth.admin.deleteUser(authUserId);
      throw new Error(empErr.message);
    }

    const rows = data.roles.map((r) => ({
      user_id: authUserId,
      role: r as unknown as never,
    }));
    const { error: rErr } = await supabaseAdmin.from("user_roles").insert(rows);
    if (rErr) throw new Error(rErr.message);

    return { ok: true, employee_id: emp.id };
  });

// ============== INCORRECT ANSWERS REPORT (Super Admin) ==============

const WrongAnswersFiltersSchema = z.object({
  employee_id: z.string().uuid().optional().nullable(),
  course_id: z.string().uuid().optional().nullable(),
  only_wrong: z.boolean().optional().default(true),
  limit: z.number().int().min(1).max(1000).optional().default(300),
});

export const listWrongAnswers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => WrongAnswersFiltersSchema.parse(d))
  .handler(async ({ data, context }) => {
    await requireSuperAdmin(context.userId);

    let q = supabaseAdmin
      .from("quiz_attempts")
      .select("id, quiz_id, employee_id, intento_num, score, aprobado, finished_at, preguntas, respuestas")
      .not("finished_at", "is", null)
      .order("finished_at", { ascending: false })
      .limit(data.limit);

    if (data.employee_id) q = q.eq("employee_id", data.employee_id);
    const { data: attempts, error } = await q;
    if (error) throw new Error(error.message);
    if (!attempts?.length) return { rows: [] };

    const quizIds = Array.from(new Set(attempts.map((a) => a.quiz_id)));
    const empIds = Array.from(new Set(attempts.map((a) => a.employee_id)));

    const [{ data: quizzes }, { data: employees }] = await Promise.all([
      supabaseAdmin.from("quizzes").select("id, nombre, course_id, courses(nombre)").in("id", quizIds),
      supabaseAdmin.from("employees").select("id, nombre, dui").in("id", empIds),
    ]);

    const quizMap = new Map((quizzes ?? []).map((q: any) => [q.id, q]));
    const empMap = new Map((employees ?? []).map((e: any) => [e.id, e]));

    const filtered = data.course_id
      ? attempts.filter((a) => (quizMap.get(a.quiz_id) as any)?.course_id === data.course_id)
      : attempts;

    const rows = filtered.map((a) => {
      const preguntas = (a.preguntas as any[]) ?? [];
      const respuestas = (a.respuestas as any[]) ?? [];
      const items = preguntas.map((p, i) => {
        const dado: number[] = Array.isArray(respuestas[i]) ? respuestas[i] : [];
        const correcto: number[] = Array.isArray(p?.respuesta_correcta) ? p.respuesta_correcta : [];
        const dSorted = [...dado].sort().join(",");
        const cSorted = [...correcto].sort().join(",");
        const ok = dSorted === cSorted;
        return {
          idx: i + 1,
          enunciado: p?.enunciado ?? "",
          tipo: p?.tipo ?? "opcion_multiple",
          opciones: (p?.opciones as string[]) ?? [],
          respuesta_correcta: correcto,
          respuesta_dada: dado,
          justificacion: p?.justificacion ?? "",
          ok,
        };
      });
      const wrong = items.filter((it) => !it.ok);
      const quiz: any = quizMap.get(a.quiz_id);
      const emp: any = empMap.get(a.employee_id);
      return {
        attempt_id: a.id,
        intento_num: a.intento_num,
        score: a.score,
        aprobado: a.aprobado,
        finished_at: a.finished_at,
        employee: emp ? { id: emp.id, nombre: emp.nombre, dui: emp.dui } : null,
        quiz: quiz ? { id: quiz.id, nombre: quiz.nombre, course_id: quiz.course_id, course_nombre: quiz.courses?.nombre } : null,
        total: items.length,
        aciertos: items.length - wrong.length,
        errores: wrong.length,
        preguntas: data.only_wrong ? wrong : items,
      };
    });

    return { rows: data.only_wrong ? rows.filter((r) => r.errores > 0) : rows };
  });

export const listEmployeesLite = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireSuperAdmin(context.userId);
    const { data } = await supabaseAdmin
      .from("employees").select("id, nombre, dui").order("nombre");
    return data ?? [];
  });

export const listCoursesLite = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireSuperAdmin(context.userId);
    const { data } = await supabaseAdmin
      .from("courses").select("id, nombre").order("nombre");
    return data ?? [];
  });

// ============== CERTIFICADOS (Admin) ==============

export const listAllCertificates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireRrhh(context.userId);
    const { data } = await supabaseAdmin
      .from("certificates")
      .select("*, employees(id, nombre, dui, area, cargo), courses(id, nombre, duracion_min)")
      .order("fecha_emision", { ascending: false })
      .limit(2000);
    return data ?? [];
  });

// Emite los certificados que falten para cursos ya aprobados.
export const issueMissingCertificates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireRrhh(context.userId);
    const { data: assigns } = await supabaseAdmin
      .from("course_assignments")
      .select("id")
      .eq("estado", "aprobado");
    const { issueCertificatesFor } = await import("@/lib/academy.functions");
    const created = await issueCertificatesFor((assigns ?? []).map((a) => a.id));
    return { created };
  });

// Reinicia los intentos de evaluación de un empleado en un curso.
export const resetQuizAttempts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        assignment_id: z.string().uuid(),
        revoke_certificate: z.boolean().optional().default(false),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireRrhh(context.userId);
    const { data: assignment } = await supabaseAdmin
      .from("course_assignments")
      .select("id, employee_id, course_id")
      .eq("id", data.assignment_id)
      .maybeSingle();
    if (!assignment) throw new Error("Asignación no encontrada.");

    const { data: quizzes } = await supabaseAdmin
      .from("quizzes")
      .select("id")
      .eq("course_id", assignment.course_id);
    const quizIds = (quizzes ?? []).map((q) => q.id);
    if (quizIds.length) {
      await supabaseAdmin
        .from("quiz_attempts")
        .delete()
        .eq("employee_id", assignment.employee_id)
        .in("quiz_id", quizIds);
    }

    if (data.revoke_certificate) {
      await supabaseAdmin.from("certificates").delete().eq("assignment_id", assignment.id);
    }

    await supabaseAdmin
      .from("course_assignments")
      .update({
        estado: "en_curso",
        intentos_consumidos: 0,
        mejor_nota: null,
        fecha_finalizacion: null,
      })
      .eq("id", assignment.id);

    await supabaseAdmin.from("audit_log").insert({
      actor_id: context.userId,
      accion: "reset_quiz",
      entidad: "course_assignments",
      entidad_id: assignment.id,
      payload: { revoke_certificate: data.revoke_certificate },
    });

    return { ok: true, deleted_attempts: quizIds.length > 0 };
  });
