"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrainingSession, HRSample } from "@/lib/entrenamientos/data-processor";
import { Timer } from "lucide-react";

interface ExerciseMinutesProps {
  session: TrainingSession;
}

interface ZoneData {
  zone: number;
  label: string;
  range: string;
  seconds: number;
  percentage: number;
  color: string;
  bgClass: string;
}

const HR_ZONES = [
  { zone: 1, label: "Recuperación", min: 0, max: 100, color: "#60a5fa", bgClass: "bg-blue-400" },
  { zone: 2, label: "Quema grasa", min: 100, max: 130, color: "#34d399", bgClass: "bg-emerald-400" },
  { zone: 3, label: "Aeróbico", min: 130, max: 155, color: "#fbbf24", bgClass: "bg-amber-400" },
  { zone: 4, label: "Umbral", min: 155, max: 175, color: "#f97316", bgClass: "bg-orange-500" },
  { zone: 5, label: "Máximo", min: 175, max: 999, color: "#ef4444", bgClass: "bg-red-500" },
];

const HR_MIN_VALID = 30;
const HR_MAX_VALID = 250;

function formatSeconds(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

function computeZones(samples: HRSample[]): ZoneData[] {
  const valid = samples.filter((s) => s.hr != null && s.hr >= HR_MIN_VALID && s.hr <= HR_MAX_VALID);
  if (valid.length === 0) return [];

  const zoneSecs = new Array(HR_ZONES.length).fill(0);
  for (let i = 0; i < valid.length; i++) {
    const hr = valid[i].hr;
    const interval =
      i < valid.length - 1
        ? valid[i + 1].time_seconds - valid[i].time_seconds
        : i > 0
          ? valid[i].time_seconds - valid[i - 1].time_seconds
          : 5;
    const zoneIdx = HR_ZONES.findIndex((z) => hr >= z.min && hr < z.max);
    if (zoneIdx >= 0) zoneSecs[zoneIdx] += interval;
  }

  const totalSecs = zoneSecs.reduce((a, b) => a + b, 0);
  return HR_ZONES.map((z, i) => ({
    zone: z.zone,
    label: z.label,
    range: z.max === 999 ? `> ${z.min} bpm` : `${z.min}–${z.max} bpm`,
    seconds: zoneSecs[i],
    percentage: totalSecs > 0 ? (zoneSecs[i] / totalSecs) * 100 : 0,
    color: z.color,
    bgClass: z.bgClass,
  }));
}

export function ExerciseMinutes({ session }: ExerciseMinutesProps) {
  const samples = session.hr_samples ?? [];
  const zones = computeZones(samples);

  if (zones.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Timer className="w-4 h-4" />
            Minutos de Ejercicio
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-6">Sin datos de frecuencia cardíaca disponibles.</p>
        </CardContent>
      </Card>
    );
  }

  const activeZones = zones.filter((z) => z.zone >= 2);
  const activeSecs = activeZones.reduce((sum, z) => sum + z.seconds, 0);
  const totalSecs = zones.reduce((sum, z) => sum + z.seconds, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Timer className="w-4 h-4 text-primary" />
          Minutos de Ejercicio
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end gap-3">
          <div>
            <p className="text-4xl font-bold tracking-tight">
              {Math.floor(activeSecs / 60)}
              <span className="text-lg font-normal text-muted-foreground ml-1">min</span>
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              en zonas activas (Z2–Z5) de{" "}
              <span className="font-medium text-foreground">{formatSeconds(totalSecs)}</span>{" "}totales
            </p>
          </div>
        </div>
        <div className="flex w-full rounded-full overflow-hidden h-3 gap-px">
          {zones.map((z) =>
            z.percentage > 0 ? (
              <div key={z.zone} className={z.bgClass} style={{ width: `${z.percentage}%` }} title={`${z.label}: ${formatSeconds(z.seconds)}`} />
            ) : null
          )}
        </div>
        <div className="space-y-2">
          {zones.map((z) => (
            <div key={z.zone} className="flex items-center gap-2 text-sm">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: z.color }} />
              <span className="flex-1 text-muted-foreground">Z{z.zone} · {z.label}</span>
              <span className="text-xs text-muted-foreground/70 tabular-nums w-24 text-right">{z.range}</span>
              <span className="font-medium tabular-nums w-16 text-right">{formatSeconds(z.seconds)}</span>
              <span className="text-xs text-muted-foreground tabular-nums w-10 text-right">{z.percentage.toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
