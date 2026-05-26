import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { startQuizAttempt, submitQuizAttempt } from "@/lib/academy.functions";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles, CheckCircle2, XCircle, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/quiz/$quizId")({ component: QuizPage });

type Pregunta = {
  enunciado: string;
  tipo: "opcion_multiple" | "verdadero_falso" | "multiple_respuesta";
  opciones: string[];
  respuesta_correcta: number[];
  justificacion: string;
};

function QuizPage() {
  const { quizId } = Route.useParams();
  const startFn = useServerFn(startQuizAttempt);
  const submitFn = useServerFn(submitQuizAttempt);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [intentoNum, setIntentoNum] = useState<number | null>(null);
  const [preguntas, setPreguntas] = useState<Pregunta[]>([]);
  const [respuestas, setRespuestas] = useState<number[][]>([]);
  const [result, setResult] = useState<{ score: number; aprobado: boolean; preguntas: Pregunta[] } | null>(null);

  const startM = useMutation({
    mutationFn: () => startFn({ data: { quiz_id: quizId } }),
    onSuccess: (d) => {
      setAttemptId(d.attempt_id);
      setIntentoNum(d.intento_num);
      setPreguntas(d.preguntas as Pregunta[]);
      setRespuestas((d.preguntas as Pregunta[]).map(() => []));
    },
    onError: (e: any) => toast.error(e.message ?? "Error al generar evaluación"),
  });

  const submitM = useMutation({
    mutationFn: () => submitFn({ data: { attempt_id: attemptId!, respuestas } }),
    onSuccess: (d) => {
      setResult(d as any);
      d.aprobado ? toast.success(`¡Aprobado con ${d.score}%!`) : toast.warning(`Obtuviste ${d.score}%. Inténtalo de nuevo.`);
    },
    onError: (e: any) => toast.error(e.message ?? "Error al enviar"),
  });

  useEffect(() => { if (!attemptId && !result) startM.mutate(); /* eslint-disable-next-line */ }, []);

  const setAnswer = (qi: number, opts: number[]) => {
    setRespuestas((r) => r.map((v, i) => (i === qi ? opts : v)));
  };

  if (startM.isPending && !preguntas.length) {
    return (
      <Card className="mx-auto max-w-2xl border-border/60">
        <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
          <Sparkles className="h-10 w-10 text-gold animate-pulse" />
          <h2 className="font-display text-xl">Generando tu evaluación personalizada…</h2>
          <p className="text-sm text-muted-foreground">Estamos preparando preguntas únicas con base en el material del curso.</p>
        </CardContent>
      </Card>
    );
  }

  if (result) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Card className={`border-2 ${result.aprobado ? "border-success/40" : "border-warning/40"}`}>
          <CardContent className="space-y-3 p-8 text-center">
            {result.aprobado ? <CheckCircle2 className="mx-auto h-14 w-14 text-success" /> : <XCircle className="mx-auto h-14 w-14 text-warning" />}
            <h1 className="font-display text-3xl font-semibold">
              {result.aprobado ? "¡Felicidades! Aprobaste." : "No alcanzaste el umbral"}
            </h1>
            <p className="text-5xl font-bold text-primary">{result.score}%</p>
          </CardContent>
        </Card>
        <h2 className="font-display text-xl font-semibold">Retroalimentación</h2>
        {result.preguntas.map((p, i) => {
          const dado = (respuestas[i] ?? []).slice().sort().join(",");
          const correcto = (p.respuesta_correcta ?? []).slice().sort().join(",");
          const ok = dado === correcto;
          return (
            <Card key={i} className={ok ? "border-success/30" : "border-warning/30"}>
              <CardContent className="space-y-3 p-5">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{i + 1}. {p.enunciado}</p>
                  {ok ? <CheckCircle2 className="h-5 w-5 text-success" /> : <XCircle className="h-5 w-5 text-warning" />}
                </div>
                <ul className="space-y-1 text-sm">
                  {p.opciones.map((o, idx) => (
                    <li key={idx} className={
                      p.respuesta_correcta.includes(idx) ? "text-success font-medium" :
                      (respuestas[i] ?? []).includes(idx) ? "text-warning line-through" : "text-muted-foreground"
                    }>
                      • {o}
                    </li>
                  ))}
                </ul>
                <p className="text-xs italic text-muted-foreground">💡 {p.justificacion}</p>
              </CardContent>
            </Card>
          );
        })}
        <div className="flex justify-between">
          <Button variant="outline" asChild><Link to="/home"><ArrowLeft className="mr-2 h-4 w-4" /> Volver</Link></Button>
          {!result.aprobado && (
            <Button onClick={() => { setResult(null); setAttemptId(null); setPreguntas([]); setRespuestas([]); startM.mutate(); }}>
              Reintentar
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <Badge variant="outline">Intento #{intentoNum}</Badge>
          <h1 className="mt-2 font-display text-2xl font-semibold">Evaluación</h1>
          <p className="text-sm text-muted-foreground">Selecciona la(s) opción(es) correcta(s). Tus respuestas se evaluarán al enviar.</p>
        </div>
      </header>
      {preguntas.map((p, qi) => {
        const isMulti = p.tipo === "multiple_respuesta";
        return (
          <Card key={qi} className="border-border/60">
            <CardContent className="space-y-4 p-6">
              <p className="font-medium">{qi + 1}. {p.enunciado}</p>
              {isMulti ? (
                <div className="space-y-2">
                  {p.opciones.map((o, idx) => {
                    const id = `q${qi}-o${idx}`;
                    const checked = (respuestas[qi] ?? []).includes(idx);
                    return (
                      <div key={idx} className="flex items-center gap-2 rounded-md border border-border p-3 hover:bg-muted/50">
                        <Checkbox id={id} checked={checked} onCheckedChange={(c) => {
                          const cur = respuestas[qi] ?? [];
                          setAnswer(qi, c ? [...cur, idx] : cur.filter((x) => x !== idx));
                        }} />
                        <Label htmlFor={id} className="flex-1 cursor-pointer font-normal">{o}</Label>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <RadioGroup value={String(respuestas[qi]?.[0] ?? "")} onValueChange={(v) => setAnswer(qi, [Number(v)])}>
                  {p.opciones.map((o, idx) => {
                    const id = `q${qi}-r${idx}`;
                    return (
                      <div key={idx} className="flex items-center gap-2 rounded-md border border-border p-3 hover:bg-muted/50">
                        <RadioGroupItem value={String(idx)} id={id} />
                        <Label htmlFor={id} className="flex-1 cursor-pointer font-normal">{o}</Label>
                      </div>
                    );
                  })}
                </RadioGroup>
              )}
            </CardContent>
          </Card>
        );
      })}
      <Button className="w-full" size="lg" disabled={submitM.isPending} onClick={() => submitM.mutate()}>
        {submitM.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Calificando…</> : "Enviar evaluación"}
      </Button>
    </div>
  );
}
