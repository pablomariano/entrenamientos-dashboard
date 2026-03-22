"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrainingSession, HRSample } from "@/lib/entrenamientos/data-processor";
import { HeartPulse, ArrowRight } from "lucide-react";

interface CardiacDriftCardProps {
  session: TrainingSession;
}

interface DriftResult {
  hrStart: number;
  hrEnd: number;
  driftPercent: number;
  steadyStateDurationSeconds: number;
}

function calculateDriftFromSamples(
  samples: HRSample[],
  totalDurationSeconds: number
): DriftResult | null {
  const valid = samples
    .filter((s) => s.hr >= 40 && s.hr <= 250)
    .sort((a, b) => a.time_seconds - b.time_seconds);

  if (valid.length < 30) return null;

  // Estado estable: 20%–80% de la sesión
  const ssStart = totalDurationSeconds * 0.2;
  const ssEnd = totalDurationSeconds * 0.8;
  const steadyStateDurationSeconds = Math.round(ssEnd - ssStart);

  const ssSamples = valid.filter(
    (s) => s.time_seconds >= ssStart && s.time_seconds <= ssEnd
  );

  if (ssSamples.length < 20) return null;

  const midpoint = ssStart + (ssEnd - ssStart) / 2;
  const firstHalf = ssSamples.filter((s) => s.time_seconds < midpoint);
  const secondHalf = ssSamples.filter((s) => s.time_seconds >= midpoint);

  if (firstHalf.length < 5 || secondHalf.length < 5) return null;

  const avg = (arr: HRSample[]) =>
    Math.round(arr.reduce((a, s) => a + s.hr, 0) / arr.length);

  const hrStart = avg(firstHalf);
  const hrEnd = avg(secondHalf);
  const driftPercent = ((hrEnd - hrStart) / hrStart) * 100;

  return {
    hrStart,
    hrEnd,
    driftPercent: Math.round(driftPercent * 10) / 10,
    steadyStateDurationSeconds,
  };
}

function getDriftInterpretation(drift: number): {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
  description: string;
} {
  const absDrift = Math.abs(drift);
  if (absDrift < 3) {
    return {
      label: "Estable",
      variant: "secondary",
      description: "Excelente estabilidad cardiovascular. Tu corazón mantiene un ritmo constante.",
    };
  }
  if (absDrift < 5) {
    return {
      label: "Leve",
      variant: "outline",
      description: "Deriva normal. Indica buena capacidad aeróbica.",
    };
  }
  if (absDrift < 10) {
    return {
      label: "Moderada",
      variant: "default",
      description: "Tu FC sube progresivamente. Puede indicar fatiga, deshidratación o calor.",
    };
  }
  return {
    label: "Significativa",
    variant: "destructive",
    description: "Deriva alta. Revisa hidratación, temperatura, descanso previo o posible sobreentrenamiento.",
  };
}

export function CardiacDriftCard({ session }: CardiacDriftCardProps) {
  const samples = session.hr_samples ?? [];

  if (samples.length < 30 || session.duration_seconds < 1200) {
    return null;
  }

  const drift = calculateDriftFromSamples(samples, session.duration_seconds);

  if (!drift) return null;

  const interpretation = getDriftInterpretation(drift.driftPercent);
  const steadyMins = Math.round(drift.steadyStateDurationSeconds / 60);
  const isPositive = drift.driftPercent > 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <HeartPulse className="h-4 w-4 text-primary" />
          Deriva Cardíaca
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-end gap-3">
          <span className="text-4xl font-bold tracking-tight tabular-nums">
            {isPositive ? "+" : ""}
            {drift.driftPercent}%
          </span>
          <Badge variant={interpretation.variant} className="mb-1">
            {interpretation.label}
          </Badge>
        </div>

        <p className="text-xs text-muted-foreground">{interpretation.description}</p>

        <div className="flex items-center justify-center gap-3 rounded-lg border bg-muted/30 p-3">
          <div className="text-center">
            <div className="text-2xl font-semibold tabular-nums">{drift.hrStart}</div>
            <div className="text-[10px] text-muted-foreground">FC 1ª mitad</div>
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground" />
          <div className="text-center">
            <div className={`text-2xl font-semibold tabular-nums ${isPositive ? "text-destructive" : "text-chart-3"}`}>
              {drift.hrEnd}
            </div>
            <div className="text-[10px] text-muted-foreground">FC 2ª mitad</div>
          </div>
        </div>

        <div className="text-xs text-muted-foreground text-center">
          Análisis sobre {steadyMins} min de estado estable (20%–80% de la sesión)
        </div>
      </CardContent>
    </Card>
  );
}
