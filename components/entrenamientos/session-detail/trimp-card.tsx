"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  color: string;
  description: string;
  Icon: typeof TrendingUp;
} {
  if (trimp < 50) return { label: "Ligero", color: "text-chart-3", description: "Recuperación activa o sesión corta", Icon: Minus };
  if (trimp < 100) return { label: "Moderado", color: "text-chart-2", description: "Entrenamiento aeróbico efectivo", Icon: TrendingUp };
  if (trimp < 200) return { label: "Alto", color: "text-chart-4", description: "Sesión exigente, buena para progresar", Icon: TrendingUp };
  return { label: "Muy alto", color: "text-chart-1", description: "Sesión muy intensa, necesitarás recuperación", Icon: TrendingDown };
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
          <p className="text-sm text-muted-foreground">Sin datos de frecuencia cardíaca para calcular TRIMP.</p>
        </CardContent>
      </Card>
    );
  }

  const hrMax = Math.max(session.hr_max ?? globalHRMax, globalHRMax);
  const trimp = calculateSessionTRIMP(session.duration_seconds, session.hr_avg!, globalHRRest, hrMax);
  const level = getTRIMPLevel(trimp);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="h-4 w-4 text-primary" />
          TRIMP (Carga de Entrenamiento)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-end gap-3">
          <span className="text-4xl font-bold tracking-tight tabular-nums">{Math.round(trimp)}</span>
          <div className="flex items-center gap-1.5 pb-1">
            <level.Icon className={`h-4 w-4 ${level.color}`} />
            <span className={`text-sm font-medium ${level.color}`}>{level.label}</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{level.description}</p>

        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Intensidad relativa</span>
            <span className="font-medium tabular-nums">
              {Math.round(((session.hr_avg! - globalHRRest) / (hrMax - globalHRRest)) * 100)}%
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-chart-3 via-chart-4 to-chart-1 transition-all"
              style={{
                width: `${Math.min(100, Math.round(((session.hr_avg! - globalHRRest) / (hrMax - globalHRRest)) * 100))}%`,
              }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground/60">
            <span>Reposo ({globalHRRest} bpm)</span>
            <span>FC Máx ({hrMax} bpm)</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-1">
          <div className="rounded-md border p-2 text-center">
            <div className="text-lg font-semibold tabular-nums">{session.hr_avg}</div>
            <div className="text-[10px] text-muted-foreground">FC Prom</div>
          </div>
          <div className="rounded-md border p-2 text-center">
            <div className="text-lg font-semibold tabular-nums text-destructive">{session.hr_max ?? "—"}</div>
            <div className="text-[10px] text-muted-foreground">FC Máx</div>
          </div>
          <div className="rounded-md border p-2 text-center">
            <div className="text-lg font-semibold tabular-nums">{session.hr_min ?? "—"}</div>
            <div className="text-[10px] text-muted-foreground">FC Mín</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
