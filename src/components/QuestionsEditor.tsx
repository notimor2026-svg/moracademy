import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Plus, Trash2, AlertCircle } from "lucide-react";

export type ManualQuestion = {
  enunciado: string;
  tipo: "opcion_multiple" | "multiple_respuesta";
  opciones: string[];
  respuesta_correcta: number[];
};

export const emptyQuestion = (): ManualQuestion => ({
  enunciado: "",
  tipo: "opcion_multiple",
  opciones: ["", ""],
  respuesta_correcta: [],
});

export function validateQuestions(qs: ManualQuestion[]): string[] {
  const errs: string[] = [];
  qs.forEach((q, i) => {
    const n = i + 1;
    if (!q.enunciado.trim()) errs.push(`Pregunta ${n}: falta el texto.`);
    if (q.opciones.length < 2) errs.push(`Pregunta ${n}: debe tener al menos 2 opciones.`);
    if (q.opciones.some((o) => !o.trim())) errs.push(`Pregunta ${n}: hay opciones vacías.`);
    if (q.tipo === "opcion_multiple" && q.respuesta_correcta.length !== 1)
      errs.push(`Pregunta ${n}: marca exactamente 1 respuesta correcta.`);
    if (q.tipo === "multiple_respuesta" && q.respuesta_correcta.length < 1)
      errs.push(`Pregunta ${n}: marca al menos 1 respuesta correcta.`);
  });
  return errs;
}

export function QuestionsEditor({
  value,
  onChange,
}: {
  value: ManualQuestion[];
  onChange: (qs: ManualQuestion[]) => void;
}) {
  const update = (i: number, patch: Partial<ManualQuestion>) =>
    onChange(value.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));

  const setTipo = (i: number, tipo: ManualQuestion["tipo"]) => {
    const q = value[i];
    const respuesta_correcta = tipo === "opcion_multiple" ? q.respuesta_correcta.slice(0, 1) : q.respuesta_correcta;
    update(i, { tipo, respuesta_correcta });
  };

  const setOpcion = (qi: number, oi: number, text: string) => {
    const opciones = value[qi].opciones.map((o, i) => (i === oi ? text : o));
    update(qi, { opciones });
  };

  const addOpcion = (qi: number) => {
    if (value[qi].opciones.length >= 8) return;
    update(qi, { opciones: [...value[qi].opciones, ""] });
  };

  const removeOpcion = (qi: number, oi: number) => {
    if (value[qi].opciones.length <= 2) return;
    const opciones = value[qi].opciones.filter((_, i) => i !== oi);
    const respuesta_correcta = value[qi].respuesta_correcta
      .filter((idx) => idx !== oi)
      .map((idx) => (idx > oi ? idx - 1 : idx));
    update(qi, { opciones, respuesta_correcta });
  };

  const toggleCorrecta = (qi: number, oi: number) => {
    const q = value[qi];
    if (q.tipo === "opcion_multiple") {
      update(qi, { respuesta_correcta: [oi] });
    } else {
      const has = q.respuesta_correcta.includes(oi);
      update(qi, {
        respuesta_correcta: has
          ? q.respuesta_correcta.filter((x) => x !== oi)
          : [...q.respuesta_correcta, oi].sort((a, b) => a - b),
      });
    }
  };

  return (
    <div className="space-y-3">
      {value.length === 0 && (
        <div className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
          Aún no has agregado preguntas.
        </div>
      )}
      {value.map((q, qi) => (
        <Card key={qi} className="border-border/60 bg-muted/30">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-start justify-between gap-2">
              <span className="text-sm font-medium">Pregunta {qi + 1}</span>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => onChange(value.filter((_, i) => i !== qi))}
                aria-label="Eliminar pregunta"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
              <div className="space-y-1.5">
                <Label>Texto de la pregunta</Label>
                <Textarea
                  rows={2}
                  value={q.enunciado}
                  onChange={(e) => update(qi, { enunciado: e.target.value })}
                  placeholder="Escribe la pregunta..."
                />
              </div>
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select value={q.tipo} onValueChange={(v) => setTipo(qi, v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="opcion_multiple">Una respuesta correcta</SelectItem>
                    <SelectItem value="multiple_respuesta">Varias respuestas correctas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Opciones {q.tipo === "opcion_multiple" ? "(marca la correcta)" : "(marca todas las correctas)"}
              </Label>
              {q.tipo === "opcion_multiple" ? (
                <RadioGroup
                  value={String(q.respuesta_correcta[0] ?? "")}
                  onValueChange={(v) => update(qi, { respuesta_correcta: [Number(v)] })}
                >
                  {q.opciones.map((o, oi) => (
                    <div key={oi} className="flex items-center gap-2">
                      <RadioGroupItem value={String(oi)} id={`q${qi}-o${oi}`} />
                      <Input
                        value={o}
                        onChange={(e) => setOpcion(qi, oi, e.target.value)}
                        placeholder={`Opción ${oi + 1}`}
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => removeOpcion(qi, oi)}
                        disabled={q.opciones.length <= 2}
                        aria-label="Eliminar opción"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </RadioGroup>
              ) : (
                <div className="space-y-2">
                  {q.opciones.map((o, oi) => (
                    <div key={oi} className="flex items-center gap-2">
                      <Checkbox
                        checked={q.respuesta_correcta.includes(oi)}
                        onCheckedChange={() => toggleCorrecta(qi, oi)}
                      />
                      <Input
                        value={o}
                        onChange={(e) => setOpcion(qi, oi, e.target.value)}
                        placeholder={`Opción ${oi + 1}`}
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => removeOpcion(qi, oi)}
                        disabled={q.opciones.length <= 2}
                        aria-label="Eliminar opción"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => addOpcion(qi)}
                disabled={q.opciones.length >= 8}
              >
                <Plus className="mr-1 h-3 w-3" /> Añadir opción
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
      <Button variant="outline" onClick={() => onChange([...value, emptyQuestion()])}>
        <Plus className="mr-1 h-4 w-4" /> Añadir pregunta
      </Button>
    </div>
  );
}

export function QuestionErrors({ errors }: { errors: string[] }) {
  if (!errors.length) return null;
  return (
    <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
      <div className="flex items-center gap-1 font-medium">
        <AlertCircle className="h-3 w-3" /> Corrige antes de guardar:
      </div>
      <ul className="ml-4 mt-1 list-disc">
        {errors.map((e, i) => (
          <li key={i}>{e}</li>
        ))}
      </ul>
    </div>
  );
}
