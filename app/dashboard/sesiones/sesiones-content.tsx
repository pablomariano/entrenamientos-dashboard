"use client";

import { useRef, useState } from "react";
import { TrainingSession } from "@/lib/entrenamientos/data-processor";
import { useTrainingData } from "@/lib/entrenamientos/training-data-context";
import { SessionsList } from "@/components/entrenamientos/sessions-list";
import { HRSessionChart } from "@/components/entrenamientos/charts/hr-session-chart";
import { ExerciseMinutes } from "@/components/entrenamientos/charts/exercise-minutes";
import { HREvolutionChart } from "@/components/entrenamientos/charts/hr-evolution-chart";

export function SesionesContent() {
  const { data, loading } = useTrainingData();
  const [selectedSession, setSelectedSession] = useState<TrainingSession | null>(null);
  const hrChartRef = useRef<HTMLDivElement>(null);

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
