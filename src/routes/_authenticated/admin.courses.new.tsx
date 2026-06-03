import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createCourse } from "@/lib/academy.functions";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Loader2, ListChecks } from "lucide-react";
import { toast } from "sonner";
import {
  QuestionsEditor,
  QuestionErrors,
  validateQuestions,
  type ManualQuestion,
} from "@/components/QuestionsEditor";

export const Route = createFileRoute("/_authenticated/admin/courses/new")({ component: NewCourse });

type Lesson = { titulo: string; tipo: "texto" | "video_url" | "enlace"; contenido?: string; url_externa?: string; obligatorio: boolean };

function NewCourse() {
  const nav = useNavigate();
  const fn = useServerFn(createCourse);
  const [course, setCourse] = useState({
    nombre: "", descripcion: "", tipo: "constante" as "induccion" | "constante",
    nota_minima: 80, intentos_max: 3, abierto_a_todos: false,
  });

  const [lessons, setLessons] = useState<Lesson[]>([{ titulo: "", tipo: "texto", contenido: "", obligatorio: true }]);
  const [quiz, setQuiz] = useState<{
    enabled: boolean;
    alcance: "final" | "por_leccion";
    umbral: number;
    intentos_permitidos: number;
    preguntas: ManualQuestion[];
    preguntas_por_leccion: ManualQuestion[][];
  }>({
    enabled: true,
    alcance: "final",
    umbral: 80,
    intentos_permitidos: 3,
    preguntas: [],
    preguntas_por_leccion: [[]],
  });

  const m = useMutation({
    mutationFn: () => fn({
      data: {
        ...course,
        lecciones: lessons,
        quiz: quiz.enabled
          ? {
              enabled: true,
              alcance: quiz.alcance,
              umbral: quiz.umbral,
              intentos_permitidos: quiz.intentos_permitidos,
              preguntas: quiz.alcance === "final" ? quiz.preguntas : [],
              preguntas_por_leccion: quiz.alcance === "por_leccion" ? quiz.preguntas_por_leccion : [],
            }
          : undefined,
      },
    }),
    onSuccess: () => { toast.success("Curso creado"); nav({ to: "/admin/courses" }); },
    onError: (e: any) => toast.error(e.message ?? "Error"),
  });

  const updateLesson = (i: number, patch: Partial<Lesson>) =>
    setLessons((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const addLesson = () => {
    setLessons([...lessons, { titulo: "", tipo: "texto", contenido: "", obligatorio: true }]);
    setQuiz((q) => ({ ...q, preguntas_por_leccion: [...q.preguntas_por_leccion, []] }));
  };

  const removeLesson = (i: number) => {
    setLessons(lessons.filter((_, idx) => idx !== i));
    setQuiz((q) => ({ ...q, preguntas_por_leccion: q.preguntas_por_leccion.filter((_, idx) => idx !== i) }));
  };

  // Validaciones
  const quizErrors: string[] = [];
  if (quiz.enabled) {
    if (quiz.alcance === "final") {
      if (!quiz.preguntas.length) quizErrors.push("La evaluación final debe tener al menos una pregunta.");
      quizErrors.push(...validateQuestions(quiz.preguntas));
    } else {
      const hasAny = quiz.preguntas_por_leccion.some((arr) => arr.length > 0);
      if (!hasAny) quizErrors.push("Agrega preguntas a al menos una lección.");
      quiz.preguntas_por_leccion.forEach((arr, i) => {
        validateQuestions(arr).forEach((e) => quizErrors.push(`Lección ${i + 1} — ${e}`));
      });
    }
  }

  const missing: string[] = [];
  if (!course.nombre.trim()) missing.push("nombre del curso");
  const emptyLessons = lessons.filter((l) => !l.titulo.trim()).length;
  if (emptyLessons > 0) missing.push(`título en ${emptyLessons} lección(es)`);
  const disabled = m.isPending || missing.length > 0 || quizErrors.length > 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Card className="border-border/60">
        <CardContent className="space-y-5 p-6 sm:p-8">
          <h2 className="font-display text-2xl font-semibold">Información del curso</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2"><Label>Nombre *</Label><Input value={course.nombre} onChange={(e) => setCourse({ ...course, nombre: e.target.value })} /></div>
            <div className="space-y-1.5 sm:col-span-2"><Label>Descripción</Label><Textarea value={course.descripcion} onChange={(e) => setCourse({ ...course, descripcion: e.target.value })} rows={3} /></div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={course.tipo} onValueChange={(v) => setCourse({ ...course, tipo: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="constante">Capacitación constante</SelectItem>
                  <SelectItem value="induccion">Inducción</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Nota mínima (%)</Label><Input type="number" min={50} max={100} value={course.nota_minima} onChange={(e) => setCourse({ ...course, nota_minima: +e.target.value })} /></div>
            <div className="space-y-2 sm:col-span-2 rounded-lg border border-border/60 bg-muted/30 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label className="text-sm font-semibold">Visible para todos los usuarios</Label>
                  <p className="text-xs text-muted-foreground">
                    El curso aparecerá en el catálogo abierto y cualquier colaborador podrá
                    inscribirse por su cuenta. No será obligatorio ni contará como asignado.
                  </p>
                </div>
                <Switch
                  checked={course.abierto_a_todos}
                  onCheckedChange={(c) => setCourse({ ...course, abierto_a_todos: c })}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>


      <Card className="border-border/60">
        <CardContent className="space-y-4 p-6 sm:p-8">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl font-semibold">Lecciones</h2>
            <Button size="sm" variant="outline" onClick={addLesson}>
              <Plus className="mr-1 h-4 w-4" /> Añadir lección
            </Button>
          </div>
          {lessons.map((l, i) => (
            <Card key={i} className="border-border/60 bg-muted/30">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Lección {i + 1}</span>
                  {lessons.length > 1 && (
                    <Button size="icon" variant="ghost" onClick={() => removeLesson(i)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input placeholder="Título" value={l.titulo} onChange={(e) => updateLesson(i, { titulo: e.target.value })} />
                  <Select value={l.tipo} onValueChange={(v) => updateLesson(i, { tipo: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="texto">Texto</SelectItem>
                      <SelectItem value="video_url">Video (YouTube/URL)</SelectItem>
                      <SelectItem value="enlace">Enlace externo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {l.tipo === "texto" ? (
                  <Textarea rows={5} placeholder="Contenido de la lección" value={l.contenido} onChange={(e) => updateLesson(i, { contenido: e.target.value })} />
                ) : (
                  <Input placeholder="https://..." value={l.url_externa ?? ""} onChange={(e) => updateLesson(i, { url_externa: e.target.value })} />
                )}
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardContent className="space-y-5 p-6 sm:p-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-2xl font-semibold flex items-center gap-2">
                <ListChecks className="h-5 w-5 text-primary" /> Evaluación / Quiz del curso
              </h2>
              <p className="text-sm text-muted-foreground">Crea manualmente las preguntas que verá el alumno.</p>
            </div>
            <Switch checked={quiz.enabled} onCheckedChange={(c) => setQuiz({ ...quiz, enabled: c })} />
          </div>

          {quiz.enabled && (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>¿Cuándo aparece?</Label>
                  <Select value={quiz.alcance} onValueChange={(v) => setQuiz({ ...quiz, alcance: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="final">Al final del curso</SelectItem>
                      <SelectItem value="por_leccion">Después de cada lección</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label>Umbral aprobación (%)</Label><Input type="number" min={50} max={100} value={quiz.umbral} onChange={(e) => setQuiz({ ...quiz, umbral: +e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Intentos permitidos</Label><Input type="number" min={1} max={10} value={quiz.intentos_permitidos} onChange={(e) => setQuiz({ ...quiz, intentos_permitidos: +e.target.value })} /></div>
              </div>

              {quiz.alcance === "final" ? (
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Preguntas de la evaluación final</Label>
                  <QuestionsEditor
                    value={quiz.preguntas}
                    onChange={(preguntas) => setQuiz({ ...quiz, preguntas })}
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  {lessons.map((l, i) => (
                    <div key={i} className="rounded-lg border border-border/60 p-4">
                      <Label className="text-sm font-semibold">
                        Preguntas de la lección {i + 1}{l.titulo ? `: ${l.titulo}` : ""}
                      </Label>
                      <div className="mt-3">
                        <QuestionsEditor
                          value={quiz.preguntas_por_leccion[i] ?? []}
                          onChange={(preguntas) => {
                            const next = quiz.preguntas_por_leccion.slice();
                            while (next.length < lessons.length) next.push([]);
                            next[i] = preguntas;
                            setQuiz({ ...quiz, preguntas_por_leccion: next });
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <QuestionErrors errors={quizErrors} />
            </>
          )}
        </CardContent>
      </Card>

      <div className="space-y-2">
        {missing.length > 0 && (
          <p className="text-right text-xs text-muted-foreground">
            Falta: {missing.join(" · ")}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => nav({ to: "/admin/courses" })}>Cancelar</Button>
          <Button onClick={() => m.mutate()} disabled={disabled}>
            {m.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Publicando…</> : "Publicar curso"}
          </Button>
        </div>
      </div>
    </div>
  );
}
