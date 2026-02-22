"use client";

import { TrendingUp, TrendingDown } from "lucide-react";
import { Bar, BarChart, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { MonthlyStats } from "@/lib/entrenamientos/data-processor";

const MONTH_NAMES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

const chartConfig = {
  entrenamientos: { label: "Sesiones", color: "var(--chart-1)" },
} satisfies ChartConfig;

interface MonthlySessionsChartProps {
  data: MonthlyStats;
}

export function MonthlySessionsChart({ data }: MonthlySessionsChartProps) {
  const chartData = Object.entries(data)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, count], i) => ({
      month,
      monthLabel: (() => {
        const [year, m] = month.split("-");
        return `${MONTH_NAMES[parseInt(m) - 1]} ${year.slice(2)}`;
      })(),
      entrenamientos: count,
      fill: CHART_COLORS[i % CHART_COLORS.length],
    }));

  const totalSessions = chartData.reduce((sum, d) => sum + d.entrenamientos, 0);
  const lastMonth = chartData[chartData.length - 1]?.entrenamientos ?? 0;
  const prevMonth = chartData[chartData.length - 2]?.entrenamientos ?? 0;
  const trend =
    prevMonth > 0 && chartData.length > 1
      ? (((lastMonth - prevMonth) / prevMonth) * 100).toFixed(1)
      : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Entrenamientos por Mes</CardTitle>
        <CardDescription>Distribución mensual de tus sesiones</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <BarChart accessibilityLayer data={chartData} layout="vertical" margin={{ left: 0 }}>
            <YAxis
              dataKey="monthLabel"
              type="category"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
            />
            <XAxis dataKey="entrenamientos" type="number" hide />
            <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
            <Bar dataKey="entrenamientos" layout="vertical" radius={5} />
          </BarChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        {trend !== null && (
          <div className="flex gap-2 font-medium leading-none">
            {Number(trend) >= 0 ? (
              <>
                +{trend}% respecto al mes anterior <TrendingUp className="h-4 w-4" />
              </>
            ) : (
              <>
                {trend}% respecto al mes anterior <TrendingDown className="h-4 w-4" />
              </>
            )}
          </div>
        )}
        <div className="leading-none text-muted-foreground">
          {totalSessions} entrenamiento{totalSessions !== 1 ? "s" : ""} en los últimos {chartData.length} meses
        </div>
      </CardFooter>
    </Card>
  );
}
