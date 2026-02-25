"use client";

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

export function DashboardContent() {
  const { data, loading } = useTrainingData();

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <div className="text-muted-foreground text-lg">Cargando dashboard...</div>
      </div>
    );
  }

  if (!data) return null;

  const stats = processTrainingData(data);
  const monthlyData = groupByMonth(data.sessions);
  const durationByMonth = groupDurationByMonth(data.sessions);
  const trimpByMonth = groupTRIMPByMonth(data.sessions);
  const zoneHours = getHoursByZone(data.sessions);

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <StatsCards stats={stats} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 px-4 lg:px-6">
        <MonthlySessionsChart data={monthlyData} />
        <TRIMPEvolutionChart data={trimpByMonth} />
      </div>
      <div className="grid grid-cols-1 gap-4 px-4 lg:grid-cols-3 lg:px-6">
        <HRChart sessions={data.sessions} />
        <DurationChart data={durationByMonth} />
        <TrainingZonesDonutChart
          zoneData={zoneHours}
          totalDurationSeconds={stats.totalDuration}
        />
      </div>
    </div>
  );
}
