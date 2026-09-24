import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { exchangeSsoTicket } from "@/lib/sso.functions";

export const Route = createFileRoute("/sso")({
  validateSearch: z.object({ ticket: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Acceso único — MOR ACADEMY" },
      { name: "description", content: "Ingreso a MOR ACADEMY desde el Portal de Gestión Humana." },
      { property: "og:title", content: "Acceso único — MOR ACADEMY" },
      { property: "og:description", content: "Ingreso a MOR ACADEMY desde el Portal de Gestión Humana." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SsoPage,
});

function SsoPage() {
  const { ticket } = Route.useSearch();
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    (async () => {
      try {
        if (!ticket) throw new Error("sin ticket");
        const { token_hash } = await exchangeSsoTicket({ data: { ticket } });
        const { data, error } = await supabase.auth.verifyOtp({ token_hash, type: "magiclink" });
        if (error || !data.session) throw error ?? new Error("sin sesión");
        navigate({ to: "/home", replace: true });
      } catch (e) {
        console.error(e);
        setFailed(true);
      }
    })();
  }, [ticket, navigate]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      {failed ? (
        <div className="text-center">
          <p className="text-lg font-semibold text-foreground">No se pudo validar el acceso</p>
          <Link to="/login" className="mt-4 inline-block text-sm text-primary underline">
            Ir al inicio de sesión
          </Link>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Validando acceso…
        </div>
      )}
    </main>
  );
}
