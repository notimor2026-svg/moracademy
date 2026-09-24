import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const VALID_ROLES = ["colaborador", "rrhh", "jefe_directo", "super_admin", "creador"] as const;
type Role = (typeof VALID_ROLES)[number];

export const exchangeSsoTicket = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ ticket: z.string().min(1).max(4096) }).parse(d))
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
    const email = info.email?.trim().toLowerCase();
    if (!email) throw new Error("Respuesta inválida");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Buscar usuario existente por email
    let userId: string | null = null;
    for (let page = 1; page <= 50 && !userId; page++) {
      const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw new Error("Error del sistema");
      const found = list.users.find((u) => u.email?.toLowerCase() === email);
      if (found) userId = found.id;
      if (list.users.length < 200) break;
    }

    if (!userId) {
      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { nombre: info.full_name, dui: info.dui },
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

      // Vincular con el empleado existente (si aún no tiene cuenta)
      if (info.dui) {
        await supabaseAdmin
          .from("employees")
          .update({ auth_user_id: userId })
          .eq("dui", info.dui)
          .is("auth_user_id", null);
      }
    }

    const { data: link, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (linkErr || !link.properties?.hashed_token) throw new Error("No se pudo generar acceso");
    return { token_hash: link.properties.hashed_token };
  });
