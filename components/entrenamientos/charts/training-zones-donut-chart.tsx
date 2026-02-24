"use client";

import * as React from "react";
import { Label, Pie, PieChart } from "recharts";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { getHoursByZone, type ZoneHours } from "@/lib/entrenamientos/data-processor";
import { Activity } from "lucide-react";

const ZONE_LEGEND = [
  { key: "Z1", label: "Z1 Recuperación", color: "hsl(var(--chart-3))" },
  { key: "Z2", label: "Z2 Quema grasa", color: "hsl(var(--chart-2))" },
  { key: "Z3", label: "Z3 Aeróbico", color: "hsl(var(--chart-4))" },
  { key: "Z4", label: "Z4 Umbral", color: "hsl(var(--chart-5))" },
  { key: "Z5", label: "Z5 Máximo", color: "hsl(var(--chart-1))" },
  { key: "SinFC", label: "Sin FC", color: "hsl(var(--muted-foreground))" },
] as const;

const chartConfig = {
  horas: { label: "Horas" },
  Z1: { label: ZONE_LEGEND[0].label, color: "var(--chart-3)" },
  Z2: { label: ZONE_LEGEND[1].label, color: "var(--chart-2)" },
  Z3: { label: ZONE_LEGEND[2].label, color: "var(--chart-4)" },
  Z4: { label: ZONE_LEGEND[3].label, color: "var(--chart-5)" },
  Z5: { label: ZONE_LEGEND[4].label, color: "var(--chart-1)" },
  SinFC: { label: "Sin FC", color: "hsl(var(--muted-foreground))" },
} satisfies ChartConfig;

function formatHours(hours: number): string {
  if (hours >= 1) return `${hours.toFixed(1)}h`;
  const mins = Math.round(hours * 60);
  return `${mins}m`;
}

function formatHoursClock(decimalHours: number): string {
  const h = Math.floor(decimalHours);
  const m = Math.round((decimalHours - h) * 60);
  if (h > 0 && m > 0) return `${h}′ ${m}″`;
  if (h > 0) return `${h}′`;
  if (m > 0) return `${m}″`;
  return "0″";
}

interface TrainingZonesDonutChartProps {
  zoneData: ZoneHours[];
  totalDurationSeconds: number;
}

export function TrainingZonesDonutChart({ zoneData, totalDurationSeconds }: TrainingZonesDonutChartProps) {
  const chartData = React.useMemo(() => {
    const zonesWithTime = zoneData
      .filter((z) => z.hours > 0)
      .map((z) => ({
        zone: z.label,
        horas: z.hours,
        fill: `var(--color-${z.label})`,
      }));
    const zoneTotalHours = zonesWithTime.reduce((acc, curr) => acc + curr.horas, 0);
    const totalHours = totalDurationSeconds / 3600;
    const sinFCHours = Math.round((totalHours - zoneTotalHours) * 100) / 100;
    if (sinFCHours > 0.01) {
      zonesWithTime.push({
        zone: "SinFC",
        horas: sinFCHours,
        fill: "var(--color-SinFC)",
      });
    }
    return zonesWithTime;
  }, [zoneData, totalDurationSeconds]);

  const totalHours = totalDurationSeconds / 3600;

  if (chartData.length === 0) {
    return (
      <Card className="flex h-full flex-col">
        <CardHeader className="items-center pb-0">
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
      <CardHeader className="items-center pb-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4" />
          Zonas de Entrenamiento
        </CardTitle>
        <CardDescription>Distribución del tiempo por zona de FC</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[300px]">
          <PieChart>
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  hideLabel
                  formatter={(value: number, name: string) => [
                    formatHours(value),
                    (chartConfig as Record<string, { label?: string }>)[name]?.label ?? name,
                  ]}
                />
              }
            />
            <Pie
              data={chartData}
              dataKey="horas"
              nameKey="zone"
              innerRadius={60}
              strokeWidth={5}
            >
              <Label
                content={({ viewBox }) => {
                  if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                    return (
                      <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                        <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-3xl font-bold">
                          {formatHoursClock(totalHours)}
                        </tspan>
                        <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 24} className="fill-muted-foreground text-sm">
                          Horas totales
                        </tspan>
                      </text>
                    );
                  }
                }}
              />
            </Pie>
          </PieChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm">
        {ZONE_LEGEND.filter((z) => chartData.some((d) => d.zone === z.key)).map((z) => (
          <span key={z.key} className="flex items-center gap-1.5 text-muted-foreground">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: z.color }}
            />
            {z.label}
          </span>
        ))}
      </CardFooter>
    </Card>
  );
}
