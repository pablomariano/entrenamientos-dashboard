"use client";

import * as React from "react";
import { Label, Pie, PieChart } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { type ZoneHours } from "@/lib/entrenamientos/data-processor";
import { Activity } from "lucide-react";

const ZONE_META: Record<string, { label: string; color: string; cssVar: string }> = {
  Z1: { label: "Recuperación", color: "var(--chart-1)", cssVar: "--color-Z1" },
  Z2: { label: "Quema grasa", color: "var(--chart-3)", cssVar: "--color-Z2" },
  Z3: { label: "Aeróbico",    color: "var(--chart-4)", cssVar: "--color-Z3" },
  Z4: { label: "Umbral",      color: "var(--chart-5)", cssVar: "--color-Z4" },
  Z5: { label: "Máximo",      color: "var(--chart-2)", cssVar: "--color-Z5" },
};

const chartConfig = {
  horas: { label: "Horas" },
  Z1: { label: "Z1 Recuperación", color: "var(--chart-1)" },
  Z2: { label: "Z2 Quema grasa",  color: "var(--chart-3)" },
  Z3: { label: "Z3 Aeróbico",     color: "var(--chart-4)" },
  Z4: { label: "Z4 Umbral",       color: "var(--chart-5)" },
  Z5: { label: "Z5 Máximo",       color: "var(--chart-2)" },
} satisfies ChartConfig;

function formatHours(hours: number): string {
  if (hours >= 1) return `${hours.toFixed(1)}h`;
  const mins = Math.round(hours * 60);
  return `${mins}m`;
}

function formatHoursClock(decimalHours: number): string {
  const h = Math.floor(decimalHours);
  const m = Math.round((decimalHours - h) * 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  if (m > 0) return `${m}m`;
  return "0m";
}

interface TrainingZonesDonutChartProps {
  zoneData: ZoneHours[];
  totalDurationSeconds: number;
}

export function TrainingZonesDonutChart({ zoneData, totalDurationSeconds }: TrainingZonesDonutChartProps) {
  const chartData = React.useMemo(
    () =>
      zoneData
        .filter((z) => z.hours > 0)
        .map((z) => ({
          zone: z.label,
          horas: z.hours,
          fill: `var(--color-${z.label})`,
        })),
    [zoneData]
  );

  const totalHours = totalDurationSeconds / 3600;
  const activeHours = zoneData
    .filter((z) => z.zone >= 2)
    .reduce((sum, z) => sum + z.hours, 0);
  const totalZoneHours = zoneData.reduce((sum, z) => sum + z.hours, 0);

  if (chartData.length === 0) {
    return (
      <Card className="flex h-full flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4" />
            Zonas de Entrenamiento
          </CardTitle>
          <CardDescription>Distribución del tiempo por zona de FC</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 pb-0">
          <p className="py-8 text-center text-sm text-muted-foreground">
            Sin datos de frecuencia cardíaca para calcular zonas.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4 text-primary" />
              Zonas de Entrenamiento
            </CardTitle>
            <CardDescription className="mt-1">Distribución por zona de FC</CardDescription>
          </div>
          <div className="text-right shrink-0">
            <div className="text-lg font-bold tabular-nums">{formatHoursClock(activeHours)}</div>
            <div className="text-[11px] text-muted-foreground">en zonas activas</div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 pb-4">
        {/* Donut */}
        <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[200px]">
          <PieChart>
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  hideLabel
                  formatter={(value, name) => [
                    formatHours(
                      typeof value === "number"
                        ? value
                        : Array.isArray(value)
                          ? Number(value[0] ?? 0)
                          : Number(value)
                    ),
                    chartConfig[name as keyof typeof chartConfig]?.label ?? name,
                  ]}
                />
              }
            />
            <Pie data={chartData} dataKey="horas" nameKey="zone" innerRadius={52} strokeWidth={4}>
              <Label
                content={({ viewBox }) => {
                  if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                    return (
                      <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                        <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-2xl font-bold">
                          {formatHoursClock(totalHours)}
                        </tspan>
                        <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 20} className="fill-muted-foreground text-xs">
                          totales
                        </tspan>
                      </text>
                    );
                  }
                }}
              />
            </Pie>
          </PieChart>
        </ChartContainer>

        {/* Leyenda custom compacta */}
        <div className="space-y-1.5">
          {zoneData.filter((z) => z.hours > 0).map((z) => {
            const meta = ZONE_META[z.label];
            const pct = totalZoneHours > 0 ? Math.round((z.hours / totalZoneHours) * 100) : 0;
            return (
              <div key={z.label} className="flex items-center gap-2">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: meta?.color ?? "var(--chart-1)" }}
                />
                <span className="text-xs text-muted-foreground flex-1">
                  {z.label} · {meta?.label}
                </span>
                <span className="text-xs font-medium tabular-nums">{formatHours(z.hours)}</span>
                <span className="text-[10px] text-muted-foreground/60 tabular-nums w-8 text-right">{pct}%</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
