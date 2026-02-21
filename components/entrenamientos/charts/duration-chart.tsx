"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";
import { MonthlyStats } from "@/lib/entrenamientos/data-processor";

const MONTH_NAMES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

interface DurationChartProps {
  data: MonthlyStats;
}

export function DurationChart({ data }: DurationChartProps) {
  const chartData = Object.entries(data)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, seconds]) => ({ month, horas: Math.round((seconds / 3600) * 10) / 10 }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Duración Total por Mes</CardTitle>
        <CardDescription>Tiempo de entrenamiento acumulado mensualmente</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" fontSize={12} tickFormatter={(value) => {
              const [year, month] = value.split("-");
              return `${month}/${year.slice(2)}`;
            }} />
            <YAxis fontSize={12} />
            <Tooltip
              labelFormatter={(value) => {
                const [year, month] = value.split("-");
                return `${MONTH_NAMES[parseInt(month) - 1]} ${year}`;
              }}
              formatter={(value: number) => [`${value} horas`, "Duración"]}
            />
            <Area type="monotone" dataKey="horas" stroke="hsl(173 58% 39%)" fill="hsl(173 58% 39% / 0.2)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
