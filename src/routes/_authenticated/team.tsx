import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { teamOverview } from "@/lib/academy.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/team")({ component: Team });

function Team() {
  const fn = useServerFn(teamOverview);
  const { data } = useQuery({ queryKey: ["team"], queryFn: () => fn() });
  const team = data?.team ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="font-display text-3xl font-semibold">Mi equipo</h1>
        <p className="text-muted-foreground">Visualiza el avance de cada persona a tu cargo.</p>
      </header>
      {team.length === 0 ? (
        <Card className="border-dashed"><CardContent className="p-10 text-center text-muted-foreground"><Users2 className="mx-auto mb-2 h-8 w-8" />No tienes colaboradores asignados.</CardContent></Card>
      ) : (
        <div className="grid gap-4">
          {team.map((t: any) => (
            <Card key={t.id} className="border-border/60">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-display text-lg font-semibold">{t.nombre}</h3>
                    <p className="text-sm text-muted-foreground">{t.cargo} · {t.area}</p>
                  </div>
                  <Badge variant="outline">{t.estado}</Badge>
                </div>
                <div className="mt-4 grid gap-2">
                  {t.assignments?.length ? t.assignments.map((a: any, i: number) => (
                    <div key={i} className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-sm">
                      <span>{a.courses?.nombre}</span>
                      <Badge variant="secondary">{a.estado}{a.mejor_nota ? ` · ${a.mejor_nota}%` : ""}</Badge>
                    </div>
                  )) : <span className="text-sm text-muted-foreground">Sin capacitaciones asignadas.</span>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
