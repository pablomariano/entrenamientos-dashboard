"use client";

import * as React from "react";
import { Label, Pie, PieChart } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { getHoursByZone, type ZoneHours } from "@/lib/entrenamientos/data-processor";
import { Activity } from "lucide-react";

const chartConfig = {
  horas: { label: "Horas" },
  Z1: { label: "Z1 Recuperación", color: "var(--chart-1)" },
  Z2: { label: "Z2 Quema grasa", color: "var(--chart-2)" },
  Z3: { label: "Z3 Aeróbico", color: "var(--chart-3)" },
  Z4: { label: "Z4 Umbral", color: "var(--chart-4)" },
  Z5: { label: "Z5 Máximo", color: "var(--chart-5)" },
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
            <Pie data={chartData} dataKey="horas" nameKey="zone" innerRadius={60} strokeWidth={5}>
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
            <ChartLegend
              content={<ChartLegendContent nameKey="zone" />}
              className="-translate-y-2 flex flex-wrap justify-center gap-2 *:basis-1/4 *:justify-center"
            />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
