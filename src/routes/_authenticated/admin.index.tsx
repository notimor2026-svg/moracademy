import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminMetrics } from "@/lib/academy.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Award, BookOpen, Lock, TrendingUp, Users2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({ component: AdminHome });

function AdminHome() {
  const fn = useServerFn(adminMetrics);
  const { data } = useQuery({ queryKey: ["admin-metrics"], queryFn: () => fn(), retry: false });



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
