import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createEmployee, listRequisitions, listEmployees } from "@/lib/hr.functions";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { isValidDui, normalizeDui } from "@/lib/dui";

export const Route = createFileRoute("/_authenticated/admin/employees/new")({ component: NewEmp });

function NewEmp() {
  const navigate = useNavigate();
  const create = useServerFn(createEmployee);
  const reqsFn = useServerFn(listRequisitions);
  const empsFn = useServerFn(listEmployees);
  const reqs = useQuery({ queryKey: ["requisitions"], queryFn: () => reqsFn() });
  const emps = useQuery({ queryKey: ["employees"], queryFn: () => empsFn() });

  const [form, setForm] = useState({
    dui: "", nombre: "", email: "", area: "", cargo: "",
    fecha_ingreso: "", jefe_id: "", tipo_proceso: "ambos" as "induccion" | "constante" | "ambos",
    requisicion_id: "", es_jefe: false,
  });

  const m = useMutation({
    mutationFn: () => create({
      data: {
        ...form,
        dui: normalizeDui(form.dui),
        jefe_id: form.jefe_id || null,
        requisicion_id: form.requisicion_id || null,
        email: form.email || undefined,
      },
    }),
    onSuccess: () => { toast.success("Empleado creado"); navigate({ to: "/admin/employees" }); },
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
        <p className="mt-1 text-sm text-muted-foreground">Registra a la persona y asigna automáticamente su plan de inducción.</p>
        <form onSubmit={onSubmit} className="mt-6 grid gap-5 sm:grid-cols-2">
          <Field label="DUI *"><Input value={form.dui} onChange={(e) => setForm({ ...form, dui: e.target.value })} placeholder="00000000-0" required /></Field>
          <Field label="Nombre completo *"><Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required /></Field>
          <Field label="Email"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Fecha de ingreso"><Input type="date" value={form.fecha_ingreso} onChange={(e) => setForm({ ...form, fecha_ingreso: e.target.value })} /></Field>
          <Field label="Área"><Input value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} /></Field>
          <Field label="Cargo"><Input value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} /></Field>

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
            <Field label="Requisición cerrada (Talent Pipeline)" className="sm:col-span-2">
              <Select value={form.requisicion_id} onValueChange={(v) => setForm({ ...form, requisicion_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecciona requisición de origen" /></SelectTrigger>
                <SelectContent>
                  {(reqs.data ?? []).map((r: any) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.codigo} · {r.cargo} ({r.area})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">Las capacitaciones de inducción se auto-asignarán según la requisición.</p>
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
