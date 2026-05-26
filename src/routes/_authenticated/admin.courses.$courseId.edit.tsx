import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCourseEdit, updateCourse, upsertLesson, deleteLesson, reorderLessons } from "@/lib/hr.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, Plus, Trash2, ArrowUp, ArrowDown, Pencil, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/courses/$courseId/edit")({
  component: EditCourse,
});

type Lesson = {
  id?: string;
  titulo: string;
  tipo: "texto" | "video_url" | "enlace" | "pdf";
  contenido?: string | null;
  url_externa?: string | null;
  obligatorio: boolean;
  orden: number;
};

function EditCourse() {
  const { courseId } = Route.useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const fnGet = useServerFn(getCourseEdit);
  const fnUpd = useServerFn(updateCourse);
  const fnUpsert = useServerFn(upsertLesson);
  const fnDel = useServerFn(deleteLesson);
  const fnReorder = useServerFn(reorderLessons);

  const { data, isLoading } = useQuery({
    queryKey: ["course-edit", courseId],
    queryFn: () => fnGet({ data: { course_id: courseId } }),
  });

  const [form, setForm] = useState<any>(null);
  const [editing, setEditing] = useState<Lesson | null>(null);

  useEffect(() => {
    if (data?.course && !form) setForm({ ...data.course });
  }, [data, form]);

  const lessons: Lesson[] = (data?.lessons ?? []) as any;

  const saveCourse = useMutation({
    mutationFn: () =>
      fnUpd({
        data: {
          course_id: courseId,
          nombre: form.nombre,
          descripcion: form.descripcion,
          tipo: form.tipo,
          estado: form.estado,
          nota_minima: form.nota_minima,
          intentos_max: form.intentos_max,
          duracion_min: form.duracion_min,
          permite_certificado: form.permite_certificado,
        },
      }),
    onSuccess: () => {
      toast.success("Curso actualizado");
      qc.invalidateQueries({ queryKey: ["course-edit", courseId] });
      qc.invalidateQueries({ queryKey: ["admin-courses"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const saveLesson = useMutation({
    mutationFn: (l: Lesson) => fnUpsert({ data: { ...l, course_id: courseId } as any }),
    onSuccess: () => {
      toast.success("Lección guardada");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["course-edit", courseId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeLesson = useMutation({
    mutationFn: (id: string) => fnDel({ data: { id } }),
    onSuccess: () => {
      toast.success("Lección eliminada");
      qc.invalidateQueries({ queryKey: ["course-edit", courseId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const moveLesson = useMutation({
    mutationFn: (order: { id: string; orden: number }[]) => fnReorder({ data: { order } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["course-edit", courseId] }),
  });

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...lessons];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    moveLesson.mutate(next.map((l, i) => ({ id: l.id!, orden: i + 1 })));
  };

  if (isLoading || !form) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-semibold">Editar curso</h2>
        <Button variant="outline" onClick={() => nav({ to: "/admin/courses" })}>Volver</Button>
      </div>

      <Card className="border-border/60">
        <CardContent className="space-y-4 p-6">
          <h3 className="font-display text-lg font-semibold">Información</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Nombre</Label>
              <Input value={form.nombre ?? ""} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Descripción</Label>
              <Textarea rows={3} value={form.descripcion ?? ""} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="constante">Constante</SelectItem>
                  <SelectItem value="induccion">Inducción</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Estado</Label>
              <Select value={form.estado} onValueChange={(v) => setForm({ ...form, estado: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="borrador">Borrador</SelectItem>
                  <SelectItem value="activa">Activa</SelectItem>
                  <SelectItem value="archivada">Archivada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Nota mínima (%)</Label>
              <Input type="number" min={50} max={100} value={form.nota_minima ?? 80} onChange={(e) => setForm({ ...form, nota_minima: +e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Intentos máximos</Label>
              <Input type="number" min={1} max={10} value={form.intentos_max ?? 3} onChange={(e) => setForm({ ...form, intentos_max: +e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Duración (min)</Label>
              <Input type="number" min={1} value={form.duracion_min ?? 30} onChange={(e) => setForm({ ...form, duracion_min: +e.target.value })} />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border/60 p-3 sm:col-span-2">
              <div>
                <Label>Permite certificado</Label>
                <p className="text-xs text-muted-foreground">Genera un PDF al aprobar el curso.</p>
              </div>
              <Switch checked={!!form.permite_certificado} onCheckedChange={(c) => setForm({ ...form, permite_certificado: c })} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => saveCourse.mutate()} disabled={saveCourse.isPending}>
              {saveCourse.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />} Guardar cambios
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold">Lecciones</h3>
            <Button size="sm" variant="outline" onClick={() => setEditing({
              titulo: "", tipo: "texto", contenido: "", obligatorio: true, orden: lessons.length + 1,
            })}>
              <Plus className="mr-1 h-4 w-4" /> Nueva lección
            </Button>
          </div>
          {lessons.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Aún no hay lecciones.</p>}
          {lessons.map((l, i) => (
            <Card key={l.id} className="border-border/60 bg-muted/30">
              <CardContent className="flex items-center justify-between p-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-muted-foreground">#{i + 1}</span>
                  <div>
                    <p className="font-medium">{l.titulo}</p>
                    <div className="flex gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline">{l.tipo}</Badge>
                      {l.obligatorio && <Badge variant="secondary">Obligatoria</Badge>}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" disabled={i === lessons.length - 1} onClick={() => move(i, 1)}><ArrowDown className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => setEditing(l)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => { if (confirm("¿Eliminar lección?")) removeLesson.mutate(l.id!); }}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>

      {editing && (
        <Card className="border-primary/40 ring-2 ring-primary/20">
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold">{editing.id ? "Editar lección" : "Nueva lección"}</h3>
              <Button size="icon" variant="ghost" onClick={() => setEditing(null)}><X className="h-4 w-4" /></Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2"><Label>Título</Label>
                <Input value={editing.titulo} onChange={(e) => setEditing({ ...editing, titulo: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select value={editing.tipo} onValueChange={(v) => setEditing({ ...editing, tipo: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="texto">Texto</SelectItem>
                    <SelectItem value="video_url">Video URL</SelectItem>
                    <SelectItem value="enlace">Enlace</SelectItem>
                    <SelectItem value="pdf">PDF</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end justify-between rounded-md border border-border/60 p-3">
                <Label>Obligatoria</Label>
                <Switch checked={editing.obligatorio} onCheckedChange={(c) => setEditing({ ...editing, obligatorio: c })} />
              </div>
            </div>
            {editing.tipo === "texto" ? (
              <div className="space-y-1.5">
                <Label>Contenido (usado por la IA para generar preguntas)</Label>
                <Textarea rows={8} value={editing.contenido ?? ""} onChange={(e) => setEditing({ ...editing, contenido: e.target.value })} />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>URL</Label>
                <Input value={editing.url_externa ?? ""} onChange={(e) => setEditing({ ...editing, url_externa: e.target.value })} placeholder="https://..." />
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
              <Button onClick={() => saveLesson.mutate(editing)} disabled={saveLesson.isPending || !editing.titulo}>
                {saveLesson.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />} Guardar lección
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
