import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { reportData } from "@/lib/hr.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/reports")({ component: Reports });

const REPORTS = [
  { kind: "empleados", title: "Empleados", desc: "Listado completo con DUI, área, cargo, estado." },
  { kind: "asignaciones", title: "Asignaciones", desc: "Cursos asignados, progreso y notas." },
  { kind: "certificados", title: "Certificados emitidos", desc: "Códigos, notas y fechas de emisión." },
  { kind: "intentos", title: "Intentos de evaluación", desc: "Detalle de quizzes, scores y resultados." },
  { kind: "bloqueos", title: "Bloqueos activos", desc: "Empleados con asignaciones bloqueadas." },
] as const;

function toCsv(rows: any[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v: any) => {
    if (v === null || v === undefined) return "";
    const s = String(v).replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
}

function Reports() {
  const fn = useServerFn(reportData);
  const [busy, setBusy] = useState<string | null>(null);

  const handleDownload = async (kind: typeof REPORTS[number]["kind"], title: string) => {
    setBusy(kind);
    try {
      const rows = await fn({ data: { kind } });
      if (!rows.length) { toast.info("Sin datos para exportar."); return; }
      const csv = toCsv(rows as any[]);
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url; a.download = `mor-academy-${kind}-${stamp}.csv`;
      a.click(); URL.revokeObjectURL(url);
      toast.success(`${title}: ${rows.length} registros exportados.`);
    } catch (e: any) {
      toast.error(e.message ?? "Error al exportar");
    } finally { setBusy(null); }
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {REPORTS.map((r) => (
        <Card key={r.kind} className="border-border/60">
          <CardContent className="space-y-3 p-5">
            <div className="flex items-start gap-3">
              <div className="rounded-md bg-primary/10 p-2 text-primary"><FileSpreadsheet className="h-5 w-5" /></div>
              <div>
                <h3 className="font-medium">{r.title}</h3>
                <p className="text-sm text-muted-foreground">{r.desc}</p>
              </div>
            </div>
            <Button size="sm" variant="outline" disabled={busy === r.kind} onClick={() => handleDownload(r.kind, r.title)}>
              <Download className="mr-1 h-4 w-4" /> {busy === r.kind ? "Generando…" : "Exportar CSV"}
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
