"use client";

import { TrendingUp, TrendingDown } from "lucide-react";
import { Bar, BarChart, XAxis, YAxis, Cell } from "recharts";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { MonthlyStats } from "@/lib/entrenamientos/data-processor";

const MONTH_NAMES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

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
      isLast: false,
    }));

  // Marcar el último mes
  if (chartData.length > 0) chartData[chartData.length - 1].isLast = true;

  const totalSessions = chartData.reduce((sum, d) => sum + d.entrenamientos, 0);
  const lastMonth = chartData[chartData.length - 1]?.entrenamientos ?? 0;
  const prevMonth = chartData[chartData.length - 2]?.entrenamientos ?? 0;
  const trend =
    prevMonth > 0 && chartData.length > 1
      ? (((lastMonth - prevMonth) / prevMonth) * 100).toFixed(1)
      : null;

  const trendPositive = trend !== null && Number(trend) >= 0;
  const lastMonthLabel = chartData[chartData.length - 1]?.monthLabel ?? "";

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>Entrenamientos por Mes</CardTitle>
            <CardDescription className="mt-1">Distribución mensual de tus sesiones</CardDescription>
          </div>
          {/* KPI del mes actual */}
          <div className="text-right shrink-0">
            <div className="text-2xl font-bold tabular-nums">{lastMonth}</div>
            <div className="text-[11px] text-muted-foreground">{lastMonthLabel}</div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <BarChart accessibilityLayer data={chartData} margin={{ top: 4 }}>
            <XAxis
              dataKey="monthLabel"
              type="category"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tick={{ fontSize: 11 }}
            />
            <YAxis dataKey="entrenamientos" type="number" hide />
            <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
            <Bar dataKey="entrenamientos" radius={5}>
              {chartData.map((entry, i) => (
                <Cell
                  key={i}
                  fill={entry.isLast ? "var(--chart-1)" : "var(--chart-1)"}
                  opacity={entry.isLast ? 1 : 0.5}
                />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex items-center justify-between gap-4 text-sm pt-0">
        {trend !== null ? (
          <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
            trendPositive
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "bg-red-500/10 text-red-600 dark:text-red-400"
          }`}>
            {trendPositive
              ? <TrendingUp className="h-3.5 w-3.5" />
              : <TrendingDown className="h-3.5 w-3.5" />}
            {trendPositive ? "+" : ""}{trend}% vs mes anterior
          </div>
        ) : <div />}
        <div className="text-xs text-muted-foreground">
          {totalSessions} sesiones · {chartData.length} meses
        </div>
      </CardFooter>
    </Card>
  );
}
