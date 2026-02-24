"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { MonthlyStats } from "@/lib/entrenamientos/data-processor";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";

const MONTH_NAMES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

const chartConfig = {
  trimp: { label: "TRIMP acumulado", color: "var(--chart-3)" },
} satisfies ChartConfig;

interface TRIMPEvolutionChartProps {
  data: MonthlyStats;
}

export function TRIMPEvolutionChart({ data }: TRIMPEvolutionChartProps) {
  const chartData = Object.entries(data)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, trimp]) => ({
      month,
      monthLabel: (() => {
        const [year, m] = month.split("-");
        return `${MONTH_NAMES[parseInt(m) - 1]} ${year.slice(2)}`;
      })(),
      trimp: Math.round(trimp),
    }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Evolución TRIMP</CardTitle>
        <CardDescription>Carga de entrenamiento (Training Impulse) por mes</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
          <AreaChart data={chartData} margin={{ top: 0 }}>
            <defs>
              <linearGradient id="fillTrimp" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-trimp)" stopOpacity={1.0} />
                <stop offset="95%" stopColor="var(--color-trimp)" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="monthLabel"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(_, payload) => {
                    const item = payload?.[0]?.payload;
                    if (item?.month) {
                      const [year, m] = item.month.split("-");
                      return `${MONTH_NAMES[parseInt(m) - 1]} ${year}`;
                    }
                    return "";
                  }}
                />
              }
            />
            <Area
              type="monotone"
              dataKey="trimp"
              fill="url(#fillTrimp)"
              stroke="var(--color-trimp)"
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
