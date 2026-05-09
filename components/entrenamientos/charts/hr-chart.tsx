"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { TrainingSession } from "@/lib/entrenamientos/data-processor";
import { Line, LineChart, XAxis, CartesianGrid, ReferenceLine } from "recharts";

const chartConfig = {
  hr: { label: "FC Promedio (bpm)", color: "var(--chart-1)" },
} satisfies ChartConfig;

interface HRChartProps {
  sessions: TrainingSession[];
}

export function HRChart({ sessions }: HRChartProps) {
  const sorted = sessions
    .filter((s) => s.hr_avg !== null && s.hr_avg !== undefined)
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
    .slice(-20);

  const hrData = sorted.map((s) => ({
    fecha: new Date(s.start_time).toLocaleDateString("es-ES", { month: "short", day: "numeric" }),
    hr: s.hr_avg,
    fullDate: new Date(s.start_time),
  }));

  const avgHR = hrData.length > 0
    ? Math.round(hrData.reduce((sum, d) => sum + (d.hr ?? 0), 0) / hrData.length)
    : 0;

  const lastHR = hrData[hrData.length - 1]?.hr ?? 0;
  const prevHR = hrData[hrData.length - 2]?.hr ?? 0;
  const delta = prevHR > 0 ? Math.round(lastHR - prevHR) : null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>FC Promedio</CardTitle>
            <CardDescription className="mt-1">Últimas 20 sesiones con datos de FC</CardDescription>
          </div>
          <div className="text-right shrink-0">
            <div className="text-2xl font-bold tabular-nums">{avgHR} <span className="text-base font-normal text-muted-foreground">bpm</span></div>
            {delta !== null && (
              <div className={`mt-0.5 text-[10px] font-medium ${delta <= 0 ? "text-emerald-500" : "text-amber-500"}`}>
                {delta > 0 ? "+" : ""}{delta} bpm última sesión
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="aspect-auto h-[220px] w-full">
          <LineChart data={hrData} margin={{ top: 4 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="fecha"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{ fontSize: 11 }}
            />
            {/* Línea de referencia del promedio */}
            <ReferenceLine
              y={avgHR}
              stroke="var(--muted-foreground)"
              strokeDasharray="4 4"
              strokeOpacity={0.5}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(_, payload) => {
                    if (payload?.[0]?.payload?.fullDate) {
                      return payload[0].payload.fullDate.toLocaleDateString("es-ES", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      });
                    }
                    return "";
                  }}
                />
              }
            />
            <Line
              type="monotone"
              dataKey="hr"
              stroke="var(--color-hr)"
              strokeWidth={2}
              dot={{ fill: "var(--color-hr)", r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
