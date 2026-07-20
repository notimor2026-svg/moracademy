import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { listWrongAnswers, listEmployeesLite, listCoursesLite } from "@/lib/hr.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { CheckCircle2, XCircle, Loader2, Download, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/feedback")({ component: Page });

function Page() {
  const fn = useServerFn(listWrongAnswers);
  const empFn = useServerFn(listEmployeesLite);
  const crsFn = useServerFn(listCoursesLite);

  const [employeeId, setEmployeeId] = useState<string>("");
  const [courseId, setCourseId] = useState<string>("");
  const [onlyWrong, setOnlyWrong] = useState(true);
  const [search, setSearch] = useState("");

  const emps = useQuery({ queryKey: ["emps-lite"], queryFn: () => empFn(), staleTime: 300_000 });
  const crss = useQuery({ queryKey: ["crss-lite"], queryFn: () => crsFn(), staleTime: 300_000 });

  const q = useQuery({
    queryKey: ["wrong-answers", employeeId, courseId, onlyWrong],
    queryFn: () =>
      fn({
        data: {
          employee_id: employeeId || undefined,
          course_id: courseId || undefined,
          only_wrong: onlyWrong,
          limit: 300,
        },
      }),
  });

  const rows = useMemo(() => {
    const all = q.data?.rows ?? [];
    if (!search.trim()) return all;
    const s = search.toLowerCase();
    return all.filter(
      (r: any) =>
        r.employee?.nombre?.toLowerCase().includes(s) ||
        r.employee?.dui?.toLowerCase().includes(s) ||
        r.quiz?.course_nombre?.toLowerCase().includes(s) ||
        r.quiz?.nombre?.toLowerCase().includes(s),
    );
  }, [q.data, search]);

  const exportCsv = () => {
    const lines = [
      ["Empleado", "DUI", "Curso", "Evaluación", "Intento", "Nota", "Aprobado", "Fecha", "#", "Pregunta", "Respuesta correcta", "Respuesta del usuario", "Justificación"].join(","),
    ];
    for (const r of rows) {
      for (const p of r.preguntas) {
        const opts = p.opciones ?? [];
        const correct = (p.respuesta_correcta ?? []).map((i: number) => opts[i]).join(" | ");
        const given = (p.respuesta_dada ?? []).map((i: number) => opts[i]).join(" | ") || "(sin respuesta)";
        lines.push(
          [
            r.employee?.nombre ?? "",
            r.employee?.dui ?? "",
            r.quiz?.course_nombre ?? "",
            r.quiz?.nombre ?? "",
            r.intento_num,
            r.score ?? "",
            r.aprobado ? "Sí" : "No",
            r.finished_at ? new Date(r.finished_at).toLocaleString() : "",
            p.idx,
            `"${(p.enunciado ?? "").replace(/"/g, '""')}"`,
            `"${correct.replace(/"/g, '""')}"`,
            `"${given.replace(/"/g, '""')}"`,
            `"${(p.justificacion ?? "").replace(/"/g, '""')}"`,
          ].join(","),
        );
      }
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `retroalimentacion-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <header>
        <h2 className="font-display text-2xl font-semibold">Retroalimentación de evaluaciones</h2>
        <p className="text-sm text-muted-foreground">
          Revisa exactamente qué preguntas contestaron mal los usuarios en cada intento para brindar acompañamiento.
        </p>
      </header>

      <Card className="border-border/60">
        <CardContent className="grid gap-3 p-4 md:grid-cols-5">
          <div className="space-y-1">
            <Label>Empleado</Label>
            <Select value={employeeId || "__all"} onValueChange={(v) => setEmployeeId(v === "__all" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">Todos</SelectItem>
                {(emps.data ?? []).map((e: any) => (
                  <SelectItem key={e.id} value={e.id}>{e.nombre} — {e.dui}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Curso</Label>
            <Select value={courseId || "__all"} onValueChange={(v) => setCourseId(v === "__all" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">Todos</SelectItem>
                {(crss.data ?? []).map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Búsqueda</Label>
            <Input placeholder="Nombre, DUI, curso…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex items-end gap-2">
            <div className="flex items-center gap-2">
              <Switch checked={onlyWrong} onCheckedChange={setOnlyWrong} id="only-wrong" />
              <Label htmlFor="only-wrong" className="cursor-pointer">Solo intentos con errores</Label>
            </div>
          </div>
          <div className="flex items-end gap-2">
            <Button variant="outline" size="sm" onClick={() => q.refetch()}>
              <RefreshCw className="mr-1 h-4 w-4" /> Refrescar
            </Button>
            <Button size="sm" onClick={exportCsv} disabled={!rows.length}>
              <Download className="mr-1 h-4 w-4" /> CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {q.isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cargando intentos…
        </div>
      ) : rows.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-muted-foreground">Sin resultados con estos filtros.</CardContent></Card>
      ) : (
        <Accordion type="multiple" className="space-y-2">
          {rows.map((r: any) => (
            <AccordionItem key={r.attempt_id} value={r.attempt_id} className="rounded-lg border border-border/60 bg-card px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex flex-1 flex-wrap items-center gap-3 pr-4 text-left">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{r.employee?.nombre ?? "—"}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {r.quiz?.course_nombre ?? "—"} · {r.quiz?.nombre ?? "Evaluación"}
                    </p>
                  </div>
                  <Badge variant="outline">Intento #{r.intento_num}</Badge>
                  <Badge className={r.aprobado ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}>
                    {r.score ?? 0}% {r.aprobado ? "Aprobado" : "No aprobado"}
                  </Badge>
                  <Badge variant="secondary">{r.errores} errores / {r.total}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {r.finished_at ? new Date(r.finished_at).toLocaleString() : ""}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pt-2">
                {r.preguntas.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin preguntas incorrectas.</p>
                ) : r.preguntas.map((p: any) => (
                  <div key={p.idx} className={`rounded-md border p-4 ${p.ok ? "border-success/30" : "border-warning/40 bg-warning/5"}`}>
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <p className="font-medium">{p.idx}. {p.enunciado}</p>
                      {p.ok ? <CheckCircle2 className="h-5 w-5 shrink-0 text-success" /> : <XCircle className="h-5 w-5 shrink-0 text-warning" />}
                    </div>
                    <ul className="space-y-1 text-sm">
                      {p.opciones.map((o: string, idx: number) => {
                        const isCorrect = p.respuesta_correcta.includes(idx);
                        const isGiven = p.respuesta_dada.includes(idx);
                        return (
                          <li key={idx} className={
                            isCorrect ? "text-success font-medium" :
                            isGiven ? "text-warning line-through" : "text-muted-foreground"
                          }>
                            {isCorrect ? "✓" : isGiven ? "✗" : "•"} {o}
                            {isGiven && !isCorrect && <span className="ml-2 text-xs">(respuesta del usuario)</span>}
                            {isCorrect && <span className="ml-2 text-xs">(correcta)</span>}
                          </li>
                        );
                      })}
                    </ul>
                    {p.respuesta_dada.length === 0 && (
                      <p className="mt-2 text-xs italic text-muted-foreground">El usuario no seleccionó ninguna opción.</p>
                    )}
                    {p.justificacion && (
                      <p className="mt-2 text-xs italic text-muted-foreground">💡 {p.justificacion}</p>
                    )}
                  </div>
                ))}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}
