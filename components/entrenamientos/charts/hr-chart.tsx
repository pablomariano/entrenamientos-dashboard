"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { TrainingSession } from "@/lib/entrenamientos/data-processor";
import { Line, LineChart, XAxis, CartesianGrid } from "recharts";

const chartConfig = {
  hr: { label: "HR Promedio (bpm)", color: "var(--chart-1)" },
} satisfies ChartConfig;

interface HRChartProps {
  sessions: TrainingSession[];
}

export function HRChart({ sessions }: HRChartProps) {
  const hrData = sessions
    .filter((s) => s.hr_avg !== null && s.hr_avg !== undefined)
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
    .slice(-20)
    .map((s) => ({
      fecha: new Date(s.start_time).toLocaleDateString("es-ES", { month: "short", day: "numeric" }),
      hr: s.hr_avg,
      fullDate: new Date(s.start_time),
    }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Frecuencia Cardíaca Promedio</CardTitle>
        <CardDescription>Últimos 20 entrenamientos con datos de HR</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
          <LineChart data={hrData} margin={{ top: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="fecha"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
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
              dot={{ fill: "var(--color-hr)" }}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
