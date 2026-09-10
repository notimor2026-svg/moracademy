import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAllCertificates, issueMissingCertificates } from "@/lib/hr.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Search, RefreshCw, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { downloadCertificate } from "@/lib/cert-pdf";

export const Route = createFileRoute("/_authenticated/admin/certificates")({ component: Page });

function Page() {
  const qc = useQueryClient();
  const fnList = useServerFn(listAllCertificates);
  const fnIssue = useServerFn(issueMissingCertificates);
  const { data, isLoading } = useQuery({ queryKey: ["all-certs"], queryFn: () => fnList() });
  const [q, setQ] = useState("");
  const [bulk, setBulk] = useState(false);

  const rows = useMemo(() => {
    const all = (data ?? []) as any[];
    if (!q.trim()) return all;
    const n = q.toLowerCase();
    return all.filter((r) =>
      [r.employees?.nombre, r.employees?.dui, r.courses?.nombre, r.codigo, r.employees?.area]
        .filter(Boolean)
        .some((s: string) => s.toLowerCase().includes(n)),
    );
  }, [data, q]);

  const issueM = useMutation({
    mutationFn: () => fnIssue(),
    onSuccess: (r: any) => {
      toast.success(r.created > 0 ? `${r.created} certificado(s) emitido(s).` : "No hay certificados pendientes.");
      qc.invalidateQueries({ queryKey: ["all-certs"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Error"),
  });

  async function downloadAll() {
    setBulk(true);
    try {
      for (const c of rows) {
        await downloadCertificate(c as any);
        await new Promise((r) => setTimeout(r, 300));
      }
      toast.success(`${rows.length} certificado(s) descargado(s).`);
    } catch (e: any) {
      toast.error(e?.message ?? "Error al descargar");
    } finally {
      setBulk(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="w-80 pl-8"
            placeholder="Buscar por empleado, DUI, curso o código…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => issueM.mutate()} disabled={issueM.isPending}>
            <RefreshCw className="mr-1 h-4 w-4" /> Emitir pendientes
          </Button>
          <Button onClick={downloadAll} disabled={bulk || rows.length === 0}>
            {bulk ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Download className="mr-1 h-4 w-4" />}
            Descargar {rows.length > 0 ? `(${rows.length})` : ""}
          </Button>
        </div>
      </div>

      <Card className="border-border/60">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empleado</TableHead>
                <TableHead>Curso</TableHead>
                <TableHead>Código</TableHead>
                <TableHead className="text-right">Nota</TableHead>
                <TableHead>Emisión</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">Cargando…</TableCell>
                </TableRow>
              )}
              {!isLoading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">Sin certificados.</TableCell>
                </TableRow>
              )}
              {rows.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="font-medium">{c.employees?.nombre}</div>
                    <div className="font-mono text-xs text-muted-foreground">{c.employees?.dui}</div>
                  </TableCell>
                  <TableCell>{c.courses?.nombre}</TableCell>
                  <TableCell className="font-mono text-xs">{c.codigo}</TableCell>
                  <TableCell className="text-right">{c.nota}%</TableCell>
                  <TableCell>{new Date(c.fecha_emision).toLocaleDateString("es-SV")}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => downloadCertificate(c)}>
                      <Download className="mr-1 h-3.5 w-3.5" /> PDF
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
