import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { exchangeSsoTicket } from "@/lib/sso.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
  const [needsDui, setNeedsDui] = useState(false);
  const [dui, setDui] = useState("");
  const [busy, setBusy] = useState(false);
  const ran = useRef(false);

  const doExchange = async (duiValue?: string) => {
    if (!ticket) throw new Error("sin ticket");
    const { token_hash } = await exchangeSsoTicket({
      data: { ticket, ...(duiValue ? { dui: duiValue } : {}) },
    });
    const { data, error } = await supabase.auth.verifyOtp({ token_hash, type: "magiclink" });
    if (error || !data.session) throw error ?? new Error("sin sesión");
    navigate({ to: "/home", replace: true });
  };

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    (async () => {
      try {
        await doExchange();
      } catch (e) {
        if (e instanceof Error && e.message.includes("NEEDS_DUI")) {
          setNeedsDui(true);
        } else {
          console.error(e);
          setFailed(true);
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket, navigate]);

  const submitDui = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dui.trim()) return;
    setBusy(true);
    try {
      await doExchange(dui.trim());
    } catch (err) {
      console.error(err);
      setNeedsDui(false);
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      {failed ? (
        <div className="text-center">
          <p className="text-lg font-semibold text-foreground">No se pudo validar el acceso</p>
          <Link to="/login" className="mt-4 inline-block text-sm text-primary underline">
            Ir al inicio de sesión
          </Link>
        </div>
      ) : needsDui ? (
        <form onSubmit={submitDui} className="w-full max-w-sm space-y-4 rounded-xl border bg-card p-6 shadow-sm">
          <div className="space-y-1">
            <p className="text-lg font-semibold text-foreground">Confirma tu identidad</p>
            <p className="text-sm text-muted-foreground">
              Digita tu número de DUI para vincular tu cuenta del Portal con tu ficha de empleado.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="sso-dui">DUI</Label>
            <Input
              id="sso-dui"
              value={dui}
              onChange={(e) => setDui(e.target.value)}
              placeholder="00000000-0"
              autoFocus
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy || !dui.trim()}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Continuar
          </Button>
        </form>
      ) : (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Validando acceso…
        </div>
      )}
    </main>
  );
}
