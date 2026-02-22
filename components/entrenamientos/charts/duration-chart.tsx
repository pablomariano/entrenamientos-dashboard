"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { MonthlyStats } from "@/lib/entrenamientos/data-processor";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";

const MONTH_NAMES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

const chartConfig = {
  horas: { label: "Duración (horas)", color: "var(--chart-2)" },
} satisfies ChartConfig;

interface DurationChartProps {
  data: MonthlyStats;
}

export function DurationChart({ data }: DurationChartProps) {
  const chartData = Object.entries(data)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, seconds]) => ({
      month,
      monthLabel: (() => {
        const [year, m] = month.split("-");
        return `${MONTH_NAMES[parseInt(m) - 1]} ${year.slice(2)}`;
      })(),
      horas: Math.round((seconds / 3600) * 10) / 10,
    }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Duración Total por Mes</CardTitle>
        <CardDescription>Tiempo de entrenamiento acumulado mensualmente</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
          <AreaChart data={chartData} margin={{ top: 0 }}>
            <defs>
              <linearGradient id="fillHoras" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-horas)" stopOpacity={1.0} />
                <stop offset="95%" stopColor="var(--color-horas)" stopOpacity={0.1} />
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
              dataKey="horas"
              fill="url(#fillHoras)"
              stroke="var(--color-horas)"
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
