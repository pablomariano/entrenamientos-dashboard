"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  TrainingData,
  processTrainingData,
  groupByMonth,
  groupDurationByMonth,
  groupTRIMPByMonth,
  getHoursByZone,
} from "@/lib/entrenamientos/data-processor";
import { fetchTrainingData, saveTrainingData } from "@/lib/entrenamientos/api";
import { StatsCards } from "@/components/entrenamientos/stats-cards";
import { MonthlySessionsChart } from "@/components/entrenamientos/charts/monthly-sessions-chart";
import { TRIMPEvolutionChart } from "@/components/entrenamientos/charts/trimp-evolution-chart";
import { HRChart } from "@/components/entrenamientos/charts/hr-chart";
import { DurationChart } from "@/components/entrenamientos/charts/duration-chart";
import { TrainingZonesDonutChart } from "@/components/entrenamientos/charts/training-zones-donut-chart";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";

export function DashboardContent() {
  const router = useRouter();
  const [data, setData] = useState<TrainingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchTrainingData()
      .then((parsedData) => {
        if (!parsedData) {
          router.push("/entrenamientos");
          return;
        }
        setData(parsedData);
      })
      .catch((error) => {
        console.error("Error loading data:", error);
        router.push("/entrenamientos");
      })
      .finally(() => setLoading(false));
  }, [router]);

  async function handleSave() {
    if (!data) return;
    setSaving(true);
    try {
      await saveTrainingData(data);
    } catch (error) {
      console.error("Error saving:", error);
    } finally {
      setSaving(false);
    }
  }

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
      <div className="flex justify-end px-4 lg:px-6">
        <Button
          variant="outline"
          size="sm"
          onClick={handleSave}
          disabled={saving}
        >
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Guardando..." : "Guardar cambios"}
        </Button>
      </div>
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
