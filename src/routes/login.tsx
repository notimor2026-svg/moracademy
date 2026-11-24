import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MorAcademyLogo } from "@/components/MorAcademyLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { isValidDui, isValidPin, normalizeDui } from "@/lib/dui";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const [dui, setDui] = useState("");
  const [tempPin, setTempPin] = useState("");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [step, setStep] = useState<"dui" | "temp" | "login" | "setup">("dui");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { session } = useAuth();

  useEffect(() => {
    if (session) navigate({ to: "/home", replace: true });
  }, [session, navigate]);

  const post = async (body: Record<string, string>) => {
    const res = await fetch("/api/auth/dui-login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Error de inicio de sesión.");
    return json;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = normalizeDui(dui);
    if (!isValidDui(v)) {
      toast.error("Formato de DUI inválido. Usa 00000000-0.");
      return;
    }
    setSubmitting(true);
    try {
      if (step === "dui") {
        const { needsSetup } = await post({ dui: v, mode: "check" });
        setStep(needsSetup ? "temp" : "login");
        return;
      }
      if (step === "temp") {
        if (!isValidPin(tempPin)) {
          toast.error("El PIN temporal debe tener 6 dígitos.");
          return;
        }
        await post({ dui: v, pin: tempPin, mode: "verify-temp" });
        setStep("setup");
        return;
      }
      if (!isValidPin(pin)) {
        toast.error("El PIN debe tener 6 dígitos.");
        return;
      }
      if (step === "setup" && pin === "000000") {
        toast.error("Elige un PIN personal diferente de 000000.");
        return;
      }
      if (step === "setup" && pin !== pin2) {
        toast.error("Los PIN no coinciden.");
        return;
      }
      const body = await post(
        step === "setup" ? { dui: v, tempPin, pin, mode: "setup" } : { dui: v, pin, mode: "login" },
      );
      const { error } = await supabase.auth.setSession({
        access_token: body.access_token,
        refresh_token: body.refresh_token,
      });
      if (error) throw error;
      toast.success("Bienvenido a MOR ACADEMY");
      navigate({ to: "/home" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo iniciar sesión.");
    } finally {
      setSubmitting(false);
    }
  };


  return (
    <main className="relative grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden bg-gradient-hero text-primary-foreground lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="flex flex-1 items-center justify-center">
          <MorAcademyLogo size={360} className="drop-shadow-2xl" />
        </div>
        <div className="space-y-6">
          <h1 className="font-display text-5xl leading-tight">
            Formación que <span className="text-gold">eleva</span> al equipo MOR.
          </h1>
          <p className="max-w-md text-base text-primary-foreground/80">
            Inducción digital, capacitación constante y trazabilidad completa de cada
            colaborador. Diseñado para Recursos Humanos exigentes.
          </p>
          <div className="flex items-center gap-3 text-sm text-primary-foreground/80">
            <ShieldCheck className="h-5 w-5 text-gold" />
            Acceso seguro con tu DUI registrado.
          </div>
        </div>
        <p className="text-xs text-primary-foreground/60">
          © {new Date().getFullYear()} MOR ACADEMY · Talent Pipeline integrado
        </p>
      </section>

      <section className="flex items-center justify-center bg-background p-6 sm:p-10">
        <Card className="w-full max-w-md border-border/60 p-8 shadow-elevated">
          <div className="mb-6 flex items-center justify-center gap-3 lg:hidden">
            <MorAcademyLogo size={96} />
          </div>
          <h2 className="font-display text-2xl font-semibold text-foreground">
            Inicia sesión
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {step === "temp"
              ? "Primer ingreso: ingresa tu PIN temporal (000000)."
              : step === "setup"
                ? "Cambia tu PIN temporal por un PIN personal de 6 dígitos."
                : "Ingresa con tu DUI y tu PIN personal."}
          </p>
          <form onSubmit={onSubmit} className="mt-8 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="dui">DUI</Label>
              <Input
                id="dui"
                inputMode="numeric"
                placeholder="00000000-0"
                value={dui}
                onChange={(e) => {
                  setDui(e.target.value);
                  setStep("dui");
                  setTempPin("");
                  setPin("");
                  setPin2("");
                }}
                maxLength={10}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Si tu DUI no es reconocido, contacta a Recursos Humanos.
              </p>
            </div>
            {step === "temp" && (
              <div className="space-y-2">
                <Label htmlFor="tempPin">PIN temporal</Label>
                <Input
                  id="tempPin"
                  type="password"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  value={tempPin}
                  onChange={(e) => setTempPin(e.target.value.replace(/\D/g, ""))}
                  maxLength={6}
                />
              </div>
            )}
            {(step === "login" || step === "setup") && (
              <div className="space-y-2">
                <Label htmlFor="pin">
                  {step === "setup" ? "Nuevo PIN personal (6 dígitos)" : "PIN"}
                </Label>
                <Input
                  id="pin"
                  type="password"
                  inputMode="numeric"
                  autoComplete={step === "setup" ? "new-password" : "current-password"}
                  placeholder="••••••"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                  maxLength={6}
                />
              </div>
            )}
            {step === "setup" && (
              <div className="space-y-2">
                <Label htmlFor="pin2">Confirma tu nuevo PIN</Label>
                <Input
                  id="pin2"
                  type="password"
                  inputMode="numeric"
                  autoComplete="new-password"
                  placeholder="••••••"
                  value={pin2}
                  onChange={(e) => setPin2(e.target.value.replace(/\D/g, ""))}
                  maxLength={6}
                />
                <p className="text-xs text-muted-foreground">
                  Guárdalo: lo necesitarás en cada inicio de sesión.
                </p>
              </div>
            )}
            <Button type="submit" className="w-full" disabled={submitting} size="lg">
              {submitting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verificando…</>
              ) : step === "dui" || step === "temp" ? (
                "Continuar"
              ) : step === "setup" ? (
                "Guardar PIN y entrar"
              ) : (
                "Acceder a MOR ACADEMY"
              )}
            </Button>
          </form>
        </Card>
      </section>
    </main>
  );
}
