import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  listSystemUsers, updateSystemUser, setUserActive, setUserRoles, createSystemUser,
} from "@/lib/hr.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Loader2, UserPlus, Pencil, ShieldCheck, Search } from "lucide-react";
import { normalizeDui } from "@/lib/dui";

export const Route = createFileRoute("/_authenticated/admin/users")({
  component: UsersPage,
});

const ROLES = [
  { value: "super_admin", label: "Super Administrador" },
  { value: "rrhh", label: "RRHH" },
  { value: "jefe_directo", label: "Jefe Directo" },
  { value: "creador", label: "Creador" },
  { value: "colaborador", label: "Colaborador" },
] as const;

type SystemUser = {
  id: string; auth_user_id: string | null; dui: string; nombre: string;
  email: string | null; area: string | null; cargo: string | null;
  estado: string; roles: string[];
};

function UsersPage() {
  const list = useServerFn(listSystemUsers);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["system-users"], queryFn: () => list() });
  const [search, setSearch] = useState("");

  const filtered = (q.data ?? []).filter((u) => {
    const t = search.toLowerCase().trim();
    if (!t) return true;
    return [u.nombre, u.dui, u.email, u.area, u.cargo].some(
      (v) => (v ?? "").toLowerCase().includes(t),
    );
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["system-users"] });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="font-display">Gestión de usuarios</CardTitle>
            <p className="text-sm text-muted-foreground">
              Crea cuentas, asigna roles y controla el acceso al sistema.
            </p>
          </div>
          <CreateUserDialog onDone={refresh} />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, DUI, email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>

          {q.isLoading ? (
            <div className="flex items-center gap-2 py-10 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando usuarios…
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>DUI</TableHead>
                  <TableHead>Área / Cargo</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Activo</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((u) => (
                  <UserRow key={u.id} user={u} onChanged={refresh} />
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Sin usuarios.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function UserRow({ user, onChanged }: { user: SystemUser; onChanged: () => void }) {
  const toggleActive = useServerFn(setUserActive);
  const m = useMutation({
    mutationFn: (activo: boolean) => toggleActive({ data: { employee_id: user.id, activo } }),
    onSuccess: () => { toast.success("Estado actualizado"); onChanged(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <TableRow>
      <TableCell>
        <div className="font-medium">{user.nombre}</div>
        <div className="text-xs text-muted-foreground">{user.email ?? "—"}</div>
      </TableCell>
      <TableCell className="font-mono text-xs">{user.dui}</TableCell>
      <TableCell className="text-sm">
        <div>{user.area ?? "—"}</div>
        <div className="text-xs text-muted-foreground">{user.cargo ?? "—"}</div>
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {user.roles.length === 0 && <span className="text-xs text-muted-foreground">Sin roles</span>}
          {user.roles.map((r) => (
            <Badge key={r} variant={r === "super_admin" ? "default" : "secondary"} className="text-[10px] uppercase">
              {r === "super_admin" && <ShieldCheck className="mr-1 h-3 w-3" />}
              {r}
            </Badge>
          ))}
        </div>
      </TableCell>
      <TableCell>
        <Switch
          checked={user.estado === "activo"}
          onCheckedChange={(v) => m.mutate(v)}
          disabled={m.isPending}
        />
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-2">
          <EditUserDialog user={user} onDone={onChanged} />
          <RolesDialog user={user} onDone={onChanged} />
        </div>
      </TableCell>
    </TableRow>
  );
}

function CreateUserDialog({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    dui: "", nombre: "", email: "", area: "", cargo: "",
    roles: ["colaborador"] as string[],
  });
  const createFn = useServerFn(createSystemUser);
  const m = useMutation({
    mutationFn: () => createFn({ data: {
      dui: normalizeDui(form.dui), nombre: form.nombre, email: form.email,
      area: form.area, cargo: form.cargo, roles: form.roles as never,
    } }),
    onSuccess: () => {
      toast.success("Usuario creado");
      setOpen(false);
      setForm({ dui: "", nombre: "", email: "", area: "", cargo: "", roles: ["colaborador"] });
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><UserPlus className="mr-2 h-4 w-4" /> Nuevo usuario</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Crear usuario</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <Field label="DUI" value={form.dui} onChange={(v) => setForm({ ...form, dui: v })} placeholder="00000000-0" />
          <Field label="Nombre" value={form.nombre} onChange={(v) => setForm({ ...form, nombre: v })} />
          <Field label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Área" value={form.area} onChange={(v) => setForm({ ...form, area: v })} />
            <Field label="Cargo" value={form.cargo} onChange={(v) => setForm({ ...form, cargo: v })} />
          </div>
          <RoleSelector value={form.roles} onChange={(roles) => setForm({ ...form, roles })} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={() => m.mutate()} disabled={m.isPending}>
            {m.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Crear
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditUserDialog({ user, onDone }: { user: SystemUser; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    nombre: user.nombre, email: user.email ?? "", area: user.area ?? "", cargo: user.cargo ?? "",
  });
  const upd = useServerFn(updateSystemUser);
  const m = useMutation({
    mutationFn: () => upd({ data: { employee_id: user.id, ...form } }),
    onSuccess: () => { toast.success("Usuario actualizado"); setOpen(false); onDone(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><Pencil className="h-3.5 w-3.5" /></Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Editar {user.nombre}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <Field label="Nombre" value={form.nombre} onChange={(v) => setForm({ ...form, nombre: v })} />
          <Field label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Área" value={form.area} onChange={(v) => setForm({ ...form, area: v })} />
            <Field label="Cargo" value={form.cargo} onChange={(v) => setForm({ ...form, cargo: v })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={() => m.mutate()} disabled={m.isPending}>
            {m.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RolesDialog({ user, onDone }: { user: SystemUser; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [roles, setRoles] = useState<string[]>(user.roles);
  const setRolesFn = useServerFn(setUserRoles);
  const m = useMutation({
    mutationFn: () => setRolesFn({ data: { employee_id: user.id, roles: roles as never } }),
    onSuccess: () => { toast.success("Roles actualizados"); setOpen(false); onDone(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setRoles(user.roles); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><ShieldCheck className="h-3.5 w-3.5" /></Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Roles de {user.nombre}</DialogTitle></DialogHeader>
        <RoleSelector value={roles} onChange={setRoles} />
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={() => m.mutate()} disabled={m.isPending}>
            {m.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RoleSelector({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="space-y-2">
      <Label>Roles</Label>
      <div className="grid gap-2">
        {ROLES.map((r) => {
          const checked = value.includes(r.value);
          return (
            <label key={r.value} className="flex items-center gap-2 rounded-md border border-border p-2 text-sm">
              <Checkbox
                checked={checked}
                onCheckedChange={(v) => {
                  if (v) onChange([...value, r.value]);
                  else onChange(value.filter((x) => x !== r.value));
                }}
              />
              <span>{r.label}</span>
              <code className="ml-auto text-xs text-muted-foreground">{r.value}</code>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, placeholder,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}
