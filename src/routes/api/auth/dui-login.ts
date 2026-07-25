import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { isValidDui, isValidPin, duiEmail } from "@/lib/dui";

/**
 * La contraseña real de la cuenta nunca se deriva de un dato público ni se
 * devuelve al cliente: se calcula con un secreto que solo vive en el servidor.
 */
function accountPassword(dui: string): string {
  const secret = process.env.AUTH_DERIVATION_SECRET;
  if (!secret) throw new Error("AUTH_DERIVATION_SECRET no configurado");
  return createHmac("sha256", secret).update(`account:${dui}`).digest("hex");
}

function pinHash(dui: string, pin: string): string {
  const secret = process.env.AUTH_DERIVATION_SECRET;
  if (!secret) throw new Error("AUTH_DERIVATION_SECRET no configurado");
  return createHmac("sha256", secret).update(`pin:${dui}:${pin}`).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

const genericError = () =>
  Response.json(
    { error: "DUI o PIN incorrectos. Contacta a Recursos Humanos." },
    { status: 401 },
  );

export const Route = createFileRoute("/api/auth/dui-login")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as {
          dui?: string;
          pin?: string;
          mode?: "check" | "login" | "setup";
        };
        const dui = body.dui?.trim() ?? "";
        const mode = body.mode ?? "login";

        if (!isValidDui(dui)) {
          return Response.json(
            { error: "Formato de DUI inválido. Usa 00000000-0." },
            { status: 400 },
          );
        }

        const { data: emp, error: empErr } = await supabaseAdmin
          .from("employees")
          .select("id, nombre, auth_user_id")
          .eq("dui", dui)
          .maybeSingle();
        if (empErr) {
          console.error(empErr);
          return Response.json({ error: "Error del sistema." }, { status: 500 });
        }

        const { data: pinRow } = emp
          ? await supabaseAdmin
              .from("employee_pins")
              .select("pin_hash")
              .eq("employee_id", emp.id)
              .maybeSingle()
          : { data: null as { pin_hash: string } | null };

        // Paso 1: ¿este DUI ya tiene PIN configurado?
        // Respuesta uniforme para no revelar si el DUI existe.
        if (mode === "check") {
          return Response.json({ needsSetup: !pinRow });
        }

        const pin = body.pin?.trim() ?? "";
        if (!isValidPin(pin)) {
          return Response.json(
            { error: "El PIN debe tener 6 dígitos." },
            { status: 400 },
          );
        }
        if (!emp) return genericError();

        if (mode === "setup") {
          if (pinRow) return genericError();
          const { error: insErr } = await supabaseAdmin
            .from("employee_pins")
            .insert({ employee_id: emp.id, pin_hash: pinHash(dui, pin) });
          if (insErr) {
            console.error(insErr);
            return Response.json({ error: "Error del sistema." }, { status: 500 });
          }
        } else {
          if (!pinRow || !safeEqual(pinRow.pin_hash, pinHash(dui, pin))) {
            return genericError();
          }
        }

        const email = duiEmail(dui);
        const password = accountPassword(dui);

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
        } else {
          // Garantiza que la contraseña interna corresponda al secreto actual.
          await supabaseAdmin.auth.admin.updateUserById(emp.auth_user_id, {
            password,
          });
        }

        // La sesión se emite en el servidor; el cliente nunca ve la contraseña.
        const authClient = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          { auth: { persistSession: false, autoRefreshToken: false } },
        );
        const { data: signIn, error: signInErr } =
          await authClient.auth.signInWithPassword({ email, password });
        if (signInErr || !signIn.session) {
          console.error(signInErr);
          return Response.json(
            { error: "No se pudo iniciar sesión." },
            { status: 500 },
          );
        }

        return Response.json({
          access_token: signIn.session.access_token,
          refresh_token: signIn.session.refresh_token,
        });
      },
    },
  },
});
