import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMe } from "@/lib/hr.functions";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldAlert, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin")({ component: AdminLayout });

function AdminLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const me = useServerFn(getMe);
  const meQ = useQuery({ queryKey: ["me-admin-gate"], queryFn: () => me(), staleTime: 60_000 });

  const tabs = [
    { to: "/admin", label: "Resumen" },
    { to: "/admin/users", label: "Usuarios", superOnly: true },
    { to: "/admin/employees", label: "Empleados" },
    { to: "/admin/courses", label: "Cursos" },
    { to: "/admin/assignments", label: "Asignaciones" },
    { to: "/admin/reports", label: "Reportes" },
    { to: "/admin/audit", label: "Auditoría" },
  ].filter((t) => !t.superOnly || meQ.data?.isSuperAdmin);

  if (meQ.isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verificando acceso…
      </div>
    );
  }

  if (!meQ.data?.isAdmin) {
    return (
      <Card className="mx-auto mt-16 max-w-md border-destructive/40">
        <CardContent className="space-y-3 p-8 text-center">
          <ShieldAlert className="mx-auto h-10 w-10 text-destructive" />
          <h2 className="font-display text-xl">Acceso restringido</h2>
          <p className="text-sm text-muted-foreground">
            Solo el administrador autorizado puede ingresar al Centro de Control de RRHH.
            Si necesitas acceso, comunícate con el responsable de MOR ACADEMY.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header>
        <p className="text-sm uppercase tracking-wider text-muted-foreground">Administración</p>
        <h1 className="font-display text-3xl font-semibold">Centro de control RRHH</h1>
      </header>
      <nav className="flex gap-1 border-b border-border">
        {tabs.map((t) => {
          const active = t.to === "/admin" ? pathname === "/admin" : pathname.startsWith(t.to);
          return (
            <Link key={t.to} to={t.to} className={cn(
              "rounded-t-md px-4 py-2 text-sm font-medium transition-colors",
              active ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground",
            )}>{t.label}</Link>
          );
        })}
      </nav>
      <Outlet />
    </div>
  );
}
