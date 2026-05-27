import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { runAdHocReport, listSavedReports, saveReport, deleteSavedReport, listCoursesBasic } from "@/lib/hr.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Download, FileSpreadsheet, FileText, Play, Save, Trash2, Layers } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/reports")({ component: Reports });

type Entidad = "empleados" | "asignaciones" | "certificados" | "intentos";

const ENTITIES: { value: Entidad; label: string; columns: { key: string; label: string }[] }[] = [
  {
    value: "empleados",
    label: "Empleados",
    columns: [
      { key: "dui", label: "DUI" }, { key: "nombre", label: "Nombre" }, { key: "email", label: "Email" },
      { key: "area", label: "Área" }, { key: "cargo", label: "Cargo" },
      { key: "fecha_ingreso", label: "Fecha ingreso" }, { key: "tipo_proceso", label: "Tipo proceso" },
      { key: "estado", label: "Estado" }, { key: "xp", label: "XP" },
    ],
  },
  {
    value: "asignaciones",
    label: "Asignaciones de cursos",
    columns: [
      { key: "dui", label: "DUI" }, { key: "empleado", label: "Empleado" },
      { key: "area", label: "Área" }, { key: "cargo", label: "Cargo" },
      { key: "curso", label: "Curso" }, { key: "tipo_curso", label: "Tipo curso" },
      { key: "estado", label: "Estado" }, { key: "origen", label: "Origen" },
      { key: "intentos", label: "Intentos" }, { key: "mejor_nota", label: "Mejor nota" },
      { key: "asignado", label: "Asignado" }, { key: "finalizado", label: "Finalizado" },
      { key: "vencimiento", label: "Vencimiento" },
    ],
  },
  {
    value: "certificados",
    label: "Certificados emitidos",
    columns: [
      { key: "codigo", label: "Código" }, { key: "dui", label: "DUI" }, { key: "empleado", label: "Empleado" },
      { key: "area", label: "Área" }, { key: "cargo", label: "Cargo" },
      { key: "curso", label: "Curso" }, { key: "nota", label: "Nota" }, { key: "emitido", label: "Emitido" },
    ],
  },
  {
    value: "intentos",
    label: "Intentos de quiz",
    columns: [
      { key: "dui", label: "DUI" }, { key: "empleado", label: "Empleado" },
      { key: "area", label: "Área" }, { key: "cargo", label: "Cargo" },
      { key: "curso", label: "Curso" }, { key: "intento", label: "Intento #" },
      { key: "score", label: "Score" }, { key: "aprobado", label: "Aprobado" },
      { key: "iniciado", label: "Iniciado" }, { key: "finalizado", label: "Finalizado" },
    ],
  },
];

type ReportConfig = {
  columns: string[];
  filters: { area?: string; cargo?: string; estado?: string; tipo_proceso?: string; origen?: string; curso_id?: string; aprobado?: string; desde?: string; hasta?: string; search?: string };
  groupBy?: string;
};

const emptyConfig = (entidad: Entidad): ReportConfig => ({
  columns: ENTITIES.find((e) => e.value === entidad)!.columns.map((c) => c.key),
  filters: {},
  groupBy: undefined,
});

function Reports() {
  const [entidad, setEntidad] = useState<Entidad>("empleados");
  const [config, setConfig] = useState<ReportConfig>(emptyConfig("empleados"));
  const [rows, setRows] = useState<any[] | null>(null);
  const [running, setRunning] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saveName, setSaveName] = useState("");
  const [saveOpen, setSaveOpen] = useState(false);

  const runFn = useServerFn(runAdHocReport);
  const saveFn = useServerFn(saveReport);
  const delFn = useServerFn(deleteSavedReport);
  const coursesFn = useServerFn(listCoursesBasic);
  const savedFn = useServerFn(listSavedReports);
  const qc = useQueryClient();

  const coursesQ = useQuery({
    queryKey: ["reports-courses"],
    queryFn: () => coursesFn(),
    staleTime: 5 * 60_000,
  });
  const savedQ = useQuery({
    queryKey: ["saved-reports"],
    queryFn: () => savedFn(),
    staleTime: 60_000,
  });

  const entityDef = ENTITIES.find((e) => e.value === entidad)!;

  const changeEntidad = (e: Entidad) => {
    setEntidad(e);
    setConfig(emptyConfig(e));
    setRows(null);
    setEditingId(null);
  };

  const toggleCol = (key: string) => {
    setConfig((c) => ({
      ...c,
      columns: c.columns.includes(key) ? c.columns.filter((k) => k !== key) : [...c.columns, key],
    }));
  };

  const run = async () => {
    setRunning(true);
    try {
      const payload: any = { entidad, ...config.filters };
      if (payload.aprobado === "true") payload.aprobado = true;
      else if (payload.aprobado === "false") payload.aprobado = false;
      else delete payload.aprobado;
      Object.keys(payload).forEach((k) => (payload[k] === "" || payload[k] === undefined) && delete payload[k]);
      const data = await runFn({ data: payload });
      setRows(data as any[]);
      toast.success(`${(data as any[]).length} registros`);
    } catch (e: any) {
      toast.error(e.message ?? "Error ejecutando reporte");
    } finally {
      setRunning(false);
    }
  };

  const visibleCols = entityDef.columns.filter((c) => config.columns.includes(c.key));

  const exportRows = useMemo(() => {
    if (!rows) return [];
    return rows.map((r) => {
      const o: any = {};
      visibleCols.forEach((c) => (o[c.label] = r[c.key] ?? ""));
      return o;
    });
  }, [rows, visibleCols]);

  const grouped = useMemo(() => {
    if (!rows || !config.groupBy) return null;
    const gb = config.groupBy;
    const map: Record<string, any[]> = {};
    rows.forEach((r) => {
      const k = String(r[gb] ?? "(vacío)");
      (map[k] ||= []).push(r);
    });
    return Object.entries(map).map(([k, items]) => ({ key: k, count: items.length, items }));
  }, [rows, config.groupBy]);

  const stamp = () => new Date().toISOString().slice(0, 10);

  const exportCSV = () => {
    if (!exportRows.length) return toast.info("Ejecuta el reporte primero");
    const headers = Object.keys(exportRows[0]);
    const esc = (v: any) => {
      if (v == null) return "";
      const s = String(v).replace(/"/g, '""');
      return /[",\n]/.test(s) ? `"${s}"` : s;
    };
    const csv = [headers.join(","), ...exportRows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `mor-${entidad}-${stamp()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const exportXLSX = () => {
    if (!exportRows.length) return toast.info("Ejecuta el reporte primero");
    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, entidad.slice(0, 30));
    XLSX.writeFile(wb, `mor-${entidad}-${stamp()}.xlsx`);
  };

  const exportPDF = () => {
    if (!exportRows.length) return toast.info("Ejecuta el reporte primero");
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text(`MOR Academy — Reporte: ${entityDef.label}`, 14, 14);
    doc.setFontSize(9);
    doc.text(`Generado: ${new Date().toLocaleString()} · ${exportRows.length} registros`, 14, 20);
    autoTable(doc, {
      startY: 24,
      head: [Object.keys(exportRows[0])],
      body: exportRows.map((r) => Object.values(r).map((v) => (v == null ? "" : String(v)))),
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [31, 42, 68] },
    });
    doc.save(`mor-${entidad}-${stamp()}.pdf`);
  };

  const doSave = async () => {
    if (!saveName.trim()) return toast.error("Ponle un nombre");
    try {
      await saveFn({ data: { id: editingId ?? undefined, nombre: saveName.trim(), entidad, config } });
      toast.success("Reporte guardado");
      setSaveOpen(false);
      setSaveName("");
      qc.invalidateQueries({ queryKey: ["saved-reports"] });
    } catch (e: any) {
      toast.error(e.message ?? "Error guardando");
    }
  };

  const loadSaved = (s: any) => {
    setEntidad(s.entidad);
    setConfig(s.config ?? emptyConfig(s.entidad));
    setEditingId(s.id);
    setSaveName(s.nombre);
    setRows(null);
    toast.info(`Cargado: ${s.nombre}`);
  };

  const removeSaved = async (id: string) => {
    if (!confirm("¿Eliminar este reporte guardado?")) return;
    try {
      await delFn({ data: { id } });
      qc.invalidateQueries({ queryKey: ["saved-reports"] });
      if (editingId === id) { setEditingId(null); setSaveName(""); }
      toast.success("Eliminado");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <Tabs defaultValue="builder" className="space-y-4">
      <TabsList>
        <TabsTrigger value="builder">Constructor</TabsTrigger>
        <TabsTrigger value="saved">Guardados {savedQ.data?.length ? `(${savedQ.data.length})` : ""}</TabsTrigger>
      </TabsList>

      <TabsContent value="builder" className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">1. Fuente de datos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-4">
              {ENTITIES.map((e) => (
                <button
                  key={e.value}
                  onClick={() => changeEntidad(e.value)}
                  className={`rounded-md border p-3 text-left text-sm transition ${
                    entidad === e.value ? "border-primary bg-primary/5 text-foreground" : "border-border/60 hover:bg-muted"
                  }`}
                >
                  <FileSpreadsheet className="mb-1 h-4 w-4 text-primary" />
                  {e.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">2. Columnas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {entityDef.columns.map((c) => (
                <label key={c.key} className="flex items-center gap-2 rounded-md border border-border/60 px-3 py-2 text-sm">
                  <Checkbox checked={config.columns.includes(c.key)} onCheckedChange={() => toggleCol(c.key)} />
                  {c.label}
                </label>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">3. Filtros</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs">Búsqueda libre</Label>
              <Input value={config.filters.search ?? ""} onChange={(e) => setConfig((c) => ({ ...c, filters: { ...c.filters, search: e.target.value } }))} placeholder="nombre, DUI, curso..." />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Área</Label>
              <Input value={config.filters.area ?? ""} onChange={(e) => setConfig((c) => ({ ...c, filters: { ...c.filters, area: e.target.value } }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Cargo</Label>
              <Input value={config.filters.cargo ?? ""} onChange={(e) => setConfig((c) => ({ ...c, filters: { ...c.filters, cargo: e.target.value } }))} />
            </div>
            {entidad === "empleados" && (
              <>
                <div className="space-y-1">
                  <Label className="text-xs">Estado</Label>
                  <Select value={config.filters.estado ?? "_all"} onValueChange={(v) => setConfig((c) => ({ ...c, filters: { ...c.filters, estado: v === "_all" ? "" : v } }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_all">Todos</SelectItem>
                      <SelectItem value="activo">Activo</SelectItem>
                      <SelectItem value="inactivo">Inactivo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Tipo proceso</Label>
                  <Select value={config.filters.tipo_proceso ?? "_all"} onValueChange={(v) => setConfig((c) => ({ ...c, filters: { ...c.filters, tipo_proceso: v === "_all" ? "" : v } }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_all">Todos</SelectItem>
                      <SelectItem value="induccion">Inducción</SelectItem>
                      <SelectItem value="constante">Constante</SelectItem>
                      <SelectItem value="ambos">Ambos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            {entidad === "asignaciones" && (
              <>
                <div className="space-y-1">
                  <Label className="text-xs">Estado</Label>
                  <Select value={config.filters.estado ?? "_all"} onValueChange={(v) => setConfig((c) => ({ ...c, filters: { ...c.filters, estado: v === "_all" ? "" : v } }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_all">Todos</SelectItem>
                      <SelectItem value="pendiente">Pendiente</SelectItem>
                      <SelectItem value="en_progreso">En progreso</SelectItem>
                      <SelectItem value="aprobado">Aprobado</SelectItem>
                      <SelectItem value="reprobado">Reprobado</SelectItem>
                      <SelectItem value="bloqueado">Bloqueado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Origen</Label>
                  <Select value={config.filters.origen ?? "_all"} onValueChange={(v) => setConfig((c) => ({ ...c, filters: { ...c.filters, origen: v === "_all" ? "" : v } }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_all">Todos</SelectItem>
                      <SelectItem value="manual">Manual</SelectItem>
                      <SelectItem value="induccion">Inducción</SelectItem>
                      <SelectItem value="constante">Constante</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            {(entidad === "asignaciones" || entidad === "certificados") && (
              <div className="space-y-1">
                <Label className="text-xs">Curso</Label>
                <Select value={config.filters.curso_id ?? "_all"} onValueChange={(v) => setConfig((c) => ({ ...c, filters: { ...c.filters, curso_id: v === "_all" ? "" : v } }))}>
                  <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">Todos</SelectItem>
                    {(coursesQ.data ?? []).map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {entidad === "intentos" && (
              <div className="space-y-1">
                <Label className="text-xs">Aprobado</Label>
                <Select value={config.filters.aprobado ?? "_all"} onValueChange={(v) => setConfig((c) => ({ ...c, filters: { ...c.filters, aprobado: v === "_all" ? "" : v } }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">Todos</SelectItem>
                    <SelectItem value="true">Sí</SelectItem>
                    <SelectItem value="false">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs">Desde</Label>
              <Input type="date" value={config.filters.desde ?? ""} onChange={(e) => setConfig((c) => ({ ...c, filters: { ...c.filters, desde: e.target.value } }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Hasta</Label>
              <Input type="date" value={config.filters.hasta ?? ""} onChange={(e) => setConfig((c) => ({ ...c, filters: { ...c.filters, hasta: e.target.value } }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1"><Layers className="h-3 w-3" /> Agrupar por</Label>
              <Select value={config.groupBy ?? "_none"} onValueChange={(v) => setConfig((c) => ({ ...c, groupBy: v === "_none" ? undefined : v }))}>
                <SelectTrigger><SelectValue placeholder="Sin agrupar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Sin agrupar</SelectItem>
                  {entityDef.columns.map((c) => (
                    <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-2">
          <Button onClick={run} disabled={running}>
            <Play className="mr-1 h-4 w-4" /> {running ? "Ejecutando…" : "Ejecutar reporte"}
          </Button>
          <Button variant="outline" onClick={exportCSV} disabled={!rows?.length}><Download className="mr-1 h-4 w-4" /> CSV</Button>
          <Button variant="outline" onClick={exportXLSX} disabled={!rows?.length}><FileSpreadsheet className="mr-1 h-4 w-4" /> Excel</Button>
          <Button variant="outline" onClick={exportPDF} disabled={!rows?.length}><FileText className="mr-1 h-4 w-4" /> PDF</Button>
          <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
            <DialogTrigger asChild>
              <Button variant="secondary" onClick={() => setSaveOpen(true)}><Save className="mr-1 h-4 w-4" /> {editingId ? "Actualizar" : "Guardar"}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editingId ? "Actualizar reporte" : "Guardar reporte"}</DialogTitle></DialogHeader>
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="Ej. Empleados activos Operaciones" />
              </div>
              <DialogFooter>
                <Button onClick={doSave}>Guardar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          {rows && <Badge variant="secondary" className="ml-auto self-center">{rows.length} filas</Badge>}
        </div>

        {rows && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Vista previa</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {grouped ? (
                <div className="space-y-4">
                  {grouped.map((g) => (
                    <div key={g.key}>
                      <div className="mb-1 flex items-center gap-2">
                        <Badge>{g.key}</Badge>
                        <span className="text-xs text-muted-foreground">{g.count} registros</span>
                      </div>
                      <PreviewTable rows={g.items} cols={visibleCols} />
                    </div>
                  ))}
                </div>
              ) : (
                <PreviewTable rows={rows.slice(0, 100)} cols={visibleCols} />
              )}
              {!grouped && rows.length > 100 && (
                <p className="mt-2 text-xs text-muted-foreground">Mostrando 100 de {rows.length}. Exporta para verlos todos.</p>
              )}
            </CardContent>
          </Card>
        )}
      </TabsContent>

      <TabsContent value="saved">
        <Card>
          <CardContent className="p-0">
            {savedQ.isLoading ? (
              <p className="p-4 text-sm text-muted-foreground">Cargando…</p>
            ) : !savedQ.data?.length ? (
              <p className="p-4 text-sm text-muted-foreground">Aún no hay reportes guardados.</p>
            ) : (
              <ul className="divide-y">
                {savedQ.data.map((s: any) => (
                  <li key={s.id} className="flex items-center justify-between p-3">
                    <div>
                      <p className="font-medium">{s.nombre}</p>
                      <p className="text-xs text-muted-foreground">{s.entidad} · actualizado {new Date(s.updated_at).toLocaleDateString()}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => loadSaved(s)}>Cargar</Button>
                      <Button size="sm" variant="ghost" onClick={() => removeSaved(s.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

function PreviewTable({ rows, cols }: { rows: any[]; cols: { key: string; label: string }[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-left text-xs uppercase text-muted-foreground">
          {cols.map((c) => <th key={c.key} className="py-2 pr-3 font-medium">{c.label}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b border-border/40">
            {cols.map((c) => (
              <td key={c.key} className="py-1.5 pr-3">{formatCell(r[c.key])}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function formatCell(v: any) {
  if (v == null || v === "") return <span className="text-muted-foreground">—</span>;
  if (typeof v === "boolean") return v ? "Sí" : "No";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) return new Date(v).toLocaleString();
  return String(v);
}
