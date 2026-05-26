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
