import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { isValidDui, duiEmail, duiPassword } from "@/lib/dui";

export const Route = createFileRoute("/api/auth/dui-login")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { dui } = (await request.json()) as { dui?: string };
        if (!dui || !isValidDui(dui)) {
          return Response.json(
            { error: "Formato de DUI inválido. Usa 00000000-0." },
            { status: 400 },
          );
        }

        // Verifica que el empleado exista (pre-registrado por RRHH)
        const { data: emp, error: empErr } = await supabaseAdmin
          .from("employees")
          .select("id, nombre, auth_user_id")
          .eq("dui", dui)
          .maybeSingle();
        if (empErr) {
          console.error(empErr);
          return Response.json({ error: "Error del sistema." }, { status: 500 });
        }
        if (!emp) {
          return Response.json(
            { error: "DUI no encontrado. Contacta a Recursos Humanos." },
            { status: 404 },
          );
        }

        const email = duiEmail(dui);
        const password = duiPassword(dui);

        // Crea el auth user si no existe
        if (!emp.auth_user_id) {
          const { data: created, error: cErr } =
            await supabaseAdmin.auth.admin.createUser({
              email,
              password,
              email_confirm: true,
              user_metadata: { dui, nombre: emp.nombre },
            });
          if (cErr || !created.user) {
            console.error(cErr);
            return Response.json(
              { error: "No se pudo iniciar sesión." },
              { status: 500 },
            );
          }
          await supabaseAdmin
            .from("employees")
            .update({ auth_user_id: created.user.id })
            .eq("id", emp.id);
          await supabaseAdmin
            .from("user_roles")
            .insert({ user_id: created.user.id, role: "colaborador" });
        }

        return Response.json({ email, password });
      },
    },
  },
});
