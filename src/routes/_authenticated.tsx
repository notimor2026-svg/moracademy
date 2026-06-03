import { createFileRoute, Outlet, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useEffect } from "react";
import { getMe } from "@/lib/hr.functions";
import { MorAcademyLogo } from "@/components/MorAcademyLogo";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard,
  GraduationCap,
  Users2,
  ShieldCheck,
  Award,
  LogOut,
  BookOpenCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const me = useServerFn(getMe);

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login", replace: true });
  }, [loading, session, navigate]);

  const meQ = useQuery({ queryKey: ["me", session?.user.id], queryFn: () => me(), enabled: !!session?.access_token, retry: false, throwOnError: false });

  const roles: string[] = meQ.data?.roles ?? [];
  const isJefe = roles.includes("jefe_directo");
  const isAdmin = meQ.data?.isAdmin === true;
  const firstName = meQ.data?.employee?.nombre?.trim().split(/\s+/)[0];

  const nav = [
    { to: "/home", label: "Mis cursos", icon: LayoutDashboard, show: true },
    { to: "/certificates", label: "Certificados", icon: Award, show: true },
    { to: "/team", label: "Mi equipo", icon: Users2, show: isJefe },
    // Administración: solo visible para el DUI autorizado.
    { to: "/admin", label: "Administración", icon: ShieldCheck, show: isAdmin },
  ].filter((n) => n.show);


  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (!session) return null;

  const initials = (meQ.data?.employee?.nombre ?? "MA")
    .split(" ").slice(0, 2).map((s) => s[0]?.toUpperCase()).join("");

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground lg:flex">
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-5">
          <MorAcademyLogo size={36} />
          <span className="font-display text-base font-semibold tracking-tight">MOR ACADEMY</span>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.to || (item.to !== "/home" && pathname.startsWith(item.to));
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-4">
          <div className="mb-3 flex items-center gap-3">
            <Avatar className="h-9 w-9 bg-sidebar-primary text-sidebar-primary-foreground">
              <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground">
                {initials || "MA"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">
                {firstName ?? "Hola"}
              </div>

              <div className="flex gap-1">
                {roles.map((r) => (
                  <Badge key={r} variant="secondary" className="bg-sidebar-accent text-[10px] uppercase tracking-wide text-sidebar-foreground">
                    {r}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/login" }); }}
          >
            <LogOut className="mr-2 h-4 w-4" /> Cerrar sesión
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-border bg-card/50 px-4 lg:px-8">
          <div className="flex items-center gap-3 lg:hidden">
            <MorAcademyLogo size={28} />
            <span className="font-display font-semibold">MOR ACADEMY</span>
          </div>
          <div className="hidden items-center gap-2 text-sm text-muted-foreground lg:flex">
            <BookOpenCheck className="h-4 w-4 text-primary" />
            Aprende. Avanza. Acredita.
          </div>
          <div className="flex items-center gap-3">
            {meQ.data?.employee && (
              <Badge variant="outline" className="gap-1.5 border-gold/40 text-gold-foreground">
                <GraduationCap className="h-3.5 w-3.5 text-gold" />
                {meQ.data.employee.xp ?? 0} XP
              </Badge>
            )}
          </div>
        </header>
        <main className="flex-1 overflow-y-auto px-4 py-6 lg:px-10 lg:py-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
