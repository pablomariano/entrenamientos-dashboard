"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrainingSession } from "@/lib/entrenamientos/data-processor";
import { BarChart3, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface TRIMPCardProps {
  session: TrainingSession;
  globalHRRest?: number;
  globalHRMax?: number;
}

function calculateSessionTRIMP(
  durationSeconds: number,
  hrAvg: number,
  hrRest: number,
  hrMax: number
): number {
  if (hrAvg <= hrRest || hrMax <= hrRest) return 0;
  const deltaHR = Math.max(0, Math.min(1, (hrAvg - hrRest) / (hrMax - hrRest)));
  const durationMin = durationSeconds / 60;
  return durationMin * deltaHR * 0.64 * Math.exp(1.92 * deltaHR);
}

function getTRIMPLevel(trimp: number): {
  label: string;
  badgeVariant: "secondary" | "outline" | "default" | "destructive";
  description: string;
  Icon: typeof TrendingUp;
  barColor: string;
} {
  if (trimp < 50)
    return {
      label: "Ligero",
      badgeVariant: "secondary",
      description: "Recuperación activa o sesión corta",
      Icon: Minus,
      barColor: "from-chart-3 to-chart-3",
    };
  if (trimp < 100)
    return {
      label: "Moderado",
      badgeVariant: "outline",
      description: "Entrenamiento aeróbico efectivo",
      Icon: TrendingUp,
      barColor: "from-chart-3 to-chart-2",
    };
  if (trimp < 200)
    return {
      label: "Alto",
      badgeVariant: "default",
      description: "Sesión exigente, buena para progresar",
      Icon: TrendingUp,
      barColor: "from-chart-2 via-chart-4 to-chart-4",
    };
  return {
    label: "Muy alto",
    badgeVariant: "destructive",
    description: "Sesión muy intensa, necesitarás recuperación",
    Icon: TrendingDown,
    barColor: "from-chart-4 via-chart-1 to-chart-1",
  };
}

export function TRIMPCard({ session, globalHRRest = 60, globalHRMax = 190 }: TRIMPCardProps) {
  if (!session.has_hr || !session.hr_avg) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4" />
            TRIMP
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Sin datos de FC para calcular TRIMP.</p>
        </CardContent>
      </Card>
    );
  }

  const hrMax = Math.max(session.hr_max ?? globalHRMax, globalHRMax);
  const trimp = calculateSessionTRIMP(session.duration_seconds, session.hr_avg!, globalHRRest, hrMax);
  const level = getTRIMPLevel(trimp);
  const intensity = Math.min(
    100,
    Math.round(((session.hr_avg! - globalHRRest) / (hrMax - globalHRRest)) * 100)
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <BarChart3 className="h-4 w-4 text-primary" />
          Carga de Entrenamiento
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Número + badge */}
        <div className="flex items-end gap-3">
          <span className="text-4xl font-bold tracking-tight tabular-nums">
            {Math.round(trimp)}
          </span>
          <div className="flex items-center gap-1.5 pb-1">
            <level.Icon className="h-3.5 w-3.5 text-muted-foreground" />
            <Badge variant={level.badgeVariant}>{level.label}</Badge>
          </div>
        </div>

        {/* Descripción */}
        <p className="text-xs text-muted-foreground">{level.description}</p>

        {/* Barra de intensidad */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Intensidad relativa</span>
            <span className="font-medium tabular-nums">{intensity}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${level.barColor} transition-all duration-700`}
              style={{ width: `${intensity}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
