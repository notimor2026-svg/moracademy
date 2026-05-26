import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, BookOpen, Pencil } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/courses")({ component: CourseList });

function CourseList() {
  const { data } = useQuery({
    queryKey: ["admin-courses"],
    queryFn: async () => {
      const { data } = await supabase.from("courses").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
  });
  const courses = data ?? [];
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
                <span className="text-xs text-muted-foreground">{c.duracion_min ?? 30} min</span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
