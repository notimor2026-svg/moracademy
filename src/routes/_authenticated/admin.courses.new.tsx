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
import { Plus, Trash2, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/courses/new")({ component: NewCourse });

type Lesson = { titulo: string; tipo: "texto" | "video_url" | "enlace"; contenido?: string; url_externa?: string; obligatorio: boolean };

function NewCourse() {
  const nav = useNavigate();
  const fn = useServerFn(createCourse);
  const [course, setCourse] = useState({
    nombre: "", descripcion: "", tipo: "constante" as "induccion" | "constante",
    nota_minima: 80, intentos_max: 3,
  });
  const [lessons, setLessons] = useState<Lesson[]>([{ titulo: "", tipo: "texto", contenido: "", obligatorio: true }]);
  const [quiz, setQuiz] = useState({ enabled: true, num_preguntas: 5, umbral: 80, intentos_permitidos: 3 });

  const m = useMutation({
    mutationFn: () => fn({
      data: {
        ...course,
        lecciones: lessons,
        quiz_final: quiz.enabled ? { num_preguntas: quiz.num_preguntas, umbral: quiz.umbral, intentos_permitidos: quiz.intentos_permitidos } : undefined,
      },
    }),
    onSuccess: () => { toast.success("Curso creado"); nav({ to: "/admin/courses" }); },
    onError: (e: any) => toast.error(e.message ?? "Error"),
  });

  const updateLesson = (i: number, patch: Partial<Lesson>) =>
    setLessons((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

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
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardContent className="space-y-4 p-6 sm:p-8">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl font-semibold">Lecciones</h2>
            <Button size="sm" variant="outline" onClick={() => setLessons([...lessons, { titulo: "", tipo: "texto", contenido: "", obligatorio: true }])}>
              <Plus className="mr-1 h-4 w-4" /> Añadir lección
            </Button>
          </div>
          {lessons.map((l, i) => (
            <Card key={i} className="border-border/60 bg-muted/30">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Lección {i + 1}</span>
                  {lessons.length > 1 && (
                    <Button size="icon" variant="ghost" onClick={() => setLessons(lessons.filter((_, idx) => idx !== i))}>
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
                  <Textarea rows={5} placeholder="Contenido (este texto será usado por la IA para generar preguntas)" value={l.contenido} onChange={(e) => updateLesson(i, { contenido: e.target.value })} />
                ) : (
                  <Input placeholder="https://..." value={l.url_externa ?? ""} onChange={(e) => updateLesson(i, { url_externa: e.target.value })} />
                )}
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardContent className="space-y-4 p-6 sm:p-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-2xl font-semibold flex items-center gap-2"><Sparkles className="h-5 w-5 text-gold" /> Evaluación final con IA</h2>
              <p className="text-sm text-muted-foreground">Se generará automáticamente desde el contenido de las lecciones.</p>
            </div>
            <Switch checked={quiz.enabled} onCheckedChange={(c) => setQuiz({ ...quiz, enabled: c })} />
          </div>
          {quiz.enabled && (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5"><Label># Preguntas</Label><Input type="number" min={3} max={15} value={quiz.num_preguntas} onChange={(e) => setQuiz({ ...quiz, num_preguntas: +e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Umbral (%)</Label><Input type="number" min={50} max={100} value={quiz.umbral} onChange={(e) => setQuiz({ ...quiz, umbral: +e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Intentos</Label><Input type="number" min={1} max={10} value={quiz.intentos_permitidos} onChange={(e) => setQuiz({ ...quiz, intentos_permitidos: +e.target.value })} /></div>
            </div>
          )}
        </CardContent>
      </Card>

      {(() => {
        const missing: string[] = [];
        if (!course.nombre.trim()) missing.push("nombre del curso");
        const emptyLessons = lessons.filter((l) => !l.titulo.trim()).length;
        if (emptyLessons > 0) missing.push(`título en ${emptyLessons} lección(es)`);
        const disabled = m.isPending || missing.length > 0;
        return (
          <div className="space-y-2">
            {missing.length > 0 && (
              <p className="text-right text-xs text-muted-foreground">
                Falta: {missing.join(" · ")}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => nav({ to: "/admin/courses" })}>Cancelar</Button>
              <Button onClick={() => m.mutate()} disabled={disabled} title={missing.length ? `Completa: ${missing.join(", ")}` : ""}>
                {m.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Publicando…</> : "Publicar curso"}
              </Button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
