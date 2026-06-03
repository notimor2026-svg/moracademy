import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listMyAssignments,
  gamificationOverview,
  listOpenCourses,
  enrollOpenCourse,
} from "@/lib/academy.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, BookOpen, CheckCircle2, Clock, Lock, Trophy, Award, Crown, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/home")({ component: Home });


const estadoStyles: Record<string, { label: string; cls: string; icon: typeof Clock }> = {
  pendiente: { label: "Pendiente", cls: "bg-muted text-muted-foreground", icon: Clock },
  en_curso: { label: "En curso", cls: "bg-primary/10 text-primary", icon: BookOpen },
  aprobado: { label: "Aprobado", cls: "bg-success/15 text-success", icon: CheckCircle2 },
  reprobado: { label: "Reprobado", cls: "bg-warning/15 text-warning", icon: Clock },
  bloqueado: { label: "Bloqueado", cls: "bg-destructive/15 text-destructive", icon: Lock },
};

function Home() {
  const fn = useServerFn(listMyAssignments);
  const fnGame = useServerFn(gamificationOverview);
  const fnOpen = useServerFn(listOpenCourses);
  const fnEnroll = useServerFn(enrollOpenCourse);
  const qc = useQueryClient();
  const nav = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ["my-assignments"], queryFn: () => fn() });
  const game = useQuery({ queryKey: ["gamification"], queryFn: () => fnGame() });
  const openCourses = useQuery({ queryKey: ["open-courses"], queryFn: () => fnOpen() });

  const enroll = useMutation({
    mutationFn: (course_id: string) => fnEnroll({ data: { course_id } }),
    onSuccess: (_res, course_id) => {
      toast.success("Te inscribiste al curso");
      qc.invalidateQueries({ queryKey: ["my-assignments"] });
      qc.invalidateQueries({ queryKey: ["open-courses"] });
      nav({ to: "/courses/$courseId", params: { courseId: course_id } });
    },
    onError: (e: any) => toast.error(e.message ?? "No se pudo inscribir"),
  });

  const assignments = data?.assignments ?? [];
  const induction = assignments.filter((a) => a.origen === "induccion");
  const ongoing = assignments.filter((a) => a.origen !== "induccion");
  const aprobados = assignments.filter((a) => a.estado === "aprobado").length;
  const open = openCourses.data ?? [];


  const myBadges = game.data?.myBadges ?? [];
  const allBadges = game.data?.allBadges ?? [];
  const ranking = game.data?.ranking ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-10">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-wider text-muted-foreground">
          Bienvenido a MOR ACADEMY
        </p>
        <h1 className="font-display text-3xl font-semibold text-foreground sm:text-4xl">
          Hola, {data?.employee?.nombre?.trim().split(/\s+/)[0] ?? "bienvenido"} 👋
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Aquí está tu ruta de aprendizaje. Completa cada capacitación a tu ritmo: tus avances
          quedan registrados automáticamente.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <KPI label="Asignados" value={assignments.length} icon={BookOpen} />
        <KPI label="Aprobados" value={aprobados} icon={Trophy} tone="gold" />
        <KPI label="XP acumulado" value={game.data?.me?.xp ?? data?.employee?.xp ?? 0} icon={Trophy} />
      </section>

      <Section title="Inducción" empty="No tienes capacitaciones de inducción asignadas." items={induction} loading={isLoading} />
      <Section title="Capacitaciones continuas" empty="No tienes capacitaciones continuas activas." items={ongoing} loading={isLoading} />

      {open.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="font-display text-xl font-semibold text-foreground flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" /> Catálogo abierto
              </h2>
              <p className="text-sm text-muted-foreground">
                Cursos opcionales disponibles para tu formación personal.
              </p>
            </div>
            <span className="text-xs text-muted-foreground">{open.length} cursos</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {open.map((c: any) => (
              <Card key={c.id} className="overflow-hidden border-border/60 transition-shadow hover:shadow-elevated">
                <div className="h-2 bg-gradient-hero" />
                <CardContent className="space-y-4 p-5">
                  <div>
                    <h3 className="font-display text-lg font-semibold text-foreground">{c.nombre}</h3>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{c.descripcion ?? "Curso abierto."}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{c.duracion_min ?? 30} min · Opcional</span>
                    <Button
                      size="sm"
                      onClick={() => enroll.mutate(c.id)}
                      disabled={enroll.isPending}
                    >
                      {enroll.isPending && enroll.variables === c.id ? (
                        <><Loader2 className="mr-1 h-4 w-4 animate-spin" /> Inscribiendo…</>
                      ) : (
                        <>Inscribirme <ArrowRight className="ml-1 h-4 w-4" /></>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}



      <section className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/60">
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-gold" />
              <h2 className="font-display text-xl font-semibold">Tus insignias</h2>
              <Badge variant="secondary" className="ml-auto">{myBadges.length}/{allBadges.length}</Badge>
            </div>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {allBadges.map((b: any) => {
                const owned = myBadges.some((m: any) => m.badge_id === b.id);
                return (
                  <div key={b.id} className={`flex flex-col items-center rounded-lg border p-3 text-center transition ${owned ? "border-gold/40 bg-gold/10" : "border-border/60 opacity-40 grayscale"}`}>
                    <Award className={`mb-1 h-6 w-6 ${owned ? "text-gold-foreground" : "text-muted-foreground"}`} />
                    <p className="text-xs font-medium leading-tight">{b.nombre}</p>
                  </div>
                );
              })}
              {allBadges.length === 0 && <p className="col-span-full text-center text-sm text-muted-foreground">Aún no hay insignias.</p>}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-gold" />
              <h2 className="font-display text-xl font-semibold">Ranking general</h2>
            </div>
            <ol className="space-y-2">
              {ranking.map((r: any) => (
                <li key={r.id} className={`flex items-center justify-between rounded-md px-3 py-2 ${r.isMe ? "bg-primary/10 ring-1 ring-primary/30" : ""}`}>
                  <div className="flex items-center gap-3">
                    <span className="w-6 text-center font-mono text-sm text-muted-foreground">#{r.rank}</span>
                    <div>
                      <p className="text-sm font-medium">{r.nombre}{r.isMe && <span className="ml-1 text-xs text-primary">(tú)</span>}</p>
                      {r.area && <p className="text-xs text-muted-foreground">{r.area}</p>}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-gold-foreground">{r.xp} XP</Badge>
                </li>
              ))}
              {ranking.length === 0 && <p className="text-center text-sm text-muted-foreground">Sin datos todavía.</p>}
            </ol>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function KPI({ label, value, icon: Icon, tone }: { label: string; value: number; icon: typeof BookOpen; tone?: "gold" }) {
  return (
    <Card className="border-border/60">
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="font-display text-3xl font-semibold text-foreground">{value}</p>
        </div>
        <div className={`rounded-full p-3 ${tone === "gold" ? "bg-gold/15 text-gold-foreground" : "bg-primary/10 text-primary"}`}>
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function Section({ title, empty, items, loading }: { title: string; empty: string; items: any[]; loading: boolean }) {
  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between">
        <h2 className="font-display text-xl font-semibold text-foreground">{title}</h2>
        <span className="text-xs text-muted-foreground">{items.length} cursos</span>
      </div>
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-44 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card className="border-dashed bg-card/50"><CardContent className="p-8 text-center text-sm text-muted-foreground">{empty}</CardContent></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((a) => {
            const s = estadoStyles[a.estado] ?? estadoStyles.pendiente;
            const Icon = s.icon;
            const progress = a.estado === "aprobado" ? 100 : a.mejor_nota ?? (a.estado === "en_curso" ? 35 : 0);
            return (
              <Card key={a.id} className="group overflow-hidden border-border/60 transition-shadow hover:shadow-elevated">
                <div className="h-2 bg-gradient-hero" />
                <CardContent className="space-y-4 p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-display text-lg font-semibold text-foreground">{a.courses?.nombre}</h3>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{a.courses?.descripcion ?? "Capacitación MOR."}</p>
                    </div>
                    <Badge className={s.cls}><Icon className="mr-1 h-3 w-3" />{s.label}</Badge>
                  </div>
                  <Progress value={progress} className="h-1.5" />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{a.courses?.duracion_min ?? 30} min</span>
                    <Button asChild size="sm" variant="ghost" className="text-primary">
                      <Link to="/courses/$courseId" params={{ courseId: a.course_id }}>
                        {a.estado === "aprobado" ? "Revisar" : "Continuar"} <ArrowRight className="ml-1 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
