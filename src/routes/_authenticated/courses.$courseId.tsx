import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCourseDetail, markLessonComplete } from "@/lib/academy.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft, BookOpen, CheckCircle2, FileText, Film, Link as LinkIcon, ListChecks, Loader2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/courses/$courseId")({
  component: CoursePage,
});

const lessonIcon = (tipo?: string) => {
  if (tipo === "video_url") return Film;
  if (tipo === "enlace") return LinkIcon;
  return FileText;
};

function CoursePage() {
  const { courseId } = Route.useParams();
  const fn = useServerFn(getCourseDetail);
  const mark = useServerFn(markLessonComplete);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["course", courseId],
    queryFn: () => fn({ data: { course_id: courseId } }),
  });

  const lessons = data?.lessons ?? [];
  const quizzes = data?.quizzes ?? [];
  const progress = data?.progress ?? {};
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = useMemo(
    () => lessons.find((l) => l.id === activeId) ?? lessons[0],
    [lessons, activeId],
  );

  const doneCount = lessons.filter((l) => progress[l.id]).length;
  const pct = lessons.length ? Math.round((doneCount / lessons.length) * 100) : 0;

  const completeM = useMutation({
    mutationFn: (lesson_id: string) => mark({ data: { lesson_id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["course", courseId] }),
  });

  if (isLoading || !data?.course) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  const finalQuiz = quizzes.find((q) => q.es_final) ?? quizzes[0];
  const canTakeQuiz = pct === 100;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Link to="/home" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="mr-1 h-4 w-4" /> Mis cursos
      </Link>

      <header className="rounded-2xl bg-gradient-hero p-6 text-primary-foreground sm:p-8">
        <Badge className="bg-gold text-gold-foreground hover:bg-gold">{data.course.tipo === "induccion" ? "Inducción" : "Capacitación continua"}</Badge>
        <h1 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">{data.course.nombre}</h1>
        <p className="mt-2 max-w-3xl text-primary-foreground/80">{data.course.descripcion}</p>
        <div className="mt-5 flex items-center gap-4">
          <div className="flex-1 max-w-md">
            <Progress value={pct} className="h-2 bg-primary-foreground/20" />
          </div>
          <span className="text-sm font-medium">{pct}% completado</span>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-2">
          <p className="px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Lecciones</p>
          <Card className="border-border/60">
            <CardContent className="p-2">
              {lessons.map((l, idx) => {
                const Icon = lessonIcon(l.tipo);
                const done = !!progress[l.id];
                const isActive = active?.id === l.id;
                return (
                  <button
                    key={l.id}
                    onClick={() => setActiveId(l.id)}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-md p-3 text-left text-sm transition-colors",
                      isActive ? "bg-primary/10 text-primary" : "hover:bg-muted",
                    )}
                  >
                    <span className="mt-0.5">
                      {done ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Icon className="h-4 w-4 text-muted-foreground" />}
                    </span>
                    <span className="flex-1">
                      <span className="block text-xs text-muted-foreground">Lección {idx + 1}</span>
                      <span className="block font-medium">{l.titulo}</span>
                    </span>
                  </button>
                );
              })}
              {finalQuiz && (
                <div className={cn(
                  "mt-1 flex items-start gap-3 rounded-md p-3 text-sm",
                  canTakeQuiz ? "bg-gold/10" : "opacity-60",
                )}>
                  <ListChecks className="mt-0.5 h-4 w-4 text-gold-foreground" />
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground">Evaluación final</div>
                    <div className="font-medium">{finalQuiz.nombre}</div>
                    <Button
                      size="sm"
                      className="mt-2 w-full bg-gradient-gold text-gold-foreground hover:opacity-90"
                      disabled={!canTakeQuiz}
                      onClick={() => navigate({ to: "/quiz/$quizId", params: { quizId: finalQuiz.id } })}
                    >
                      {canTakeQuiz ? "Iniciar evaluación" : "Completa las lecciones"}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </aside>

        <section>
          {active ? (
            <Card className="border-border/60">
              <CardContent className="space-y-6 p-6 sm:p-8">
                <div>
                  <Badge variant="outline">{active.tipo ?? "texto"}</Badge>
                  <h2 className="mt-3 font-display text-2xl font-semibold">{active.titulo}</h2>
                </div>
                <LessonRenderer lesson={active} />
                <div className="flex items-center justify-between border-t border-border pt-5">
                  <span className="text-xs text-muted-foreground">{active.duracion_min ?? 5} min · {active.obligatorio ? "Obligatoria" : "Opcional"}</span>
                  <Button
                    onClick={() => {
                      if (progress[active.id]) {
                        toast.info("Ya marcaste esta lección como completada.");
                        return;
                      }
                      completeM.mutate(active.id, { onSuccess: () => toast.success("Lección completada") });
                    }}
                    disabled={completeM.isPending}
                    variant={progress[active.id] ? "secondary" : "default"}
                  >
                    {progress[active.id] ? (
                      <><CheckCircle2 className="mr-2 h-4 w-4" /> Completada</>
                    ) : completeM.isPending ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando…</>
                    ) : (
                      "Marcar como completada"
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card><CardContent className="p-8 text-muted-foreground"><BookOpen className="mb-2 h-6 w-6" /> Selecciona una lección.</CardContent></Card>
          )}
        </section>
      </div>
    </div>
  );
}

function LessonRenderer({ lesson }: { lesson: any }) {
  if (lesson.tipo === "video_url" && lesson.url_externa) {
    const url = lesson.url_externa as string;
    const yt = url.match(/(?:youtu\.be\/|v=)([\w-]+)/);
    const src = yt ? `https://www.youtube.com/embed/${yt[1]}` : url;
    return (
      <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
        <iframe src={src} className="h-full w-full" allow="autoplay; encrypted-media" allowFullScreen />
      </div>
    );
  }
  if (lesson.tipo === "enlace" && lesson.url_externa) {
    return (
      <a href={lesson.url_externa} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-md border border-border bg-muted/50 px-4 py-3 text-sm font-medium hover:bg-muted">
        <LinkIcon className="h-4 w-4" /> Abrir recurso externo
      </a>
    );
  }
  return (
    <article className="prose prose-sm max-w-none whitespace-pre-wrap text-foreground">
      {lesson.contenido ?? "Sin contenido."}
    </article>
  );
}
