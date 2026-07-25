import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCourseDetail, markLessonComplete, getLessonFileUrl } from "@/lib/academy.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft, BookOpen, CheckCircle2, Download, FileText, Film, Link as LinkIcon, ListChecks, Loader2, Paperclip,
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
  if (tipo === "archivo" || tipo === "pdf") return Paperclip;
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

  const canTakeQuiz = pct === 100;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Link to="/home" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="mr-1 h-4 w-4" /> Mis cursos
      </Link>

      <header className="rounded-2xl bg-gradient-hero p-6 text-primary-foreground sm:p-8">
        <Badge className="bg-gold text-gold-foreground hover:bg-gold">{data.course.tipo === "induccion" ? "Inducción" : data.course.tipo === "material" ? "Material didáctico" : "Capacitación continua"}</Badge>
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
              {quizzes.length > 0 && (
                <div className="mt-2 border-t border-border pt-2">
                  <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Evaluaciones
                  </p>
                  {quizzes.map((q) => {
                    const lessonIdx = q.lesson_id
                      ? lessons.findIndex((l) => l.id === q.lesson_id)
                      : -1;
                    const unlocked = q.es_final
                      ? canTakeQuiz
                      : q.lesson_id
                        ? !!progress[q.lesson_id]
                        : true;
                    const label = q.es_final
                      ? "Evaluación final"
                      : lessonIdx >= 0
                        ? `Evaluación · Lección ${lessonIdx + 1}`
                        : "Evaluación";
                    const gateMsg = q.es_final
                      ? "Completa las lecciones"
                      : "Completa la lección";
                    return (
                      <div
                        key={q.id}
                        className={cn(
                          "mt-1 flex items-start gap-3 rounded-md p-3 text-sm",
                          unlocked ? (q.es_final ? "bg-gold/10" : "bg-muted/40") : "opacity-60",
                        )}
                      >
                        <ListChecks className="mt-0.5 h-4 w-4 text-gold-foreground" />
                        <div className="flex-1">
                          <div className="text-xs text-muted-foreground">{label}</div>
                          <div className="font-medium">{q.nombre}</div>
                          <Button
                            size="sm"
                            className={cn(
                              "mt-2 w-full",
                              q.es_final && "bg-gradient-gold text-gold-foreground hover:opacity-90",
                            )}
                            variant={q.es_final ? "default" : "outline"}
                            disabled={!unlocked}
                            onClick={() => navigate({ to: "/quiz/$quizId", params: { quizId: q.id } })}
                          >
                            {unlocked ? "Iniciar evaluación" : gateMsg}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
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

function MaterialLesson({ lesson }: { lesson: any }) {
  const getUrl = useServerFn(getLessonFileUrl);
  const { data, isLoading, error } = useQuery({
    queryKey: ["lesson-file", lesson.id],
    queryFn: () => getUrl({ data: { lesson_id: lesson.id } }),
    retry: false,
    staleTime: 30 * 60 * 1000,
  });

  const nombre: string = lesson.contenido || "Documento";
  const ext = (nombre.split(".").pop() ?? "").toLowerCase();
  const url = data?.url;

  if (isLoading) {
    return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  }
  if (error || !url) {
    return (
      <p className="text-sm text-muted-foreground">
        No se pudo abrir el material. {(error as Error)?.message ?? ""}
      </p>
    );
  }

  const isPdf = ext === "pdf";
  const isImage = ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext);
  const isOffice = ["doc", "docx", "ppt", "pptx", "xls", "xlsx"].includes(ext);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/60 bg-muted/40 px-4 py-3">
        <span className="flex min-w-0 items-center gap-2 text-sm">
          <Paperclip className="h-4 w-4 shrink-0 text-primary" />
          <span className="truncate font-medium">{nombre}</span>
        </span>
        <Button asChild size="sm" variant="outline">
          <a href={url} target="_blank" rel="noreferrer" download>
            <Download className="mr-1 h-4 w-4" /> Descargar
          </a>
        </Button>
      </div>

      {isPdf && (
        <iframe src={url} title={nombre} className="h-[70vh] w-full rounded-lg border border-border" />
      )}
      {isImage && (
        <img src={url} alt={nombre} className="max-h-[70vh] w-full rounded-lg border border-border object-contain" />
      )}
      {isOffice && (
        <iframe
          src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`}
          title={nombre}
          className="h-[70vh] w-full rounded-lg border border-border"
        />
      )}
      {!isPdf && !isImage && !isOffice && (
        <p className="text-sm text-muted-foreground">
          Descarga el documento para leerlo a tu ritmo.
        </p>
      )}
    </div>
  );
}

function LessonRenderer({ lesson }: { lesson: any }) {
  if ((lesson.tipo === "archivo" || lesson.tipo === "pdf") && lesson.storage_path) {
    return <MaterialLesson lesson={lesson} />;
  }
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
