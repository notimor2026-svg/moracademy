import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const VALID_ROLES = ["colaborador", "rrhh", "jefe_directo", "super_admin", "creador"] as const;
type Role = (typeof VALID_ROLES)[number];

export const exchangeSsoTicket = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ ticket: z.string().min(1).max(4096), dui: z.string().trim().max(20).optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    const secret = process.env["PORTAL_SSO_SECRET"];
    if (!secret) throw new Error("SSO no configurado");

    const res = await fetch("https://morgestionhumana.lovable.app/api/public/sso/verify", {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ticket: data.ticket }),
    });
    if (res.status !== 200) throw new Error("Ticket inválido");
    const info = (await res.json()) as {
      email?: string; full_name?: string; dui?: string; roles?: string[];
    };
    let email = info.email?.trim().toLowerCase();
    const rawDui = (data.dui || info.dui || "").trim();
    const digits = rawDui.replace(/\D/g, "");
    const dui = digits.length === 9 ? `${digits.slice(0, 8)}-${digits.slice(8)}` : rawDui || null;
    const duiVariants = dui ? Array.from(new Set([dui, digits].filter(Boolean))) : [];

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Buscar primero por DUI (con o sin guion): si el empleado ya tiene cuenta, usarla
    let userId: string | null = null;
    let employeeFound = false;
    let employeeId: string | null = null;
    if (dui) {
      const { data: emp } = await supabaseAdmin
        .from("employees")
        .select("id, auth_user_id")
        .in("dui", duiVariants)
        .limit(1)
        .maybeSingle();
      employeeFound = !!emp;
      employeeId = emp?.id ?? null;
      if (emp?.auth_user_id) {
        userId = emp.auth_user_id;
        const { data: u } = await supabaseAdmin.auth.admin.getUserById(userId);
        if (u.user?.email) email = u.user.email.toLowerCase();
      }
    }
    const portalEmail = info.email?.trim().toLowerCase() || null;

    // 2. Si no hay DUI vinculado, buscar usuario existente por email
    if (!userId && email) {
      for (let page = 1; page <= 50 && !userId; page++) {
        const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
        if (error) throw new Error("Error del sistema");
        const found = list.users.find((u) => u.email?.toLowerCase() === email);
        if (found) userId = found.id;
        if (list.users.length < 200) break;
      }
    }

    // 3. Antes de crear una cuenta nueva, pedir el DUI al empleado
    //    (puede tener una ficha de empleado que el ticket no trajo)
    if (!userId && !employeeFound && !data.dui) {
      throw new Error("NEEDS_DUI");
    }

    // 4. Si tampoco existe, crear el usuario
    if (!userId) {
      if (!email) throw new Error("Respuesta inválida");
      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { nombre: info.full_name, dui },
      });
      if (error || !created.user) throw new Error("No se pudo crear el usuario");
      userId = created.user.id;

      const roles = (info.roles ?? []).filter((r): r is Role =>
        (VALID_ROLES as readonly string[]).includes(r),
      );
      if (!roles.length) roles.push("colaborador");
      await supabaseAdmin
        .from("user_roles")
        .insert(roles.map((role) => ({ user_id: userId!, role })));
    }

    // Vincular con el empleado existente y asociar el correo del Portal al DUI
    if (employeeId) {
      await supabaseAdmin
        .from("employees")
        .update({ auth_user_id: userId })
        .eq("id", employeeId)
        .is("auth_user_id", null);
      if (portalEmail) {
        await supabaseAdmin.from("employees").update({ email: portalEmail }).eq("id", employeeId);
      }
    }

    if (!email) throw new Error("Respuesta inválida");
    const { data: link, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (linkErr || !link.properties?.hashed_token) throw new Error("No se pudo generar acceso");
    return { token_hash: link.properties.hashed_token };
  });
