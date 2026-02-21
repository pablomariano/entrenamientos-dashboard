"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrainingSession } from "@/lib/entrenamientos/data-processor";

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
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={hrData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="fecha" fontSize={12} />
            <YAxis fontSize={12} domain={["dataMin - 10", "dataMax + 10"]} />
            <Tooltip
              labelFormatter={(_, payload) => {
                if (payload && payload[0]) {
                  return payload[0].payload.fullDate.toLocaleDateString("es-ES", {
                    weekday: "long", year: "numeric", month: "long", day: "numeric",
                  });
                }
                return "";
              }}
              formatter={(value: number) => [`${value} bpm`, "HR Promedio"]}
            />
            <Line type="monotone" dataKey="hr" stroke="hsl(0 84.2% 60.2%)" strokeWidth={2} dot={{ fill: "hsl(0 84.2% 60.2%)" }} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
