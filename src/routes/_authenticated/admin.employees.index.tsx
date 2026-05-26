import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listEmployees } from "@/lib/hr.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, UserPlus } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/admin/employees/")({ component: EmpList });

function EmpList() {
  const fn = useServerFn(listEmployees);
  const { data } = useQuery({ queryKey: ["employees"], queryFn: () => fn() });
  const emps = data ?? [];
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{emps.length} empleados registrados</p>
        <Button asChild><Link to="/admin/employees/new"><Plus className="mr-1 h-4 w-4" /> Nuevo empleado</Link></Button>
      </div>
      <Card className="border-border/60">
        <CardContent className="p-0">
          {emps.length === 0 ? (
            <div className="p-10 text-center">
              <UserPlus className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
              <p className="text-muted-foreground">Aún no hay empleados. Empieza creando el primero.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>DUI</TableHead>
                  <TableHead>Área</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {emps.map((e: any) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.nombre}</TableCell>
                    <TableCell className="font-mono text-xs">{e.dui}</TableCell>
                    <TableCell>{e.area ?? "—"}</TableCell>
                    <TableCell>{e.cargo ?? "—"}</TableCell>
                    <TableCell><Badge variant="outline">{e.estado}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
