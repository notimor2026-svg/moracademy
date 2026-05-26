import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminMetrics } from "@/lib/academy.functions";
import { ensureFirstRrhh } from "@/lib/hr.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Award, BookOpen, Lock, ShieldCheck, TrendingUp, Users2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/")({ component: AdminHome });

function AdminHome() {
  const fn = useServerFn(adminMetrics);
  const ensure = useServerFn(ensureFirstRrhh);
  const { data, isError } = useQuery({ queryKey: ["admin-metrics"], queryFn: () => fn(), retry: false });
  const ensureM = useMutation({
    mutationFn: () => ensure(),
    onSuccess: (d) => { d.promoted ? toast.success("Te promovimos a RRHH. Refresca la página.") : toast.info("Ya existe un RRHH."); },
  });

  if (isError) {
    return (
      <Card className="border-warning/40">
        <CardContent className="space-y-3 p-6 text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-warning" />
          <h2 className="font-display text-xl">Acceso restringido</h2>
          <p className="text-sm text-muted-foreground">Si eres el primer administrador del sistema, puedes auto-asignarte el rol RRHH.</p>
          <Button onClick={() => ensureM.mutate()} disabled={ensureM.isPending}>Convertirme en RRHH</Button>
        </CardContent>
      </Card>
    );
  }

  const items = [
    { label: "Empleados", value: data?.empleados ?? 0, icon: Users2 },
    { label: "En inducción", value: data?.en_induccion ?? 0, icon: BookOpen },
    { label: "Aprobados", value: data?.aprobados ?? 0, icon: TrendingUp, tone: "success" },
    { label: "Reprobados", value: data?.reprobados ?? 0, icon: TrendingUp, tone: "warning" },
    { label: "Bloqueados", value: data?.bloqueados ?? 0, icon: Lock, tone: "destructive" },
    { label: "Certificados", value: data?.certificados ?? 0, icon: Award, tone: "gold" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((i) => {
          const Icon = i.icon;
          const tone =
            i.tone === "gold" ? "bg-gold/15 text-gold-foreground" :
            i.tone === "success" ? "bg-success/15 text-success" :
            i.tone === "warning" ? "bg-warning/15 text-warning" :
            i.tone === "destructive" ? "bg-destructive/15 text-destructive" :
            "bg-primary/10 text-primary";
          return (
            <Card key={i.label} className="border-border/60">
              <CardContent className="flex items-center justify-between p-5">
                <div>
                  <p className="text-sm text-muted-foreground">{i.label}</p>
                  <p className="font-display text-3xl font-semibold">{i.value}</p>
                </div>
                <div className={`rounded-full p-3 ${tone}`}><Icon className="h-5 w-5" /></div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
