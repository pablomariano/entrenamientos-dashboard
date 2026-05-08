"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrainingSession, HRSample } from "@/lib/entrenamientos/data-processor";
import { HeartPulse } from "lucide-react";

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
  barWidth: number;
} {
  const absDrift = Math.abs(drift);
  if (absDrift < 3) {
    return {
      label: "Estable",
      variant: "secondary",
      description: "Excelente estabilidad cardiovascular.",
      barWidth: 15,
    };
  }
  if (absDrift < 5) {
    return {
      label: "Leve",
      variant: "outline",
      description: "Deriva normal, buena capacidad aeróbica.",
      barWidth: 40,
    };
  }
  if (absDrift < 10) {
    return {
      label: "Moderada",
      variant: "default",
      description: "FC sube progresivamente. Puede indicar fatiga o calor.",
      barWidth: 70,
    };
  }
  return {
    label: "Significativa",
    variant: "destructive",
    description: "Deriva alta. Revisa hidratación y descanso previo.",
    barWidth: 100,
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
  const isPositive = drift.driftPercent > 0;

  // Color de la barra según severidad
  const barColorMap: Record<string, string> = {
    Estable: "bg-chart-3",
    Leve: "bg-chart-2",
    Moderada: "bg-chart-4",
    Significativa: "bg-destructive",
  };
  const barColor = barColorMap[interpretation.label] ?? "bg-chart-2";

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <HeartPulse className="h-4 w-4 text-primary" />
          Deriva Cardíaca
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Número + badge */}
        <div className="flex items-end gap-3">
          <span className="text-4xl font-bold tracking-tight tabular-nums">
            {isPositive ? "+" : ""}
            {drift.driftPercent}%
          </span>
          <div className="pb-1">
            <Badge variant={interpretation.variant}>{interpretation.label}</Badge>
          </div>
        </div>

        {/* Descripción */}
        <p className="text-xs text-muted-foreground">{interpretation.description}</p>

        {/* Barra de severidad */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Severidad</span>
            <span className="font-medium tabular-nums text-muted-foreground">
              {drift.hrStart} → {drift.hrEnd} bpm
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full ${barColor} transition-all duration-700`}
              style={{ width: `${interpretation.barWidth}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
