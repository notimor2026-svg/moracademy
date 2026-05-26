import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAuditLog, listOutbox, dispatchNotifications } from "@/lib/hr.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Send, RefreshCw, ShieldCheck, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/audit")({ component: Page });

function Page() {
  const qc = useQueryClient();
  const fnAudit = useServerFn(listAuditLog);
  const fnOutbox = useServerFn(listOutbox);
  const fnDispatch = useServerFn(dispatchNotifications);

  const [filter, setFilter] = useState("");

  const audit = useQuery({ queryKey: ["audit"], queryFn: () => fnAudit({ data: { limit: 200 } }) });
  const outbox = useQuery({ queryKey: ["outbox"], queryFn: () => fnOutbox() });

  const dispatchM = useMutation({
    mutationFn: () => fnDispatch(),
    onSuccess: (r) => {
      toast.success(`Notificaciones procesadas: ${r.sent} enviadas, ${r.failed} fallidas`);
      qc.invalidateQueries({ queryKey: ["outbox"] });
      qc.invalidateQueries({ queryKey: ["audit"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Error"),
  });

  const rows = useMemo(() => {
    const all = audit.data?.rows ?? [];
    if (!filter.trim()) return all;
    const f = filter.toLowerCase();
    return all.filter(
      (r: any) =>
        r.accion?.toLowerCase().includes(f) ||
        r.entidad?.toLowerCase().includes(f) ||
        (audit.data?.actors[r.actor_id] ?? "").toLowerCase().includes(f),
    );
  }, [audit.data, filter]);

  const out = outbox.data ?? [];
  const pendingCount = out.filter((o: any) => o.status === "pending").length;

  return (
    <Tabs defaultValue="audit" className="space-y-4">
      <TabsList>
        <TabsTrigger value="audit">
          <ShieldCheck className="mr-1 h-4 w-4" /> Auditoría
        </TabsTrigger>
        <TabsTrigger value="outbox">
          <Send className="mr-1 h-4 w-4" /> Notificaciones {pendingCount > 0 && <Badge variant="secondary" className="ml-2">{pendingCount}</Badge>}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="audit" className="space-y-4">
        <div className="flex items-center gap-2">
          <Input placeholder="Filtrar por acción, entidad o actor…" value={filter} onChange={(e) => setFilter(e.target.value)} className="max-w-md" />
          <Button variant="outline" size="sm" onClick={() => audit.refetch()}>
            <RefreshCw className="mr-1 h-4 w-4" /> Refrescar
          </Button>
        </div>
        <Card className="border-border/60">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Acción</TableHead>
                  <TableHead>Entidad</TableHead>
                  <TableHead>Detalle</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Sin registros</TableCell></TableRow>
                ) : rows.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</TableCell>
                    <TableCell className="text-sm">{audit.data?.actors[r.actor_id] ?? "Sistema"}</TableCell>
                    <TableCell><Badge variant="outline">{r.accion}</Badge></TableCell>
                    <TableCell className="text-sm">{r.entidad ?? "—"}</TableCell>
                    <TableCell className="max-w-md truncate text-xs text-muted-foreground">{r.payload ? JSON.stringify(r.payload) : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="outbox" className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{pendingCount} pendientes de {out.length} totales.</p>
          <Button onClick={() => dispatchM.mutate()} disabled={dispatchM.isPending || pendingCount === 0}>
            {dispatchM.isPending ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" /> Enviando…</> : <><Send className="mr-1 h-4 w-4" /> Procesar pendientes</>}
          </Button>
        </div>
        <Card className="border-border/60">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Destinatario</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Payload</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {out.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Sin notificaciones</TableCell></TableRow>
                ) : out.map((n: any) => (
                  <TableRow key={n.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString()}</TableCell>
                    <TableCell><Badge variant="outline">{n.tipo}</Badge></TableCell>
                    <TableCell className="text-sm">{n.destinatario ?? "—"}</TableCell>
                    <TableCell>
                      <Badge className={
                        n.status === "sent" ? "bg-success/15 text-success" :
                        n.status === "failed" ? "bg-destructive/15 text-destructive" :
                        "bg-muted text-muted-foreground"
                      }>{n.status}</Badge>
                    </TableCell>
                    <TableCell className="max-w-md truncate text-xs text-muted-foreground">{n.payload ? JSON.stringify(n.payload) : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
