"use client";

import * as React from "react";
import {
  processTrainingData,
  groupByMonth,
  groupDurationByMonth,
  groupTRIMPByMonth,
  getHoursByZone,
} from "@/lib/entrenamientos/data-processor";
import { useTrainingData } from "@/lib/entrenamientos/training-data-context";
import { StatsCards } from "@/components/entrenamientos/stats-cards";
import { MonthlySessionsChart } from "@/components/entrenamientos/charts/monthly-sessions-chart";
import { TRIMPEvolutionChart } from "@/components/entrenamientos/charts/trimp-evolution-chart";
import { HRChart } from "@/components/entrenamientos/charts/hr-chart";
import { DurationChart } from "@/components/entrenamientos/charts/duration-chart";
import { TrainingZonesDonutChart } from "@/components/entrenamientos/charts/training-zones-donut-chart";
import { DateRangePicker, type DateRangeFilter } from "@/components/entrenamientos/date-range-picker";
import { differenceInDays, startOfYear, endOfDay } from "date-fns";
import { CalendarOff } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DashboardContent() {
  const { data, loading } = useTrainingData();
  const [dateRange, setDateRange] = React.useState<DateRangeFilter | undefined>(() => ({
    from: startOfYear(new Date()),
    to: endOfDay(new Date()),
  }));

  // Filtrar las sesiones del usuario de acuerdo al rango seleccionado
  const filteredSessions = React.useMemo(() => {
    if (!data?.sessions) return [];
    if (!dateRange || (!dateRange.from && !dateRange.to)) return data.sessions;

    const fromTime = dateRange.from ? dateRange.from.getTime() : -Infinity;
    const toTime = dateRange.to ? dateRange.to.getTime() : Infinity;

    return data.sessions.filter((session) => {
      const sessionTime = new Date(session.start_time).getTime();
      return sessionTime >= fromTime && sessionTime <= toTime;
    });
  }, [data?.sessions, dateRange]);

  // Construir la estructura filtrada que esperan los procesadores
  const filteredData = React.useMemo(() => {
    if (!data) return null;
    return {
      ...data,
      sessions: filteredSessions,
      total_sessions: filteredSessions.length,
    };
  }, [data, filteredSessions]);

  // Calcular las semanas del rango seleccionado de forma dinámica
  const weeksCount = React.useMemo(() => {
    if (dateRange?.from && dateRange?.to) {
      const diffDays = differenceInDays(dateRange.to, dateRange.from);
      return Math.max(1, diffDays / 7);
    }
    
    // Si no hay un rango explícito (Todo el tiempo), calculamos el rango
    // basándonos en la sesión más vieja y más nueva de las disponibles.
    if (filteredSessions && filteredSessions.length > 1) {
      const sorted = [...filteredSessions].sort(
        (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      );
      const first = new Date(sorted[0].start_time);
      const last = new Date(sorted[sorted.length - 1].start_time);
      const diffDays = differenceInDays(last, first);
      return Math.max(1, diffDays / 7);
    }
    
    return 17; // fallback histórico
  }, [dateRange, filteredSessions]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <div className="text-muted-foreground text-lg">Cargando dashboard...</div>
      </div>
    );
  }

  if (!data) return null;

  const stats = filteredData ? processTrainingData(filteredData) : null;
  const monthlyData = groupByMonth(filteredSessions);
  const durationByMonth = groupDurationByMonth(filteredSessions);
  const trimpByMonth = groupTRIMPByMonth(filteredSessions);
  const zoneHours = getHoursByZone(filteredSessions);

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      {/* Cabecera del Dashboard con Filtro de Fechas */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-4 lg:px-6 border-b pb-4 border-border/40">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard de Rendimiento</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Visualiza tus estadísticas de entrenamiento y progresión física.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DateRangePicker date={dateRange} onDateChange={setDateRange} />
        </div>
      </div>

      {filteredSessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
          <div className="bg-muted flex h-16 w-16 items-center justify-center rounded-full mb-4">
            <CalendarOff className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold tracking-tight">No se encontraron entrenamientos</h3>
          <p className="text-muted-foreground text-sm max-w-sm mt-1 mb-6">
            No tienes entrenamientos registrados en el rango de fechas seleccionado. Intenta con un rango diferente.
          </p>
          <Button onClick={() => setDateRange(undefined)} variant="outline" size="sm">
            Restablecer filtro
          </Button>
        </div>
      ) : (
        <>
          {stats && <StatsCards stats={stats} weeks={weeksCount} />}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 px-4 lg:px-6">
            <MonthlySessionsChart data={monthlyData} />
            <TRIMPEvolutionChart data={trimpByMonth} />
          </div>
          <div className="grid grid-cols-1 gap-4 px-4 lg:grid-cols-3 lg:px-6">
            <HRChart sessions={filteredSessions} />
            <DurationChart data={durationByMonth} />
            {stats && (
              <TrainingZonesDonutChart
                zoneData={zoneHours}
                totalDurationSeconds={stats.totalDuration}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
