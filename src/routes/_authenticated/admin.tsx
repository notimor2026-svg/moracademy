import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin")({ component: AdminLayout });

function AdminLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const tabs = [
    { to: "/admin", label: "Resumen" },
    { to: "/admin/employees", label: "Empleados" },
    { to: "/admin/courses", label: "Cursos" },
    { to: "/admin/assignments", label: "Asignaciones" },
    { to: "/admin/reports", label: "Reportes" },
  ];
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
