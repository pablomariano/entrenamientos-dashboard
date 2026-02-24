"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { TrainingData, TrainingSession } from "@/lib/entrenamientos/data-processor";
import { fetchTrainingData, saveTrainingData } from "@/lib/entrenamientos/api";
import { SessionsList } from "@/components/entrenamientos/sessions-list";
import { HRSessionChart } from "@/components/entrenamientos/charts/hr-session-chart";
import { ExerciseMinutes } from "@/components/entrenamientos/charts/exercise-minutes";
import { HREvolutionChart } from "@/components/entrenamientos/charts/hr-evolution-chart";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";

export function SesionesContent() {
  const router = useRouter();
  const [data, setData] = useState<TrainingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedSession, setSelectedSession] = useState<TrainingSession | null>(null);
  const hrChartRef = useRef<HTMLDivElement>(null);

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

  function handleSelectSession(session: TrainingSession) {
    if (!session.has_hr || !session.hr_samples || session.hr_samples.length === 0) return;
    if (selectedSession?.start_time === session.start_time) {
      setSelectedSession(null);
      return;
    }
    setSelectedSession(session);
    setTimeout(() => {
      hrChartRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <div className="text-lg text-muted-foreground">Cargando sesiones...</div>
      </div>
    );
  }

  if (!data) return null;

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
      <div className="px-4 lg:px-6">
        <SessionsList
          sessions={data.sessions}
          selectedSession={selectedSession}
          onSelectSession={handleSelectSession}
        />
      </div>
      {selectedSession && (
        <div ref={hrChartRef} className="space-y-4 px-4 lg:px-6">
          <HRSessionChart session={selectedSession} />
          <ExerciseMinutes session={selectedSession} />
          <HREvolutionChart session={selectedSession} onClose={() => setSelectedSession(null)} />
        </div>
      )}
    </div>
  );
}
