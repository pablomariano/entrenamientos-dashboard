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

  const lastTrimp = chartData[chartData.length - 1]?.trimp ?? 0;
  const prevTrimp = chartData[chartData.length - 2]?.trimp ?? 0;
  const delta = prevTrimp > 0 ? Math.round(((lastTrimp - prevTrimp) / prevTrimp) * 100) : null;
  const lastMonthLabel = chartData[chartData.length - 1]?.monthLabel ?? "";

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>Evolución TRIMP</CardTitle>
            <CardDescription className="mt-1">Carga mensual acumulada (Training Impulse)</CardDescription>
          </div>
          <div className="text-right shrink-0">
            <div className="text-2xl font-bold tabular-nums">{lastTrimp.toLocaleString()}</div>
            <div className="text-[11px] text-muted-foreground">{lastMonthLabel}</div>
            {delta !== null && (
              <div className={`mt-0.5 text-[10px] font-medium ${delta >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                {delta >= 0 ? "+" : ""}{delta}% vs anterior
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="aspect-auto h-[220px] w-full">
          <AreaChart data={chartData} margin={{ top: 4 }}>
            <defs>
              <linearGradient id="fillTrimp" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-trimp)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--color-trimp)" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="monthLabel"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{ fontSize: 11 }}
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
