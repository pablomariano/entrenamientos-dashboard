"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { useTrainingData } from "@/lib/entrenamientos/training-data-context";
import { processTrainingData, type TrainingSession, type HRSample } from "@/lib/entrenamientos/data-processor";
import {
  HeartPulse,
  BarChart3,
  TrendingUp,
  Activity,
  Clock,
  Heart,
  Flame,
} from "lucide-react";

// --- Helpers ---

function computeSessionTRIMP(s: TrainingSession, hrRest: number, hrMax: number): number {
  const hrAvg = s.hr_avg ?? 0;
  if (hrAvg <= hrRest || hrMax <= hrRest) return 0;
  const effectiveMax = Math.max(s.hr_max ?? hrMax, hrMax);
  const deltaHR = Math.max(0, Math.min(1, (hrAvg - hrRest) / (effectiveMax - hrRest)));
  const durationMin = (s.duration_seconds ?? 0) / 60;
  return durationMin * deltaHR * 0.64 * Math.exp(1.92 * deltaHR);
}

function computeDrift(samples: HRSample[], totalDuration: number) {
  const valid = samples.filter((s) => s.hr >= 40 && s.hr <= 250).sort((a, b) => a.time_seconds - b.time_seconds);
  if (valid.length < 30 || totalDuration < 1200) return null;
  const ssStart = totalDuration * 0.2;
  const ssEnd = totalDuration * 0.8;
  const ss = valid.filter((s) => s.time_seconds >= ssStart && s.time_seconds <= ssEnd);
  if (ss.length < 20) return null;
  const mid = ssStart + (ssEnd - ssStart) / 2;
  const first = ss.filter((s) => s.time_seconds < mid);
  const second = ss.filter((s) => s.time_seconds >= mid);
  if (first.length < 5 || second.length < 5) return null;
  const avg = (arr: HRSample[]) => Math.round(arr.reduce((a, v) => a + v.hr, 0) / arr.length);
  const hrStart = avg(first);
  const hrEnd = avg(second);
  return { hrStart, hrEnd, driftPercent: Math.round(((hrEnd - hrStart) / hrStart) * 1000) / 10 };
}

function getWeekKey(date: Date): string {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  d.setUTCDate(diff);
  return d.toISOString().slice(0, 10);
}

// --- Chart Configs ---

const trimpChartConfig = {
  trimp: { label: "TRIMP", color: "var(--chart-1)" },
} satisfies ChartConfig;

const driftChartConfig = {
  drift: { label: "Deriva %", color: "var(--chart-5)" },
} satisfies ChartConfig;

const weeklyLoadConfig = {
  load: { label: "Carga Semanal", color: "var(--chart-4)" },
} satisfies ChartConfig;

const hrTrendConfig = {
  hrAvg: { label: "FC Prom", color: "var(--chart-2)" },
  hrMax: { label: "FC Máx", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function AnalisisContent() {
  const { data, loading } = useTrainingData();

  const analysis = useMemo(() => {
    if (!data) return null;
    const stats = processTrainingData(data);
    const hrRest = stats.minHR > 0 ? stats.minHR : 60;
    const hrMax = stats.maxHR > 0 ? stats.maxHR : 190;

    const sessionsWithHR = data.sessions
      .filter((s) => s.has_hr && s.hr_avg)
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

    // TRIMP per session
    const trimpData = sessionsWithHR.map((s) => {
      const d = new Date(s.start_time);
      return {
        date: d.toLocaleDateString("es-ES", { day: "2-digit", month: "short", timeZone: "UTC" }),
        trimp: Math.round(computeSessionTRIMP(s, hrRest, hrMax)),
        sport: s.sport ?? "?",
      };
    });

    // Cardiac drift per session (only sessions with samples)
    const driftData = sessionsWithHR
      .filter((s) => (s.hr_samples?.length ?? 0) >= 30 && s.duration_seconds >= 1200)
      .map((s) => {
        const drift = computeDrift(s.hr_samples!, s.duration_seconds);
        if (!drift) return null;
        const d = new Date(s.start_time);
        return {
          date: d.toLocaleDateString("es-ES", { day: "2-digit", month: "short", timeZone: "UTC" }),
          drift: drift.driftPercent,
          sport: s.sport ?? "?",
        };
      })
      .filter(Boolean) as Array<{ date: string; drift: number; sport: string }>;

    // Weekly training load (TRIMP)
    const weeklyMap: Record<string, number> = {};
    for (const s of sessionsWithHR) {
      const weekKey = getWeekKey(new Date(s.start_time));
      weeklyMap[weekKey] = (weeklyMap[weekKey] ?? 0) + computeSessionTRIMP(s, hrRest, hrMax);
    }
    const weeklyData = Object.entries(weeklyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, load]) => ({
        week: new Date(week).toLocaleDateString("es-ES", { day: "2-digit", month: "short", timeZone: "UTC" }),
        load: Math.round(load),
      }));

    // HR trends
    const hrTrend = sessionsWithHR.map((s) => {
      const d = new Date(s.start_time);
      return {
        date: d.toLocaleDateString("es-ES", { day: "2-digit", month: "short", timeZone: "UTC" }),
        hrAvg: s.hr_avg ?? 0,
        hrMax: s.hr_max ?? 0,
      };
    });

    // Summary cards data
    const last4WeeksTrimp = sessionsWithHR
      .filter((s) => new Date(s.start_time).getTime() > Date.now() - 28 * 86400000)
      .reduce((sum, s) => sum + computeSessionTRIMP(s, hrRest, hrMax), 0);

    const prev4WeeksTrimp = sessionsWithHR
      .filter((s) => {
        const t = new Date(s.start_time).getTime();
        return t > Date.now() - 56 * 86400000 && t <= Date.now() - 28 * 86400000;
      })
      .reduce((sum, s) => sum + computeSessionTRIMP(s, hrRest, hrMax), 0);

    const trimpChange = prev4WeeksTrimp > 0 ? ((last4WeeksTrimp - prev4WeeksTrimp) / prev4WeeksTrimp) * 100 : 0;

    const avgDrift = driftData.length > 0 ? driftData.reduce((a, d) => a + d.drift, 0) / driftData.length : null;

    return {
      stats,
      trimpData,
      driftData,
      weeklyData,
      hrTrend,
      last4WeeksTrimp: Math.round(last4WeeksTrimp),
      trimpChange: Math.round(trimpChange),
      avgDrift: avgDrift !== null ? Math.round(avgDrift * 10) / 10 : null,
      totalSessions: sessionsWithHR.length,
    };
  }, [data]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <div className="text-lg text-muted-foreground">Cargando análisis...</div>
      </div>
    );
  }

  if (!analysis) return null;

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="px-4 lg:px-6">
        <h2 className="text-2xl font-bold tracking-tight">Análisis</h2>
        <p className="text-sm text-muted-foreground">
          Evolución de rendimiento, carga de entrenamiento y deriva cardíaca
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 px-4 lg:px-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Carga 4 semanas</CardTitle>
            <Flame className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analysis.last4WeeksTrimp}</div>
            <p className="text-xs text-muted-foreground">
              {analysis.trimpChange > 0 ? "+" : ""}{analysis.trimpChange}% vs periodo anterior
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Deriva promedio</CardTitle>
            <HeartPulse className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analysis.avgDrift !== null ? `${analysis.avgDrift > 0 ? "+" : ""}${analysis.avgDrift}%` : "—"}
            </div>
            <p className="text-xs text-muted-foreground">en sesiones con suficientes datos</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">FC Promedio</CardTitle>
            <Heart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(analysis.stats.avgHR)} bpm</div>
            <p className="text-xs text-muted-foreground">
              Máx histórico: {analysis.stats.maxHR} bpm
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sesiones analizadas</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analysis.totalSessions}</div>
            <p className="text-xs text-muted-foreground">con datos de frecuencia cardíaca</p>
          </CardContent>
        </Card>
      </div>

      {/* TRIMP Evolution */}
      <div className="grid grid-cols-1 gap-4 px-4 lg:grid-cols-2 lg:px-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4 text-primary" />
              TRIMP por sesión
            </CardTitle>
            <CardDescription>Carga de entrenamiento individual</CardDescription>
          </CardHeader>
          <CardContent>
            {analysis.trimpData.length > 0 ? (
              <ChartContainer config={trimpChartConfig} className="h-[250px] w-full">
                <BarChart data={analysis.trimpData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} fontSize={10} />
                  <YAxis fontSize={10} tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="trimp" radius={[4, 4, 0, 0]} fill="var(--color-trimp)" />
                </BarChart>
              </ChartContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Sin datos suficientes</p>
            )}
          </CardContent>
        </Card>

        {/* Weekly Load */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-primary" />
              Carga semanal
            </CardTitle>
            <CardDescription>TRIMP acumulado por semana</CardDescription>
          </CardHeader>
          <CardContent>
            {analysis.weeklyData.length > 0 ? (
              <ChartContainer config={weeklyLoadConfig} className="h-[250px] w-full">
                <AreaChart data={analysis.weeklyData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="week" tickLine={false} axisLine={false} tickMargin={8} fontSize={10} />
                  <YAxis fontSize={10} tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area
                    type="monotone"
                    dataKey="load"
                    fill="var(--color-load)"
                    fillOpacity={0.1}
                    stroke="var(--color-load)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ChartContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Sin datos suficientes</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Drift + HR trends */}
      <div className="grid grid-cols-1 gap-4 px-4 lg:grid-cols-2 lg:px-6">
        {/* Cardiac Drift Evolution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <HeartPulse className="h-4 w-4 text-primary" />
              Evolución de deriva cardíaca
            </CardTitle>
            <CardDescription>
              Tendencia de la deriva en sesiones con datos suficientes
            </CardDescription>
          </CardHeader>
          <CardContent>
            {analysis.driftData.length > 0 ? (
              <ChartContainer config={driftChartConfig} className="h-[250px] w-full">
                <LineChart data={analysis.driftData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} fontSize={10} />
                  <YAxis fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line
                    type="monotone"
                    dataKey="drift"
                    stroke="var(--color-drift)"
                    strokeWidth={2}
                    dot={{ fill: "var(--color-drift)", r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ChartContainer>
            ) : (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <HeartPulse className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  No hay suficientes sesiones con datos de FC para calcular la deriva cardíaca.
                  Se necesitan sesiones de al menos 20 minutos con muestras de FC.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* HR Trends */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Heart className="h-4 w-4 text-primary" />
              Tendencia de frecuencia cardíaca
            </CardTitle>
            <CardDescription>FC promedio y máxima por sesión</CardDescription>
          </CardHeader>
          <CardContent>
            {analysis.hrTrend.length > 0 ? (
              <ChartContainer config={hrTrendConfig} className="h-[250px] w-full">
                <LineChart data={analysis.hrTrend} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} fontSize={10} />
                  <YAxis fontSize={10} tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line
                    type="monotone"
                    dataKey="hrAvg"
                    stroke="var(--color-hrAvg)"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="hrMax"
                    stroke="var(--color-hrMax)"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    dot={false}
                  />
                </LineChart>
              </ChartContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Sin datos suficientes</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
