"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { MonthlyStats } from "@/lib/entrenamientos/data-processor";

const MONTH_NAMES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

interface MonthlySessionsChartProps {
  data: MonthlyStats;
}

export function MonthlySessionsChart({ data }: MonthlySessionsChartProps) {
  const chartData = Object.entries(data)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, count]) => ({ month, entrenamientos: count }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Entrenamientos por Mes</CardTitle>
        <CardDescription>Distribución mensual de tus sesiones</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
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
            />
            <Bar dataKey="entrenamientos" fill="hsl(262 83% 58%)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
