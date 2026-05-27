import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  createEmployee,
  listEmployees,
  listPipelineRequisitions,
  type PipelineRequisition,
} from "@/lib/hr.functions";
import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, AlertCircle, GraduationCap } from "lucide-react";
import { toast } from "sonner";
import { isValidDui, normalizeDui } from "@/lib/dui";

export const Route = createFileRoute("/_authenticated/admin/employees/new")({ component: NewEmp });

function NewEmp() {
  const navigate = useNavigate();
  const create = useServerFn(createEmployee);
  const reqsFn = useServerFn(listPipelineRequisitions);
  const empsFn = useServerFn(listEmployees);
  const reqs = useQuery({
    queryKey: ["pipeline-requisitions"],
    queryFn: () => reqsFn(),
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    retry: 1,
  });
  const emps = useQuery({
    queryKey: ["employees"],
    queryFn: () => empsFn(),
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  });

  const [form, setForm] = useState({
    dui: "", nombre: "", email: "", area: "", cargo: "",
    fecha_ingreso: "", jefe_id: "", tipo_proceso: "ambos" as "induccion" | "constante" | "ambos",
    pipeline_requisition_id: "", es_jefe: false,
  });

  const selected: PipelineRequisition | undefined = useMemo(
    () => (reqs.data ?? []).find((r) => r.id === form.pipeline_requisition_id),
    [reqs.data, form.pipeline_requisition_id],
  );

  const m = useMutation({
    mutationFn: () => create({
      data: {
        dui: normalizeDui(form.dui),
        nombre: form.nombre,
        email: form.email || undefined,
        area: selected?.management_area || selected?.department || form.area || undefined,
        cargo: selected?.position_title || form.cargo || undefined,
        fecha_ingreso: form.fecha_ingreso,
        jefe_id: form.jefe_id || null,
        tipo_proceso: form.tipo_proceso,
        es_jefe: form.es_jefe,
        pipeline_requisition_id: form.pipeline_requisition_id || null,
        pipeline_required_trainings: selected?.required_trainings ?? [],
      },
    }),
    onSuccess: () => {
      const n = selected?.required_trainings?.length ?? 0;
      toast.success(n ? `Empleado creado · ${n} capacitación(es) pre-creada(s)` : "Empleado creado");
      navigate({ to: "/admin/employees" });
    },
    onError: (e: any) => toast.error(e.message ?? "Error al crear"),
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidDui(normalizeDui(form.dui))) return toast.error("DUI inválido");
    m.mutate();
  };

  const showInduction = form.tipo_proceso !== "constante";

  return (
    <Card className="mx-auto max-w-3xl border-border/60">
      <CardContent className="p-6 sm:p-8">
        <h2 className="font-display text-2xl font-semibold">Alta de empleado</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Registra a la persona, vincúlala con su requisición del Talent Pipeline y se auto-crearán sus capacitaciones obligatorias.
        </p>
        <form onSubmit={onSubmit} className="mt-6 grid gap-5 sm:grid-cols-2">
          <Field label="DUI *"><Input value={form.dui} onChange={(e) => setForm({ ...form, dui: e.target.value })} placeholder="00000000-0" required /></Field>
          <Field label="Nombre completo *"><Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required /></Field>
          <Field label="Email"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Fecha de ingreso"><Input type="date" value={form.fecha_ingreso} onChange={(e) => setForm({ ...form, fecha_ingreso: e.target.value })} /></Field>
          <Field label="Área"><Input value={selected?.management_area ?? selected?.department ?? form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} placeholder={selected ? "(desde Pipeline)" : ""} disabled={!!selected} /></Field>
          <Field label="Cargo"><Input value={selected?.position_title ?? form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} placeholder={selected ? "(desde Pipeline)" : ""} disabled={!!selected} /></Field>

          <Field label="Jefe directo">
            <Select value={form.jefe_id} onValueChange={(v) => setForm({ ...form, jefe_id: v })}>
              <SelectTrigger><SelectValue placeholder="Sin jefe asignado" /></SelectTrigger>
              <SelectContent>
                {(emps.data ?? []).map((e: any) => (
                  <SelectItem key={e.id} value={e.id}>{e.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Tipo de proceso *">
            <Select value={form.tipo_proceso} onValueChange={(v) => setForm({ ...form, tipo_proceso: v as any })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="induccion">Solo inducción</SelectItem>
                <SelectItem value="constante">Solo capacitación constante</SelectItem>
                <SelectItem value="ambos">Ambos</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          {showInduction && (
            <Field label="Requisición cubierta (MOR Talent Pipeline)" className="sm:col-span-2">
              {reqs.isLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando requisiciones del Pipeline…</div>
              ) : reqs.isError ? (
                <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <div className="font-medium">No se pudo leer el Talent Pipeline.</div>
                    <div className="text-xs opacity-80">{(reqs.error as Error)?.message}</div>
                  </div>
                </div>
              ) : (
                <Select value={form.pipeline_requisition_id} onValueChange={(v) => setForm({ ...form, pipeline_requisition_id: v })}>
                  <SelectTrigger><SelectValue placeholder={(reqs.data ?? []).length ? "Selecciona la plaza cubierta" : "No hay requisiciones cubiertas disponibles"} /></SelectTrigger>
                  <SelectContent>
                    {(reqs.data ?? []).map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.code} · {r.position_title}{r.management_area || r.department ? ` (${r.management_area ?? r.department})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {selected && (
                <div className="mt-3 rounded-lg border border-border/60 bg-muted/30 p-3">
                  <div className="flex items-center gap-2 text-sm font-medium"><GraduationCap className="h-4 w-4" /> Capacitaciones obligatorias ({selected.required_trainings.length})</div>
                  {selected.required_trainings.length === 0 ? (
                    <p className="mt-1 text-xs text-muted-foreground">Esta requisición no tiene capacitaciones registradas en el Pipeline.</p>
                  ) : (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {selected.required_trainings.map((t, i) => <Badge key={i} variant="secondary" className="font-normal">{t}</Badge>)}
                    </div>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">Se crearán como cursos de inducción en estado borrador (sin material) y se auto-asignarán al empleado.</p>
                </div>
              )}
            </Field>
          )}

          <div className="flex items-center gap-3 sm:col-span-2">
            <Switch checked={form.es_jefe} onCheckedChange={(c) => setForm({ ...form, es_jefe: c })} id="es_jefe" />
            <Label htmlFor="es_jefe">Es jefe directo (podrá ver el panel de su equipo)</Label>
          </div>

          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => navigate({ to: "/admin/employees" })}>Cancelar</Button>
            <Button type="submit" disabled={m.isPending}>
              {m.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creando…</> : <><Save className="mr-2 h-4 w-4" /> Crear empleado</>}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={`space-y-1.5 ${className ?? ""}`}><Label>{label}</Label>{children}</div>;
}
