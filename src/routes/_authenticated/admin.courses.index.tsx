import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { deleteCourse } from "@/lib/academy.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, BookOpen, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/courses/")({ component: CourseList });

function CourseList() {
  const qc = useQueryClient();
  const delFn = useServerFn(deleteCourse);
  const { data } = useQuery({
    queryKey: ["admin-courses"],
    queryFn: async () => {
      const { data } = await supabase.from("courses").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
  });
  const courses = data ?? [];
  const delM = useMutation({
    mutationFn: (course_id: string) => delFn({ data: { course_id } }),
    onSuccess: () => {
      toast.success("Curso eliminado");
      qc.invalidateQueries({ queryKey: ["admin-courses"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "No se pudo eliminar"),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{courses.length} cursos publicados</p>
        <Button asChild><Link to="/admin/courses/new"><Plus className="mr-1 h-4 w-4" /> Nuevo curso</Link></Button>
      </div>
      {courses.length === 0 ? (
        <Card className="border-dashed"><CardContent className="p-10 text-center text-muted-foreground"><BookOpen className="mx-auto mb-2 h-8 w-8" />Aún no hay cursos.</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {courses.map((c: any) => (
            <Card key={c.id} className="border-border/60">
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{c.nombre}</h3>
                    <Badge variant="outline">{c.tipo}</Badge>
                    <Badge variant="secondary">{c.estado}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{c.descripcion}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">{c.duracion_min ?? 30} min</span>
                  <Button asChild size="sm" variant="outline">
                    <Link to="/admin/courses/$courseId/edit" params={{ courseId: c.id }}>
                      <Pencil className="mr-1 h-3 w-3" /> Editar
                    </Link>
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        disabled={delM.isPending && delM.variables === c.id}
                      >
                        {delM.isPending && delM.variables === c.id ? (
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        ) : (
                          <Trash2 className="mr-1 h-3 w-3" />
                        )}
                        Eliminar
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar “{c.nombre}”?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta acción es permanente. Se eliminarán también sus lecciones,
                          evaluaciones, intentos, asignaciones y certificados asociados.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => delM.mutate(c.id)}
                        >
                          Eliminar curso
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
