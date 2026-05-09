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
  seconds: number;
  percentage: number;
  color: string;
  bgClass: string;
}

const HR_ZONES = [
  { zone: 1, label: "Recuperación", min: 0, max: 100, color: "var(--chart-1)", bgClass: "bg-chart-1" },
  { zone: 2, label: "Quema grasa", min: 100, max: 130, color: "var(--chart-3)", bgClass: "bg-chart-3" },
  { zone: 3, label: "Aeróbico", min: 130, max: 155, color: "var(--chart-4)", bgClass: "bg-chart-4" },
  { zone: 4, label: "Umbral", min: 155, max: 175, color: "var(--chart-5)", bgClass: "bg-chart-5" },
  { zone: 5, label: "Máximo", min: 175, max: 999, color: "var(--chart-2)", bgClass: "bg-chart-2" },
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
  const valid = samples.filter(
    (s) => s.hr != null && s.hr >= HR_MIN_VALID && s.hr <= HR_MAX_VALID
  );
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
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Timer className="w-4 h-4" />
            Zonas de FC
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Sin datos de frecuencia cardíaca.
          </p>
        </CardContent>
      </Card>
    );
  }

  const activeZones = zones.filter((z) => z.zone >= 2);
  const activeSecs = activeZones.reduce((sum, z) => sum + z.seconds, 0);
  const totalSecs = zones.reduce((sum, z) => sum + z.seconds, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Timer className="w-4 h-4 text-primary" />
          Zonas de FC
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Tiempo activo destacado */}
        <div>
          <p className="text-4xl font-bold tracking-tight tabular-nums">
            {formatSeconds(activeSecs)}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            en zonas activas · {formatSeconds(totalSecs)} totales
          </p>
        </div>

        {/* Barra de zonas */}
        <div className="flex w-full rounded-full overflow-hidden h-2 gap-px">
          {zones.map((z) =>
            z.percentage > 0 ? (
              <div
                key={z.zone}
                className={z.bgClass}
                style={{ width: `${z.percentage}%` }}
                title={`Z${z.zone} ${z.label}: ${formatSeconds(z.seconds)}`}
              />
            ) : null
          )}
        </div>

        {/* Solo zonas activas (Z2–Z5) en formato compacto */}
        <div className="space-y-1.5">
          {activeZones
            .filter((z) => z.seconds > 0)
            .map((z) => (
              <div key={z.zone} className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: z.color }}
                />
                <span className="text-xs text-muted-foreground flex-1">
                  Z{z.zone} · {z.label}
                </span>
                <span className="text-xs font-medium tabular-nums">
                  {formatSeconds(z.seconds)}
                </span>
                <span className="text-[10px] text-muted-foreground/70 tabular-nums w-8 text-right">
                  {z.percentage.toFixed(0)}%
                </span>
              </div>
            ))}
        </div>
      </CardContent>
    </Card>
  );
}
