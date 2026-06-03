import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMyCertificates } from "@/lib/academy.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Award, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadCertificate } from "@/lib/cert-pdf";

export const Route = createFileRoute("/_authenticated/certificates")({ component: Certs });

function Certs() {
  const fn = useServerFn(listMyCertificates);
  const { data } = useQuery({
    queryKey: ["my-certs"],
    queryFn: () => fn(),
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="font-display text-3xl font-semibold">Mis certificados</h1>
        <p className="text-muted-foreground">Tus logros acreditados por MOR ACADEMY.</p>
      </header>
      {data && data.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {data.map((c: any) => (
            <Card key={c.id} className="overflow-hidden border-border/60">
              <div className="bg-gradient-gold p-5 text-gold-foreground">
                <Award className="h-8 w-8" />
                <h3 className="mt-2 font-display text-lg font-semibold">{c.courses?.nombre}</h3>
                <p className="text-xs">Código: {c.codigo}</p>
              </div>
              <CardContent className="flex items-center justify-between p-4">
                <span className="text-sm text-muted-foreground">Nota {c.nota}%</span>
                <Button variant="ghost" size="sm" onClick={() => downloadCertificate(c)}>
                  <Download className="mr-1 h-4 w-4" /> Descargar PDF
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-dashed"><CardContent className="p-10 text-center text-muted-foreground">Aún no tienes certificados. ¡Completa tus capacitaciones!</CardContent></Card>
      )}
    </div>
  );
}

