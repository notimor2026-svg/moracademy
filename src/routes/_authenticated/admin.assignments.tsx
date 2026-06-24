import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAllAssignments, listEmployees, listCoursesBasic, assignCourse, unblockAssignment } from "@/lib/hr.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Unlock, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/assignments")({ component: Page });

const ESTADOS: Record<string, string> = {
  pendiente: "bg-muted text-muted-foreground",
  en_curso: "bg-primary/10 text-primary",
  aprobado: "bg-success/15 text-success",
  reprobado: "bg-warning/15 text-warning",
  bloqueado: "bg-destructive/15 text-destructive",
};

function Page() {
  const qc = useQueryClient();
  const fnList = useServerFn(listAllAssignments);
  const fnUnblock = useServerFn(unblockAssignment);
  const { data } = useQuery({ queryKey: ["all-assignments"], queryFn: () => fnList() });
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState<string>("all");

  const rows = useMemo(() => {
    const all = (data ?? []) as any[];
    return all.filter((r) => {
      if (estado !== "all" && r.estado !== estado) return false;
      if (!q.trim()) return true;
      const needle = q.toLowerCase();
      return [r.employees?.nombre, r.employees?.dui, r.courses?.nombre, r.employees?.area]
        .filter(Boolean).some((s: string) => s.toLowerCase().includes(needle));
    });
  }, [data, q, estado]);

  const unblockM = useMutation({
    mutationFn: (id: string) => fnUnblock({ data: { assignment_id: id } }),
    onSuccess: () => { toast.success("Asignación desbloqueada."); qc.invalidateQueries({ queryKey: ["all-assignments"] }); },
    onError: (e: any) => toast.error(e.message ?? "Error"),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="w-72 pl-8" placeholder="Buscar por nombre, DUI, curso…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select value={estado} onValueChange={setEstado}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              {Object.keys(ESTADOS).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <AssignDialog onDone={() => qc.invalidateQueries({ queryKey: ["all-assignments"] })} />
      </div>

      <Card className="border-border/60">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empleado</TableHead>
                <TableHead>Curso</TableHead>
                <TableHead>Origen</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Intentos</TableHead>
                <TableHead className="text-right">Mejor nota</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">Sin resultados.</TableCell></TableRow>
              )}
              {rows.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="font-medium">{r.employees?.nombre}</div>
                    <div className="font-mono text-xs text-muted-foreground">{r.employees?.dui}</div>
                  </TableCell>
                  <TableCell>{r.courses?.nombre}</TableCell>
                  <TableCell><Badge variant="outline">{r.origen}</Badge></TableCell>
                  <TableCell><Badge className={ESTADOS[r.estado] ?? ""}>{r.estado}</Badge></TableCell>
                  <TableCell className="text-right">{r.intentos_consumidos}</TableCell>
                  <TableCell className="text-right">{r.mejor_nota ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    {r.estado === "bloqueado" && (
                      <Button size="sm" variant="outline" onClick={() => unblockM.mutate(r.id)} disabled={unblockM.isPending}>
                        <Unlock className="mr-1 h-3.5 w-3.5" /> Desbloquear
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function AssignDialog({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [selectedCourses, setSelectedCourses] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const fnEmps = useServerFn(listEmployees);
  const fnCourses = useServerFn(listCoursesBasic);
  const fnAssign = useServerFn(assignCourse);
  const emps = useQuery({ queryKey: ["employees"], queryFn: () => fnEmps(), enabled: open });
  const courses = useQuery({ queryKey: ["courses-basic"], queryFn: () => fnCourses(), enabled: open });
  const m = useMutation({
    mutationFn: () => fnAssign({ data: { course_ids: Array.from(selectedCourses), employee_ids: Array.from(selected) } }),
    onSuccess: (r) => {
      toast.success(`${r.assigned} asignaciones creadas.`);
      setOpen(false); setSelected(new Set()); setSelectedCourses(new Set()); onDone();
    },
    onError: (e: any) => toast.error(e.message ?? "Error"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="mr-1 h-4 w-4" /> Asignar curso</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Asignar cursos a empleados</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <span className="text-sm font-medium">Cursos ({selectedCourses.size} seleccionados)</span>
            <div className="max-h-56 overflow-y-auto rounded-md border border-border">
              {(courses.data ?? []).map((c: any) => (
                <label key={c.id} className="flex cursor-pointer items-center gap-3 border-b border-border/60 px-3 py-2 hover:bg-muted/40">
                  <Checkbox
                    checked={selectedCourses.has(c.id)}
                    onCheckedChange={(chk) => {
                      const next = new Set(selectedCourses);
                      if (chk) next.add(c.id); else next.delete(c.id);
                      setSelectedCourses(next);
                    }}
                  />
                  <div className="min-w-0 flex-1 text-sm font-medium">{c.nombre}</div>
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <span className="text-sm font-medium">Empleados ({selected.size} seleccionados)</span>
            <div className="max-h-56 overflow-y-auto rounded-md border border-border">
              {(emps.data ?? []).map((e: any) => (
                <label key={e.id} className="flex cursor-pointer items-center gap-3 border-b border-border/60 px-3 py-2 hover:bg-muted/40">
                  <Checkbox
                    checked={selected.has(e.id)}
                    onCheckedChange={(c) => {
                      const next = new Set(selected);
                      if (c) next.add(e.id); else next.delete(e.id);
                      setSelected(next);
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{e.nombre}</div>
                    <div className="font-mono text-xs text-muted-foreground">{e.dui} · {e.area ?? "—"}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={() => m.mutate()} disabled={selectedCourses.size === 0 || selected.size === 0 || m.isPending}>
            {m.isPending ? "Asignando…" : `Asignar (${selectedCourses.size * selected.size})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
